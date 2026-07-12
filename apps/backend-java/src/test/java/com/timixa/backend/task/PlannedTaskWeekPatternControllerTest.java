package com.timixa.backend.task;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timixa.backend.auth.dto.RegisterRequest;
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
import java.time.temporal.TemporalAdjusters;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class PlannedTaskWeekPatternControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired PlannedTaskRepository tasks;
    @Autowired PlannedTaskCompletionRepository completions;
    @Autowired PlannedTaskExceptionRepository exceptions;
    @Autowired PlannedTaskSegmentRepository segments;
    @Autowired PlannedTaskWeekSlotRepository weekSlots;

    private String token;
    private String taskId;

    @BeforeEach
    void clean() throws Exception {
        weekSlots.deleteAll();
        segments.deleteAll();
        exceptions.deleteAll();
        completions.deleteAll();
        tasks.deleteAll();
        users.deleteAll();
        token = registerAndGetToken("a@b.com", "password123");
        taskId = createWeekendTask();
    }

    private String registerAndGetToken(String email, String pw) throws Exception {
        String resp = mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new RegisterRequest(email, pw, "Alex"))))
            .andReturn().getResponse().getContentAsString();
        return json.readTree(resp).get("token").asText();
    }

    private String createWeekendTask() throws Exception {
        String body = mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskRequest(
                    "Upskill", null, null, Cadence.WEEKLY, true,
                    null, null, null, Set.of(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY), null,
                    360, null, null, null))))
            .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asText();
    }

    private static LocalDate next(DayOfWeek dow) {
        return LocalDate.now().with(TemporalAdjusters.nextOrSame(dow));
    }

    @Test
    void put_replaces_pattern_and_returns_it_for_matching_date() throws Exception {
        LocalDate sat = next(DayOfWeek.SATURDAY);
        mvc.perform(put("/api/planned-tasks/" + taskId + "/week-pattern/SATURDAY?date=" + sat)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("[{\"startTime\":\"09:00\",\"endTime\":\"12:00\"},{\"startTime\":\"14:00\",\"endTime\":\"17:00\"}]"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.patternForDate.length()").value(2))
           .andExpect(jsonPath("$.patternForDate[0].startTime").value("09:00"))
           .andExpect(jsonPath("$.patternForDate[1].startTime").value("14:00"));
    }

    @Test
    void pattern_applies_only_to_its_weekday() throws Exception {
        LocalDate sat = next(DayOfWeek.SATURDAY);
        LocalDate sun = next(DayOfWeek.SUNDAY);
        mvc.perform(put("/api/planned-tasks/" + taskId + "/week-pattern/SATURDAY?date=" + sat)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("[{\"startTime\":\"09:00\",\"endTime\":\"12:00\"}]"));

        mvc.perform(get("/api/planned-tasks?date=" + sat).header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$[0].patternForDate.length()").value(1));
        mvc.perform(get("/api/planned-tasks?date=" + sun).header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$[0].patternForDate.length()").value(0));
    }

    @Test
    void empty_list_clears_pattern() throws Exception {
        LocalDate sat = next(DayOfWeek.SATURDAY);
        mvc.perform(put("/api/planned-tasks/" + taskId + "/week-pattern/SATURDAY?date=" + sat)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("[{\"startTime\":\"09:00\",\"endTime\":\"12:00\"}]"));
        mvc.perform(put("/api/planned-tasks/" + taskId + "/week-pattern/SATURDAY?date=" + sat)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("[]"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.patternForDate.length()").value(0));
    }

    @Test
    void overlapping_slots_are_rejected() throws Exception {
        mvc.perform(put("/api/planned-tasks/" + taskId + "/week-pattern/SATURDAY")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("[{\"startTime\":\"09:00\",\"endTime\":\"12:00\"},{\"startTime\":\"11:00\",\"endTime\":\"13:00\"}]"))
           .andExpect(status().isBadRequest());
    }

    @Test
    void deleting_task_cascades_pattern() throws Exception {
        mvc.perform(put("/api/planned-tasks/" + taskId + "/week-pattern/SATURDAY")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("[{\"startTime\":\"09:00\",\"endTime\":\"12:00\"}]"));
        mvc.perform(delete("/api/planned-tasks/" + taskId)
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isNoContent());
        org.junit.jupiter.api.Assertions.assertEquals(0, weekSlots.count());
    }

    @Test
    void requires_authentication() throws Exception {
        mvc.perform(put("/api/planned-tasks/" + taskId + "/week-pattern/SATURDAY")
                .contentType(MediaType.APPLICATION_JSON)
                .content("[]"))
           .andExpect(status().isUnauthorized());
    }
}
