import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8080/api';

async function resetDb(page: Page) { await page.request.post(`${API}/test/reset`); }
async function uniqueEmail() { return `s4-${Date.now()}-${Math.floor(Math.random()*1e6)}@test.local`; }

async function registerAndToken(page: Page): Promise<string> {
  const email = await uniqueEmail();
  const res = await page.request.post(`${API}/auth/register`, {
    data: { email, password: 'password123', name: 'S4 User' },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).token;
}

async function createTask(page: Page, token: string, body: any) {
  const res = await page.request.post(`${API}/planned-tasks`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function createSegment(page: Page, token: string, taskId: string, body: any) {
  return page.request.post(`${API}/planned-tasks/${taskId}/segments`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
}

async function patchSegment(page: Page, token: string, taskId: string, segmentId: string, body: any) {
  return page.request.patch(`${API}/planned-tasks/${taskId}/segments/${segmentId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
}

async function deleteSegment(page: Page, token: string, taskId: string, segmentId: string) {
  return page.request.delete(`${API}/planned-tasks/${taskId}/segments/${segmentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function getForDate(page: Page, token: string, date: string) {
  return page.request.get(`${API}/planned-tasks?date=${date}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

test.beforeEach(async ({ page }) => {
  await resetDb(page);
});

test('POST /segments creates a segment for the date', async ({ page }) => {
  const token = await registerAndToken(page);
  const task = await createTask(page, token, {
    title: 'Math', cadence: 'DAILY', needsTimeSlot: true,
    startTime: '09:00', endTime: '10:00',
    minTimeMinutes: 60,
  });
  const today = new Date().toISOString().slice(0, 10);
  const res = await createSegment(page, token, task.id, { date: today, startTime: '14:00', endTime: '14:30' });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.segmentsForDate.length).toBe(1);
  expect(body.segmentsForDate[0].startTime).toBe('14:00');
  expect(body.segmentsForDate[0].endTime).toBe('14:30');
});

test('GET ?date=X includes segmentsForDate', async ({ page }) => {
  const token = await registerAndToken(page);
  const task = await createTask(page, token, {
    title: 'Read', cadence: 'DAILY', needsTimeSlot: true,
    startTime: '09:00', endTime: '10:00',
  });
  const today = new Date().toISOString().slice(0, 10);
  await createSegment(page, token, task.id, { date: today, startTime: '14:00', endTime: '14:30' });
  await createSegment(page, token, task.id, { date: today, startTime: '15:00', endTime: '15:30' });

  const list = await (await getForDate(page, token, today)).json();
  expect(list.length).toBe(1);
  expect(list[0].segmentsForDate.length).toBe(2);
  const times = list[0].segmentsForDate.map((s: any) => s.startTime).sort();
  expect(times).toEqual(['14:00', '15:00']);
});

test('POST /segments rejects overlap with 409 SEGMENT_OVERLAP', async ({ page }) => {
  const token = await registerAndToken(page);
  const task = await createTask(page, token, {
    title: 'Math', cadence: 'DAILY', needsTimeSlot: true,
    startTime: '09:00', endTime: '10:00',
  });
  const today = new Date().toISOString().slice(0, 10);
  await createSegment(page, token, task.id, { date: today, startTime: '09:00', endTime: '10:00' });
  const res = await createSegment(page, token, task.id, { date: today, startTime: '09:30', endTime: '10:30' });
  expect(res.status()).toBe(409);
  const body = await res.json();
  expect(body.code).toBe('SEGMENT_OVERLAP');
});

test('POST /segments adjacent slots are allowed', async ({ page }) => {
  const token = await registerAndToken(page);
  const task = await createTask(page, token, {
    title: 'Math', cadence: 'DAILY', needsTimeSlot: true,
    startTime: '09:00', endTime: '10:00',
  });
  const today = new Date().toISOString().slice(0, 10);
  await createSegment(page, token, task.id, { date: today, startTime: '09:00', endTime: '10:00' });
  const res = await createSegment(page, token, task.id, { date: today, startTime: '10:00', endTime: '11:00' });
  expect(res.status()).toBe(201);
});

test('PATCH /segments/{id} updates the end time', async ({ page }) => {
  const token = await registerAndToken(page);
  const task = await createTask(page, token, {
    title: 'Math', cadence: 'DAILY', needsTimeSlot: true,
    startTime: '09:00', endTime: '10:00',
  });
  const today = new Date().toISOString().slice(0, 10);
  const created = await (await createSegment(page, token, task.id, { date: today, startTime: '14:00', endTime: '14:30' })).json();
  const segmentId = created.segmentsForDate[0].id;

  const res = await patchSegment(page, token, task.id, segmentId, { endTime: '15:00' });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.segmentsForDate[0].endTime).toBe('15:00');
});

test('DELETE /segments/{id} removes the row', async ({ page }) => {
  const token = await registerAndToken(page);
  const task = await createTask(page, token, {
    title: 'Math', cadence: 'DAILY', needsTimeSlot: true,
    startTime: '09:00', endTime: '10:00',
  });
  const today = new Date().toISOString().slice(0, 10);
  const created = await (await createSegment(page, token, task.id, { date: today, startTime: '14:00', endTime: '14:30' })).json();
  const segmentId = created.segmentsForDate[0].id;

  const res = await deleteSegment(page, token, task.id, segmentId);
  expect(res.ok()).toBeTruthy();
  const list = await (await getForDate(page, token, today)).json();
  expect(list[0].segmentsForDate.length).toBe(0);
});

test('Multi-segment scenario: split a 60-min minTime task across two slots on the same day', async ({ page }) => {
  const token = await registerAndToken(page);
  const task = await createTask(page, token, {
    title: 'Math', cadence: 'DAILY', needsTimeSlot: true,
    minTimeMinutes: 60,
  });
  const today = new Date().toISOString().slice(0, 10);
  await createSegment(page, token, task.id, { date: today, startTime: '09:00', endTime: '09:30' });
  await createSegment(page, token, task.id, { date: today, startTime: '14:00', endTime: '14:30' });

  const list = await (await getForDate(page, token, today)).json();
  expect(list[0].segmentsForDate.length).toBe(2);
});

test('Delete task cascades segments', async ({ page }) => {
  const token = await registerAndToken(page);
  const task = await createTask(page, token, {
    title: 'Math', cadence: 'DAILY', needsTimeSlot: true,
    startTime: '09:00', endTime: '10:00',
  });
  const today = new Date().toISOString().slice(0, 10);
  await createSegment(page, token, task.id, { date: today, startTime: '14:00', endTime: '14:30' });

  await page.request.delete(`${API}/planned-tasks/${task.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const list = await (await getForDate(page, token, today)).json();
  expect(list.length).toBe(0);
});
