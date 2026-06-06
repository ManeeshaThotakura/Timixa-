package com.timixa.backend.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timixa.backend.auth.dto.LoginRequest;
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
class AuthControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;

    @BeforeEach
    void clean() { users.deleteAll(); }

    @Test
    void register_201() throws Exception {
        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new RegisterRequest("a@b.com", "password123", "Alex"))))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.token").isNotEmpty())
           .andExpect(jsonPath("$.user.email").value("a@b.com"))
           .andExpect(jsonPath("$.user.onboardingComplete").value(false));
    }

    @Test
    void register_400_when_password_too_short() throws Exception {
        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new RegisterRequest("a@b.com", "short", "Alex"))))
           .andExpect(status().isBadRequest())
           .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
           .andExpect(jsonPath("$.fields.password").exists());
    }

    @Test
    void register_409_on_duplicate() throws Exception {
        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new RegisterRequest("a@b.com", "password123", "Alex"))));

        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new RegisterRequest("A@B.COM", "password123", "Other"))))
           .andExpect(status().isConflict())
           .andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
    }

    @Test
    void login_200() throws Exception {
        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new RegisterRequest("a@b.com", "password123", "Alex"))));

        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new LoginRequest("a@b.com", "password123"))))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void login_401_on_wrong_password() throws Exception {
        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new RegisterRequest("a@b.com", "password123", "Alex"))));

        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new LoginRequest("a@b.com", "wrong-pw1"))))
           .andExpect(status().isUnauthorized())
           .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void me_401_without_token() throws Exception {
        mvc.perform(get("/api/auth/me"))
           .andExpect(status().isUnauthorized());
    }

    @Test
    void me_returns_user_with_valid_token() throws Exception {
        String resp = mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new RegisterRequest("a@b.com", "password123", "Alex"))))
            .andReturn().getResponse().getContentAsString();
        String token = json.readTree(resp).get("token").asText();

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.email").value("a@b.com"));
    }
}
