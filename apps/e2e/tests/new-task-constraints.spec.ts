import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8080/api';

async function resetDb(page: Page) { await page.request.post(`${API}/test/reset`); }
async function uniqueEmail() { return `s3c-${Date.now()}-${Math.floor(Math.random()*1e6)}@test.local`; }

async function registerAndOnboard(page: Page) {
  const email = await uniqueEmail();
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('S3 C');
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

// Toggle a `sr-only` checkbox by clicking the wrapping label inside the named card.
async function toggleCard(page: Page, cardTestId: 'time-card' | 'count-card') {
  await page.locator(`[data-testid="${cardTestId}"] label`).first().click();
}

test.beforeEach(async ({ page }) => {
  await resetDb(page);
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('both cards default OFF; toggling ON shows the fields', async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto('/new-task');
  await expect(page.getByTestId('time-fields')).toHaveCount(0);
  await expect(page.getByTestId('count-fields')).toHaveCount(0);
  await toggleCard(page, 'time-card');
  await expect(page.getByTestId('time-fields')).toBeVisible();
  await toggleCard(page, 'count-card');
  await expect(page.getByTestId('count-fields')).toBeVisible();
});

test('save with only max-minutes → backend stores minTime=null, maxTime=60', async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto('/new-task');
  await page.locator('input[placeholder="e.g., Study, Exercise"]').fill('Read');
  await toggleCard(page, 'time-card');
  await page.getByTestId('time-max').fill('60');
  await page.getByTestId('new-task-save').click();
  await expect(page).toHaveURL(/\/schedule$/);

  const t = await page.evaluate(() => localStorage.getItem('timixa_token')!);
  const list = await page.request.get(`${API}/planned-tasks`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json());
  const created = list.find((x: any) => x.title === 'Read');
  expect(created.minTimeMinutes).toBeUndefined();
  expect(created.maxTimeMinutes).toBe(60);
});

test('save with max < min → error shown, no submit', async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto('/new-task');
  await page.locator('input[placeholder="e.g., Study, Exercise"]').fill('Bad');
  await toggleCard(page, 'time-card');
  await page.getByTestId('time-min').fill('60');
  await page.getByTestId('time-max').fill('30');
  await page.getByTestId('new-task-save').click();
  await expect(page.getByTestId('constraint-error')).toBeVisible();
  await expect(page).toHaveURL(/\/new-task$/);
});
