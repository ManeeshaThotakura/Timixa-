package com.timixa.backend.habit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timixa.backend.auth.dto.RegisterRequest;
import com.timixa.backend.habit.dto.HabitRequest;
import com.timixa.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class HabitControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired HabitRepository habits;
    @Autowired HabitCompletionRepository completions;

    private String token;

    @BeforeEach
    void clean() throws Exception {
        completions.deleteAll();
        habits.deleteAll();
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

    private String createHabit(HabitRequest req) throws Exception {
        String body = mvc.perform(post("/api/habits")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
            .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asText();
    }

    @Test
    void get_returns_empty_for_new_user() throws Exception {
        mvc.perform(get("/api/habits").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$").isArray())
           .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void post_creates_habit_with_defaults() throws Exception {
        HabitRequest req = new HabitRequest("Water", "Health", null, null, null, null, null);
        mvc.perform(post("/api/habits")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.title").value("Water"))
           .andExpect(jsonPath("$.category").value("Health"))
           .andExpect(jsonPath("$.icon").value("task_alt"))
           .andExpect(jsonPath("$.targetCount").value(1))
           .andExpect(jsonPath("$.currentCount").value(0))
           .andExpect(jsonPath("$.unit").value("time"))
           .andExpect(jsonPath("$.color").value("#00c1fd"))
           .andExpect(jsonPath("$.streak").value(0));
    }

    @Test
    void post_respects_supplied_values() throws Exception {
        HabitRequest req = new HabitRequest(
            "Read", "Learning", "menu_book", 30, "minutes", "#5e43fb", "goal-1");
        mvc.perform(post("/api/habits")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.icon").value("menu_book"))
           .andExpect(jsonPath("$.targetCount").value(30))
           .andExpect(jsonPath("$.unit").value("minutes"))
           .andExpect(jsonPath("$.color").value("#5e43fb"))
           .andExpect(jsonPath("$.goalId").value("goal-1"));
    }

    @Test
    void increment_bumps_currentCount() throws Exception {
        String id = createHabit(new HabitRequest("Water", null, null, 3, null, null, null));

        mvc.perform(post("/api/habits/" + id + "/increment")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.currentCount").value(1))
           .andExpect(jsonPath("$.streak").value(0));

        mvc.perform(post("/api/habits/" + id + "/increment")
                .header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$.currentCount").value(2));

        mvc.perform(post("/api/habits/" + id + "/increment")
                .header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$.currentCount").value(3))
           .andExpect(jsonPath("$.streak").value(1));
    }

    @Test
    void get_lists_created_habits_with_todays_progress() throws Exception {
        String id = createHabit(new HabitRequest("Water", null, null, 2, null, null, null));
        mvc.perform(post("/api/habits/" + id + "/increment")
                .header("Authorization", "Bearer " + token));

        mvc.perform(get("/api/habits").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(1))
           .andExpect(jsonPath("$[0].currentCount").value(1))
           .andExpect(jsonPath("$[0].targetCount").value(2));
    }

    @Test
    void streak_counts_consecutive_hit_days() throws Exception {
        String id = createHabit(new HabitRequest("Water", null, null, 1, null, null, null));
        LocalDate today = LocalDate.now();
        UUID habitId = UUID.fromString(id);
        for (int i = 1; i <= 4; i++) {
            completions.save(new HabitCompletion(habitId, today.minusDays(i), 2, Instant.now()));
        }

        mvc.perform(get("/api/habits").header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$[0].streak").value(4));
    }

    @Test
    void streak_breaks_on_missed_day() throws Exception {
        String id = createHabit(new HabitRequest("Water", null, null, 1, null, null, null));
        LocalDate today = LocalDate.now();
        UUID habitId = UUID.fromString(id);
        completions.save(new HabitCompletion(habitId, today.minusDays(1), 1, Instant.now()));
        // gap at today-2
        completions.save(new HabitCompletion(habitId, today.minusDays(3), 1, Instant.now()));

        mvc.perform(get("/api/habits").header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$[0].streak").value(1));
    }

    @Test
    void requires_authentication() throws Exception {
        mvc.perform(get("/api/habits")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/habits")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/habits/00000000-0000-0000-0000-000000000000/increment"))
           .andExpect(status().isUnauthorized());
    }

    @Test
    void increment_404_for_other_users_habit() throws Exception {
        String otherToken = registerAndGetToken("b@b.com", "password123");
        String id = mvc.perform(post("/api/habits")
                .header("Authorization", "Bearer " + otherToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new HabitRequest("Other", null, null, null, null, null, null))))
            .andReturn().getResponse().getContentAsString();
        String otherId = json.readTree(id).get("id").asText();

        mvc.perform(post("/api/habits/" + otherId + "/increment")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isNotFound())
           .andExpect(jsonPath("$.code").value("HABIT_NOT_FOUND"));
    }
}
