import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8080/api';

async function resetDb(page: Page) {
  await page.request.post(`${API}/test/reset`);
}

async function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;
}

test.beforeEach(async ({ page }) => {
  await resetDb(page);
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('register → onboarding → dashboard', async ({ page }) => {
  const email = await uniqueEmail();

  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('E2E User');
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
  const token = await page.evaluate(() => localStorage.getItem('timixa_token'));
  expect(token).toBeTruthy();
});

test('duplicate email shows error', async ({ page }) => {
  const email = await uniqueEmail();

  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('Alice');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.evaluate(() => localStorage.clear());
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('Bob');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();

  await expect(page.getByTestId('register-error')).toHaveText(/Email already in use/i);
});

test('wrong password shows generic error', async ({ page }) => {
  const email = await uniqueEmail();
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('Alice');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.evaluate(() => localStorage.clear());

  await page.goto('/auth/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill('wrong-pw1');
  await page.getByTestId('login-submit').click();

  await expect(page.getByTestId('login-error')).toHaveText(/Invalid credentials/i);
});

test('user with incomplete onboarding is bounced to /onboarding', async ({ page }) => {
  const email = await uniqueEmail();
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('Alice');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.reload();
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/onboarding$/);
});

test('completed user lands on /dashboard after login', async ({ page }) => {
  const email = await uniqueEmail();
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('Alice');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('password123');
  await page.getByTestId('register-submit').click();
  await page.getByTestId('onboarding-age').fill('28');
  await page.getByTestId('onboarding-occupation').fill('Engineer');
  await page.getByTestId('onboarding-bedtime').fill('22:30');
  await page.getByTestId('onboarding-waketime').fill('06:30');
  await page.getByTestId('onboarding-submit').click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.evaluate(() => localStorage.clear());

  await page.goto('/auth/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill('password123');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  const token = await page.evaluate(() => localStorage.getItem('timixa_token'));
  expect(token).toBeTruthy();
});

test('expired token redirects to login', async ({ page }) => {
  await page.goto('/auth/login');
  await page.evaluate(() =>
    localStorage.setItem('timixa_token', 'eyJhbGciOiJIUzI1NiJ9.bm90LWEtcmVhbC10b2tlbg.x')
  );
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/auth\/login$/);
  const token = await page.evaluate(() => localStorage.getItem('timixa_token'));
  expect(token).toBeNull();
});

test('unauthenticated /dashboard redirects to /auth/login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/auth\/login$/);
});
