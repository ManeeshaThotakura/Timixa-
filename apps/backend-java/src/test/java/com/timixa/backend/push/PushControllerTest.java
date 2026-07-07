package com.timixa.backend.push;

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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class PushControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired PushSubscriptionRepository subscriptions;

    private String token;

    @BeforeEach
    void clean() throws Exception {
        subscriptions.deleteAll();
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
    void public_key_is_exposed() throws Exception {
        mvc.perform(get("/api/push/public-key")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.publicKey").isNotEmpty());
    }

    @Test
    void subscribe_persists_subscription() throws Exception {
        mvc.perform(post("/api/push/subscriptions")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"endpoint\":\"https://push.example/ep-1\",\"p256dh\":\"key\",\"auth\":\"secret\"}"))
           .andExpect(status().isCreated());
        assertEquals(1, subscriptions.count());
    }

    @Test
    void resubscribe_same_endpoint_is_idempotent() throws Exception {
        for (int i = 0; i < 2; i++) {
            mvc.perform(post("/api/push/subscriptions")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"endpoint\":\"https://push.example/ep-1\",\"p256dh\":\"key\",\"auth\":\"secret\"}"))
               .andExpect(status().isCreated());
        }
        assertEquals(1, subscriptions.count());
    }

    @Test
    void unsubscribe_removes_row() throws Exception {
        mvc.perform(post("/api/push/subscriptions")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"endpoint\":\"https://push.example/ep-1\",\"p256dh\":\"key\",\"auth\":\"secret\"}"));
        mvc.perform(delete("/api/push/subscriptions?endpoint=https://push.example/ep-1")
                .header("Authorization", "Bearer " + token))
           .andExpect(status().isNoContent());
        assertEquals(0, subscriptions.count());
    }

    @Test
    void requires_authentication() throws Exception {
        mvc.perform(post("/api/push/subscriptions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"endpoint\":\"x\",\"p256dh\":\"y\",\"auth\":\"z\"}"))
           .andExpect(status().isUnauthorized());
    }
}
