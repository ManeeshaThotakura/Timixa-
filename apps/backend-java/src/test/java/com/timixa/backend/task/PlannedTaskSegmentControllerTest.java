package com.timixa.backend.task;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timixa.backend.auth.dto.RegisterRequest;
import com.timixa.backend.task.dto.PlannedTaskRequest;
import com.timixa.backend.task.dto.PlannedTaskSegmentRequest;
import com.timixa.backend.task.dto.PlannedTaskSegmentUpdateRequest;
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
class PlannedTaskSegmentControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired PlannedTaskRepository tasks;
    @Autowired PlannedTaskSegmentRepository segments;
    @Autowired PlannedTaskExceptionRepository exceptions;
    @Autowired PlannedTaskCompletionRepository completions;

    private String token;
    private String taskId;

    @BeforeEach
    void clean() throws Exception {
        segments.deleteAll();
        exceptions.deleteAll();
        completions.deleteAll();
        tasks.deleteAll();
        users.deleteAll();
        token = registerAndGetToken("a@b.com", "password123");
        taskId = createDaily();
    }

    private String registerAndGetToken(String email, String pw) throws Exception {
        String resp = mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new RegisterRequest(email, pw, "Alex"))))
            .andReturn().getResponse().getContentAsString();
        return json.readTree(resp).get("token").asText();
    }

    private String createDaily() throws Exception {
        String body = mvc.perform(post("/api/planned-tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskRequest(
                    "Gym", null, null, Cadence.DAILY, true,
                    "09:00", "10:00", null, null, null,
                    null, null, null, null))))
            .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asText();
    }

    @Test
    void post_201_round_trips_segment() throws Exception {
        LocalDate d = LocalDate.now();
        mvc.perform(post("/api/planned-tasks/" + taskId + "/segments")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskSegmentRequest(d, "14:00", "14:30"))))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.segmentsForDate[0].startTime").value("14:00"))
           .andExpect(jsonPath("$.segmentsForDate[0].endTime").value("14:30"));
    }

    @Test
    void post_409_on_overlap() throws Exception {
        LocalDate d = LocalDate.now();
        mvc.perform(post("/api/planned-tasks/" + taskId + "/segments")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskSegmentRequest(d, "09:00", "10:00"))));
        mvc.perform(post("/api/planned-tasks/" + taskId + "/segments")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskSegmentRequest(d, "09:30", "10:30"))))
           .andExpect(status().isConflict())
           .andExpect(jsonPath("$.code").value("SEGMENT_OVERLAP"));
    }

    @Test
    void patch_segment_updates_end_time() throws Exception {
        LocalDate d = LocalDate.now();
        String body = mvc.perform(post("/api/planned-tasks/" + taskId + "/segments")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskSegmentRequest(d, "14:00", "14:30"))))
            .andReturn().getResponse().getContentAsString();
        String segmentId = json.readTree(body).get("segmentsForDate").get(0).get("id").asText();

        mvc.perform(patch("/api/planned-tasks/" + taskId + "/segments/" + segmentId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskSegmentUpdateRequest(null, "14:45"))))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.segmentsForDate[0].endTime").value("14:45"));
    }

    @Test
    void delete_segment_removes_from_response() throws Exception {
        LocalDate d = LocalDate.now();
        String body = mvc.perform(post("/api/planned-tasks/" + taskId + "/segments")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskSegmentRequest(d, "14:00", "14:30"))))
            .andReturn().getResponse().getContentAsString();
        String segmentId = json.readTree(body).get("segmentsForDate").get(0).get("id").asText();

        mvc.perform(delete("/api/planned-tasks/" + taskId + "/segments/" + segmentId)
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk());

        mvc.perform(get("/api/planned-tasks?date=" + d)
                .header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$[0].segmentsForDate").isArray())
           .andExpect(jsonPath("$[0].segmentsForDate.length()").value(0));
    }

    @Test
    void get_date_scoped_includes_segments_array() throws Exception {
        LocalDate d = LocalDate.now();
        mvc.perform(post("/api/planned-tasks/" + taskId + "/segments")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new PlannedTaskSegmentRequest(d, "14:00", "14:30"))));
        mvc.perform(get("/api/planned-tasks?date=" + d)
                .header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$[0].segmentsForDate").isArray())
           .andExpect(jsonPath("$[0].segmentsForDate.length()").value(1))
           .andExpect(jsonPath("$[0].segmentsForDate[0].startTime").value("14:00"));
    }
}
