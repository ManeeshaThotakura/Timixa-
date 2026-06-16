package com.timixa.backend.task;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timixa.backend.auth.dto.RegisterRequest;
import com.timixa.backend.task.dto.PlannedTaskExceptionRequest;
import com.timixa.backend.task.dto.PlannedTaskRequest;
import com.timixa.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class PlannedTaskExceptionControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired PlannedTaskRepository tasks;
    @Autowired PlannedTaskExceptionRepository exceptions;
    @Autowired PlannedTaskCompletionRepository completions;

    private String token;

    @BeforeEach
    void clean() throws Exception {
        exceptions.deleteAll();
        completions.deleteAll();
        tasks.deleteAll();
        users.deleteAll();
        token = registerAndGetToken("a@b.com", "password123");
    }

    private String registerAndGetToken(String email, String pw) throws Exception {
        String resp = mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new RegisterRequest(email, pw, "Alex"))))
            .andReturn().getResponse().getContentAsString();
        return json.readTree(resp).get("token").asText();
    }

    private String createWeekly(Set<DayOfWeek> weekdays) throws Exception {
        String body = mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskRequest(
                    "Weekly", null, null, Cadence.WEEKLY, true,
                    "09:00", "10:00", null, weekdays, null,
                    null, null, null, null))))
            .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asText();
    }

    private LocalDate mostRecent(DayOfWeek dow) {
        LocalDate d = LocalDate.now();
        while (d.getDayOfWeek() != dow) d = d.minusDays(1);
        return d;
    }

    @Test
    void post_201_for_add_on_uncovered_date() throws Exception {
        String id = createWeekly(Set.of(DayOfWeek.MONDAY));
        LocalDate tue = mostRecent(DayOfWeek.TUESDAY);
        mvc.perform(post("/api/planned-tasks/" + id + "/exceptions")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskExceptionRequest(tue, ExceptionType.ADD))))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.exceptions[0].date").value(tue.toString()))
           .andExpect(jsonPath("$.exceptions[0].type").value("ADD"));
    }

    @Test
    void post_400_for_add_on_covered_date() throws Exception {
        String id = createWeekly(Set.of(DayOfWeek.MONDAY));
        LocalDate mon = mostRecent(DayOfWeek.MONDAY);
        mvc.perform(post("/api/planned-tasks/" + id + "/exceptions")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskExceptionRequest(mon, ExceptionType.ADD))))
           .andExpect(status().isBadRequest())
           .andExpect(jsonPath("$.code").value("EXCEPTION_NOT_ALLOWED"));
    }

    @Test
    void post_409_on_duplicate() throws Exception {
        String id = createWeekly(Set.of(DayOfWeek.MONDAY));
        LocalDate tue = mostRecent(DayOfWeek.TUESDAY);
        mvc.perform(post("/api/planned-tasks/" + id + "/exceptions")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskExceptionRequest(tue, ExceptionType.ADD))));
        mvc.perform(post("/api/planned-tasks/" + id + "/exceptions")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskExceptionRequest(tue, ExceptionType.ADD))))
           .andExpect(status().isConflict())
           .andExpect(jsonPath("$.code").value("EXCEPTION_ALREADY_EXISTS"));
    }

    @Test
    void delete_204_then_subsequent_get_clean() throws Exception {
        String id = createWeekly(Set.of(DayOfWeek.MONDAY));
        LocalDate tue = mostRecent(DayOfWeek.TUESDAY);
        mvc.perform(post("/api/planned-tasks/" + id + "/exceptions")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskExceptionRequest(tue, ExceptionType.ADD))));
        mvc.perform(delete("/api/planned-tasks/" + id + "/exceptions/" + tue)
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isNoContent());
        mvc.perform(get("/api/planned-tasks?date=" + tue)
                .header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$.length()").value(0));
    }
}
