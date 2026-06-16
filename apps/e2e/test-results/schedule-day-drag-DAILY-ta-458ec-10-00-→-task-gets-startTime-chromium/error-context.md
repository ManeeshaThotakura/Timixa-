# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: schedule-day.spec.ts >> drag DAILY task from queue onto 10:00 → task gets startTime
- Location: tests/schedule-day.spec.ts:53:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.dragTo: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByTestId('day-queue-1db8107a-48cb-4027-b899-85e6787eb578')

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic "Timixa" [ref=e5]:
    - banner [ref=e6]:
      - generic [ref=e7]:
        - generic [ref=e9]: person
        - generic [ref=e10]: Timixa
      - button "notifications" [ref=e12] [cursor=pointer]:
        - generic [ref=e13]: notifications
  - main [ref=e14]:
    - generic [ref=e15]:
      - generic [ref=e17]:
        - button "Day" [ref=e18] [cursor=pointer]
        - button "Week" [ref=e19] [cursor=pointer]
        - button "Month" [ref=e20] [cursor=pointer]
      - generic [ref=e21]:
        - generic [ref=e22]:
          - heading "Unplanned" [level=3] [ref=e23]
          - generic [ref=e24]: 1 Remaining
        - paragraph [ref=e25]:
          - generic [ref=e26]: south
          - text: Hold & drag a card onto a time slot below
        - generic [ref=e28]:
          - generic [ref=e30]: task_alt
          - paragraph [ref=e32]: Stretch
          - generic [ref=e34]: DAILY
      - generic [ref=e35]:
        - generic [ref=e36]:
          - generic [ref=e38]: 00:00
          - generic [ref=e41]: 01:00
          - generic [ref=e44]: 02:00
          - generic [ref=e47]: 03:00
          - generic [ref=e50]: 04:00
          - generic [ref=e53]: 05:00
          - generic [ref=e56]: 06:00
          - generic [ref=e59]: 07:00
          - generic [ref=e62]: 08:00
          - generic [ref=e65]: 09:00
          - generic [ref=e68]: 10:00
          - generic [ref=e71]: 11:00
          - generic [ref=e74]: 12:00
          - generic [ref=e77]: 13:00
          - generic [ref=e80]: 14:00
          - generic [ref=e83]: 15:00
          - generic [ref=e86]: 16:00
          - generic [ref=e89]: 17:00
          - generic [ref=e92]: 18:00
          - generic [ref=e95]: 19:00
          - generic [ref=e98]: 20:00
          - generic [ref=e101]: 21:00
          - generic [ref=e104]: 22:00
          - generic [ref=e107]: 23:00
        - generic [ref=e110]:
          - generic [ref=e111]:
            - img [ref=e112]
            - generic [ref=e114]: 0%
          - generic [ref=e115]: Planned
      - button "add" [ref=e116] [cursor=pointer]:
        - generic [ref=e117]: add
  - navigation [ref=e118]:
    - button "home Home" [ref=e119] [cursor=pointer]:
      - generic [ref=e121]: home
      - generic [ref=e122]: Home
    - button "rocket_launch Projects" [ref=e123] [cursor=pointer]:
      - generic [ref=e125]: rocket_launch
      - generic [ref=e126]: Projects
    - button "calendar_today Calendar" [ref=e127] [cursor=pointer]:
      - generic [ref=e129]: calendar_today
      - generic [ref=e130]: Calendar
    - button "insights Insights" [ref=e131] [cursor=pointer]:
      - generic [ref=e133]: insights
      - generic [ref=e134]: Insights
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
> 61 |   await queue.dragTo(slot10);
     |               ^ Error: locator.dragTo: Test timeout of 30000ms exceeded.
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
  75 |   await expect(page.getByTestId(`day-bar-${t.id}`)).toBeVisible();
  76 |   await page.getByTestId(`day-skip-${t.id}`).click();
  77 |   await expect(page.getByTestId(`day-bar-${t.id}`)).toHaveCount(0);
  78 | });
  79 | 
```