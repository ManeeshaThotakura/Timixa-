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

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class PlannedTaskControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired PlannedTaskRepository tasks;
    @Autowired PlannedTaskCompletionRepository completions;
    @Autowired PlannedTaskExceptionRepository exceptions;

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

    @Test
    void post_201_for_valid_daily() throws Exception {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", "Fitness", null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            null, null, null, null);
        mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.id").exists())
           .andExpect(jsonPath("$.cadence").value("DAILY"))
           .andExpect(jsonPath("$.completedToday").value(false));
    }

    @Test
    void post_400_for_weekly_without_weekdays() throws Exception {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Run", null, null, Cadence.WEEKLY, true,
            "07:00", "08:00", null, null, null,
            null, null, null, null);
        mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
           .andExpect(status().isBadRequest())
           .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void post_401_without_token() throws Exception {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "X", null, null, Cadence.DAILY, true, "09:00", "10:00", null, null, null,
            null, null, null, null);
        mvc.perform(post("/api/planned-tasks")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
           .andExpect(status().isUnauthorized());
    }

    @Test
    void get_returns_daily_task() throws Exception {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true, "09:00", "10:00", null, null, null,
            null, null, null, null);
        mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)));

        mvc.perform(get("/api/planned-tasks?date=" + LocalDate.now())
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(1))
           .andExpect(jsonPath("$[0].title").value("Gym"));
    }

    @Test
    void completion_201_then_409_then_uncomplete_204() throws Exception {
        String body = mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskRequest(
                    "Gym", null, null, Cadence.DAILY, true,
                    "09:00", "10:00", null, null, null,
                    null, null, null, null))))
            .andReturn().getResponse().getContentAsString();
        String id = json.readTree(body).get("id").asText();

        mvc.perform(post("/api/planned-tasks/" + id + "/completions")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.completedToday").value(true));

        mvc.perform(post("/api/planned-tasks/" + id + "/completions")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isConflict())
           .andExpect(jsonPath("$.code").value("TASK_ALREADY_COMPLETE"));

        mvc.perform(delete("/api/planned-tasks/" + id + "/completions/" + LocalDate.now())
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isNoContent());
    }

    @Test
    void other_users_tasks_invisible() throws Exception {
        String otherToken = registerAndGetToken("z@z.com", "password123");
        mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + otherToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskRequest(
                    "Theirs", null, null, Cadence.DAILY, true,
                    "09:00", "10:00", null, null, null,
                    null, null, null, null))));

        mvc.perform(get("/api/planned-tasks?date=" + LocalDate.now())
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void delete_204_and_subsequent_get_404() throws Exception {
        String body = mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskRequest(
                    "Gym", null, null, Cadence.DAILY, true,
                    "09:00", "10:00", null, null, null,
                    null, null, null, null))))
            .andReturn().getResponse().getContentAsString();
        String id = json.readTree(body).get("id").asText();

        mvc.perform(delete("/api/planned-tasks/" + id)
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isNoContent());

        mvc.perform(delete("/api/planned-tasks/" + id)
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isNotFound())
           .andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
    }

    @Test
    void post_201_round_trips_constraints() throws Exception {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", "Fitness", null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            30, 60, 5, 10);
        mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.minTimeMinutes").value(30))
           .andExpect(jsonPath("$.maxTimeMinutes").value(60))
           .andExpect(jsonPath("$.minCount").value(5))
           .andExpect(jsonPath("$.maxCount").value(10))
           .andExpect(jsonPath("$.exceptions").isArray())
           .andExpect(jsonPath("$.exceptions").isEmpty());
    }

    @Test
    void post_400_for_max_less_than_min_time() throws Exception {
        PlannedTaskRequest req = new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null,
            60, 30, null, null);
        mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
           .andExpect(status().isBadRequest())
           .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }
}
