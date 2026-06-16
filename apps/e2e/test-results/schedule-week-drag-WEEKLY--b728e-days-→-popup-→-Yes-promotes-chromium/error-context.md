# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: schedule-week.spec.ts >> drag WEEKLY bar across days → popup → Yes promotes
- Location: tests/schedule-week.spec.ts:87:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.dragTo: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByTestId('week-bar-de16b7da-8503-4c35-aa50-c0e8470f76e1-2026-06-10')

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
      - generic [ref=e22] [cursor=pointer]:
        - generic [ref=e23]:
          - generic [ref=e25]: pending_actions
          - generic [ref=e26]:
            - paragraph [ref=e27]: Unscheduled
            - paragraph [ref=e28]: 0 tasks waiting for slot
        - generic [ref=e29]: keyboard_arrow_down
      - generic [ref=e30]:
        - button "chevron_left" [ref=e31] [cursor=pointer]:
          - generic [ref=e32]: chevron_left
        - generic [ref=e33]: Jun 8 – Jun 14
        - button "chevron_right" [ref=e34] [cursor=pointer]:
          - generic [ref=e35]: chevron_right
        - generic [ref=e36]:
          - button "zoom_out" [ref=e37] [cursor=pointer]:
            - generic [ref=e38]: zoom_out
          - generic [ref=e39]: 100%
          - button "zoom_in" [ref=e40] [cursor=pointer]:
            - generic [ref=e41]: zoom_in
      - generic [ref=e43]:
        - generic [ref=e44]:
          - generic [ref=e46]:
            - paragraph [ref=e47]: MON
            - paragraph [ref=e48]: "8"
          - generic [ref=e49]:
            - paragraph [ref=e50]: TUE
            - paragraph [ref=e51]: "9"
          - generic [ref=e52]:
            - paragraph [ref=e53]: WED
            - paragraph [ref=e54]: "10"
          - generic [ref=e55]:
            - paragraph [ref=e56]: THU
            - paragraph [ref=e57]: "11"
          - generic [ref=e58]:
            - paragraph [ref=e59]: FRI
            - paragraph [ref=e60]: "12"
          - generic [ref=e61]:
            - paragraph [ref=e62]: SAT
            - paragraph [ref=e63]: "13"
          - generic [ref=e64]:
            - paragraph [ref=e65]: SUN
            - paragraph [ref=e66]: "14"
        - generic [ref=e68]: 00:00
        - generic [ref=e77]: 01:00
        - generic [ref=e86]: 02:00
        - generic [ref=e95]: 03:00
        - generic [ref=e104]: 04:00
        - generic [ref=e113]: 05:00
        - generic [ref=e122]: 06:00
        - generic [ref=e130]:
          - generic [ref=e131]: 07:00
          - generic [ref=e134] [cursor=pointer]:
            - generic: drag_indicator
            - generic: Gym
            - generic: 07:00–08:00
          - generic [ref=e139] [cursor=pointer]:
            - generic: drag_indicator
            - generic: Gym
            - generic: 07:00–08:00
          - generic [ref=e144] [cursor=pointer]:
            - generic: drag_indicator
            - generic: Gym
            - generic: 07:00–08:00
        - generic [ref=e149]: 08:00
        - generic [ref=e158]: 09:00
        - generic [ref=e167]: 10:00
        - generic [ref=e176]: 11:00
        - generic [ref=e185]: 12:00
        - generic [ref=e194]: 13:00
        - generic [ref=e203]: 14:00
        - generic [ref=e212]: 15:00
        - generic [ref=e221]: 16:00
        - generic [ref=e230]: 17:00
        - generic [ref=e239]: 18:00
        - generic [ref=e248]: 19:00
        - generic [ref=e257]: 20:00
        - generic [ref=e266]: 21:00
        - generic [ref=e275]: 22:00
        - generic [ref=e284]: 23:00
      - generic [ref=e292]:
        - generic [ref=e293]:
          - generic [ref=e294]: bolt
          - paragraph [ref=e295]: 100%
          - paragraph [ref=e296]: Velocity
        - generic [ref=e297]:
          - generic [ref=e298]: check_circle
          - paragraph [ref=e299]: "3"
          - paragraph [ref=e300]: Scheduled
      - button "add" [ref=e301] [cursor=pointer]:
        - generic [ref=e302]: add
  - navigation [ref=e303]:
    - button "home Home" [ref=e304] [cursor=pointer]:
      - generic [ref=e306]: home
      - generic [ref=e307]: Home
    - button "rocket_launch Projects" [ref=e308] [cursor=pointer]:
      - generic [ref=e310]: rocket_launch
      - generic [ref=e311]: Projects
    - button "calendar_today Calendar" [ref=e312] [cursor=pointer]:
      - generic [ref=e314]: calendar_today
      - generic [ref=e315]: Calendar
    - button "insights Insights" [ref=e316] [cursor=pointer]:
      - generic [ref=e318]: insights
      - generic [ref=e319]: Insights
```

# Test source

```ts
  1   | import { test, expect, Page } from '@playwright/test';
  2   | 
  3   | const API = 'http://localhost:8080/api';
  4   | 
  5   | async function resetDb(page: Page) { await page.request.post(`${API}/test/reset`); }
  6   | async function uniqueEmail() { return `s3w-${Date.now()}-${Math.floor(Math.random()*1e6)}@test.local`; }
  7   | 
  8   | async function registerAndOnboard(page: Page) {
  9   |   const email = await uniqueEmail();
  10  |   await page.goto('/auth/register');
  11  |   await page.getByTestId('register-name').fill('S3 Week');
  12  |   await page.getByTestId('register-email').fill(email);
  13  |   await page.getByTestId('register-password').fill('password123');
  14  |   await page.getByTestId('register-submit').click();
  15  |   await expect(page).toHaveURL(/\/onboarding$/);
  16  |   await page.getByTestId('onboarding-age').fill('28');
  17  |   await page.getByTestId('onboarding-occupation').fill('Eng');
  18  |   await page.getByTestId('onboarding-bedtime').fill('22:30');
  19  |   await page.getByTestId('onboarding-waketime').fill('06:30');
  20  |   await page.getByTestId('onboarding-submit').click();
  21  |   await expect(page).toHaveURL(/\/dashboard$/);
  22  | }
  23  | 
  24  | async function token(page: Page): Promise<string> {
  25  |   return await page.evaluate(() => localStorage.getItem('timixa_token')!);
  26  | }
  27  | 
  28  | async function createTask(page: Page, body: any) {
  29  |   const t = await token(page);
  30  |   const res = await page.request.post(`${API}/planned-tasks`, {
  31  |     headers: { Authorization: `Bearer ${t}` },
  32  |     data: body,
  33  |   });
  34  |   expect(res.ok()).toBeTruthy();
  35  |   return res.json();
  36  | }
  37  | 
  38  | async function getTask(page: Page, id: string) {
  39  |   const t = await token(page);
  40  |   const res = await page.request.get(`${API}/planned-tasks/${id}`, {
  41  |     headers: { Authorization: `Bearer ${t}` },
  42  |   });
  43  |   return res.json();
  44  | }
  45  | 
  46  | function thisMonday(): Date {
  47  |   const d = new Date();
  48  |   const dow = (d.getDay() + 6) % 7;
  49  |   d.setDate(d.getDate() - dow);
  50  |   d.setHours(0,0,0,0);
  51  |   return d;
  52  | }
  53  | function isoOfDay(weekday: 'MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT'|'SUN'): string {
  54  |   const map = { MON:0, TUE:1, WED:2, THU:3, FRI:4, SAT:5, SUN:6 };
  55  |   const d = thisMonday(); d.setDate(d.getDate() + map[weekday]);
  56  |   return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  57  | }
  58  | 
  59  | test.beforeEach(async ({ page }) => {
  60  |   await resetDb(page);
  61  |   await page.context().clearCookies();
  62  |   await page.goto('/');
  63  |   await page.evaluate(() => localStorage.clear());
  64  | });
  65  | 
  66  | test('drag WEEKLY bar across days → popup → No keeps exceptions', async ({ page }) => {
  67  |   await registerAndOnboard(page);
  68  |   const t = await createTask(page, {
  69  |     title: 'Gym', cadence: 'WEEKLY',
  70  |     weekdays: ['MONDAY','WEDNESDAY','FRIDAY'],
  71  |     needsTimeSlot: true, startTime: '07:00', endTime: '08:00',
  72  |   });
  73  |   await page.goto('/schedule/week');
  74  |   const wedIso = isoOfDay('WED');
  75  |   const thuIso = isoOfDay('THU');
  76  |   const wedBar = page.getByTestId(`week-bar-${t.id}-${wedIso}`);
  77  |   const thuCol = page.getByTestId(`week-col-${thuIso}`);
  78  |   await wedBar.dragTo(thuCol);
  79  |   await expect(page.getByTestId('exception-popup')).toBeVisible();
  80  |   await page.getByTestId('exception-popup-no').click();
  81  |   const after = await getTask(page, t.id);
  82  |   expect(new Set(after.weekdays)).toEqual(new Set(['MONDAY','WEDNESDAY','FRIDAY']));
  83  |   expect(after.exceptions.map((e: any) => `${e.date}:${e.type}`).sort())
  84  |     .toEqual([`${thuIso}:ADD`, `${wedIso}:SKIP`].sort());
  85  | });
  86  | 
  87  | test('drag WEEKLY bar across days → popup → Yes promotes', async ({ page }) => {
  88  |   await registerAndOnboard(page);
  89  |   const t = await createTask(page, {
  90  |     title: 'Gym', cadence: 'WEEKLY',
  91  |     weekdays: ['MONDAY','WEDNESDAY','FRIDAY'],
  92  |     needsTimeSlot: true, startTime: '07:00', endTime: '08:00',
  93  |   });
  94  |   await page.goto('/schedule/week');
  95  |   const wedBar = page.getByTestId(`week-bar-${t.id}-${isoOfDay('WED')}`);
  96  |   const thuCol = page.getByTestId(`week-col-${isoOfDay('THU')}`);
> 97  |   await wedBar.dragTo(thuCol);
      |                ^ Error: locator.dragTo: Test timeout of 30000ms exceeded.
  98  |   await expect(page.getByTestId('exception-popup')).toBeVisible();
  99  |   await page.getByTestId('exception-popup-yes').click();
  100 |   await expect(page.getByTestId('exception-popup')).toHaveCount(0);
  101 |   const after = await getTask(page, t.id);
  102 |   expect(new Set(after.weekdays)).toEqual(new Set(['MONDAY','THURSDAY','FRIDAY']));
  103 |   expect(after.exceptions).toEqual([]);
  104 | });
  105 | 
```