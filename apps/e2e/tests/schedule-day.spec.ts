import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8080/api';

async function resetDb(page: Page) { await page.request.post(`${API}/test/reset`); }
async function uniqueEmail() { return `s3d-${Date.now()}-${Math.floor(Math.random()*1e6)}@test.local`; }

async function registerAndOnboard(page: Page) {
  const email = await uniqueEmail();
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('S3 Day');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByTestId('onboarding-age').fill('28');
  await page.getByTestId('onboarding-occupation').fill('Eng');
  await page.getByTestId('onboarding-bedtime').fill('22:30');
  await page.getByTestId('onboarding-waketime').fill('06:30');
  await page.getByTestId('onboarding-submit').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function token(page: Page): Promise<string> {
  return await page.evaluate(() => localStorage.getItem('timixa_token')!);
}

async function createTask(page: Page, body: any) {
  const t = await token(page);
  const res = await page.request.post(`${API}/planned-tasks`, {
    headers: { Authorization: `Bearer ${t}` },
    data: body,
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function getTask(page: Page, id: string) {
  const t = await token(page);
  const res = await page.request.get(`${API}/planned-tasks/${id}`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.json();
}

test.beforeEach(async ({ page }) => {
  await resetDb(page);
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('drag DAILY task from queue onto 10:00 → task gets startTime', async ({ page }) => {
  await registerAndOnboard(page);
  const t = await createTask(page, {
    title: 'Stretch', cadence: 'DAILY', needsTimeSlot: true,
  });
  await page.goto('/schedule');
  const queue = page.getByTestId(`day-queue-${t.id}`);
  const slot10 = page.getByTestId('day-slot-10');
  await queue.dragTo(slot10);
  await expect(page.getByTestId(`day-bar-${t.id}`)).toBeVisible();
  const after = await getTask(page, t.id);
  expect(after.startTime).toBe('10:00');
  expect(after.endTime).toBe('11:00');
});

test('skip DAILY bar → bar disappears (SKIP exception, no popup)', async ({ page }) => {
  await registerAndOnboard(page);
  const t = await createTask(page, {
    title: 'Stretch', cadence: 'DAILY', needsTimeSlot: true,
    startTime: '10:00', endTime: '11:00',
  });
  await page.goto('/schedule');
  await expect(page.getByTestId(`day-bar-${t.id}`)).toBeVisible();
  await page.getByTestId(`day-skip-${t.id}`).click();
  await expect(page.getByTestId(`day-bar-${t.id}`)).toHaveCount(0);
});
