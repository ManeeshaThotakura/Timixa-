package com.timixa.backend.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timixa.backend.auth.dto.RegisterRequest;
import com.timixa.backend.user.dto.OnboardingRequest;
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
class UserControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;

    @BeforeEach
    void clean() { users.deleteAll(); }

    @Test
    void onboarding_401_without_token() throws Exception {
        mvc.perform(patch("/api/users/me/onboarding")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(payload())))
           .andExpect(status().isUnauthorized());
    }

    @Test
    void onboarding_200_marks_user_complete() throws Exception {
        String token = registerAndGetToken();

        mvc.perform(patch("/api/users/me/onboarding")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(payload())))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.onboardingComplete").value(true))
           .andExpect(jsonPath("$.age").value(28))
           .andExpect(jsonPath("$.bedtime").value("22:30"))
           .andExpect(jsonPath("$.wakeTime").value("06:30"));
    }

    @Test
    void onboarding_400_when_bedtime_invalid() throws Exception {
        String token = registerAndGetToken();
        OnboardingRequest bad = new OnboardingRequest(28, "Eng", "9999", "06:30");

        mvc.perform(patch("/api/users/me/onboarding")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(bad)))
           .andExpect(status().isBadRequest())
           .andExpect(jsonPath("$.fields.bedtime").exists());
    }

    @Test
    void onboarding_409_when_already_complete() throws Exception {
        String token = registerAndGetToken();
        mvc.perform(patch("/api/users/me/onboarding")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(payload())));

        mvc.perform(patch("/api/users/me/onboarding")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(payload())))
           .andExpect(status().isConflict())
           .andExpect(jsonPath("$.code").value("ONBOARDING_ALREADY_COMPLETE"));
    }

    private OnboardingRequest payload() {
        return new OnboardingRequest(28, "Engineer", "22:30", "06:30");
    }

    private String registerAndGetToken() throws Exception {
        String resp = mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new RegisterRequest("a@b.com", "password123", "Alex"))))
            .andReturn().getResponse().getContentAsString();
        return json.readTree(resp).get("token").asText();
    }
}
