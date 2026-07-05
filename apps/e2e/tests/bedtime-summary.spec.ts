import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8080/api';

async function resetDb(page: Page) { await page.request.post(`${API}/test/reset`); }
async function uniqueEmail() { return `s5-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`; }

async function registerAndOnboard(page: Page) {
  const email = await uniqueEmail();
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('S5 User');
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

async function bedtime(page: Page) {
  const token = await getToken(page);
  return page.request.get(`${API}/insights/bedtime`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

test.beforeEach(async ({ page }) => { await resetDb(page); });

test('GET /insights/bedtime returns shape on empty user', async ({ page }) => {
  await registerAndOnboard(page);
  const res = await bedtime(page);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body).toHaveProperty('date');
  expect(body).toHaveProperty('pendingToday');
  expect(Array.isArray(body.pendingToday)).toBe(true);
  expect(body).toHaveProperty('tomorrow');
  expect(body.tomorrow).toHaveProperty('unscheduledCount');
  expect(body.tomorrow).toHaveProperty('overlapConflictCount');
});

test('Bedtime summary page shows pending tasks and lets user complete one', async ({ page }) => {
  await registerAndOnboard(page);
  const pending = await createTaskViaApi(page, {
    title: 'Read', cadence: 'DAILY', needsTimeSlot: true,
    startTime: '09:00', endTime: '10:00',
  });

  await page.goto('/bedtime-summary');
  await expect(page.getByTestId('bedtime-header')).toBeVisible();
  const card = page.getByTestId(`bedtime-pending-${pending.id}`);
  await expect(card).toBeVisible();

  await page.getByTestId(`bedtime-complete-${pending.id}`).click();
  await expect(card).toBeHidden();
});

test('Bedtime summary surfaces overlap conflict count for tomorrow', async ({ page }) => {
  await registerAndOnboard(page);
  await createTaskViaApi(page, {
    title: 'A', cadence: 'DAILY', needsTimeSlot: true,
    startTime: '09:00', endTime: '10:00',
  });
  await createTaskViaApi(page, {
    title: 'B', cadence: 'DAILY', needsTimeSlot: true,
    startTime: '09:30', endTime: '10:30',
  });

  await page.goto('/bedtime-summary');
  await expect(page.getByTestId('bedtime-tomorrow-conflicts')).toContainText('1');
});

test('Bedtime summary shows unscheduled count for tomorrow', async ({ page }) => {
  await registerAndOnboard(page);
  await createTaskViaApi(page, {
    title: 'Floating', cadence: 'DAILY', needsTimeSlot: true,
    minTimeMinutes: 30,
  });

  await page.goto('/bedtime-summary');
  await expect(page.getByTestId('bedtime-tomorrow-unscheduled')).toContainText('1');
});

test('"Open tomorrow\'s schedule" CTA navigates to calendar view with date param', async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto('/bedtime-summary');
  await page.getByTestId('bedtime-open-tomorrow').click();
  await expect(page).toHaveURL(/\/schedule\/calendar\?date=\d{4}-\d{2}-\d{2}/);
});
