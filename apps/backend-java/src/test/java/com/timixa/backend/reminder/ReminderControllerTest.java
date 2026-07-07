package com.timixa.backend.reminder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timixa.backend.auth.dto.RegisterRequest;
import com.timixa.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class ReminderControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired ReminderRepository reminders;

    private String token;

    @BeforeEach
    void clean() throws Exception {
        reminders.deleteAll();
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

    private String createReminder(String body) throws Exception {
        String resp = mvc.perform(post("/api/reminders")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return json.readTree(resp).get("id").asText();
    }

    @Test
    void list_empty_for_new_user() throws Exception {
        mvc.perform(get("/api/reminders").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void create_applies_defaults_and_round_trips() throws Exception {
        String id = createReminder("{\"title\":\"Drink water\"}");
        mvc.perform(get("/api/reminders").header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$[0].id").value(id))
           .andExpect(jsonPath("$[0].title").value("Drink water"))
           .andExpect(jsonPath("$[0].type").value("manual"))
           .andExpect(jsonPath("$[0].dismissed").value(false))
           .andExpect(jsonPath("$[0].icon").value("notifications"))
           .andExpect(jsonPath("$[0].iconColor").value("#451de3"));
    }

    @Test
    void dismiss_marks_reminder_dismissed() throws Exception {
        String id = createReminder("{\"title\":\"Stretch\"}");
        mvc.perform(patch("/api/reminders/" + id + "/dismiss")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.dismissed").value(true));
    }

    @Test
    void snooze_updates_time_and_fireAt() throws Exception {
        String id = createReminder("{\"title\":\"Stretch\"}");
        mvc.perform(patch("/api/reminders/" + id + "/snooze")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"minutes\":10}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.time").value("In 10 min"))
           .andExpect(jsonPath("$.fireAt").isNotEmpty())
           .andExpect(jsonPath("$.sent").value(false));
    }

    @Test
    void snooze_defaults_to_30_min_with_empty_body() throws Exception {
        String id = createReminder("{\"title\":\"Stretch\"}");
        mvc.perform(patch("/api/reminders/" + id + "/snooze")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.time").value("In 30 min"));
    }

    @Test
    void delete_removes_reminder() throws Exception {
        String id = createReminder("{\"title\":\"Old\"}");
        mvc.perform(delete("/api/reminders/" + id)
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isNoContent());
        mvc.perform(get("/api/reminders").header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void cross_user_access_is_404() throws Exception {
        String id = createReminder("{\"title\":\"Mine\"}");
        String other = registerAndGetToken("b@b.com", "password123");
        mvc.perform(patch("/api/reminders/" + id + "/dismiss")
                .header("Authorization", "Bearer " + other))
           .andExpect(status().isNotFound())
           .andExpect(jsonPath("$.code").value("REMINDER_NOT_FOUND"));
    }

    @Test
    void requires_authentication() throws Exception {
        mvc.perform(get("/api/reminders")).andExpect(status().isUnauthorized());
    }
}
