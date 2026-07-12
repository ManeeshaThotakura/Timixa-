import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8080/api';

async function resetDb(page: Page) { await page.request.post(`${API}/test/reset`); }
async function uniqueEmail() { return `at-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`; }

async function registerAndOnboard(page: Page) {
  const email = await uniqueEmail();
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('AT User');
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

async function createTaskViaApi(page: Page, body: any) {
  const token = await page.evaluate(() => localStorage.getItem('timixa_token')!);
  const res = await page.request.post(`${API}/planned-tasks`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.beforeEach(async ({ page }) => { await resetDb(page); });

test('dashboard View all tasks lists created tasks', async ({ page }) => {
  await registerAndOnboard(page);
  const t = await createTaskViaApi(page, {
    title: 'Weekend project', cadence: 'WEEKLY', needsTimeSlot: true,
    weekdays: ['SATURDAY', 'SUNDAY'], startTime: '09:00', endTime: '12:00',
  });
  await page.goto('/dashboard');
  const prompt = page.getByTestId('unsched-prompt-dismiss');
  if (await prompt.isVisible().catch(() => false)) await prompt.click();
  await page.getByTestId('view-all-tasks').click();
  await expect(page).toHaveURL(/\/tasks$/);
  const row = page.getByTestId(`task-row-${t.id}`);
  await expect(row).toContainText('Weekend project');
  await expect(row).toContainText('Sat Sun');
});

test('edit opens prefilled form and saves changes', async ({ page }) => {
  await registerAndOnboard(page);
  const t = await createTaskViaApi(page, {
    title: 'Read book', goal: 'Learning', cadence: 'DAILY', needsTimeSlot: false, minCount: 3,
  });
  await page.goto('/tasks');
  await page.getByTestId(`edit-${t.id}`).click();
  await expect(page).toHaveURL(new RegExp(`/new-task\\?taskId=${t.id}`));

  const titleInput = page.locator('input[placeholder="e.g., Study, Exercise"]');
  await expect(titleInput).toHaveValue('Read book');
  await titleInput.fill('Read a book');
  await page.getByTestId('new-task-save').click();

  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByTestId(`task-row-${t.id}`)).toContainText('Read a book');
});

test('delete removes the task and its schedule everywhere', async ({ page }) => {
  await registerAndOnboard(page);
  const t = await createTaskViaApi(page, {
    title: 'Doomed', cadence: 'DAILY', needsTimeSlot: true,
    startTime: '09:00', endTime: '10:00',
  });
  await page.goto('/tasks');
  await page.getByTestId(`delete-${t.id}`).click();
  await expect(page.getByTestId('delete-confirm')).toContainText('Doomed');
  await page.getByTestId('delete-confirm-yes').click();
  await expect(page.getByTestId(`task-row-${t.id}`)).toHaveCount(0);
  await expect(page.getByTestId('all-tasks-empty')).toBeVisible();

  // Gone from the schedule too.
  const token = await page.evaluate(() => localStorage.getItem('timixa_token')!);
  const today = new Date().toISOString().slice(0, 10);
  const list = await (await page.request.get(`${API}/planned-tasks?date=${today}`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  expect(list.length).toBe(0);
});
