# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: schedule-day.spec.ts >> skip DAILY bar → bar disappears (SKIP exception, no popup)
- Location: tests/schedule-day.spec.ts:68:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('day-bar-9026108d-d1ca-4161-9be0-911abb0f9c9e')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByTestId('day-bar-9026108d-d1ca-4161-9be0-911abb0f9c9e')

```

```yaml
- banner:
  - text: person Timixa
  - button "notifications"
- main:
  - button "Day"
  - button "Week"
  - button "Month"
  - text: 00:00 01:00 02:00 03:00 04:00 05:00 06:00 07:00 08:00 09:00 10:00 drag_indicator task_alt Stretch 10:00–11:00 11:00 12:00 13:00 14:00 15:00 16:00 17:00 18:00 19:00 20:00 21:00 22:00 23:00
  - img
  - text: 100% Planned
  - button "add"
- navigation:
  - button "home Home"
  - button "rocket_launch Projects"
  - button "calendar_today Calendar"
  - button "insights Insights"
```

# Test source

```ts
  1  | import { test, expect, Page } from '@playwright/test';
  2  | 
  3  | const API = 'http://localhost:8080/api';
  4  | 
  5  | async function resetDb(page: Page) { await page.request.post(`${API}/test/reset`); }
  6  | async function uniqueEmail() { return `s3d-${Date.now()}-${Math.floor(Math.random()*1e6)}@test.local`; }
  7  | 
  8  | async function registerAndOnboard(page: Page) {
  9  |   const email = await uniqueEmail();
  10 |   await page.goto('/auth/register');
  11 |   await page.getByTestId('register-name').fill('S3 Day');
  12 |   await page.getByTestId('register-email').fill(email);
  13 |   await page.getByTestId('register-password').fill('password123');
  14 |   await page.getByTestId('register-submit').click();
  15 |   await expect(page).toHaveURL(/\/onboarding$/);
  16 |   await page.getByTestId('onboarding-age').fill('28');
  17 |   await page.getByTestId('onboarding-occupation').fill('Eng');
  18 |   await page.getByTestId('onboarding-bedtime').fill('22:30');
  19 |   await page.getByTestId('onboarding-waketime').fill('06:30');
  20 |   await page.getByTestId('onboarding-submit').click();
  21 |   await expect(page).toHaveURL(/\/dashboard$/);
  22 | }
  23 | 
  24 | async function token(page: Page): Promise<string> {
  25 |   return await page.evaluate(() => localStorage.getItem('timixa_token')!);
  26 | }
  27 | 
  28 | async function createTask(page: Page, body: any) {
  29 |   const t = await token(page);
  30 |   const res = await page.request.post(`${API}/planned-tasks`, {
  31 |     headers: { Authorization: `Bearer ${t}` },
  32 |     data: body,
  33 |   });
  34 |   expect(res.ok()).toBeTruthy();
  35 |   return res.json();
  36 | }
  37 | 
  38 | async function getTask(page: Page, id: string) {
  39 |   const t = await token(page);
  40 |   const res = await page.request.get(`${API}/planned-tasks/${id}`, {
  41 |     headers: { Authorization: `Bearer ${t}` },
  42 |   });
  43 |   return res.json();
  44 | }
  45 | 
  46 | test.beforeEach(async ({ page }) => {
  47 |   await resetDb(page);
  48 |   await page.context().clearCookies();
  49 |   await page.goto('/');
  50 |   await page.evaluate(() => localStorage.clear());
  51 | });
  52 | 
  53 | test('drag DAILY task from queue onto 10:00 → task gets startTime', async ({ page }) => {
  54 |   await registerAndOnboard(page);
  55 |   const t = await createTask(page, {
  56 |     title: 'Stretch', cadence: 'DAILY', needsTimeSlot: true,
  57 |   });
  58 |   await page.goto('/schedule');
  59 |   const queue = page.getByTestId(`day-queue-${t.id}`);
  60 |   const slot10 = page.getByTestId('day-slot-10');
  61 |   await queue.dragTo(slot10);
  62 |   await expect(page.getByTestId(`day-bar-${t.id}`)).toBeVisible();
  63 |   const after = await getTask(page, t.id);
  64 |   expect(after.startTime).toBe('10:00');
  65 |   expect(after.endTime).toBe('11:00');
  66 | });
  67 | 
  68 | test('skip DAILY bar → bar disappears (SKIP exception, no popup)', async ({ page }) => {
  69 |   await registerAndOnboard(page);
  70 |   const t = await createTask(page, {
  71 |     title: 'Stretch', cadence: 'DAILY', needsTimeSlot: true,
  72 |     startTime: '10:00', endTime: '11:00',
  73 |   });
  74 |   await page.goto('/schedule');
> 75 |   await expect(page.getByTestId(`day-bar-${t.id}`)).toBeVisible();
     |                                                     ^ Error: expect(locator).toBeVisible() failed
  76 |   await page.getByTestId(`day-skip-${t.id}`).click();
  77 |   await expect(page.getByTestId(`day-bar-${t.id}`)).toHaveCount(0);
  78 | });
  79 | 
```