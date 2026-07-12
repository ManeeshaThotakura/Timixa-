import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8080/api';

async function resetDb(page: Page) {
  await page.request.post(`${API}/test/reset`);
}

async function uniqueEmail() {
  return `s2-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;
}

async function registerAndOnboard(page: Page) {
  const email = await uniqueEmail();
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('S2 User');
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
}

async function getToken(page: Page): Promise<string> {
  return await page.evaluate(() => localStorage.getItem('timixa_token')!);
}

async function createTaskViaApi(page: Page, body: any) {
  const token = await getToken(page);
  const res = await page.request.post(`${API}/planned-tasks`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.beforeEach(async ({ page }) => {
  await resetDb(page);
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('dashboard is empty when no planned tasks', async ({ page }) => {
  await registerAndOnboard(page);
  await expect(page.getByTestId('now-card')).toHaveCount(0);
  await expect(page.getByTestId('todays-plan')).toHaveCount(0);
  await expect(page.getByTestId('unscheduled-banner')).toHaveCount(0);
  await expect(page.getByTestId('done-section')).toHaveCount(0);
});

// A slot that contains "now" and never rolls past midnight (23:xx → end 23:59).
function nowWindow(): { start: string; end: string } {
  const h = new Date().getHours();
  const start = `${String(h).padStart(2, '0')}:00`;
  const end = h === 23 ? '23:59' : `${String(h + 1).padStart(2, '0')}:00`;
  return { start, end };
}

test('Now card shows for in-window DAILY task', async ({ page }) => {
  await registerAndOnboard(page);
  const { start, end } = nowWindow();
  await createTaskViaApi(page, {
    title: 'Gym', goal: 'Fitness', cadence: 'DAILY',
    needsTimeSlot: true, startTime: start, endTime: end,
  });
  await page.reload();
  await expect(page.getByTestId('now-card')).toBeVisible();
  await expect(page.getByTestId('now-card')).toContainText('Gym');
});

test('clicking Complete moves task to Done', async ({ page }) => {
  await registerAndOnboard(page);
  const { start, end } = nowWindow();
  await createTaskViaApi(page, {
    title: 'Gym', cadence: 'DAILY',
    needsTimeSlot: true, startTime: start, endTime: end,
  });
  await page.reload();
  await page.getByTestId('now-complete').click();
  await expect(page.getByTestId('now-card')).toHaveCount(0);
  await page.getByTestId('done-toggle').click();
  await expect(page.getByTestId('done-section')).toContainText('Gym');
});

test('unscheduled banner routes to schedule page', async ({ page }) => {
  await registerAndOnboard(page);
  await createTaskViaApi(page, {
    title: 'Read', cadence: 'DAILY', needsTimeSlot: true,
  });
  await page.reload();
  // The once-per-day unscheduled popup fires first — dismiss it.
  await expect(page.getByTestId('unsched-prompt')).toBeVisible();
  await page.getByTestId('unsched-prompt-dismiss').click();
  await expect(page.getByTestId('unscheduled-banner')).toBeVisible();
  await page.getByTestId('unscheduled-toggle').click();
  // Banner shows the task title in its expanded list.
  await expect(page.getByTestId('unscheduled-banner')).toContainText('Read');
  // The "Open today's schedule" button routes to /schedule.
  await page.getByTestId('open-schedule').click();
  await expect(page).toHaveURL(/\/schedule$/);
});

test('unscheduled popup Schedule now routes to schedule and stays dismissed', async ({ page }) => {
  await registerAndOnboard(page);
  await createTaskViaApi(page, {
    title: 'Read', cadence: 'DAILY', needsTimeSlot: true,
  });
  await page.reload();
  await expect(page.getByTestId('unsched-prompt')).toBeVisible();
  await page.getByTestId('unsched-prompt-open').click();
  await expect(page).toHaveURL(/\/schedule$/);
  // Back to dashboard: suppressed for the rest of the day.
  await page.goto('/dashboard');
  await expect(page.getByTestId('unscheduled-banner')).toBeVisible();
  await expect(page.getByTestId('unsched-prompt')).toHaveCount(0);
});

test('New Task page redirects to day schedule for DAILY tasks', async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto('/new-task');
  await page.locator('input[placeholder="e.g., Study, Exercise"]').fill('Stretch');
  await page.getByTestId('new-task-save').click();
  await expect(page).toHaveURL(/\/schedule$/);

  // Task is persisted — visible on the dashboard's unscheduled banner after navigating back.
  await page.goto('/dashboard');
  // Fresh session with an unscheduled task → the once-per-day popup fires; dismiss it.
  await expect(page.getByTestId('unsched-prompt')).toBeVisible();
  await page.getByTestId('unsched-prompt-dismiss').click();
  await expect(page.getByTestId('unscheduled-banner')).toBeVisible();
  await page.getByTestId('unscheduled-toggle').click();
  await expect(page.getByTestId('unscheduled-banner')).toContainText('Stretch');
});

test('needsTimeSlot=false task does not appear in unscheduled banner', async ({ page }) => {
  await registerAndOnboard(page);
  await createTaskViaApi(page, {
    title: 'Drink water', goal: 'Health', cadence: 'DAILY', needsTimeSlot: false,
  });
  await page.reload();
  // Notify-only tasks are not "needing a time slot", so the banner stays hidden.
  await expect(page.getByTestId('unscheduled-banner')).toHaveCount(0);
});

test('WEEKLY task with non-matching weekday does not show', async ({ page }) => {
  await registerAndOnboard(page);
  const tomorrow = new Date(Date.now() + 86400000)
    .toLocaleString('en-US', { weekday: 'long' })
    .toUpperCase();
  await createTaskViaApi(page, {
    title: 'Run', cadence: 'WEEKLY',
    weekdays: [tomorrow],
    needsTimeSlot: true, startTime: '07:00', endTime: '08:00',
  });
  await page.reload();
  await expect(page.getByTestId('now-card')).toHaveCount(0);
  await expect(page.getByTestId('todays-plan')).toHaveCount(0);
  await expect(page.getByTestId('unscheduled-banner')).toHaveCount(0);
});

test('user isolation — other user\'s tasks invisible', async ({ page, browser }) => {
  await registerAndOnboard(page);
  await createTaskViaApi(page, {
    title: 'Mine', cadence: 'DAILY', needsTimeSlot: true,
    startTime: '09:00', endTime: '10:00',
  });

  const other = await browser.newContext();
  const p2 = await other.newPage();
  await resetDb(p2);
  await p2.goto('/');
  await p2.evaluate(() => localStorage.clear());
  await registerAndOnboard(p2);
  await expect(p2.getByTestId('todays-plan')).toHaveCount(0);
  await other.close();
});
