import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8080/api';

async function resetDb(page: Page) { await page.request.post(`${API}/test/reset`); }
async function uniqueEmail() { return `audit-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`; }

async function registerAndOnboard(page: Page) {
  const email = await uniqueEmail();
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('Audit User');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByTestId('onboarding-age').fill('30');
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

test.beforeEach(async ({ page }) => { await resetDb(page); });

test('UI: count-based flex task shows +1 progression and progress bar', async ({ page }) => {
  await registerAndOnboard(page);
  const t = await createTaskViaApi(page, {
    title: 'Water', cadence: 'DAILY', needsTimeSlot: false, minCount: 3,
  });
  await page.reload();

  const card = page.getByTestId(`flex-${t.id}`);
  await expect(card).toBeVisible();
  await expect(page.getByTestId(`flex-progress-${t.id}`)).toContainText('0/3');

  await page.getByTestId(`start-${t.id}`).click();
  await expect(page.getByTestId(`flex-progress-${t.id}`)).toContainText('1/3');
  await expect(page.getByTestId(`start-${t.id}`)).toContainText('+1');

  await page.getByTestId(`start-${t.id}`).click();
  await page.getByTestId(`start-${t.id}`).click();
  await expect(card).toBeHidden();
  await page.getByTestId('done-toggle').click();
  await expect(page.getByTestId('done-section')).toContainText('Water');
});

test('UI: time-based task shows slider, partial log updates progress', async ({ page }) => {
  await registerAndOnboard(page);
  const t = await createTaskViaApi(page, {
    title: 'Study', cadence: 'DAILY', needsTimeSlot: true,
    startTime: '01:00', endTime: '02:00',
  });
  await page.reload();

  const slider = page.getByTestId(`time-slider-${t.id}`);
  await expect(slider).toBeVisible();
  await slider.fill('30');
  await page.getByTestId(`log-time-${t.id}`).click();
  await expect(page.getByTestId(`planned-${t.id}`)).toContainText('30/60 min');

  // one-tap Done still available for time-based
  await page.getByTestId(`complete-${t.id}`).click();
  await page.getByTestId('done-toggle').click();
  await expect(page.getByTestId('done-section')).toContainText('Study');
});

test('UI: insights page renders real metrics and 7d/30d toggle works', async ({ page }) => {
  await registerAndOnboard(page);
  const t = await createTaskViaApi(page, {
    title: 'Read', goal: 'Learning', cadence: 'DAILY', needsTimeSlot: false,
  });
  const token = await getToken(page);
  await page.request.post(`${API}/planned-tasks/${t.id}/completions`, {
    headers: { Authorization: `Bearer ${token}` }, data: {},
  });

  await page.goto('/insights');
  await expect(page.getByTestId('metric-discipline')).toContainText('100%');
  await expect(page.getByTestId('metric-streak')).toContainText('1');
  await expect(page.getByTestId('goal-Learning')).toContainText('100%');

  const bars7 = await page.getByTestId('day-bars').locator('> div').count();
  expect(bars7).toBe(7);
  await page.getByTestId('window-30d').click();
  await expect(async () => {
    const bars30 = await page.getByTestId('day-bars').locator('> div').count();
    expect(bars30).toBe(30);
  }).toPass({ timeout: 5000 });
});

test('UI: calendar view is read-only with conflict + unscheduled banners and Edit CTA', async ({ page }) => {
  await registerAndOnboard(page);
  await createTaskViaApi(page, {
    title: 'A', cadence: 'DAILY', needsTimeSlot: true, startTime: '09:00', endTime: '10:00',
  });
  await createTaskViaApi(page, {
    title: 'B', cadence: 'DAILY', needsTimeSlot: true, startTime: '09:30', endTime: '10:30',
  });
  await createTaskViaApi(page, {
    title: 'Floating', cadence: 'DAILY', needsTimeSlot: true,
  });

  await page.goto('/schedule/calendar');
  await expect(page.getByTestId('cal-conflict-banner')).toContainText('1 time conflict');
  await expect(page.getByTestId('cal-unscheduled-banner')).toContainText('1 task');
  await expect(page.locator('[data-testid^="cal-bar-"]')).toHaveCount(2);

  await page.getByTestId('cal-edit').click();
  await expect(page).toHaveURL(/\/schedule\?date=/);
});

test('UI: week view shows task titles on bars and weekly pending strip', async ({ page }) => {
  await registerAndOnboard(page);
  const weekdays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const todayDow = weekdays[new Date().getDay()];
  await createTaskViaApi(page, {
    title: 'Gym Session', cadence: 'WEEKLY', needsTimeSlot: true,
    startTime: '09:00', endTime: '10:00', weekdays: [todayDow],
  });

  await page.goto('/schedule/week');
  await expect(page.locator('[data-event-id]').first()).toContainText('Gym Session');
  await expect(page.getByTestId('weekly-pending')).toBeVisible();
  await expect(page.locator('[data-testid^="weekly-row-"]').first()).toContainText('Gym Session');
});

test('UI: profile menu opens and logout returns to login', async ({ page }) => {
  await registerAndOnboard(page);
  await page.getByTestId('profile-button').click();
  await expect(page.getByTestId('profile-menu')).toContainText('Audit User');
  await page.getByTestId('profile-logout').click();
  await expect(page).toHaveURL(/\/auth\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('timixa_token'))).toBeNull();
});
