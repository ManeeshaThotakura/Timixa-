import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8080/api';

async function resetDb(page: Page) { await page.request.post(`${API}/test/reset`); }
async function uniqueEmail() { return `s3w-${Date.now()}-${Math.floor(Math.random()*1e6)}@test.local`; }

async function registerAndOnboard(page: Page) {
  const email = await uniqueEmail();
  await page.goto('/auth/register');
  await page.getByTestId('register-name').fill('S3 Week');
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

function thisMonday(): Date {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  d.setHours(0,0,0,0);
  return d;
}
function isoOfDay(weekday: 'MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT'|'SUN'): string {
  const map = { MON:0, TUE:1, WED:2, THU:3, FRI:4, SAT:5, SUN:6 };
  const d = thisMonday(); d.setDate(d.getDate() + map[weekday]);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

test.beforeEach(async ({ page }) => {
  await resetDb(page);
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('drag WEEKLY bar across days → popup → No keeps exceptions', async ({ page }) => {
  await registerAndOnboard(page);
  const t = await createTask(page, {
    title: 'Gym', cadence: 'WEEKLY',
    weekdays: ['MONDAY','WEDNESDAY','FRIDAY'],
    needsTimeSlot: true, startTime: '07:00', endTime: '08:00',
  });
  await page.goto('/schedule/week');
  const wedIso = isoOfDay('WED');
  const thuIso = isoOfDay('THU');
  const wedBar = page.getByTestId(`week-bar-${t.id}-${wedIso}`);
  const thuCol = page.getByTestId(`week-col-${thuIso}`);
  await wedBar.dragTo(thuCol);
  await expect(page.getByTestId('exception-popup')).toBeVisible();
  await page.getByTestId('exception-popup-no').click();
  const after = await getTask(page, t.id);
  expect(new Set(after.weekdays)).toEqual(new Set(['MONDAY','WEDNESDAY','FRIDAY']));
  expect(after.exceptions.map((e: any) => `${e.date}:${e.type}`).sort())
    .toEqual([`${thuIso}:ADD`, `${wedIso}:SKIP`].sort());
});

test('drag WEEKLY bar across days → popup → Yes promotes', async ({ page }) => {
  await registerAndOnboard(page);
  const t = await createTask(page, {
    title: 'Gym', cadence: 'WEEKLY',
    weekdays: ['MONDAY','WEDNESDAY','FRIDAY'],
    needsTimeSlot: true, startTime: '07:00', endTime: '08:00',
  });
  await page.goto('/schedule/week');
  const wedBar = page.getByTestId(`week-bar-${t.id}-${isoOfDay('WED')}`);
  const thuCol = page.getByTestId(`week-col-${isoOfDay('THU')}`);
  await wedBar.dragTo(thuCol);
  await expect(page.getByTestId('exception-popup')).toBeVisible();
  await page.getByTestId('exception-popup-yes').click();
  await expect(page.getByTestId('exception-popup')).toHaveCount(0);
  const after = await getTask(page, t.id);
  expect(new Set(after.weekdays)).toEqual(new Set(['MONDAY','THURSDAY','FRIDAY']));
  expect(after.exceptions).toEqual([]);
});
