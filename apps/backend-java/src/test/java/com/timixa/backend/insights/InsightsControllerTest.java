package com.timixa.backend.insights;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.timixa.backend.auth.dto.RegisterRequest;
import com.timixa.backend.task.Cadence;
import com.timixa.backend.task.PlannedTask;
import com.timixa.backend.task.PlannedTaskCompletion;
import com.timixa.backend.task.PlannedTaskCompletionRepository;
import com.timixa.backend.task.PlannedTaskExceptionRepository;
import com.timixa.backend.task.PlannedTaskRepository;
import com.timixa.backend.task.PlannedTaskSegmentRepository;
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
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class InsightsControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired PlannedTaskRepository tasks;
    @Autowired PlannedTaskCompletionRepository completions;
    @Autowired PlannedTaskExceptionRepository exceptions;
    @Autowired PlannedTaskSegmentRepository segments;

    private String token;

    @BeforeEach
    void clean() throws Exception {
        segments.deleteAll();
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

    private UUID currentUserId() {
        return users.findAll().get(0).getId();
    }

    private String createTask(PlannedTaskRequest req) throws Exception {
        String body = mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
            .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asText();
    }

    @Test
    void empty_user_returns_no_streaks_and_empty_pending() throws Exception {
        LocalDate d = LocalDate.now();
        mvc.perform(get("/api/insights/bedtime?date=" + d)
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.date").value(d.toString()))
           .andExpect(jsonPath("$.pendingToday").isArray())
           .andExpect(jsonPath("$.pendingToday.length()").value(0))
           .andExpect(jsonPath("$.topStreak").doesNotExist())
           .andExpect(jsonPath("$.topMissedStreak").doesNotExist())
           .andExpect(jsonPath("$.tomorrow.date").value(d.plusDays(1).toString()))
           .andExpect(jsonPath("$.tomorrow.unscheduledCount").value(0))
           .andExpect(jsonPath("$.tomorrow.overlapConflictCount").value(0));
    }

    @Test
    void pendingToday_excludes_completed() throws Exception {
        LocalDate d = LocalDate.now();
        String doneId = createTask(new PlannedTaskRequest(
            "Done", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null, null, null, null, null));
        createTask(new PlannedTaskRequest(
            "Pending", null, null, Cadence.DAILY, true,
            "11:00", "12:00", null, null, null, null, null, null, null));

        mvc.perform(post("/api/planned-tasks/" + doneId + "/completions")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\":\"" + d + "\"}"))
           .andExpect(status().isCreated());

        mvc.perform(get("/api/insights/bedtime?date=" + d)
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.pendingToday.length()").value(1))
           .andExpect(jsonPath("$.pendingToday[0].title").value("Pending"));
    }

    @Test
    void top_streak_finds_longest_completed_run() throws Exception {
        LocalDate today = LocalDate.now();
        String shortId = createTask(new PlannedTaskRequest(
            "ShortStreak", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null, null, null, null, null));
        String longId = createTask(new PlannedTaskRequest(
            "LongStreak", null, null, Cadence.DAILY, true,
            "10:00", "11:00", null, null, null, null, null, null, null));

        UUID userId = currentUserId();
        UUID shortUuid = UUID.fromString(shortId);
        UUID longUuid = UUID.fromString(longId);

        // count = 60 satisfies the slot-duration target (09:00–10:00)
        for (int i = 1; i <= 2; i++) {
            completions.save(new PlannedTaskCompletion(shortUuid, today.minusDays(i), 60, Instant.now()));
        }
        for (int i = 1; i <= 5; i++) {
            completions.save(new PlannedTaskCompletion(longUuid, today.minusDays(i), 60, Instant.now()));
        }

        mvc.perform(get("/api/insights/bedtime?date=" + today)
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.topStreak.taskId").value(longId))
           .andExpect(jsonPath("$.topStreak.title").value("LongStreak"))
           .andExpect(jsonPath("$.topStreak.length").value(5));
    }

    @Test
    void top_missed_streak_finds_longest_skipped_run() throws Exception {
        LocalDate today = LocalDate.now();
        createTask(new PlannedTaskRequest(
            "DailyTask", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null, null, null, null, null));

        mvc.perform(get("/api/insights/bedtime?date=" + today)
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.topMissedStreak.title").value("DailyTask"))
           .andExpect(jsonPath("$.topMissedStreak.length").value(org.hamcrest.Matchers.greaterThan(0)));
    }

    @Test
    void tomorrow_unscheduled_count_includes_no_slot_no_segments() throws Exception {
        LocalDate today = LocalDate.now();
        createTask(new PlannedTaskRequest(
            "Floating", null, null, Cadence.DAILY, true,
            null, null, null, null, null, 30, null, null, null));
        createTask(new PlannedTaskRequest(
            "Fixed", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null, null, null, null, null));

        mvc.perform(get("/api/insights/bedtime?date=" + today)
                .header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$.tomorrow.unscheduledCount").value(1))
           .andExpect(jsonPath("$.tomorrow.overlapConflictCount").value(0));
    }

    @Test
    void tomorrow_overlap_conflict_detected_across_two_tasks() throws Exception {
        LocalDate today = LocalDate.now();
        createTask(new PlannedTaskRequest(
            "A", null, null, Cadence.DAILY, true,
            "09:00", "10:00", null, null, null, null, null, null, null));
        createTask(new PlannedTaskRequest(
            "B", null, null, Cadence.DAILY, true,
            "09:30", "10:30", null, null, null, null, null, null, null));

        mvc.perform(get("/api/insights/bedtime?date=" + today)
                .header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$.tomorrow.overlapConflictCount").value(1));
    }

    @Test
    void requires_authentication() throws Exception {
        mvc.perform(get("/api/insights/bedtime"))
           .andExpect(status().isUnauthorized());
    }

    @Test
    void weekly_task_streak_counts_only_applicable_days() throws Exception {
        LocalDate today = LocalDate.now();
        DayOfWeek todayDow = today.getDayOfWeek();
        String id = createTask(new PlannedTaskRequest(
            "Weekly", null, null, Cadence.WEEKLY, true,
            "09:00", "10:00", null, Set.of(todayDow), null, null, null, null, null));
        UUID taskUuid = UUID.fromString(id);

        for (int weeksBack = 1; weeksBack <= 3; weeksBack++) {
            completions.save(new PlannedTaskCompletion(taskUuid, today.minusDays(7L * weeksBack), 60, Instant.now()));
        }

        String body = mvc.perform(get("/api/insights/bedtime?date=" + today)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        JsonNode root = json.readTree(body);
        int streak = root.get("topStreak").get("length").asInt();
        org.junit.jupiter.api.Assertions.assertEquals(3, streak);
    }
}
