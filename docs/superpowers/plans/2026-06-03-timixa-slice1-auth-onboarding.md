# Timixa Slice 1 — Backend Foundation, Auth & Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a new Spring Boot backend that owns `/api/auth/*` + `/api/users/me/*`, proxies everything else to the existing Express server on `:3000`, and ship an end-to-end **register → onboarding → dashboard** flow on the Angular frontend.

**Architecture:** Spring Boot 3.3 on `:8080` is the single API origin for the frontend. Two real endpoints (`/api/auth/**`, `/api/users/me/**`) plus a JWT filter chain and a WebClient-based catch-all proxy to Express. The Angular frontend talks to `/api` via the dev-server proxy. Onboarding is a top-level route with its own guard.

**Tech Stack:** Spring Boot 3.3.x, Java 21, Maven, JPA, H2 (dev) / Postgres (prod), Flyway, jjwt 0.12, BCrypt. Angular 17 (existing), Playwright (new, root-level workspace).

**Spec:** `docs/superpowers/specs/2026-06-03-timixa-slice1-auth-onboarding-design.md`

**Git policy:** User does git manually. Where this plan says "Checkpoint", verify the listed tests pass, then stop and tell the user the work is ready to stage.

---

## File structure (locked before tasks start)

```
apps/backend-java/                                  NEW — Spring Boot project
├── pom.xml
├── mvnw, mvnw.cmd, .mvn/wrapper/maven-wrapper.properties
└── src/
    ├── main/java/com/timixa/backend/
    │   ├── TimixaApplication.java
    │   ├── config/SecurityConfig.java
    │   ├── config/WebClientConfig.java
    │   ├── config/JpaAuditingConfig.java
    │   ├── security/JwtUtil.java
    │   ├── security/JwtAuthenticationFilter.java
    │   ├── security/UserPrincipal.java
    │   ├── auth/AuthController.java
    │   ├── auth/AuthService.java
    │   ├── auth/dto/RegisterRequest.java
    │   ├── auth/dto/LoginRequest.java
    │   ├── auth/dto/AuthResponse.java
    │   ├── user/User.java
    │   ├── user/Role.java
    │   ├── user/UserRepository.java
    │   ├── user/UserService.java
    │   ├── user/UserController.java
    │   ├── user/dto/OnboardingRequest.java
    │   ├── user/dto/UserResponse.java
    │   ├── proxy/LegacyProxyController.java
    │   ├── test/TestResetController.java           dev-profile only
    │   └── common/
    │       ├── GlobalExceptionHandler.java
    │       ├── ErrorResponse.java
    │       ├── EmailTakenException.java
    │       ├── InvalidCredentialsException.java
    │       └── OnboardingAlreadyCompleteException.java
    ├── main/resources/
    │   ├── application.yml
    │   ├── application-dev.yml
    │   ├── application-prod.yml
    │   └── db/migration/V1__init.sql
    └── test/java/com/timixa/backend/
        ├── auth/AuthControllerTest.java
        ├── auth/AuthServiceTest.java
        ├── user/UserControllerTest.java
        ├── security/JwtUtilTest.java
        └── security/JwtAuthenticationFilterTest.java

apps/frontend/                                      MODIFY
├── proxy.conf.json                                 NEW
├── angular.json                                    edited: wire proxy
└── src/
    ├── environments/environment.ts                 edited: apiUrl → '/api'
    └── app/
        ├── app.config.ts                           edited: APP_INITIALIZER
        ├── app.routes.ts                           edited: /onboarding route + guard
        ├── core/
        │   ├── models/user.model.ts                edited: profile + onboardingComplete
        │   ├── services/auth.service.ts            rewrite
        │   ├── interceptors/auth.interceptor.ts    edited: paths
        │   └── guards/onboarding.guard.ts          NEW
        └── features/auth/
            ├── login/login.component.ts            edited: nav + remove fake setTimeout
            ├── register/register.component.ts      edited: nav to /onboarding
            └── onboarding/                         NEW
                ├── onboarding.component.ts
                ├── onboarding.component.html
                └── onboarding.component.scss

apps/e2e/                                           NEW — Playwright workspace
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── tests/auth-and-onboarding.spec.ts

package.json                                        edited: e2e script
```

---

## Phase A — Spring Boot project bootstrap

### Task 1: Scaffold Maven project structure

**Files:**
- Create: `apps/backend-java/pom.xml`
- Create: `apps/backend-java/mvnw`
- Create: `apps/backend-java/mvnw.cmd`
- Create: `apps/backend-java/.mvn/wrapper/maven-wrapper.properties`

- [ ] **Step 1.1: Create `pom.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.4</version>
        <relativePath/>
    </parent>

    <groupId>com.timixa</groupId>
    <artifactId>backend</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>timixa-backend</name>

    <properties>
        <java.version>21</java.version>
        <jjwt.version>0.12.6</jjwt.version>
    </properties>

    <dependencies>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-security</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-validation</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-webflux</artifactId></dependency>
        <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-core</artifactId></dependency>
        <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-database-postgresql</artifactId></dependency>

        <dependency><groupId>com.h2database</groupId><artifactId>h2</artifactId><scope>runtime</scope></dependency>
        <dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId><scope>runtime</scope></dependency>

        <dependency>
            <groupId>io.jsonwebtoken</groupId><artifactId>jjwt-api</artifactId><version>${jjwt.version}</version>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId><artifactId>jjwt-impl</artifactId><version>${jjwt.version}</version><scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId><artifactId>jjwt-jackson</artifactId><version>${jjwt.version}</version><scope>runtime</scope>
        </dependency>

        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-test</artifactId><scope>test</scope></dependency>
        <dependency><groupId>org.springframework.security</groupId><artifactId>spring-security-test</artifactId><scope>test</scope></dependency>
        <dependency><groupId>io.projectreactor</groupId><artifactId>reactor-test</artifactId><scope>test</scope></dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

- [ ] **Step 1.2: Generate Maven wrapper**

Run from `apps/backend-java/`:

```bash
mvn -N wrapper:wrapper -Dmaven=3.9.9
```

If no system Maven is available, copy the wrapper from any other Spring Boot project (or download from https://github.com/apache/maven-mvnd). Verify the files exist:

```bash
ls -la mvnw mvnw.cmd .mvn/wrapper/maven-wrapper.properties
```

Expected: all three files present, `mvnw` is executable (`chmod +x mvnw` if not).

- [ ] **Step 1.3: Verify project compiles**

```bash
cd apps/backend-java && ./mvnw -q compile
```

Expected: BUILD SUCCESS (warnings about no source files are OK at this stage if `src/main/java` is empty).

- [ ] **Step 1.4: Checkpoint** — files ready to stage.

---

### Task 2: Main application class + config files

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/TimixaApplication.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/config/JpaAuditingConfig.java`
- Create: `apps/backend-java/src/main/resources/application.yml`
- Create: `apps/backend-java/src/main/resources/application-dev.yml`
- Create: `apps/backend-java/src/main/resources/application-prod.yml`

- [ ] **Step 2.1: Create `TimixaApplication.java`**

```java
package com.timixa.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class TimixaApplication {
    public static void main(String[] args) {
        SpringApplication.run(TimixaApplication.class, args);
    }
}
```

- [ ] **Step 2.2: Create `config/JpaAuditingConfig.java`**

```java
package com.timixa.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@Configuration
@EnableJpaAuditing
public class JpaAuditingConfig {}
```

- [ ] **Step 2.3: Create `application.yml`**

```yaml
spring:
  profiles:
    active: dev
  application:
    name: timixa-backend

server:
  port: 8080

app:
  jwt:
    secret: ${TIMIXA_JWT_SECRET:dev-secret-change-me-in-prod-needs-to-be-at-least-32-bytes-long}
    expiry-seconds: 604800   # 7 days
  legacy:
    base-url: http://localhost:3000
```

- [ ] **Step 2.4: Create `application-dev.yml`**

```yaml
spring:
  datasource:
    url: jdbc:h2:mem:timixa;DB_CLOSE_DELAY=-1
    username: sa
    password: ""
    driver-class-name: org.h2.Driver
  jpa:
    hibernate:
      ddl-auto: create-drop
    properties:
      hibernate.dialect: org.hibernate.dialect.H2Dialect
  flyway:
    enabled: false
  h2:
    console:
      enabled: true
      path: /h2

logging:
  level:
    com.timixa: DEBUG
```

- [ ] **Step 2.5: Create `application-prod.yml`**

```yaml
spring:
  datasource:
    url: ${DATABASE_URL}
    username: ${DATABASE_USERNAME}
    password: ${DATABASE_PASSWORD}
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate.dialect: org.hibernate.dialect.PostgreSQLDialect
  flyway:
    enabled: true
    locations: classpath:db/migration

logging:
  level:
    com.timixa: INFO
```

- [ ] **Step 2.6: Boot the app**

```bash
cd apps/backend-java && ./mvnw spring-boot:run
```

Expected (in another terminal):
```bash
curl -s http://localhost:8080/actuator/health || curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/
```
You'll see `401` from the root (security is enforced by default — fine for now). Stop the server with Ctrl-C.

- [ ] **Step 2.7: Checkpoint.**

---

### Task 3: V1 SQL migration (used in prod only)

**Files:**
- Create: `apps/backend-java/src/main/resources/db/migration/V1__init.sql`

- [ ] **Step 3.1: Write the migration**

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(80) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'MEMBER',
  age INTEGER,
  occupation VARCHAR(80),
  bedtime VARCHAR(5),
  wake_time VARCHAR(5),
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_users_email_lower ON users (LOWER(email));
```

- [ ] **Step 3.2: Verify** — no run command at this stage; H2 ignores it. We test it only when Postgres is wired in future deployment work.

- [ ] **Step 3.3: Checkpoint.**

---

### Task 4: Public health endpoint + open SecurityConfig for it

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/config/SecurityConfig.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/HealthController.java`
- Create: `apps/backend-java/src/test/java/com/timixa/backend/HealthControllerTest.java`

> This Task creates SecurityConfig with **only** the rules needed for `/api/health`. The JWT filter is added in Task 9; `/api/auth/**` is opened in Task 15.

- [ ] **Step 4.1: Write the failing test**

`apps/backend-java/src/test/java/com/timixa/backend/HealthControllerTest.java`:

```java
package com.timixa.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class HealthControllerTest {

    @Autowired MockMvc mvc;

    @Test
    void health_returns_ok() throws Exception {
        mvc.perform(get("/api/health"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.status").value("ok"));
    }
}
```

- [ ] **Step 4.2: Run the test (expect FAIL — endpoint not implemented)**

```bash
cd apps/backend-java && ./mvnw -q test -Dtest=HealthControllerTest
```

Expected: BUILD FAILURE with `Status expected:<200> but was:<401>` or similar.

- [ ] **Step 4.3: Create `SecurityConfig.java`** (minimal — JWT filter added in Task 11)

```java
package com.timixa.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration c = new CorsConfiguration();
        c.setAllowedOrigins(List.of("http://localhost:4200"));
        c.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
        c.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        c.setAllowCredentials(false);
        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", c);
        return src;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> {})
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/health", "/h2/**").permitAll()
                .anyRequest().authenticated()
            )
            .httpBasic(b -> b.disable())
            .formLogin(f -> f.disable())
            .headers(h -> h.frameOptions(fo -> fo.disable()));   // H2 console
        return http.build();
    }
}
```

- [ ] **Step 4.4: Create `HealthController.java`**

```java
package com.timixa.backend;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}
```

- [ ] **Step 4.5: Run test (expect PASS)**

```bash
./mvnw -q test -Dtest=HealthControllerTest
```

Expected: `Tests run: 1, Failures: 0, Errors: 0`.

- [ ] **Step 4.6: Checkpoint.**

---

## Phase B — User domain + JWT infrastructure

### Task 5: User entity + Role enum

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/user/Role.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/user/User.java`

- [ ] **Step 5.1: Create `Role.java`**

```java
package com.timixa.backend.user;

public enum Role { ADMIN, MEMBER }
```

- [ ] **Step 5.2: Create `User.java`**

```java
package com.timixa.backend.user;

import jakarta.persistence.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
@EntityListeners(AuditingEntityListener.class)
public class User {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false, length = 80)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Role role = Role.MEMBER;

    private Integer age;

    @Column(length = 80)
    private String occupation;

    @Column(length = 5)
    private String bedtime;

    @Column(name = "wake_time", length = 5)
    private String wakeTime;

    @Column(name = "onboarding_complete", nullable = false)
    private boolean onboardingComplete = false;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (email != null) email = email.toLowerCase();
    }

    // ---- getters / setters ----

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }
    public String getOccupation() { return occupation; }
    public void setOccupation(String occupation) { this.occupation = occupation; }
    public String getBedtime() { return bedtime; }
    public void setBedtime(String bedtime) { this.bedtime = bedtime; }
    public String getWakeTime() { return wakeTime; }
    public void setWakeTime(String wakeTime) { this.wakeTime = wakeTime; }
    public boolean isOnboardingComplete() { return onboardingComplete; }
    public void setOnboardingComplete(boolean v) { this.onboardingComplete = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
```

- [ ] **Step 5.3: Compile**

```bash
./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 5.4: Checkpoint.**

---

### Task 6: UserRepository

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/user/UserRepository.java`

- [ ] **Step 6.1: Create repository**

```java
package com.timixa.backend.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);
}
```

- [ ] **Step 6.2: Boot to confirm wiring**

```bash
./mvnw -q test -Dtest=HealthControllerTest
```

Expected: still passes (the repository must wire cleanly into the existing `@SpringBootTest` context).

- [ ] **Step 6.3: Checkpoint.**

---

### Task 7: JwtUtil with TDD

**Files:**
- Create: `apps/backend-java/src/test/java/com/timixa/backend/security/JwtUtilTest.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/security/JwtUtil.java`

- [ ] **Step 7.1: Write the failing test**

```java
package com.timixa.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

class JwtUtilTest {

    private JwtUtil util;
    private static final String SECRET = "test-secret-test-secret-test-secret-test-secret";

    @BeforeEach
    void setup() {
        util = new JwtUtil(SECRET, Duration.ofMinutes(10));
    }

    @Test
    void generated_token_round_trips() {
        UUID userId = UUID.randomUUID();
        String token = util.generate(userId, "a@b.com", "MEMBER");
        Claims claims = util.parse(token);
        assertThat(claims.getSubject()).isEqualTo(userId.toString());
        assertThat(claims.get("email", String.class)).isEqualTo("a@b.com");
        assertThat(claims.get("role", String.class)).isEqualTo("MEMBER");
    }

    @Test
    void expired_token_throws() {
        JwtUtil shortLived = new JwtUtil(SECRET, Duration.ofMillis(-1));
        String token = shortLived.generate(UUID.randomUUID(), "a@b.com", "MEMBER");
        assertThatThrownBy(() -> shortLived.parse(token))
            .isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    void tampered_signature_throws() {
        String token = util.generate(UUID.randomUUID(), "a@b.com", "MEMBER");
        String tampered = token.substring(0, token.length() - 2) + "xx";
        assertThatThrownBy(() -> util.parse(tampered))
            .isInstanceOf(SignatureException.class);
    }
}
```

- [ ] **Step 7.2: Run (expect FAIL — JwtUtil not yet defined)**

```bash
./mvnw -q test -Dtest=JwtUtilTest
```

Expected: compilation failure (`cannot find symbol JwtUtil`).

- [ ] **Step 7.3: Implement `JwtUtil.java`**

```java
package com.timixa.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

@Component
public class JwtUtil {

    private final SecretKey key;
    private final Duration expiry;

    public JwtUtil(@Value("${app.jwt.secret}") String secret,
                   @Value("${app.jwt.expiry-seconds}") long expirySeconds) {
        this(secret, Duration.ofSeconds(expirySeconds));
    }

    JwtUtil(String secret, Duration expiry) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiry = expiry;
    }

    public String generate(UUID userId, String email, String role) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(userId.toString())
            .claim("email", email)
            .claim("role", role)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(expiry)))
            .signWith(key)
            .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    public Optional<String> extract(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) return Optional.empty();
        return Optional.of(header.substring(7));
    }
}
```

> The two-constructor pattern lets the test instantiate without Spring DI while production uses the `@Value`-injected one.

- [ ] **Step 7.4: Run (expect PASS)**

```bash
./mvnw -q test -Dtest=JwtUtilTest
```

Expected: 3 tests passing.

- [ ] **Step 7.5: Checkpoint.**

---

### Task 8: UserPrincipal value class

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/security/UserPrincipal.java`

- [ ] **Step 8.1: Create the record**

```java
package com.timixa.backend.security;

import java.util.UUID;

public record UserPrincipal(UUID id, String email, String role) {}
```

- [ ] **Step 8.2: Compile**

```bash
./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 8.3: Checkpoint.**

---

### Task 9: JwtAuthenticationFilter with TDD

**Files:**
- Create: `apps/backend-java/src/test/java/com/timixa/backend/security/JwtAuthenticationFilterTest.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/security/JwtAuthenticationFilter.java`

- [ ] **Step 9.1: Write the failing test**

```java
package com.timixa.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class JwtAuthenticationFilterTest {

    private static final String SECRET = "test-secret-test-secret-test-secret-test-secret";
    private final JwtUtil util = new JwtUtil(SECRET, Duration.ofMinutes(10));
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(util);

    @AfterEach
    void clear() { SecurityContextHolder.clearContext(); }

    @Test
    void no_header_leaves_context_empty() throws Exception {
        HttpServletRequest req = new MockHttpServletRequest();
        HttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(req, res);
    }

    @Test
    void valid_bearer_populates_principal() throws Exception {
        UUID userId = UUID.randomUUID();
        String token = util.generate(userId, "a@b.com", "MEMBER");
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer " + token);
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, new MockHttpServletResponse(), chain);

        var auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.getPrincipal()).isInstanceOf(UserPrincipal.class);
        UserPrincipal principal = (UserPrincipal) auth.getPrincipal();
        assertThat(principal.id()).isEqualTo(userId);
        assertThat(principal.email()).isEqualTo("a@b.com");
    }

    @Test
    void malformed_token_leaves_context_empty() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer not-a-real-jwt");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(req, res);
    }
}
```

- [ ] **Step 9.2: Run (expect FAIL — filter not defined)**

```bash
./mvnw -q test -Dtest=JwtAuthenticationFilterTest
```

Expected: compilation failure.

- [ ] **Step 9.3: Implement filter**

```java
package com.timixa.backend.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwt;

    public JwtAuthenticationFilter(JwtUtil jwt) { this.jwt = jwt; }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        jwt.extract(req).ifPresent(token -> {
            try {
                Claims c = jwt.parse(token);
                UserPrincipal principal = new UserPrincipal(
                    UUID.fromString(c.getSubject()),
                    c.get("email", String.class),
                    c.get("role", String.class)
                );
                var auth = new UsernamePasswordAuthenticationToken(
                    principal, null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + principal.role()))
                );
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception ignored) {
                // bad token → leave context empty; security chain rejects downstream
            }
        });
        chain.doFilter(req, res);
    }
}
```

- [ ] **Step 9.4: Run (expect PASS)**

```bash
./mvnw -q test -Dtest=JwtAuthenticationFilterTest
```

Expected: 3 passing.

- [ ] **Step 9.5: Checkpoint.**

---

## Phase C — Security wiring + error envelope

### Task 10: Wire JwtAuthenticationFilter into SecurityConfig

**Files:**
- Modify: `apps/backend-java/src/main/java/com/timixa/backend/config/SecurityConfig.java`

- [ ] **Step 10.1: Update SecurityConfig**

Replace the existing class body with:

```java
package com.timixa.backend.config;

import com.timixa.backend.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtFilter) {
        this.jwtFilter = jwtFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration c = new CorsConfiguration();
        c.setAllowedOrigins(List.of("http://localhost:4200"));
        c.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
        c.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        c.setAllowCredentials(false);
        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", c);
        return src;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> {})
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/auth/**", "/api/health", "/h2/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .httpBasic(b -> b.disable())
            .formLogin(f -> f.disable())
            .headers(h -> h.frameOptions(fo -> fo.disable()));
        return http.build();
    }
}
```

- [ ] **Step 10.2: Run prior tests**

```bash
./mvnw -q test -Dtest='HealthControllerTest,JwtUtilTest,JwtAuthenticationFilterTest'
```

Expected: all passing.

- [ ] **Step 10.3: Checkpoint.**

---

### Task 11: Error envelope + custom exceptions

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/common/ErrorResponse.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/common/EmailTakenException.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/common/InvalidCredentialsException.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/common/OnboardingAlreadyCompleteException.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/common/GlobalExceptionHandler.java`

- [ ] **Step 11.1: Create `ErrorResponse.java`**

```java
package com.timixa.backend.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(String code, String message, Map<String, String> fields) {

    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(code, message, null);
    }

    public static ErrorResponse of(String code, String message, Map<String, String> fields) {
        return new ErrorResponse(code, message, fields);
    }
}
```

- [ ] **Step 11.2: Create three custom exceptions**

`EmailTakenException.java`:
```java
package com.timixa.backend.common;
public class EmailTakenException extends RuntimeException {
    public EmailTakenException() { super("Email already in use"); }
}
```

`InvalidCredentialsException.java`:
```java
package com.timixa.backend.common;
public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException() { super("Invalid credentials"); }
}
```

`OnboardingAlreadyCompleteException.java`:
```java
package com.timixa.backend.common;
public class OnboardingAlreadyCompleteException extends RuntimeException {
    public OnboardingAlreadyCompleteException() { super("Onboarding already complete"); }
}
```

- [ ] **Step 11.3: Create `GlobalExceptionHandler.java`**

```java
package com.timixa.backend.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> fields = new HashMap<>();
        e.getBindingResult().getFieldErrors().forEach(fe ->
            fields.put(fe.getField(), fe.getDefaultMessage()));
        return ResponseEntity.badRequest()
            .body(ErrorResponse.of("VALIDATION_ERROR", "Invalid request", fields));
    }

    @ExceptionHandler(EmailTakenException.class)
    public ResponseEntity<ErrorResponse> handleEmailTaken(EmailTakenException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ErrorResponse.of("EMAIL_TAKEN", e.getMessage()));
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCreds(InvalidCredentialsException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(ErrorResponse.of("INVALID_CREDENTIALS", e.getMessage()));
    }

    @ExceptionHandler(OnboardingAlreadyCompleteException.class)
    public ResponseEntity<ErrorResponse> handleOnboardingDone(OnboardingAlreadyCompleteException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ErrorResponse.of("ONBOARDING_ALREADY_COMPLETE", e.getMessage()));
    }

    @ExceptionHandler({AuthenticationException.class, BadCredentialsException.class})
    public ResponseEntity<ErrorResponse> handleAuth(AuthenticationException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(ErrorResponse.of("UNAUTHENTICATED", "Authentication required"));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ErrorResponse.of("FORBIDDEN", "Access denied"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleAny(Exception e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ErrorResponse.of("INTERNAL", "Internal server error"));
    }
}
```

- [ ] **Step 11.4: Compile**

```bash
./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 11.5: Checkpoint.**

---

## Phase D — Auth endpoints

### Task 12: DTOs for register/login + UserResponse mapper

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/auth/dto/RegisterRequest.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/auth/dto/LoginRequest.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/auth/dto/AuthResponse.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/user/dto/UserResponse.java`

- [ ] **Step 12.1: `RegisterRequest.java`**

```java
package com.timixa.backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @Email @NotBlank String email,
    @NotBlank @Size(min = 8, max = 100) String password,
    @NotBlank @Size(min = 1, max = 80) String name
) {}
```

- [ ] **Step 12.2: `LoginRequest.java`**

```java
package com.timixa.backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
    @Email @NotBlank String email,
    @NotBlank String password
) {}
```

- [ ] **Step 12.3: `UserResponse.java`**

```java
package com.timixa.backend.user.dto;

import com.timixa.backend.user.Role;
import com.timixa.backend.user.User;

import java.util.UUID;

public record UserResponse(
    UUID id,
    String name,
    String email,
    Role role,
    Integer age,
    String occupation,
    String bedtime,
    String wakeTime,
    boolean onboardingComplete
) {
    public static UserResponse from(User u) {
        return new UserResponse(
            u.getId(), u.getName(), u.getEmail(), u.getRole(),
            u.getAge(), u.getOccupation(), u.getBedtime(), u.getWakeTime(),
            u.isOnboardingComplete()
        );
    }
}
```

- [ ] **Step 12.4: `AuthResponse.java`**

```java
package com.timixa.backend.auth.dto;

import com.timixa.backend.user.dto.UserResponse;

public record AuthResponse(String token, UserResponse user) {}
```

- [ ] **Step 12.5: Compile**

```bash
./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 12.6: Checkpoint.**

---

### Task 13: AuthService with TDD

**Files:**
- Create: `apps/backend-java/src/test/java/com/timixa/backend/auth/AuthServiceTest.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/auth/AuthService.java`

- [ ] **Step 13.1: Write the failing test**

```java
package com.timixa.backend.auth;

import com.timixa.backend.auth.dto.AuthResponse;
import com.timixa.backend.auth.dto.LoginRequest;
import com.timixa.backend.auth.dto.RegisterRequest;
import com.timixa.backend.common.EmailTakenException;
import com.timixa.backend.common.InvalidCredentialsException;
import com.timixa.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("dev")
class AuthServiceTest {

    @Autowired AuthService auth;
    @Autowired UserRepository users;

    @BeforeEach
    void clean() { users.deleteAll(); }

    @Test
    void register_creates_user_and_returns_token() {
        AuthResponse res = auth.register(new RegisterRequest("a@b.com", "password123", "Alex"));
        assertThat(res.token()).isNotBlank();
        assertThat(res.user().email()).isEqualTo("a@b.com");
        assertThat(res.user().onboardingComplete()).isFalse();
        assertThat(users.existsByEmailIgnoreCase("A@B.COM")).isTrue();
    }

    @Test
    void register_with_duplicate_email_throws() {
        auth.register(new RegisterRequest("a@b.com", "password123", "Alex"));
        assertThatThrownBy(() ->
            auth.register(new RegisterRequest("A@B.COM", "differentpw", "Alex2"))
        ).isInstanceOf(EmailTakenException.class);
    }

    @Test
    void login_with_correct_credentials_returns_token() {
        auth.register(new RegisterRequest("a@b.com", "password123", "Alex"));
        AuthResponse res = auth.login(new LoginRequest("a@b.com", "password123"));
        assertThat(res.token()).isNotBlank();
    }

    @Test
    void login_with_wrong_password_throws_invalid_credentials() {
        auth.register(new RegisterRequest("a@b.com", "password123", "Alex"));
        assertThatThrownBy(() -> auth.login(new LoginRequest("a@b.com", "wrong-pw1")))
            .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void login_with_unknown_user_throws_same_exception() {
        assertThatThrownBy(() -> auth.login(new LoginRequest("nobody@b.com", "password123")))
            .isInstanceOf(InvalidCredentialsException.class);
    }
}
```

- [ ] **Step 13.2: Run (expect FAIL — class missing)**

```bash
./mvnw -q test -Dtest=AuthServiceTest
```

Expected: compilation failure.

- [ ] **Step 13.3: Implement AuthService**

```java
package com.timixa.backend.auth;

import com.timixa.backend.auth.dto.AuthResponse;
import com.timixa.backend.auth.dto.LoginRequest;
import com.timixa.backend.auth.dto.RegisterRequest;
import com.timixa.backend.common.EmailTakenException;
import com.timixa.backend.common.InvalidCredentialsException;
import com.timixa.backend.security.JwtUtil;
import com.timixa.backend.user.Role;
import com.timixa.backend.user.User;
import com.timixa.backend.user.UserRepository;
import com.timixa.backend.user.dto.UserResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtUtil jwt;

    public AuthService(UserRepository users, PasswordEncoder encoder, JwtUtil jwt) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (users.existsByEmailIgnoreCase(req.email())) {
            throw new EmailTakenException();
        }
        User u = new User();
        u.setEmail(req.email());
        u.setPasswordHash(encoder.encode(req.password()));
        u.setName(req.name());
        u.setRole(Role.MEMBER);
        u.setOnboardingComplete(false);
        users.save(u);
        return new AuthResponse(token(u), UserResponse.from(u));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        User u = users.findByEmailIgnoreCase(req.email())
            .orElseThrow(InvalidCredentialsException::new);
        if (!encoder.matches(req.password(), u.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        return new AuthResponse(token(u), UserResponse.from(u));
    }

    private String token(User u) {
        return jwt.generate(u.getId(), u.getEmail(), u.getRole().name());
    }
}
```

- [ ] **Step 13.4: Run (expect PASS)**

```bash
./mvnw -q test -Dtest=AuthServiceTest
```

Expected: 5 passing.

- [ ] **Step 13.5: Checkpoint.**

---

### Task 14: AuthController + integration test

**Files:**
- Create: `apps/backend-java/src/test/java/com/timixa/backend/auth/AuthControllerTest.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/auth/AuthController.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/user/UserService.java` (just the `findById` helper used by `/me`)

- [ ] **Step 14.1: Write failing test**

```java
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
```

- [ ] **Step 14.2: Run (expect FAIL — controller missing)**

```bash
./mvnw -q test -Dtest=AuthControllerTest
```

Expected: 404s on every endpoint, OR compilation failure if missing classes.

- [ ] **Step 14.3: Create `UserService.java`**

```java
package com.timixa.backend.user;

import com.timixa.backend.user.dto.UserResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository users;

    public UserService(UserRepository users) { this.users = users; }

    @Transactional(readOnly = true)
    public UserResponse findById(UUID id) {
        return users.findById(id)
            .map(UserResponse::from)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
```

- [ ] **Step 14.4: Create `AuthController.java`**

```java
package com.timixa.backend.auth;

import com.timixa.backend.auth.dto.AuthResponse;
import com.timixa.backend.auth.dto.LoginRequest;
import com.timixa.backend.auth.dto.RegisterRequest;
import com.timixa.backend.security.UserPrincipal;
import com.timixa.backend.user.UserService;
import com.timixa.backend.user.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final UserService users;

    public AuthController(AuthService auth, UserService users) {
        this.auth = auth;
        this.users = users;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(auth.register(req));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        return auth.login(req);
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal UserPrincipal principal) {
        return users.findById(principal.id());
    }
}
```

- [ ] **Step 14.5: Run (expect PASS)**

```bash
./mvnw -q test -Dtest=AuthControllerTest
```

Expected: 7 passing.

- [ ] **Step 14.6: Run the full backend suite so far**

```bash
./mvnw -q test
```

Expected: all green.

- [ ] **Step 14.7: Checkpoint.**

---

## Phase E — Onboarding endpoint

### Task 15: OnboardingRequest DTO + UserService.completeOnboarding

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/user/dto/OnboardingRequest.java`
- Modify: `apps/backend-java/src/main/java/com/timixa/backend/user/UserService.java`

- [ ] **Step 15.1: `OnboardingRequest.java`**

```java
package com.timixa.backend.user.dto;

import jakarta.validation.constraints.*;

public record OnboardingRequest(
    @NotNull @Min(13) @Max(120) Integer age,
    @NotBlank @Size(min = 1, max = 80) String occupation,
    @NotBlank @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "must be HH:mm") String bedtime,
    @NotBlank @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "must be HH:mm") String wakeTime
) {}
```

- [ ] **Step 15.2: Extend `UserService`**

Replace the file with:

```java
package com.timixa.backend.user;

import com.timixa.backend.common.OnboardingAlreadyCompleteException;
import com.timixa.backend.user.dto.OnboardingRequest;
import com.timixa.backend.user.dto.UserResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository users;

    public UserService(UserRepository users) { this.users = users; }

    @Transactional(readOnly = true)
    public UserResponse findById(UUID id) {
        return users.findById(id)
            .map(UserResponse::from)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }

    @Transactional
    public UserResponse completeOnboarding(UUID id, OnboardingRequest req) {
        User u = users.findById(id).orElseThrow(() -> new RuntimeException("User not found"));
        if (u.isOnboardingComplete()) {
            throw new OnboardingAlreadyCompleteException();
        }
        u.setAge(req.age());
        u.setOccupation(req.occupation());
        u.setBedtime(req.bedtime());
        u.setWakeTime(req.wakeTime());
        u.setOnboardingComplete(true);
        return UserResponse.from(users.save(u));
    }
}
```

- [ ] **Step 15.3: Compile**

```bash
./mvnw -q compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 15.4: Checkpoint.**

---

### Task 16: UserController PATCH `/api/users/me/onboarding` + integration test

**Files:**
- Create: `apps/backend-java/src/test/java/com/timixa/backend/user/UserControllerTest.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/user/UserController.java`

- [ ] **Step 16.1: Write failing test**

```java
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
```

- [ ] **Step 16.2: Run (expect FAIL)**

```bash
./mvnw -q test -Dtest=UserControllerTest
```

Expected: 404 on PATCH because controller missing.

- [ ] **Step 16.3: Create `UserController.java`**

```java
package com.timixa.backend.user;

import com.timixa.backend.security.UserPrincipal;
import com.timixa.backend.user.dto.OnboardingRequest;
import com.timixa.backend.user.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService users;

    public UserController(UserService users) { this.users = users; }

    @PatchMapping("/me/onboarding")
    public UserResponse completeOnboarding(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody OnboardingRequest req) {
        return users.completeOnboarding(principal.id(), req);
    }
}
```

- [ ] **Step 16.4: Run (expect PASS)**

```bash
./mvnw -q test -Dtest=UserControllerTest
```

Expected: 4 passing.

- [ ] **Step 16.5: Run full backend suite**

```bash
./mvnw -q test
```

Expected: all green.

- [ ] **Step 16.6: Checkpoint.**

---

## Phase F — Reverse proxy + test reset endpoint

### Task 17: WebClient config + LegacyProxyController

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/config/WebClientConfig.java`
- Create: `apps/backend-java/src/main/java/com/timixa/backend/proxy/LegacyProxyController.java`

- [ ] **Step 17.1: `WebClientConfig.java`**

```java
package com.timixa.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Bean
    public WebClient legacyClient(@Value("${app.legacy.base-url}") String baseUrl) {
        return WebClient.builder().baseUrl(baseUrl).build();
    }
}
```

- [ ] **Step 17.2: `LegacyProxyController.java`**

```java
package com.timixa.backend.proxy;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DefaultDataBufferFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

@RestController
public class LegacyProxyController {

    private final WebClient legacy;

    public LegacyProxyController(WebClient legacyClient) { this.legacy = legacyClient; }

    @RequestMapping("/api/**")
    public Mono<ResponseEntity<byte[]>> proxy(HttpServletRequest request) throws IOException {
        String path = request.getRequestURI();          // /api/something
        String query = request.getQueryString();
        String upstreamPath = path.replaceFirst("^/api", "");  // strip /api prefix
        String fullPath = upstreamPath + (query != null ? "?" + query : "");

        byte[] body = request.getInputStream().readAllBytes();
        HttpMethod method = HttpMethod.valueOf(request.getMethod());

        WebClient.RequestBodySpec spec = legacy.method(method).uri(fullPath);

        // copy headers (skip Host)
        var headerNames = request.getHeaderNames();
        while (headerNames.hasMoreElements()) {
            String h = headerNames.nextElement();
            if (h.equalsIgnoreCase("host") || h.equalsIgnoreCase("content-length")) continue;
            spec.header(h, request.getHeader(h));
        }

        WebClient.RequestHeadersSpec<?> finalSpec =
            body.length == 0 ? spec : spec.body(BodyInserters.fromValue(body));

        return finalSpec.exchangeToMono(resp ->
            resp.bodyToMono(byte[].class)
                .defaultIfEmpty(new byte[0])
                .map(bytes -> {
                    ResponseEntity.BodyBuilder out = ResponseEntity.status(resp.statusCode());
                    resp.headers().asHttpHeaders().forEach((k, v) -> {
                        if (!k.equalsIgnoreCase("transfer-encoding")) out.header(k, v.toArray(new String[0]));
                    });
                    return out.body(bytes);
                })
        );
    }
}
```

> Spring's path-matching means specific `@RestController` mappings (`/api/auth/**`, `/api/users/**`, `/api/health`) take precedence over the `/api/**` catch-all when the URL matches. Verify in the manual test below.

- [ ] **Step 17.3: Verify routing precedence (manual)**

In one terminal:
```bash
cd apps/backend-java && ./mvnw spring-boot:run
```

In another terminal:
```bash
# specific route → handled in-process (200)
curl -s http://localhost:8080/api/health
# {"status":"ok"}

# unknown route under /api → proxied to Express (expect connection refused if Express isn't running, or whatever Express returns)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/habits
# 502 or 503 if Express is down — that's OK; we're just verifying the proxy is reached.
```

Stop the server.

- [ ] **Step 17.4: Run the full backend suite to ensure proxy didn't break existing tests**

```bash
./mvnw -q test
```

Expected: all green.

- [ ] **Step 17.5: Checkpoint.**

---

### Task 18: Dev-profile test reset endpoint

**Files:**
- Create: `apps/backend-java/src/main/java/com/timixa/backend/test/TestResetController.java`
- Modify: `apps/backend-java/src/main/java/com/timixa/backend/config/SecurityConfig.java`

> This endpoint exists ONLY under the `dev` profile so Playwright tests can truncate the user table between runs without polluting prod.

- [ ] **Step 18.1: Create `TestResetController.java`**

```java
package com.timixa.backend.test;

import com.timixa.backend.user.UserRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/test")
@Profile("dev")
public class TestResetController {

    private final UserRepository users;

    public TestResetController(UserRepository users) { this.users = users; }

    @PostMapping("/reset")
    public ResponseEntity<Void> reset() {
        users.deleteAll();
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 18.2: Open `/api/test/**` in SecurityConfig**

In `SecurityConfig.securityFilterChain`, update the matchers line:

```java
.requestMatchers("/api/auth/**", "/api/health", "/api/test/**", "/h2/**").permitAll()
```

- [ ] **Step 18.3: Verify (manual)**

```bash
./mvnw spring-boot:run
# in another terminal:
curl -s -X POST -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/test/reset
# 204
```

Stop the server.

- [ ] **Step 18.4: Run full test suite**

```bash
./mvnw -q test
```

Expected: all green.

- [ ] **Step 18.5: Checkpoint.**

---

## Phase G — Frontend wiring

### Task 19: Frontend dev-server proxy

**Files:**
- Create: `apps/frontend/proxy.conf.json`
- Modify: `apps/frontend/angular.json` (serve target → wire proxy)
- Modify: `apps/frontend/src/environments/environment.ts`

- [ ] **Step 19.1: Create `proxy.conf.json`**

```json
{
  "/api": {
    "target": "http://localhost:8080",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  }
}
```

- [ ] **Step 19.2: Wire proxy into `angular.json`**

In `apps/frontend/angular.json`, locate the `serve` target (currently at lines 49-56). Add a `"options"` block above `"configurations"`:

```json
"serve": {
  "builder": "@angular-devkit/build-angular:dev-server",
  "options": {
    "proxyConfig": "proxy.conf.json"
  },
  "configurations": {
    "production": { "buildTarget": "timixa-frontend:build:production" },
    "development": { "buildTarget": "timixa-frontend:build:development" }
  },
  "defaultConfiguration": "development"
}
```

- [ ] **Step 19.3: Update `environment.ts`**

Replace the file contents with:

```ts
export const environment = {
  production: false,
  apiUrl: '/api',
};
```

- [ ] **Step 19.4: Verify** — no test runs here; integration is verified in Task 30 (end-to-end).

- [ ] **Step 19.5: Checkpoint.**

---

### Task 20: Extend `User` model

**Files:**
- Modify: `apps/frontend/src/app/core/models/user.model.ts`

- [ ] **Step 20.1: Replace file contents**

```ts
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'admin' | 'member' | 'ADMIN' | 'MEMBER';
  age?: number;
  occupation?: string;
  bedtime?: string;
  wakeTime?: string;
  onboardingComplete: boolean;
}
```

> The union on `role` accepts both casings — Spring serializes `Role.MEMBER` as `"MEMBER"` while mock JSON files use `"member"`. Tolerate both during Slice 1; we'll normalize when migrating other services.

- [ ] **Step 20.2: Verify compilation**

```bash
cd apps/frontend && npx ng build --configuration development
```

Expected: BUILD SUCCESS (any warnings about unused fields are OK).

- [ ] **Step 20.3: Checkpoint.**

---

### Task 21: Update auth interceptor — match `/api/auth/**`

**Files:**
- Modify: `apps/frontend/src/app/core/interceptors/auth.interceptor.ts`

- [ ] **Step 21.1: Replace file contents**

```ts
import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

const PUBLIC_PATH_PREFIXES = ['/api/auth/', '/api/health', '/api/test/'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  const isPublic = PUBLIC_PATH_PREFIXES.some(p => req.url.startsWith(p));
  const token = localStorage.getItem('timixa_token');

  const authedReq =
    token && !isPublic
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authedReq).pipe(
    catchError(err => {
      if (err.status === 401 && !isPublic) {
        localStorage.removeItem('timixa_token');
        router.navigate(['/auth/login']);
      }
      return throwError(() => err);
    }),
  );
};
```

- [ ] **Step 21.2: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 21.3: Checkpoint.**

---

### Task 22: Rewrite `AuthService`

**Files:**
- Modify: `apps/frontend/src/app/core/services/auth.service.ts`

- [ ] **Step 22.1: Replace file contents**

```ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, Observable, map, tap } from 'rxjs';
import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';

interface AuthResponse { token: string; user: User; }

export interface RegisterPayload { name: string; email: string; password: string; }
export interface LoginPayload    { email: string; password: string; }
export interface OnboardingPayload { age: number; occupation: string; bedtime: string; wakeTime: string; }

const TOKEN_KEY = 'timixa_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private api = `${environment.apiUrl}/auth`;
  private userApi = `${environment.apiUrl}/users`;

  private _currentUser = signal<User | null>(null);
  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this._currentUser() !== null);

  async bootstrap(): Promise<void> {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    try {
      const user = await firstValueFrom(this.http.get<User>(`${this.api}/me`));
      this._currentUser.set(user);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      this._currentUser.set(null);
    }
  }

  register(payload: RegisterPayload): Observable<User> {
    return this.http.post<AuthResponse>(`${this.api}/register`, payload).pipe(
      tap(({ token, user }) => { localStorage.setItem(TOKEN_KEY, token); this._currentUser.set(user); }),
      map(({ user }) => user),
    );
  }

  login(payload: LoginPayload): Observable<User> {
    return this.http.post<AuthResponse>(`${this.api}/login`, payload).pipe(
      tap(({ token, user }) => { localStorage.setItem(TOKEN_KEY, token); this._currentUser.set(user); }),
      map(({ user }) => user),
    );
  }

  completeOnboarding(payload: OnboardingPayload): Observable<User> {
    return this.http
      .patch<User>(`${this.userApi}/me/onboarding`, payload)
      .pipe(tap(user => this._currentUser.set(user)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  hasToken(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  }
}
```

- [ ] **Step 22.2: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 22.3: Checkpoint.**

---

### Task 23: Wire `APP_INITIALIZER` in `app.config.ts`

**Files:**
- Modify: `apps/frontend/src/app/app.config.ts`

- [ ] **Step 23.1: Replace file contents**

```ts
import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withViewTransitions()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [AuthService],
      useFactory: (auth: AuthService) => () => auth.bootstrap(),
    },
  ],
};
```

- [ ] **Step 23.2: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 23.3: Checkpoint.**

---

### Task 24: Onboarding guard

**Files:**
- Create: `apps/frontend/src/app/core/guards/onboarding.guard.ts`

- [ ] **Step 24.1: Create guard**

```ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const onboardingGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.currentUser();

  // user not yet hydrated (no token) — let authGuard handle redirect
  if (!user) return true;

  const onOnboardingPage = state.url.startsWith('/onboarding');

  if (!user.onboardingComplete && !onOnboardingPage) {
    return router.createUrlTree(['/onboarding']);
  }
  if (user.onboardingComplete && onOnboardingPage) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};
```

- [ ] **Step 24.2: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 24.3: Checkpoint.**

---

### Task 25: Create `OnboardingComponent`

**Files:**
- Create: `apps/frontend/src/app/features/auth/onboarding/onboarding.component.ts`

- [ ] **Step 25.1: Create the component (inline template + styles)**

```ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div class="w-full max-w-sm">
        <div class="flex flex-col items-center mb-10">
          <div class="w-16 h-16 rounded-[20px] flex items-center justify-center mb-4"
               style="background: linear-gradient(135deg, #451de3, #00c1fd)">
            <span class="material-symbols-outlined text-white text-[32px]">person</span>
          </div>
          <h1 class="font-manrope font-bold text-h1 text-on-surface tracking-tight">Tell us about yourself</h1>
          <p class="text-on-surface-variant text-sm mt-1 text-center">A few quick questions so we can plan your day</p>
        </div>

        <form #f="ngForm" (ngSubmit)="submit(f)" class="bg-surface-container-lowest rounded-[28px] p-8 shadow-card">
          <div class="space-y-4">
            <div>
              <label class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 block">Age</label>
              <input type="number" name="age" [(ngModel)]="form.age" required min="13" max="120"
                     class="input-ghost" data-testid="onboarding-age" />
            </div>
            <div>
              <label class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 block">Occupation</label>
              <input type="text" name="occupation" [(ngModel)]="form.occupation" required maxlength="80"
                     class="input-ghost" data-testid="onboarding-occupation" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 block">Bedtime</label>
                <input type="time" name="bedtime" [(ngModel)]="form.bedtime" required
                       class="input-ghost" data-testid="onboarding-bedtime" />
              </div>
              <div>
                <label class="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2 block">Wake time</label>
                <input type="time" name="wakeTime" [(ngModel)]="form.wakeTime" required
                       class="input-ghost" data-testid="onboarding-waketime" />
              </div>
            </div>
          </div>

          <p *ngIf="errorMsg()" class="text-red-500 text-sm mt-4" data-testid="onboarding-error">{{ errorMsg() }}</p>

          <button type="submit" [disabled]="f.invalid || busy()"
                  class="btn-primary w-full mt-6 flex items-center justify-center gap-2"
                  data-testid="onboarding-submit">
            <span *ngIf="busy()" class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            <span>{{ busy() ? 'Saving...' : 'Continue' }}</span>
          </button>
        </form>
      </div>
    </div>
  `,
})
export class OnboardingComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  form = { age: null as number | null, occupation: '', bedtime: '', wakeTime: '' };
  busy = signal(false);
  errorMsg = signal<string | null>(null);

  submit(f: NgForm) {
    if (f.invalid || this.form.age == null) return;
    this.busy.set(true);
    this.errorMsg.set(null);
    this.auth.completeOnboarding({
      age: this.form.age,
      occupation: this.form.occupation,
      bedtime: this.form.bedtime,
      wakeTime: this.form.wakeTime,
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        this.busy.set(false);
        if (err?.error?.code === 'ONBOARDING_ALREADY_COMPLETE') {
          this.router.navigateByUrl('/dashboard');
          return;
        }
        this.errorMsg.set(err?.error?.message || 'Could not save your profile. Please try again.');
      },
    });
  }
}
```

- [ ] **Step 25.2: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 25.3: Checkpoint.**

---

### Task 26: Update login/register components

**Files:**
- Modify: `apps/frontend/src/app/features/auth/login/login.component.ts`
- Modify: `apps/frontend/src/app/features/auth/register/register.component.ts`

> Both components currently call `this.auth.login(email, password)` / `register(name, email, password)`. We're changing both to use the new payload-object API and to handle navigation here.

- [ ] **Step 26.1: Update login component — replace the `login()` method and `loading` state usage**

In `login.component.ts`, replace the `LoginComponent` class body with:

```ts
import { Router } from '@angular/router';
// (existing imports — keep them; add Router)

export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  loading = false;
  error: string | null = null;

  login(): void {
    if (!this.email || !this.password) return;
    this.loading = true;
    this.error = null;
    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Invalid credentials';
      },
    });
  }
}
```

Also update the template (in the same file) to show errors. Find this section:

```html
<button (click)="login()" ...
```

Insert immediately above the button:

```html
<p *ngIf="error" class="text-red-500 text-sm mt-3" data-testid="login-error">{{ error }}</p>
```

Add `data-testid` to the email/password/button inputs:
```html
<input ... [(ngModel)]="email" ... data-testid="login-email" />
<input ... [(ngModel)]="password" ... data-testid="login-password" />
<button ... data-testid="login-submit">
```

- [ ] **Step 26.2: Update register component analogously**

Replace `RegisterComponent` class body with:

```ts
import { Router } from '@angular/router';

export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  name = '';
  email = '';
  password = '';
  loading = false;
  error: string | null = null;

  register(): void {
    if (!this.name || !this.email || !this.password) return;
    this.loading = true;
    this.error = null;
    this.auth.register({ name: this.name, email: this.email, password: this.password }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl('/onboarding');
      },
      error: (err) => {
        this.loading = false;
        if (err?.error?.code === 'EMAIL_TAKEN') {
          this.error = 'Email already in use';
        } else if (err?.error?.code === 'VALIDATION_ERROR') {
          const f = err.error.fields || {};
          this.error = Object.values(f)[0] as string || 'Please check your input';
        } else {
          this.error = err?.error?.message || 'Registration failed';
        }
      },
    });
  }
}
```

Add error display + `data-testid` attributes in the template as in Task 26.1 (use `register-name`, `register-email`, `register-password`, `register-submit`, `register-error`).

- [ ] **Step 26.3: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 26.4: Checkpoint.**

---

### Task 27: Update `app.routes.ts`

**Files:**
- Modify: `apps/frontend/src/app/app.routes.ts`

- [ ] **Step 27.1: Replace file contents**

```ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { onboardingGuard } from './core/guards/onboarding.guard';

export const routes: Routes = [
  {
    path: 'auth',
    children: [
      { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent) },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./features/auth/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    canActivate: [authGuard, onboardingGuard],
  },
  {
    path: '',
    loadComponent: () => import('./shared/layout/app-shell/app-shell.component').then(m => m.AppShellComponent),
    canActivate: [authGuard, onboardingGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/today-dashboard/today-dashboard.component').then(m => m.TodayDashboardComponent) },
      { path: 'projects', loadComponent: () => import('./features/projects/projects-dashboard/projects-dashboard.component').then(m => m.ProjectsDashboardComponent) },
      { path: 'projects/:id/board', loadComponent: () => import('./features/projects/project-kanban/project-kanban.component').then(m => m.ProjectKanbanComponent) },
      { path: 'projects/:id/meeting', loadComponent: () => import('./features/projects/meeting-scheduler/meeting-scheduler.component').then(m => m.MeetingSchedulerComponent), canActivate: [adminGuard] },
      { path: 'schedule/calendar', loadComponent: () => import('./features/schedule/calendar/calendar.component').then(m => m.CalendarComponent) },
      { path: 'schedule', loadComponent: () => import('./features/schedule/schedule-day/schedule-day.component').then(m => m.ScheduleDayComponent) },
      { path: 'schedule/week', loadComponent: () => import('./features/schedule/schedule-week/schedule-week.component').then(m => m.ScheduleWeekComponent) },
      { path: 'schedule/month', loadComponent: () => import('./features/schedule/schedule-month/schedule-month.component').then(m => m.ScheduleMonthComponent) },
      { path: 'insights', loadComponent: () => import('./features/insights/insights-dashboard/insights-dashboard.component').then(m => m.InsightsDashboardComponent) },
      { path: 'reminders', loadComponent: () => import('./features/reminders/smart-reminders/smart-reminders.component').then(m => m.SmartRemindersComponent) },
      { path: 'new-task', loadComponent: () => import('./features/new-task/new-task.component').then(m => m.NewTaskComponent) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'auth/login' },
];
```

- [ ] **Step 27.2: Verify build**

```bash
npx ng build --configuration development
```

Expected: BUILD SUCCESS.

- [ ] **Step 27.3: Checkpoint.**

---

### Task 28: End-to-end manual smoke

> All three servers must be running. Start them in three terminals.

- [ ] **Step 28.1: Start Express backend (proxied)**

```bash
cd apps/backend && npm run dev
```

Expected: `Timixa API running on http://localhost:3000`.

- [ ] **Step 28.2: Start Spring Boot**

```bash
cd apps/backend-java && ./mvnw spring-boot:run
```

Expected: `Started TimixaApplication in N seconds`. Listening on :8080.

- [ ] **Step 28.3: Start Angular**

```bash
cd apps/frontend && npm start
```

Expected: dev server up on `http://localhost:4200`, proxy log shows `[HPM] Proxy created` for `/api`.

- [ ] **Step 28.4: Manual end-to-end**

Open browser at `http://localhost:4200`:
1. Click "Sign up" → fill name/email/password → submit → expect `/onboarding`.
2. Fill all four onboarding fields → submit → expect `/dashboard`.
3. Open DevTools → Application → Local Storage → `timixa_token` should exist.
4. Reload → still on `/dashboard`, no flash to `/auth/login`.
5. Logout via app shell → back to `/auth/login`. Token gone.
6. Login with same email/password → straight to `/dashboard`.

- [ ] **Step 28.5: Stop all three servers.**

- [ ] **Step 28.6: Checkpoint.**

---

## Phase H — Playwright e2e

### Task 29: Set up `apps/e2e` workspace

**Files:**
- Create: `apps/e2e/package.json`
- Create: `apps/e2e/playwright.config.ts`
- Create: `apps/e2e/tsconfig.json`
- Modify: root `package.json` (add `e2e` script)

- [ ] **Step 29.1: Create `apps/e2e/package.json`**

```json
{
  "name": "timixa-e2e",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "install-browsers": "playwright install --with-deps chromium"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "typescript": "~5.4.0"
  }
}
```

- [ ] **Step 29.2: Create `apps/e2e/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'cd ../backend && npm run dev',
      url: 'http://localhost:3000/health',
      timeout: 60_000,
      reuseExistingServer: true,
    },
    {
      command: 'cd ../backend-java && ./mvnw spring-boot:run',
      url: 'http://localhost:8080/api/health',
      timeout: 120_000,
      reuseExistingServer: true,
    },
    {
      command: 'cd ../frontend && npm start -- --no-open',
      url: 'http://localhost:4200',
      timeout: 120_000,
      reuseExistingServer: true,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

- [ ] **Step 29.3: Create `apps/e2e/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["tests/**/*.ts", "playwright.config.ts"]
}
```

- [ ] **Step 29.4: Add root `e2e` script**

In root `package.json`, change `"scripts"` to:

```json
"scripts": {
  "frontend": "npm run start --workspace=apps/frontend",
  "backend": "npm run dev --workspace=apps/backend",
  "backend-java": "cd apps/backend-java && ./mvnw spring-boot:run",
  "e2e": "npm run test --workspace=apps/e2e",
  "e2e:install": "npm run install-browsers --workspace=apps/e2e"
}
```

- [ ] **Step 29.5: Install Playwright browsers**

From repo root:
```bash
npm install
npm run e2e:install
```

Expected: `playwright` downloads chromium. Confirmation message ends with `Downloading … done`.

- [ ] **Step 29.6: Checkpoint.**

---

### Task 30: Write Playwright e2e tests

**Files:**
- Create: `apps/e2e/tests/auth-and-onboarding.spec.ts`

- [ ] **Step 30.1: Write the spec**

```ts
import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8080/api';

async function resetDb(page: Page) {
  await page.request.post(`${API}/test/reset`);
}

async function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;
}

test.beforeEach(async ({ page }) => {
  await resetDb(page);
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('register → onboarding → dashboard', async ({ page }) => {
  const email = await uniqueEmail();

  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('E2E User');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();

  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByTestId('onboarding-age').fill('28');
  await page.getByTestId('onboarding-occupation').fill('Engineer');
  await page.getByTestId('onboarding-bedtime').fill('22:30');
  await page.getByTestId('onboarding-waketime').fill('06:30');
  await page.getByTestId('onboarding-submit').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  const token = await page.evaluate(() => localStorage.getItem('timixa_token'));
  expect(token).toBeTruthy();
});

test('duplicate email shows error', async ({ page }) => {
  const email = await uniqueEmail();

  // first registration
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('Alice');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();
  await expect(page).toHaveURL(/\/onboarding$/);

  // clear token, retry with same email
  await page.evaluate(() => localStorage.clear());
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('Bob');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();

  await expect(page.getByTestId('register-error')).toHaveText(/Email already in use/i);
});

test('wrong password shows generic error', async ({ page }) => {
  const email = await uniqueEmail();
  // register
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('Alice');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();
  await expect(page).toHaveURL(/\/onboarding$/);

  // logout
  await page.evaluate(() => localStorage.clear());

  // attempt login with wrong password
  await page.goto('/auth/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill('wrong-pw1');
  await page.getByTestId('login-submit').click();

  await expect(page.getByTestId('login-error')).toHaveText(/Invalid credentials/i);
});

test('user with incomplete onboarding is bounced to /onboarding', async ({ page }) => {
  const email = await uniqueEmail();
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('Alice');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();
  await expect(page).toHaveURL(/\/onboarding$/);

  // simulate reload before submitting onboarding
  await page.reload();
  await expect(page).toHaveURL(/\/onboarding$/);

  // try to navigate elsewhere — should bounce back
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/onboarding$/);
});

test('completed user lands on /dashboard after login', async ({ page }) => {
  const email = await uniqueEmail();
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('Alice');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();
  await page.getByTestId('onboarding-age').fill('28');
  await page.getByTestId('onboarding-occupation').fill('Engineer');
  await page.getByTestId('onboarding-bedtime').fill('22:30');
  await page.getByTestId('onboarding-waketime').fill('06:30');
  await page.getByTestId('onboarding-submit').click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.evaluate(() => localStorage.clear());

  await page.goto('/auth/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill('password123');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  const token = await page.evaluate(() => localStorage.getItem('timixa_token'));
  expect(token).toBeTruthy();
});

test('expired token redirects to login', async ({ page }) => {
  await page.goto('/auth/login');
  // inject a syntactically valid but unsigned-junk token
  await page.evaluate(() =>
    localStorage.setItem('timixa_token', 'eyJhbGciOiJIUzI1NiJ9.bm90LWEtcmVhbC10b2tlbg.x')
  );
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/auth\/login$/);
  const token = await page.evaluate(() => localStorage.getItem('timixa_token'));
  expect(token).toBeNull();
});

test('unauthenticated /dashboard redirects to /auth/login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/auth\/login$/);
});
```

- [ ] **Step 30.2: Run the suite**

From repo root, with **all three servers up** (Express, Spring Boot, Angular):

```bash
npm run e2e
```

Expected: 7 tests pass. If `webServer` is configured correctly the suite can also be run with everything stopped (Playwright will start the servers); however on first run set `reuseExistingServer: true` keeps things stable when iterating.

- [ ] **Step 30.3: Checkpoint.**

---

## Phase I — Final verification

### Task 31: Full slice verification

- [ ] **Step 31.1: Backend test suite (green)**

```bash
cd apps/backend-java && ./mvnw -q test
```

Expected: all tests pass.

- [ ] **Step 31.2: Frontend production build (green)**

```bash
cd apps/frontend && npx ng build
```

Expected: BUILD SUCCESS (warnings about chunk size are OK).

- [ ] **Step 31.3: Playwright suite (green)**

```bash
cd ../.. && npm run e2e
```

Expected: 7 passing.

- [ ] **Step 31.4: Manual review — Section 11 of the design doc**

Walk through `docs/superpowers/specs/2026-06-03-timixa-slice1-auth-onboarding-design.md` § 11 (Verification checklist). Confirm each item.

- [ ] **Step 31.5: Final checkpoint.** Slice 1 is complete. Ready for Slice 2 (PlannedTask + Dashboard).

---

## Spec coverage check

| Spec section | Implementing tasks |
|---|---|
| § 4 Architecture | Tasks 17 (proxy), 19 (Angular proxy), 10 (security filter) |
| § 5 Project layout | Tasks 1, 2, 3 |
| § 6 Domain model | Tasks 5, 6 |
| § 7 Auth flow | Tasks 7, 8, 9, 10, 11, 12, 13, 14 |
| § 8 Onboarding flow | Tasks 15, 16, 24, 25 |
| § 9 Frontend wiring | Tasks 19, 20, 21, 22, 23, 26, 27 |
| § 10 Testing strategy | Tasks 4, 7, 9, 13, 14, 16, 29, 30 |
| § 11 Verification | Task 28 (manual), Task 31 (suite + manual) |
