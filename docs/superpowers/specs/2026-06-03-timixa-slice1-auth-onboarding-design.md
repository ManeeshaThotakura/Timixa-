# Timixa — Slice 1: Backend Foundation, Auth, and Onboarding

**Date:** 2026-06-03
**Status:** Approved for implementation planning
**Author:** Brainstormed with @ManeeshaThotakura

---

## 1. Overview

Timixa is a habit and task management application with a planned 8-subsystem product surface (auth, onboarding, dashboard, new-task, schedule editor, calendar view, bedtime summary, analytics). This document specifies the **first vertical slice**: standing up a new Spring Boot backend and shipping the auth + onboarding flows end-to-end.

After Slice 1, a new user can register, complete onboarding, and reach the dashboard. Every later slice depends on having a real, JWT-authenticated user and a working backend foundation.

### Context

- The frontend (Angular) already has scaffolded pages for most product surfaces, but every service reads `assets/mock/*.json`.
- An existing Express + SQLite backend lives in `apps/backend/`. The user has chosen to **rewrite it in Spring Boot** rather than extend it.
- Slice 1 focuses **only** on auth + onboarding. Other subsystems are out of scope and will get their own design + plan cycles.

---

## 2. Scope

### In scope

- New Spring Boot 3.3.x project at `apps/backend-java/` (Maven, Java 21).
- `User` entity, JPA repository, BCrypt password hashing.
- JWT-based stateless auth (HS256, 7-day expiry, no refresh tokens).
- Endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/users/me/onboarding`.
- A reverse-proxy controller in Spring Boot that forwards any unmatched `/api/**` request to the existing Express backend on `:3000`.
- Frontend changes: new onboarding page, new `onboardingGuard`, new `AuthInterceptor`, rewritten `AuthService`, extended `User` model, route changes.
- H2 (in-memory) for dev; Postgres + Flyway migration scaffolded for prod (not exercised until deployment).
- Test strategy across three layers: backend JUnit, frontend Karma/Jasmine, root-level Playwright e2e.

### Out of scope

- Any other product surface (dashboard logic, habits, schedule, calendar, bedtime summary, analytics).
- Migrating existing Express endpoints (`/habits`, `/events`, etc.) to Spring Boot — they keep running and are proxied through.
- Email verification, password reset, social login.
- Refresh tokens, token rotation, server-side logout / blacklist.
- Production deployment, nginx/Caddy configuration.
- Cross-browser Playwright sweeps; load testing.

---

## 3. Decisions locked during brainstorming

| Decision | Choice | Reason |
|---|---|---|
| Backend strategy | Rewrite Express → Spring Boot | User preference |
| Express lifecycle during Slice 1 | Keep running; Spring Boot proxies non-auth `/api/**` to it | Avoids breaking other pages while only auth migrates |
| JWT storage on frontend | `localStorage` + `Authorization: Bearer …` header | Simplest path for a personal app; easy Playwright testing |
| JWT expiry | 7 days, no refresh tokens | Personal app; re-login is acceptable UX |
| Email verification | Skip | No SMTP infra; not in spec |
| Password rules | Min 8 characters, no other rules | Standard floor |
| Onboarding fields | `age` (13–120), `occupation` (1–80 chars), `bedtime` (`HH:mm`), `wakeTime` (`HH:mm`); all required | Spec |
| Dev DB | H2 in-memory, fresh per boot, optional seed user | Per PLAN.md; deterministic tests |
| Prod DB | Postgres via Flyway (`V1__init.sql`) | Per PLAN.md; deferred until deployment |
| User PK | UUID string | Avoids leaking row counts; matches frontend model |
| Spring Boot package layout | By feature (`auth/`, `user/`, `proxy/`), not by layer | Slice boundaries map cleanly to packages |

---

## 4. System architecture

### Processes (dev)

```
Browser (Angular dev server :4200)
    │
    │  Angular proxy.conf.json:  /api/* → http://localhost:8080
    ▼
Spring Boot  :8080                        ← Slice 1 owns this
    ├── /api/auth/**          → handled in-process
    ├── /api/users/me/**      → handled in-process
    ├── /api/health           → handled in-process
    └── /api/**  (anything else)
            │  WebClient forward (method, headers, body)
            ▼
        Express  :3000                    ← existing backend, untouched
            └── /habits, /events, /insights, /reminders, etc.
```

### Why the proxy lives inside Spring Boot

- Frontend points at a single origin (`/api`) in both dev and prod.
- We can retire Express incrementally by deleting forwarding rules — the frontend never knows.
- The JWT filter runs at the gateway, so Express continues to run with no JWT awareness.

### Production (out of scope for Slice 1, noted for continuity)

When deployment becomes a concern, an nginx/Caddy reverse proxy replaces the in-process forwarder — same routing rules, no app changes. The Angular build is served from the same origin as the API, so `/api` resolves natively.

### CORS

Spring Boot allows `http://localhost:4200`, methods `GET POST PATCH DELETE OPTIONS`, headers `Authorization, Content-Type`, `allowCredentials=false` (no cookies). Express's existing CORS config stays in place but the browser never talks to it directly.

---

## 5. Spring Boot project layout

**Location:** `apps/backend-java/` (sibling of existing `apps/backend/`).

**Build:** Maven, wrapper checked in (`./mvnw`). Java 21, Spring Boot 3.3.x.

### Dependencies (`pom.xml`)

| Dependency | Purpose |
|---|---|
| `spring-boot-starter-web` | REST controllers |
| `spring-boot-starter-security` | Filter chain, BCrypt, principal |
| `spring-boot-starter-data-jpa` | User repository |
| `spring-boot-starter-validation` | DTO `@Valid` |
| `spring-boot-starter-webflux` | `WebClient` for proxy forwarding |
| `com.h2database:h2` (runtime) | Dev database |
| `org.postgresql:postgresql` (runtime) | Prod database (unused in Slice 1) |
| `io.jsonwebtoken:jjwt-api / impl / jackson` (`0.12.x`) | JWT sign/verify |
| `spring-boot-starter-test`, `spring-security-test` (test) | Unit + integration tests |

### Package tree (Slice 1)

```
apps/backend-java/
├── pom.xml
├── mvnw, mvnw.cmd, .mvn/...
└── src/
    ├── main/java/com/timixa/backend/
    │   ├── TimixaApplication.java
    │   ├── config/
    │   │   ├── SecurityConfig.java         filter chain, BCrypt bean, CORS
    │   │   └── WebClientConfig.java        WebClient bean → http://localhost:3000
    │   ├── security/
    │   │   ├── JwtUtil.java                sign / parse / extract
    │   │   ├── JwtAuthenticationFilter.java
    │   │   └── UserPrincipal.java
    │   ├── auth/
    │   │   ├── AuthController.java         /api/auth/register, /login, /me
    │   │   ├── AuthService.java
    │   │   └── dto/                        RegisterRequest, LoginRequest, AuthResponse
    │   ├── user/
    │   │   ├── User.java                   @Entity
    │   │   ├── UserRepository.java
    │   │   ├── UserController.java         PATCH /api/users/me/onboarding
    │   │   ├── UserService.java
    │   │   └── dto/                        OnboardingRequest, UserResponse
    │   ├── proxy/
    │   │   └── LegacyProxyController.java  catch-all /api/** → Express
    │   └── common/
    │       ├── GlobalExceptionHandler.java
    │       └── ErrorResponse.java
    └── main/resources/
    │   ├── application.yml                 shared
    │   ├── application-dev.yml             H2, seed user, CORS for :4200
    │   ├── application-prod.yml            Postgres, Flyway
    │   ├── db/migration/V1__init.sql       User table (prod only)
    │   └── data-dev.sql                    optional seed user for dev
    └── test/java/com/timixa/backend/
        ├── auth/AuthControllerTest.java
        ├── auth/AuthServiceTest.java
        ├── user/UserControllerTest.java
        ├── security/JwtUtilTest.java
        └── security/JwtAuthenticationFilterTest.java
```

Spring profile `dev` is the default. Override with `--spring.profiles.active=prod` when deploying.

---

## 6. Domain model

### `User` entity (`com.timixa.backend.user.User`)

| Field | Type | Constraints / Notes |
|---|---|---|
| `id` | `UUID` | `@Id`; generated via `UUID.randomUUID()` in `@PrePersist` |
| `email` | `String` | unique index, `@Email`, **lowercased before save** |
| `passwordHash` | `String` | BCrypt (strength 12); never exposed in any DTO |
| `name` | `String` | 1–80 chars |
| `role` | `enum Role { ADMIN, MEMBER }` | defaults to `MEMBER` |
| `age` | `Integer` (nullable) | 13–120; null until onboarding completes |
| `occupation` | `String` (nullable) | 1–80 chars |
| `bedtime` | `String` (nullable) | `HH:mm`, `@Pattern("^([01]\\d\|2[0-3]):[0-5]\\d$")` |
| `wakeTime` | `String` (nullable) | same pattern |
| `onboardingComplete` | `boolean` | defaults `false` |
| `createdAt` | `Instant` | `@CreatedDate` |
| `updatedAt` | `Instant` | `@LastModifiedDate` |

`bedtime`/`wakeTime` are stored as strings (not `LocalTime`) so the wire format is identical end-to-end and no Jackson time-format config is needed.

### DTOs (Java records)

```
RegisterRequest    { @Email email, @Size(min=8) password, @Size(min=1,max=80) name }
LoginRequest       { @Email email, @NotBlank password }
OnboardingRequest  { @Min(13) @Max(120) Integer age,
                     @Size(min=1,max=80) String occupation,
                     @Pattern(...) String bedtime,
                     @Pattern(...) String wakeTime }
UserResponse       { UUID id, String name, String email, Role role,
                     Integer age, String occupation, String bedtime, String wakeTime,
                     boolean onboardingComplete }
AuthResponse       { String token, UserResponse user }
```

`UserResponse` mirrors the existing `apps/frontend/src/app/core/models/user.model.ts` (extended per Section 8). `passwordHash` never appears in any DTO — guaranteed by using records, not entity serialization.

### Repository

```java
UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);
}
```

### DB schema — `V1__init.sql` (prod only)

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
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_users_email_lower ON users (LOWER(email));
```

In dev, H2 uses `spring.jpa.hibernate.ddl-auto=create-drop`; this SQL is unused.

---

## 7. Auth flow

### `POST /api/auth/register` — public

Request: `RegisterRequest { email, password, name }`

1. `@Valid` runs DTO validation → 400 on shape errors.
2. `existsByEmailIgnoreCase(email)` → **409 `EMAIL_TAKEN`** if true.
3. `passwordHash = BCryptPasswordEncoder(strength=12).encode(password)`.
4. Save `User { email lowercased, passwordHash, name, role=MEMBER, onboardingComplete=false }`.
5. Issue JWT.
6. Respond **201** with `AuthResponse { token, user }`.

### `POST /api/auth/login` — public

Request: `LoginRequest { email, password }`

1. Look up user by lowercased email.
2. `BCrypt.matches(password, user.passwordHash)`. **Failure paths (no user / wrong password) both return 401 `INVALID_CREDENTIALS`** to avoid email enumeration.
3. Issue JWT.
4. Respond **200** with `AuthResponse { token, user }`.

### `GET /api/auth/me` — authenticated

Read `UserPrincipal` from `SecurityContextHolder`, load fresh user from DB (so onboarding updates show up), return `UserResponse`. 401 if no/invalid JWT.

### JWT

| Property | Value |
|---|---|
| Library | `io.jsonwebtoken:jjwt 0.12.x` |
| Algorithm | HS256 |
| Secret | `app.jwt.secret`. Dev default in `application-dev.yml`; prod reads env var `TIMIXA_JWT_SECRET` |
| `sub` | user UUID as string |
| Claims | `email`, `role` |
| `iat` / `exp` | issued-at = now; exp = now + 7 days |

`JwtUtil` exposes `generate(User)`, `parse(String) → Claims`, `extract(HttpServletRequest) → Optional<String>`. No refresh logic, no blacklist — logout is purely frontend (drop the token).

### Security filter chain (`SecurityConfig`)

```
http
  .csrf().disable()
  .cors().and()
  .sessionManagement(STATELESS)
  .authorizeHttpRequests(
      "/api/auth/**", "/api/health"  → permitAll,
      anyRequest()                    → authenticated)
  .addFilterBefore(JwtAuthenticationFilter, UsernamePasswordAuthenticationFilter)
  .exceptionHandling(
      authenticationEntryPoint → 401 ErrorResponse,
      accessDeniedHandler      → 403 ErrorResponse)
```

`JwtAuthenticationFilter`:

1. Extract `Authorization: Bearer …`. If absent → continue (anonymous; downstream rejects if endpoint requires auth).
2. Parse JWT; catch `ExpiredJwtException`, `MalformedJwtException`, `SignatureException` → leave context unset.
3. Build `UserPrincipal { id, email, role }` and `UsernamePasswordAuthenticationToken`; set in `SecurityContextHolder`.
4. Continue chain.

### Error envelope

`GlobalExceptionHandler` (`@RestControllerAdvice`):

| Exception | Status | Body |
|---|---|---|
| `MethodArgumentNotValidException` | 400 | `{ code: "VALIDATION_ERROR", fields: {field: msg, …} }` |
| `EmailTakenException` | 409 | `{ code: "EMAIL_TAKEN", message }` |
| `InvalidCredentialsException` | 401 | `{ code: "INVALID_CREDENTIALS", message }` |
| `OnboardingAlreadyCompleteException` | 409 | `{ code: "ONBOARDING_ALREADY_COMPLETE", message }` |
| `AccessDeniedException` | 403 | `{ code: "FORBIDDEN", message }` |
| default fallback | 500 | `{ code: "INTERNAL", message }` (generic in prod) |

`ErrorResponse { code, message, fields? }` is the single error shape the frontend parses.

---

## 8. Onboarding flow

### `PATCH /api/users/me/onboarding` — authenticated

Request: `OnboardingRequest { age, occupation, bedtime, wakeTime }`.

1. Resolve current user from `UserPrincipal`.
2. If `user.onboardingComplete == true` → **409 `ONBOARDING_ALREADY_COMPLETE`** (prevents accidental overwrite via a stale tab; a separate "profile update" endpoint will be added when that becomes a real need).
3. Set the four fields, set `onboardingComplete = true`, save.
4. Respond **200** with refreshed `UserResponse`. **No new token** — claims didn't change.

### Frontend component

**New:** `apps/frontend/src/app/features/auth/onboarding/onboarding.component.ts`

- Reactive form, single screen (no wizard — four fields fit on one mobile view).
- Fields: `age` (number input), `occupation` (text), `bedtime` (`<input type="time">`), `wakeTime` (`<input type="time">`).
- "Continue" disabled until form valid.
- On submit → `authService.completeOnboarding(payload)` → updates the in-memory user signal → `router.navigateByUrl('/dashboard')`.
- Error states: inline field errors from `ErrorResponse.fields`; toast for 409 ("Onboarding already complete — taking you to dashboard") + redirect to `/dashboard`.

### Route placement

Onboarding is a **top-level authenticated route**, NOT a child of `app-shell` — the shell has bottom nav we don't want visible during onboarding.

### `onboardingGuard` rules

- `currentUser.onboardingComplete === false` AND target is not `/onboarding` → redirect to `/onboarding`.
- `currentUser.onboardingComplete === true` AND target IS `/onboarding` → redirect to `/dashboard`.
- Otherwise → allow.

Applied to every child of `app-shell`.

### State model

`AuthService` holds `currentUser = signal<User | null>(null)`. All guards and components read from this signal. On cold reload, `app.config.ts`'s `provideAppInitializer` calls `/api/auth/me` if a token exists, hydrates the signal, then bootstraps routing.

### End-to-end summary

```
1. Register     → POST /api/auth/register → 201 {token, user{onboardingComplete:false}}
                → router.navigate('/onboarding')
2. Submit form  → PATCH /api/users/me/onboarding → 200 {user{onboardingComplete:true}}
                → router.navigate('/dashboard')
3. Reload       → token exists → APP_INITIALIZER calls /api/auth/me
                → currentUser populated → routing proceeds
                → onboardingGuard allows /dashboard
4. Closed-tab interrupt → returning user with incomplete onboarding is bounced to /onboarding by guard
```

Partial onboarding state is not saved — the form is small enough that re-entering is acceptable.

---

## 9. Frontend wiring

### New files

**`apps/frontend/src/app/core/config/environment.ts`**

```ts
export const environment = {
  apiBase: '/api',   // Angular dev server proxies → http://localhost:8080
};
```

Production builds serve the SPA from the same origin as the API, so `/api` resolves correctly with no config change.

**`apps/frontend/src/app/core/interceptors/auth.interceptor.ts`** — functional interceptor

```ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('timixa.token');

  const isAuthRoute = req.url.startsWith('/api/auth/');
  const reqWithAuth = token && !isAuthRoute
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(reqWithAuth).pipe(
    catchError(err => {
      if (err.status === 401 && !isAuthRoute) {
        localStorage.removeItem('timixa.token');
        router.navigateByUrl('/auth/login');
      }
      return throwError(() => err);
    }),
  );
};
```

Registered via `provideHttpClient(withInterceptors([authInterceptor]))` in `app.config.ts`.

**`apps/frontend/src/app/core/guards/onboarding.guard.ts`** — rules in Section 8.

### Modified files

**`app.config.ts`**

- `provideHttpClient(withInterceptors([authInterceptor]))`
- `provideAppInitializer(() => inject(AuthService).bootstrap())` — `bootstrap()` calls `/api/auth/me` if a token exists, populates the user signal, swallows errors (interceptor handles 401).

**`core/services/auth.service.ts`** — full rewrite around real HTTP:

```ts
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly currentUser = signal<User | null>(null);

  bootstrap(): Promise<void>                      // GET /api/auth/me if token present
  register(payload): Observable<User>             // POST /api/auth/register
  login(payload): Observable<User>                // POST /api/auth/login
  completeOnboarding(payload): Observable<User>   // PATCH /api/users/me/onboarding
  logout(): void                                  // clear token + signal + navigate /auth/login
}
```

Storage key: `timixa.token`. Same key the interceptor reads.

**`core/models/user.model.ts`** — extend with `age?`, `occupation?`, `bedtime?`, `wakeTime?`, `onboardingComplete: boolean`.

**`features/auth/login/login.component.ts`** — on success, navigate to `/dashboard`; let `onboardingGuard` bounce to `/onboarding` if needed.

**`features/auth/register/register.component.ts`** — on success, navigate to `/onboarding`.

**`app.routes.ts`** — add onboarding as a sibling of `app-shell`:

```ts
[
  { path: 'auth', children: [...] },
  { path: 'onboarding',
    loadComponent: () => import('./features/auth/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    canActivate: [authGuard] },
  { path: '', loadComponent: app-shell,
    canActivate: [authGuard, onboardingGuard],
    children: [ /* existing children */ ] },
  { path: '**', redirectTo: 'auth/login' },
]
```

**`angular.json`** — wire `proxy.conf.json` for the serve target.

**`proxy.conf.json`** (new) — `{ "/api": { "target": "http://localhost:8080", "changeOrigin": true } }`.

### Existing services other than `AuthService`

Untouched in Slice 1. They keep loading `assets/mock/*.json`. Spring Boot forwards `/api/**` to Express but no non-auth service calls `/api/*` yet — migrations happen in later slices.

### Touchpoints

| File | Action | Est. lines |
|---|---|---|
| `core/config/environment.ts` | create | 5 |
| `core/interceptors/auth.interceptor.ts` | create | 25 |
| `core/guards/onboarding.guard.ts` | create | 20 |
| `features/auth/onboarding/onboarding.component.{ts,html,scss}` | create | ~180 |
| `core/services/auth.service.ts` | rewrite | ~120 |
| `core/models/user.model.ts` | extend | +6 |
| `app.config.ts` | modify | +5 |
| `app.routes.ts` | modify | +6 |
| `features/auth/login/login.component.ts` | tweak | ~3 |
| `features/auth/register/register.component.ts` | tweak | ~3 |
| `proxy.conf.json` | create | 8 |
| `angular.json` | wire proxy | 1 |

---

## 10. Testing strategy

Three layers; each catches a different bug class; the whole suite is fast enough to run on every commit.

### Layer 1 — Backend unit/integration (JUnit 5 + Spring Boot Test)

Location: `apps/backend-java/src/test/java/com/timixa/backend/`.

| Test class | Asserts |
|---|---|
| `AuthControllerTest` (`@WebMvcTest` + `@MockBean AuthService`) | request validation: missing email → 400; weak password → 400; happy register → 201 |
| `AuthServiceTest` (`@SpringBootTest` + H2) | duplicate email → 409; correct credentials → JWT issued; wrong password → 401; missing user → identical 401 (no enumeration) |
| `UserControllerTest` (`@SpringBootTest` + `MockMvc` + real JWT) | unauthenticated PATCH → 401; valid onboarding → 200 + user updated; second PATCH → 409 |
| `JwtUtilTest` | round-trip generate→parse; expired token detected; tampered signature rejected |
| `JwtAuthenticationFilterTest` | no header → context empty; valid bearer → principal set; malformed token → 401 surfaces |

`LegacyProxyControllerTest` deferred — no real forwarding to assert against until Express endpoints are exercised in later slices.

Run with `./mvnw test`. Target: under 20s.

### Layer 2 — Frontend unit (Karma/Jasmine)

Location: `apps/frontend/src/app/**/*.spec.ts`.

Slice 1 coverage:

- `AuthService` — happy login/register/onboarding flows + 401 interceptor behaviour (via `HttpTestingController`).
- `authInterceptor` — adds header for non-auth routes; skips for `/api/auth/**`; redirects on 401.
- `onboardingGuard` — three branches (`incomplete + not on /onboarding`, `complete + on /onboarding`, allowed path-through).
- `OnboardingComponent` — form invalid until all fields valid; submit calls service; redirects on success.

Run with `npx ng test --watch=false`. Target: under 30s.

### Layer 3 — Playwright e2e

Location (new): `apps/e2e/` (root-level workspace, separate from `apps/frontend`).

Setup:

- `playwright.config.ts` with `webServer` array starting **both** Spring Boot and Angular dev server before tests.
- Each test starts from a fresh H2 database. Reset via a `dev`-profile-only `POST /api/test/reset` endpoint that truncates `users`. Endpoint annotated `@Profile("dev")` so it cannot exist in prod.
- `baseURL: http://localhost:4200`.
- Single browser (Chromium) in Slice 1; multi-browser deferred.

Test file: `apps/e2e/tests/auth-and-onboarding.spec.ts`.

| Test | Steps | Assertion |
|---|---|---|
| `register → onboarding → dashboard` | fill register form → submit → expect `/onboarding` → fill all four onboarding fields → submit → expect `/dashboard` | dashboard heading visible; `localStorage['timixa.token']` populated |
| `duplicate email shows 409 error` | register `a@b.com` → log out → register same email | inline error: "Email already in use" |
| `wrong password shows generic error` | register → log out → login with wrong password | error: "Invalid credentials" (same as nonexistent email path) |
| `existing user with incomplete onboarding is bounced to /onboarding` | register → reload before submitting onboarding | URL is `/onboarding` |
| `completed-onboarding user lands on /dashboard after login` | full flow → logout → login | URL is `/dashboard`; token in localStorage |
| `expired token clears localStorage and redirects to login` | inject pre-expired token → navigate to `/dashboard` | URL is `/auth/login`; localStorage cleared |
| `unauthenticated /dashboard redirects to /auth/login` | clear storage → navigate `/dashboard` | URL is `/auth/login` |

Each test under 5s. Suite target: under 60s.

Root `package.json` gets one new script: `"e2e": "npm run test --workspace=apps/e2e"`.

### Not tested in Slice 1

- Proxy forwarding behaviour (no Express endpoints are exercised by the frontend yet).
- Cross-browser parity.
- Load / concurrency.
- Email verification, password reset.

---

## 11. Verification checklist (manual end-to-end at slice exit)

1. `./mvnw spring-boot:run` in `apps/backend-java` → app listens on `:8080`; `GET /api/health` returns `{ "status": "ok" }`.
2. `npm run frontend` → Angular dev server on `:4200`.
3. `npm run backend` → existing Express on `:3000` (so the proxy has something to forward to, even though we don't call it yet).
4. Register a new user → land on `/onboarding`.
5. Submit onboarding → land on `/dashboard`. `localStorage['timixa.token']` populated.
6. Reload → still on `/dashboard`, no flash to `/auth/login`.
7. Logout → back to `/auth/login`. Token cleared.
8. Login with same credentials → straight to `/dashboard`.
9. Wrong-password login → "Invalid credentials" error.
10. Duplicate-email registration → "Email already in use" error.
11. `./mvnw test` and `npx ng test --watch=false` and `npm run e2e` all green.

---

## 12. Future work (not Slice 1)

- Slice 2 — PlannedTask domain, new-task page, dashboard listing today's tasks.
- Slice 3 — schedule editor with drag/drop, frequency-rule validator.
- Slice 4 — read-only calendar with conflict + unscheduled popups.
- Slice 5 — bedtime summary page + bedtime-trigger popup.
- Slice 6 — analytics revamp (Discipline + Adherence + 7d/30d chart).
- Eventual — migrate remaining Express endpoints (`/habits`, `/events`, `/insights`, `/reminders`, etc.) into Spring Boot and delete `apps/backend/`. The proxy controller's forwarding rules shrink as each endpoint is reimplemented.
- Production deployment — nginx/Caddy reverse proxy, Postgres provisioning, Flyway migration run, JWT secret rotation policy.
- Refresh tokens, password reset, email verification — if/when the app moves beyond personal use.
