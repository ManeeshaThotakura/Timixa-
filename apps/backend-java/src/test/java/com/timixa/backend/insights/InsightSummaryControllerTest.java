package com.timixa.backend.insights;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timixa.backend.auth.dto.RegisterRequest;
import com.timixa.backend.task.Cadence;
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

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class InsightSummaryControllerTest {

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

    private String createTask(PlannedTaskRequest req) throws Exception {
        String body = mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
            .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asText();
    }

    private static Instant onDateAt(LocalDate d, int hour, int minute) {
        return LocalDateTime.of(d, LocalTime.of(hour, minute))
            .atZone(ZoneId.systemDefault()).toInstant();
    }

    @Test
    void empty_user_returns_zeroes_with_full_day_list() throws Exception {
        mvc.perform(get("/api/insights/summary?days=7")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.windowDays").value(7))
           .andExpect(jsonPath("$.disciplinePercent").value(0))
           .andExpect(jsonPath("$.adherencePercent").value(0))
           .andExpect(jsonPath("$.days.length()").value(7))
           .andExpect(jsonPath("$.goals.length()").value(0))
           .andExpect(jsonPath("$.timeDistribution.length()").value(0));
    }

    @Test
    void discipline_counts_completed_vs_applicable() throws Exception {
        // DAILY task created now → applicable only today (creation date filter)
        String id = createTask(new PlannedTaskRequest(
            "Read", "Learning", null, Cadence.DAILY, false,
            null, null, null, null, null, null, null, null, null));
        // complete today
        mvc.perform(post("/api/planned-tasks/" + id + "/completions")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
           .andExpect(status().isCreated());

        mvc.perform(get("/api/insights/summary?days=7")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.disciplinePercent").value(100))
           .andExpect(jsonPath("$.goals[0].goalName").value("Learning"))
           .andExpect(jsonPath("$.goals[0].completionRate").value(100));
    }

    @Test
    void adherence_counts_on_time_completion() throws Exception {
        LocalDate today = LocalDate.now();
        String id = createTask(new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true,
            "06:00", "07:00", null, null, null, null, null, null, null));

        // Simulate an on-time completion: count = target (60 min slot), done at 06:30
        completions.save(new PlannedTaskCompletion(
            UUID.fromString(id), today, 60, onDateAt(today, 6, 30)));

        mvc.perform(get("/api/insights/summary?days=7")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.adherencePercent").value(100));
    }

    @Test
    void adherence_zero_for_late_completion() throws Exception {
        LocalDate today = LocalDate.now();
        String id = createTask(new PlannedTaskRequest(
            "Gym", null, null, Cadence.DAILY, true,
            "06:00", "07:00", null, null, null, null, null, null, null));

        // Completed at 22:00 — way past slot end + 60min grace
        completions.save(new PlannedTaskCompletion(
            UUID.fromString(id), today, 60, onDateAt(today, 22, 0)));

        mvc.perform(get("/api/insights/summary?days=7")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.disciplinePercent").value(100))
           .andExpect(jsonPath("$.adherencePercent").value(0));
    }

    @Test
    void time_distribution_reports_hours_for_time_based_tasks() throws Exception {
        LocalDate today = LocalDate.now();
        String id = createTask(new PlannedTaskRequest(
            "Study", "School", null, Cadence.DAILY, true,
            "16:00", "17:00", null, null, null, null, null, null, null));

        completions.save(new PlannedTaskCompletion(
            UUID.fromString(id), today, 30, onDateAt(today, 16, 30)));

        mvc.perform(get("/api/insights/summary?days=7")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.timeDistribution[0].label").value("School"))
           .andExpect(jsonPath("$.timeDistribution[0].hours").value(0.5));
    }

    @Test
    void window_clamps_and_30_day_request_returns_30_days() throws Exception {
        mvc.perform(get("/api/insights/summary?days=30")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.windowDays").value(30))
           .andExpect(jsonPath("$.days.length()").value(30));

        mvc.perform(get("/api/insights/summary?days=2")
                .header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$.windowDays").value(7));
    }

    @Test
    void requires_authentication() throws Exception {
        mvc.perform(get("/api/insights/summary"))
           .andExpect(status().isUnauthorized());
    }

    @Test
    void deep_analysis_reports_best_and_worst_time_of_day() throws Exception {
        LocalDate today = LocalDate.now();
        String morning = createTask(new PlannedTaskRequest(
            "Morning Run", null, null, Cadence.DAILY, true,
            "06:00", "07:00", null, null, null, null, null, null, null));
        createTask(new PlannedTaskRequest(
            "Evening Read", null, null, Cadence.DAILY, true,
            "19:00", "20:00", null, null, null, null, null, null, null));

        // Morning task fully done; evening task untouched.
        completions.save(new PlannedTaskCompletion(
            UUID.fromString(morning), today, 60, onDateAt(today, 6, 30)));

        mvc.perform(get("/api/insights/summary?days=7")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.bestTime.label").value("Morning"))
           .andExpect(jsonPath("$.bestTime.percent").value(100))
           .andExpect(jsonPath("$.worstTime.label").value("Evening"))
           .andExpect(jsonPath("$.worstTime.percent").value(0));
    }
}
