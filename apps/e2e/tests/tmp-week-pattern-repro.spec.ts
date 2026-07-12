import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8080/api';

// NOTE: intentionally NO /test/reset — the backend points at a shared DB with real data.

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function registerAndOnboard(page: Page) {
  const email = `wpfix-${Date.now()}@test.local`;
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('WP Fix');
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

test('resize slot then Yes-every-weekday saves the week pattern', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('response', async r => {
    if (r.url().includes('week-pattern') || r.status() >= 400) {
      let body = '';
      try { body = (await r.text()).slice(0, 300); } catch { /* ignore */ }
      console.log(`[NET] ${r.request().method()} ${r.url()} -> ${r.status()} ${body}`);
    }
  });

  await registerAndOnboard(page);
  const token = await getToken(page);
  const auth = { Authorization: `Bearer ${token}` };

  const today = new Date();
  const todayIso = isoOf(today);
  const weekdayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

  const create = await page.request.post(`${API}/planned-tasks`, {
    headers: auth,
    data: {
      title: 'wp repro', goal: 'Fitness', cadence: 'WEEKLY', needsTimeSlot: true,
      weekdays: [weekdayName], minTimeMinutes: 360,
    },
  });
  expect(create.ok()).toBeTruthy();
  const task = await create.json();

  for (const s of [{ startTime: '09:00', endTime: '12:00' }, { startTime: '14:00', endTime: '17:00' }]) {
    const seg = await page.request.post(`${API}/planned-tasks/${task.id}/segments`, {
      headers: auth, data: { date: todayIso, ...s },
    });
    expect(seg.ok()).toBeTruthy();
  }

  await page.goto('/schedule/week');
  const bar = page.locator(`[data-event-id^="${task.id}"], [data-event-id]`).filter({ hasText: 'wp repro' }).first();
  await expect(bar).toBeVisible();

  // Tap the bar (no movement) -> edit modal; change End; Save.
  // saveEditModal() runs the same updateSegment -> afterLayoutChange -> popup chain as resize.
  await bar.scrollIntoViewIfNeeded();
  const box = (await bar.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByText('Edit schedule')).toBeVisible();
  await page.locator('input[type="time"]').nth(1).fill('12:30');
  await page.getByRole('button', { name: 'Save' }).click();

  const popup = page.getByTestId('exception-popup');
  await expect(popup).toBeVisible({ timeout: 5000 });
  await page.getByTestId('exception-popup-yes').click();

  await page.waitForTimeout(2000);

  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const check = await page.request.get(`${API}/planned-tasks?date=${isoOf(nextWeek)}`, { headers: auth });
  const list = await check.json();
  const t = list.find((x: any) => x.id === task.id);
  console.log('[PATTERN next week]', JSON.stringify(t?.patternForDate));
  console.log('[CONSOLE ERRORS]', JSON.stringify(consoleErrors, null, 2).slice(0, 2000));
  expect(t?.patternForDate?.length ?? 0).toBeGreaterThan(0);
});
