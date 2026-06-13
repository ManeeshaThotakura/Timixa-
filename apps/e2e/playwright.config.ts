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
      command: 'cd ../backend-java && SPRING_PROFILES_ACTIVE=dev ./mvnw spring-boot:run',
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
