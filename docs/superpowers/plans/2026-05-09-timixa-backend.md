# Timixa Backend Implementation Plan

**Goal:** Build a working REST API backend for Timixa that replaces all mock JSON files, covering every feature the Angular frontend already uses.

**Architecture:** Express.js monolith with SQLite (better-sqlite3) — no external DB server required. All tables created on startup via a single `db.js` migration. JWT protects all routes except `/auth/login` and `/auth/register`. Each domain lives in its own route file.

**Tech Stack:** Node.js, Express.js, better-sqlite3, jsonwebtoken, bcryptjs

---

## File Map

| File | Responsibility |
|---|---|
| `apps/backend/src/db.js` | Open/create SQLite DB, run `CREATE TABLE IF NOT EXISTS` for all tables |
| `apps/backend/src/middleware/auth.js` | Verify JWT, attach `req.userId` |
| `apps/backend/src/routes/auth.js` | POST /auth/register, POST /auth/login, GET /auth/me |
| `apps/backend/src/routes/habits.js` | CRUD habits + increment progress |
| `apps/backend/src/routes/projects.js` | CRUD projects + stats computed endpoint |
| `apps/backend/src/routes/tasks.js` | CRUD project tasks, PATCH status, schedule time fields |
| `apps/backend/src/routes/events.js` | CRUD scheduled events, filter by date/week/month |
| `apps/backend/src/routes/meetings.js` | CRUD meetings, filter by projectId |
| `apps/backend/src/routes/unscheduled-tasks.js` | GET remaining tasks, PATCH remaining minutes |
| `apps/backend/src/routes/reminders.js` | GET, dismiss, snooze |
| `apps/backend/src/routes/insights.js` | GET computed summary from habits + tasks |
| `apps/backend/src/index.js` | App entry: middleware, route mounts, listen |
| `apps/frontend/src/environments/environment.ts` | Add `apiUrl: 'http://localhost:3000'` |
| `apps/frontend/src/app/core/services/auth.service.ts` | Replace mock HTTP with real API calls |
| `apps/frontend/src/app/core/services/habit.service.ts` | Replace mock HTTP with real API calls |
| `apps/frontend/src/app/core/services/project.service.ts` | Replace mock HTTP with real API calls |
| `apps/frontend/src/app/core/services/schedule.service.ts` | Replace mock HTTP with real API calls |
| `apps/frontend/src/app/core/services/reminder.service.ts` | Replace mock HTTP with real API calls |
| `apps/frontend/src/app/core/services/insight.service.ts` | Replace mock HTTP with real API calls |

---

## Task 1: Install dependencies

**Files:**
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Install packages**

```bash
cd apps/backend
npm install better-sqlite3 jsonwebtoken bcryptjs
```

Expected: `node_modules/better-sqlite3`, `node_modules/jsonwebtoken`, `node_modules/bcryptjs` appear.

- [ ] **Step 2: Verify install**

```bash
node -e "require('better-sqlite3'); require('jsonwebtoken'); require('bcryptjs'); console.log('ok')"
```

Expected output: `ok`

---

## Task 2: Database setup (`db.js`)

**Files:**
- Create: `apps/backend/src/db.js`

- [ ] **Step 1: Create `db.js`**

```js
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'timixa.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT DEFAULT '',
    role TEXT DEFAULT 'member',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT DEFAULT '',
    icon TEXT DEFAULT 'check',
    target_count INTEGER DEFAULT 1,
    current_count INTEGER DEFAULT 0,
    unit TEXT DEFAULT 'times',
    goal_id TEXT DEFAULT '',
    streak INTEGER DEFAULT 0,
    color TEXT DEFAULT '#5e43fb',
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'active',
    progress INTEGER DEFAULT 0,
    due_date TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    color TEXT DEFAULT '#451de3',
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'todo',
    due_date TEXT DEFAULT '',
    assignees TEXT DEFAULT '[]',
    priority TEXT DEFAULT 'medium',
    duration_minutes INTEGER DEFAULT 0,
    remaining_minutes INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'task',
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    color TEXT DEFAULT '#4b4f52',
    source_task_id TEXT DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    participants TEXT DEFAULT '[]',
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location TEXT DEFAULT '',
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    time TEXT DEFAULT '',
    type TEXT DEFAULT 'manual',
    related_habit_id TEXT DEFAULT NULL,
    related_task_id TEXT DEFAULT NULL,
    dismissed INTEGER DEFAULT 0,
    icon TEXT DEFAULT 'notifications',
    icon_color TEXT DEFAULT '#451de3',
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

module.exports = db;
```

- [ ] **Step 2: Verify tables create without error**

```bash
node -e "const db = require('./src/db'); console.log(db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\'').all().map(r=>r.name).join(', '))"
```

Expected: `users, habits, projects, tasks, events, meetings, reminders`

---

## Task 3: Auth middleware

**Files:**
- Create: `apps/backend/src/middleware/auth.js`

- [ ] **Step 1: Create `auth.js` middleware**

```js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'timixa_dev_secret';

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

---

## Task 4: Auth routes

**Files:**
- Create: `apps/backend/src/routes/auth.js`

- [ ] **Step 1: Create `auth.js` route**

```js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'timixa_dev_secret';

// POST /auth/register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const id = randomUUID();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)').run(id, name, email, hash);
  const token = jwt.sign({ sub: id }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: { id, name, email, avatarUrl: '', role: 'member' } });
});

// POST /auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatar_url, role: user.role } });
});

// GET /auth/me  (protected by authMiddleware applied in index.js)
router.get('/me', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, name: user.name, email: user.email, avatarUrl: user.avatar_url, role: user.role });
});

module.exports = router;
```

---

## Task 5: Habits routes

**Files:**
- Create: `apps/backend/src/routes/habits.js`

- [ ] **Step 1: Create `habits.js` route**

```js
const router = require('express').Router();
const { randomUUID } = require('crypto');
const db = require('../db');

// GET /habits
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM habits WHERE user_id = ?').all(req.userId);
  res.json(rows.map(toHabit));
});

// POST /habits
router.post('/', (req, res) => {
  const { title, category = '', icon = 'check', targetCount = 1, unit = 'times', goalId = '', streak = 0, color = '#5e43fb' } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const id = randomUUID();
  db.prepare(`INSERT INTO habits (id, user_id, title, category, icon, target_count, current_count, unit, goal_id, streak, color)
              VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`).run(id, req.userId, title, category, icon, targetCount, unit, goalId, streak, color);
  const row = db.prepare('SELECT * FROM habits WHERE id = ?').get(id);
  res.status(201).json(toHabit(row));
});

// PUT /habits/:id
router.put('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { title, category, icon, targetCount, unit, goalId, streak, color } = req.body;
  db.prepare(`UPDATE habits SET title=?, category=?, icon=?, target_count=?, unit=?, goal_id=?, streak=?, color=? WHERE id=?`)
    .run(title ?? row.title, category ?? row.category, icon ?? row.icon,
         targetCount ?? row.target_count, unit ?? row.unit, goalId ?? row.goal_id,
         streak ?? row.streak, color ?? row.color, row.id);
  res.json(toHabit(db.prepare('SELECT * FROM habits WHERE id = ?').get(row.id)));
});

// DELETE /habits/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM habits WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// POST /habits/:id/increment
router.post('/:id/increment', (req, res) => {
  const row = db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.current_count < row.target_count) {
    db.prepare('UPDATE habits SET current_count = current_count + 1 WHERE id = ?').run(row.id);
  }
  res.json(toHabit(db.prepare('SELECT * FROM habits WHERE id = ?').get(row.id)));
});

function toHabit(r) {
  return { id: r.id, title: r.title, category: r.category, icon: r.icon, targetCount: r.target_count,
           currentCount: r.current_count, unit: r.unit, goalId: r.goal_id, streak: r.streak, color: r.color };
}

module.exports = router;
```

---

## Task 6: Projects routes

**Files:**
- Create: `apps/backend/src/routes/projects.js`

- [ ] **Step 1: Create `projects.js` route**

```js
const router = require('express').Router();
const { randomUUID } = require('crypto');
const db = require('../db');

// GET /projects
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM projects WHERE user_id = ?').all(req.userId).map(toProject));
});

// GET /projects/stats
router.get('/stats', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects WHERE user_id = ?').all(req.userId);
  const today = Date.now();
  const soonMs = 7 * 24 * 60 * 60 * 1000;
  res.json({
    activeCount: projects.filter(p => p.status === 'active').length,
    velocity: 84,
    dueSoonCount: projects.filter(p => {
      return new Date(p.due_date).getTime() - today <= soonMs && p.status === 'active';
    }).length,
  });
});

// GET /projects/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(toProject(row));
});

// POST /projects
router.post('/', (req, res) => {
  const { title, description = '', priority = 'medium', status = 'active', progress = 0, dueDate = '', tags = [], color = '#451de3' } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const id = randomUUID();
  db.prepare(`INSERT INTO projects (id, user_id, title, description, priority, status, progress, due_date, tags, color)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, req.userId, title, description, priority, status, progress, dueDate, JSON.stringify(tags), color);
  res.status(201).json(toProject(db.prepare('SELECT * FROM projects WHERE id = ?').get(id)));
});

// PUT /projects/:id
router.put('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { title, description, priority, status, progress, dueDate, tags, color } = req.body;
  db.prepare(`UPDATE projects SET title=?, description=?, priority=?, status=?, progress=?, due_date=?, tags=?, color=? WHERE id=?`)
    .run(title ?? row.title, description ?? row.description, priority ?? row.priority,
         status ?? row.status, progress ?? row.progress, dueDate ?? row.due_date,
         JSON.stringify(tags ?? JSON.parse(row.tags)), color ?? row.color, row.id);
  res.json(toProject(db.prepare('SELECT * FROM projects WHERE id = ?').get(row.id)));
});

// DELETE /projects/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

function toProject(r) {
  return { id: r.id, title: r.title, description: r.description, priority: r.priority,
           status: r.status, progress: r.progress, dueDate: r.due_date,
           tags: JSON.parse(r.tags || '[]'), color: r.color };
}

module.exports = router;
```

---

## Task 7: Tasks routes

**Files:**
- Create: `apps/backend/src/routes/tasks.js`

- [ ] **Step 1: Create `tasks.js` route**

```js
const router = require('express').Router();
const { randomUUID } = require('crypto');
const db = require('../db');

// GET /tasks?projectId=xxx
router.get('/', (req, res) => {
  const { projectId } = req.query;
  const rows = projectId
    ? db.prepare('SELECT * FROM tasks WHERE project_id = ? AND user_id = ?').all(projectId, req.userId)
    : db.prepare('SELECT * FROM tasks WHERE user_id = ?').all(req.userId);
  res.json(rows.map(toTask));
});

// POST /tasks
router.post('/', (req, res) => {
  const { projectId, title, status = 'todo', dueDate = '', assignees = [], priority = 'medium', durationMinutes = 0, remainingMinutes = 0 } = req.body;
  if (!projectId || !title) return res.status(400).json({ error: 'projectId and title required' });
  const id = randomUUID();
  db.prepare(`INSERT INTO tasks (id, project_id, user_id, title, status, due_date, assignees, priority, duration_minutes, remaining_minutes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, projectId, req.userId, title, status, dueDate, JSON.stringify(assignees), priority, durationMinutes, remainingMinutes);
  res.status(201).json(toTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)));
});

// PUT /tasks/:id
router.put('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { title, status, dueDate, assignees, priority, durationMinutes, remainingMinutes } = req.body;
  db.prepare(`UPDATE tasks SET title=?, status=?, due_date=?, assignees=?, priority=?, duration_minutes=?, remaining_minutes=? WHERE id=?`)
    .run(title ?? row.title, status ?? row.status, dueDate ?? row.due_date,
         JSON.stringify(assignees ?? JSON.parse(row.assignees || '[]')),
         priority ?? row.priority, durationMinutes ?? row.duration_minutes,
         remainingMinutes ?? row.remaining_minutes, row.id);
  res.json(toTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(row.id)));
});

// PATCH /tasks/:id/status
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });
  const info = db.prepare('UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?').run(status, req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(toTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)));
});

// PATCH /tasks/:id/remaining-minutes
router.patch('/:id/remaining-minutes', (req, res) => {
  const { remainingMinutes } = req.body;
  if (remainingMinutes === undefined) return res.status(400).json({ error: 'remainingMinutes required' });
  const info = db.prepare('UPDATE tasks SET remaining_minutes = ? WHERE id = ? AND user_id = ?').run(remainingMinutes, req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(toTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)));
});

// DELETE /tasks/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

function toTask(r) {
  return { id: r.id, projectId: r.project_id, title: r.title, status: r.status,
           dueDate: r.due_date, assignees: JSON.parse(r.assignees || '[]'),
           priority: r.priority, durationMinutes: r.duration_minutes, remainingMinutes: r.remaining_minutes };
}

module.exports = router;
```

---

## Task 8: Events routes

**Files:**
- Create: `apps/backend/src/routes/events.js`

- [ ] **Step 1: Create `events.js` route**

```js
const router = require('express').Router();
const { randomUUID } = require('crypto');
const db = require('../db');

// GET /events?date=YYYY-MM-DD
// GET /events?weekStart=YYYY-MM-DD
// GET /events?year=YYYY&month=M
// GET /events  (all)
router.get('/', (req, res) => {
  const { date, weekStart, year, month } = req.query;
  let rows;
  if (date) {
    rows = db.prepare('SELECT * FROM events WHERE user_id = ? AND date = ?').all(req.userId, date);
  } else if (weekStart) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    rows = db.prepare('SELECT * FROM events WHERE user_id = ? AND date >= ? AND date <= ?')
      .all(req.userId, start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  } else if (year && month !== undefined) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const startD = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const endD = new Date(y, m + 1, 0).toISOString().split('T')[0];
    rows = db.prepare('SELECT * FROM events WHERE user_id = ? AND date >= ? AND date <= ?')
      .all(req.userId, startD, endD);
  } else {
    rows = db.prepare('SELECT * FROM events WHERE user_id = ?').all(req.userId);
  }
  res.json(rows.map(toEvent));
});

// POST /events
router.post('/', (req, res) => {
  const { title, type = 'task', date, startTime, endTime, color = '#4b4f52', sourceTaskId = null } = req.body;
  if (!title || !date || !startTime || !endTime) return res.status(400).json({ error: 'title, date, startTime, endTime required' });
  const id = randomUUID();
  db.prepare(`INSERT INTO events (id, user_id, title, type, date, start_time, end_time, color, source_task_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, req.userId, title, type, date, startTime, endTime, color, sourceTaskId);
  res.status(201).json(toEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(id)));
});

// PUT /events/:id
router.put('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { title, type, date, startTime, endTime, color } = req.body;
  db.prepare(`UPDATE events SET title=?, type=?, date=?, start_time=?, end_time=?, color=? WHERE id=?`)
    .run(title ?? row.title, type ?? row.type, date ?? row.date,
         startTime ?? row.start_time, endTime ?? row.end_time, color ?? row.color, row.id);
  res.json(toEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(row.id)));
});

// DELETE /events/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM events WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

function toEvent(r) {
  return { id: r.id, title: r.title, type: r.type, date: r.date,
           startTime: r.start_time, endTime: r.end_time, color: r.color,
           sourceTaskId: r.source_task_id ?? undefined };
}

module.exports = router;
```

---

## Task 9: Meetings routes

**Files:**
- Create: `apps/backend/src/routes/meetings.js`

- [ ] **Step 1: Create `meetings.js` route**

```js
const router = require('express').Router();
const { randomUUID } = require('crypto');
const db = require('../db');

// GET /meetings?projectId=xxx
router.get('/', (req, res) => {
  const { projectId } = req.query;
  const rows = projectId
    ? db.prepare('SELECT * FROM meetings WHERE project_id = ? AND user_id = ?').all(projectId, req.userId)
    : db.prepare('SELECT * FROM meetings WHERE user_id = ?').all(req.userId);
  res.json(rows.map(toMeeting));
});

// POST /meetings
router.post('/', (req, res) => {
  const { projectId, title, participants = [], date, startTime, endTime, location = '' } = req.body;
  if (!projectId || !title || !date || !startTime || !endTime) {
    return res.status(400).json({ error: 'projectId, title, date, startTime, endTime required' });
  }
  const id = randomUUID();
  db.prepare(`INSERT INTO meetings (id, project_id, user_id, title, participants, date, start_time, end_time, location)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, projectId, req.userId, title, JSON.stringify(participants), date, startTime, endTime, location);

  // Also create a corresponding event for the calendar
  const eventId = randomUUID();
  db.prepare(`INSERT INTO events (id, user_id, title, type, date, start_time, end_time, color, source_task_id)
              VALUES (?, ?, ?, 'meeting', ?, ?, ?, '#006688', NULL)`).run(eventId, req.userId, title, date, startTime, endTime);

  res.status(201).json(toMeeting(db.prepare('SELECT * FROM meetings WHERE id = ?').get(id)));
});

// DELETE /meetings/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM meetings WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

function toMeeting(r) {
  return { id: r.id, projectId: r.project_id, title: r.title,
           participants: JSON.parse(r.participants || '[]'), date: r.date,
           startTime: r.start_time, endTime: r.end_time, location: r.location };
}

module.exports = router;
```

---

## Task 10: Unscheduled tasks route

**Files:**
- Create: `apps/backend/src/routes/unscheduled-tasks.js`

Note: Unscheduled tasks are project tasks with `duration_minutes > 0` and `remaining_minutes > 0`. This endpoint reads from the tasks table — no separate table needed.

- [ ] **Step 1: Create `unscheduled-tasks.js` route**

```js
const router = require('express').Router();
const db = require('../db');

// GET /unscheduled-tasks
router.get('/', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM tasks WHERE user_id = ? AND duration_minutes > 0 AND remaining_minutes > 0'
  ).all(req.userId);
  res.json(rows.map(r => ({
    id: r.id,
    title: r.title,
    projectId: r.project_id,
    dueDate: r.due_date,
    durationMinutes: r.duration_minutes,
    remainingMinutes: r.remaining_minutes,
  })));
});

// PATCH /unscheduled-tasks/:id  { remainingMinutes: number }
router.patch('/:id', (req, res) => {
  const { remainingMinutes } = req.body;
  if (remainingMinutes === undefined) return res.status(400).json({ error: 'remainingMinutes required' });
  const clamped = Math.max(0, remainingMinutes);
  const info = db.prepare('UPDATE tasks SET remaining_minutes = ? WHERE id = ? AND user_id = ?')
    .run(clamped, req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json({ id: row.id, title: row.title, projectId: row.project_id, dueDate: row.due_date,
             durationMinutes: row.duration_minutes, remainingMinutes: row.remaining_minutes });
});

module.exports = router;
```

---

## Task 11: Reminders routes

**Files:**
- Create: `apps/backend/src/routes/reminders.js`

- [ ] **Step 1: Create `reminders.js` route**

```js
const router = require('express').Router();
const { randomUUID } = require('crypto');
const db = require('../db');

// GET /reminders
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM reminders WHERE user_id = ?').all(req.userId).map(toReminder));
});

// POST /reminders
router.post('/', (req, res) => {
  const { title, description = '', time = '', type = 'manual', relatedHabitId = null, relatedTaskId = null, icon = 'notifications', iconColor = '#451de3' } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const id = randomUUID();
  db.prepare(`INSERT INTO reminders (id, user_id, title, description, time, type, related_habit_id, related_task_id, dismissed, icon, icon_color)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`).run(id, req.userId, title, description, time, type, relatedHabitId, relatedTaskId, icon, iconColor);
  res.status(201).json(toReminder(db.prepare('SELECT * FROM reminders WHERE id = ?').get(id)));
});

// PATCH /reminders/:id/dismiss
router.patch('/:id/dismiss', (req, res) => {
  const info = db.prepare('UPDATE reminders SET dismissed = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(toReminder(db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id)));
});

// PATCH /reminders/:id/snooze  (sets time to "In 30 min")
router.patch('/:id/snooze', (req, res) => {
  const info = db.prepare("UPDATE reminders SET time = 'In 30 min' WHERE id = ? AND user_id = ?").run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(toReminder(db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id)));
});

function toReminder(r) {
  return { id: r.id, title: r.title, description: r.description, time: r.time, type: r.type,
           relatedHabitId: r.related_habit_id ?? undefined, relatedTaskId: r.related_task_id ?? undefined,
           dismissed: r.dismissed === 1, icon: r.icon, iconColor: r.icon_color };
}

module.exports = router;
```

---

## Task 12: Insights route

**Files:**
- Create: `apps/backend/src/routes/insights.js`

Note: Insights are computed from live data — no table needed.

- [ ] **Step 1: Create `insights.js` route**

```js
const router = require('express').Router();
const db = require('../db');

// GET /insights/summary
router.get('/summary', (req, res) => {
  const habits = db.prepare('SELECT * FROM habits WHERE user_id = ?').all(req.userId);
  const tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ?').all(req.userId);
  const events = db.prepare('SELECT * FROM events WHERE user_id = ?').all(req.userId);

  const totalHabits = habits.length;
  const completed = habits.filter(h => h.current_count >= h.target_count).length;
  const streak = habits.length ? Math.max(...habits.map(h => h.streak)) : 0;

  // Focus hours = sum of event durations for habit-type events
  const focusMinutes = events
    .filter(e => e.type === 'habit')
    .reduce((sum, e) => {
      const [sh, sm] = e.start_time.split(':').map(Number);
      const [eh, em] = e.end_time.split(':').map(Number);
      return sum + (eh * 60 + em - (sh * 60 + sm));
    }, 0);

  // Group habits by goalId for performance breakdown
  const goalMap = new Map();
  for (const h of habits) {
    const gid = h.goal_id || 'General';
    if (!goalMap.has(gid)) goalMap.set(gid, []);
    goalMap.get(gid).push(h);
  }
  const goals = [...goalMap.entries()].map(([name, hs]) => {
    const rate = Math.round(hs.filter(h => h.current_count >= h.target_count).length / hs.length * 100);
    return { goalName: name, category: hs[0].category || name, completionRate: rate, trend: 'flat' };
  });

  const overallScore = totalHabits > 0 ? Math.round((completed / totalHabits) * 100) : 0;

  res.json({
    overallScore,
    streak,
    focusHours: Math.round(focusMinutes / 60 * 10) / 10,
    totalHabits,
    goals,
    deepAnalysis: [
      { title: 'Habit Consistency', status: overallScore >= 70 ? 'verified' : 'warning', score: overallScore },
      { title: 'Task Completion', status: tasks.filter(t => t.status === 'done').length >= tasks.length * 0.5 ? 'verified' : 'info', insight: `${tasks.filter(t => t.status === 'done').length} of ${tasks.length} tasks done` },
    ],
    timeDistribution: [
      { label: 'Habits', hours: Math.round(focusMinutes / 60 * 10) / 10, color: '#e4dfff' },
      { label: 'Tasks', hours: tasks.filter(t => t.status !== 'done').length * 0.5, color: '#c2e8ff' },
    ],
    individualSync: overallScore,
    teamSync: 75,
  });
});

module.exports = router;
```

---

## Task 13: Wire everything in `index.js`

**Files:**
- Modify: `apps/backend/src/index.js`

- [ ] **Step 1: Replace `index.js` with full wired version**

```js
const express = require('express');
const cors = require('cors');
require('./db'); // runs CREATE TABLE IF NOT EXISTS on startup

const authMiddleware = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const habitRoutes = require('./routes/habits');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const eventRoutes = require('./routes/events');
const meetingRoutes = require('./routes/meetings');
const unscheduledRoutes = require('./routes/unscheduled-tasks');
const reminderRoutes = require('./routes/reminders');
const insightRoutes = require('./routes/insights');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

// Public routes
app.use('/auth', authRoutes);

// Protected routes
app.use('/auth/me', authMiddleware);           // GET /auth/me needs token
app.use('/habits', authMiddleware, habitRoutes);
app.use('/projects', authMiddleware, projectRoutes);
app.use('/tasks', authMiddleware, taskRoutes);
app.use('/events', authMiddleware, eventRoutes);
app.use('/meetings', authMiddleware, meetingRoutes);
app.use('/unscheduled-tasks', authMiddleware, unscheduledRoutes);
app.use('/reminders', authMiddleware, reminderRoutes);
app.use('/insights', authMiddleware, insightRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Timixa API running on http://localhost:${PORT}`));
```

> **Note on `/auth/me`:** The `/auth` router already handles GET `/me`. The `authMiddleware` mount above adds protection to that sub-path. Alternatively inline the middleware inside `auth.js` for the `/me` route — both work.

- [ ] **Step 2: Start the server and verify all routes respond**

```bash
cd apps/backend && npm run dev
```

In another terminal:
```bash
# Register
curl -s -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"test@test.com","password":"pass123"}' | jq .

# Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"pass123"}' | jq -r '.token')
echo "Token: $TOKEN"

# Habits (should return [])
curl -s http://localhost:3000/habits -H "Authorization: Bearer $TOKEN" | jq .

# Health check
curl -s http://localhost:3000/health | jq .
```

Expected: register returns `{token, user}`, habits returns `[]`.

---

## Task 14: Seed demo data endpoint

**Files:**
- Create: `apps/backend/src/routes/seed.js`

This lets the frontend log in and immediately see data matching the current mock JSON. Only runs in development.

- [ ] **Step 1: Create seed route**

```js
const router = require('express').Router();
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');

router.post('/', (_req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).end();

  // Clear all data
  db.exec('DELETE FROM reminders; DELETE FROM events; DELETE FROM meetings; DELETE FROM tasks; DELETE FROM habits; DELETE FROM projects; DELETE FROM users;');

  const userId = randomUUID();
  db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(userId, 'Maneesha', 'demo@timixa.com', bcrypt.hashSync('demo123', 10), 'admin');

  // Projects
  const p = (id, title, desc, priority, status, progress, dueDate, tags, color) =>
    db.prepare('INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?)').run(id, userId, title, desc, priority, status, progress, dueDate, JSON.stringify(tags), color);
  p('p1','Website Redesign','Revamping core landing pages','high','active',68,'2026-05-20',['Design','Frontend'],'#451de3');
  p('p2','Mobile App MVP','First version of iOS/Android habit tracker','high','active',42,'2026-06-15',['Mobile','React Native'],'#006688');
  p('p3','API Integration','Connecting third-party health data APIs','medium','active',25,'2026-05-30',['Backend','API'],'#4b4f52');
  p('p4','Analytics Dashboard','Insights module for enterprise clients','medium','paused',15,'2026-07-01',['Analytics','Charts'],'#451de3');

  // Tasks
  const t = (id, pid, title, status, dueDate, priority, dur, rem) =>
    db.prepare('INSERT INTO tasks (id,project_id,user_id,title,status,due_date,assignees,priority,duration_minutes,remaining_minutes) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(id, pid, userId, title, status, dueDate, JSON.stringify([userId]), priority, dur ?? 0, rem ?? 0);
  t('t1','p1','User interview synthesis','todo','2026-05-10','high',60,60);
  t('t2','p1','Mobile navigation prototype','todo','2026-05-12','medium',0,0);
  t('t3','p1','Homepage copy review','in-progress','2026-05-08','high',0,0);
  t('t4','p1','Design system tokens update','in-progress','2026-05-09','medium',0,0);
  t('t5','p1','Project kick-off meeting','done','2026-04-30','low',0,0);
  t('t6','p1','Stakeholder presentation','done','2026-05-01','high',0,0);
  t('t7','p2','Onboarding flow wireframes','todo','2026-05-15','high',45,45);
  t('t8','p2','Auth module implementation','in-progress','2026-05-20','high',0,0);
  t('t9','p2','Push notification setup','done','2026-04-28','medium',0,0);
  t('t10','p3','API schema definition','todo','2026-05-18','medium',90,90);

  // Habits
  const h = (id, title, cat, icon, target, current, unit, goalId, streak, color) =>
    db.prepare('INSERT INTO habits VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id, userId, title, cat, icon, target, current, unit, goalId, streak, color);
  h('h1','Study (2 hrs)','Learning','menu_book',120,45,'min','g1',7,'#e4dfff');
  h('h2','Drink Water','Health','water_drop',10,4,'glasses','g2',14,'#c2e8ff');
  h('h3','Morning Run','Fitness','directions_run',5,5,'km','g2',21,'#e4dfff');
  h('h4','Meditate','Wellness','self_improvement',20,20,'min','g3',5,'#c2e8ff');
  h('h5','Read a Book','Learning','auto_stories',30,10,'pages','g1',3,'#e4dfff');
  h('h6','Deep Work','Work','laptop',4,2,'hrs','g4',9,'#e3e6e9');

  // Events
  const e = (id, title, type, date, s, en, color, src = null) =>
    db.prepare('INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?)').run(id, userId, title, type, date, s, en, color, src);
  e('e1','Deep Work Session','habit','2026-05-04','09:00','11:00','#451de3');
  e('e2','Team Standup','meeting','2026-05-04','11:00','11:30','#006688');
  e('e3','Design Review','task','2026-05-04','14:00','15:00','#4b4f52');
  e('e4','Morning Run','habit','2026-05-05','07:00','07:45','#451de3');
  e('e5','Product Planning','meeting','2026-05-05','10:00','11:30','#006688');
  e('e6','Study Session','habit','2026-05-06','08:00','10:00','#451de3');
  e('e7','Code Review','task','2026-05-06','13:00','14:00','#4b4f52');
  e('e8','Sprint Retrospective','meeting','2026-05-07','15:00','16:00','#006688');
  e('e9','Meditation','habit','2026-05-08','07:00','07:20','#451de3');
  e('e10','Client Demo','meeting','2026-05-08','14:00','15:00','#006688');

  // Reminders
  db.prepare(`INSERT INTO reminders (id,user_id,title,description,time,type,icon,icon_color) VALUES (?,?,?,?,?,?,?,?)`)
    .run(randomUUID(), userId, 'Study session in 30 min','You have a 2-hour study block scheduled','In 30 min','smart','menu_book','#451de3');
  db.prepare(`INSERT INTO reminders (id,user_id,title,description,time,type,icon,icon_color) VALUES (?,?,?,?,?,?,?,?)`)
    .run(randomUUID(), userId, 'Drink water reminder','You have only logged 4 of 10 glasses today','Now','smart','water_drop','#006688');

  res.json({ ok: true, userId, email: 'demo@timixa.com', password: 'demo123' });
});

module.exports = router;
```

- [ ] **Step 2: Mount seed in `index.js` (dev only)**

Add after the health route:
```js
if (process.env.NODE_ENV !== 'production') {
  app.use('/seed', require('./routes/seed'));
}
```

- [ ] **Step 3: Seed and verify**

```bash
curl -s -X POST http://localhost:3000/seed | jq .
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@timixa.com","password":"demo123"}' | jq -r '.token')
curl -s http://localhost:3000/habits -H "Authorization: Bearer $TOKEN" | jq 'length'
# Expected: 6
curl -s "http://localhost:3000/events?date=2026-05-04" -H "Authorization: Bearer $TOKEN" | jq 'length'
# Expected: 3
```

---

## Task 15: Update Angular frontend services

**Files:**
- Create: `apps/frontend/src/environments/environment.ts`
- Modify: `apps/frontend/src/app/core/services/auth.service.ts`
- Modify: `apps/frontend/src/app/core/services/habit.service.ts`
- Modify: `apps/frontend/src/app/core/services/project.service.ts`
- Modify: `apps/frontend/src/app/core/services/schedule.service.ts`
- Modify: `apps/frontend/src/app/core/services/reminder.service.ts`
- Modify: `apps/frontend/src/app/core/services/insight.service.ts`

- [ ] **Step 1: Create environment file**

Create `apps/frontend/src/environments/environment.ts`:
```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
};
```

- [ ] **Step 2: Update `auth.service.ts`**

Replace mock-based login/register with real API calls. Store token in localStorage as before. Key changes:
- `login()`: POST `/auth/login` → save token + user
- `register()`: POST `/auth/register` → save token + user
- Add `getAuthHeaders()` helper other services will use

```ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private api = environment.apiUrl;

  private _currentUser = signal<User | null>(this.loadFromStorage());
  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this._currentUser() !== null);

  private loadFromStorage(): User | null {
    const stored = localStorage.getItem('timixa_user');
    return stored ? JSON.parse(stored) : null;
  }

  getAuthHeaders(): { Authorization: string } {
    return { Authorization: `Bearer ${localStorage.getItem('timixa_token') ?? ''}` };
  }

  login(email: string, password: string): void {
    this.http.post<{ token: string; user: User }>(`${this.api}/auth/login`, { email, password })
      .subscribe({
        next: ({ token, user }) => {
          localStorage.setItem('timixa_token', token);
          localStorage.setItem('timixa_user', JSON.stringify(user));
          this._currentUser.set(user);
          this.router.navigate(['/dashboard']);
        },
        error: () => alert('Invalid email or password'),
      });
  }

  register(name: string, email: string, password: string): void {
    this.http.post<{ token: string; user: User }>(`${this.api}/auth/register`, { name, email, password })
      .subscribe({
        next: ({ token, user }) => {
          localStorage.setItem('timixa_token', token);
          localStorage.setItem('timixa_user', JSON.stringify(user));
          this._currentUser.set(user);
          this.router.navigate(['/dashboard']);
        },
        error: () => alert('Registration failed'),
      });
  }

  logout(): void {
    localStorage.removeItem('timixa_user');
    localStorage.removeItem('timixa_token');
    this._currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  hasToken(): boolean {
    return !!localStorage.getItem('timixa_token');
  }
}
```

- [ ] **Step 3: Update `habit.service.ts`**

Replace `assets/mock/habits.json` with `/habits` API. Use `authService.getAuthHeaders()`.

```ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Habit, TodayProgress } from '../models/habit.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class HabitService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private api = `${environment.apiUrl}/habits`;

  private _habits = signal<Habit[]>([]);
  readonly habits = this._habits.asReadonly();

  readonly todayProgress = computed<TodayProgress>(() => {
    const all = this._habits();
    const completed = all.filter(h => h.currentCount >= h.targetCount).length;
    return { totalHabits: all.length, completedHabits: completed,
             percentage: all.length ? Math.round((completed / all.length) * 100) : 0 };
  });

  load(): void {
    this.http.get<Habit[]>(this.api, { headers: this.auth.getAuthHeaders() })
      .subscribe(data => this._habits.set(data));
  }

  incrementHabit(id: string): void {
    this.http.post<Habit>(`${this.api}/${id}/increment`, {}, { headers: this.auth.getAuthHeaders() })
      .subscribe(updated => this._habits.update(h => h.map(x => x.id === id ? updated : x)));
  }

  startHabit(id: string): void { this.incrementHabit(id); }

  addTask(title: string, category: string, targetCount: number, unit: string): void {
    this.http.post<Habit>(this.api, { title, category, targetCount, unit }, { headers: this.auth.getAuthHeaders() })
      .subscribe(h => this._habits.update(all => [...all, h]));
  }

  addQuickTask(title: string): void { this.addTask(title, 'Task', 1, 'time'); }

  progressPercent(habit: Habit): number {
    return Math.min(100, Math.round((habit.currentCount / habit.targetCount) * 100));
  }
}
```

- [ ] **Step 4: Update `project.service.ts`**

Replace mock JSON with `/projects` and `/tasks` API calls.

```ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Project, Task, ProjectStats } from '../models/project.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private apiUrl = environment.apiUrl;

  private _projects = signal<Project[]>([]);
  private _tasks = signal<Task[]>([]);

  readonly projects = this._projects.asReadonly();
  readonly tasks = this._tasks.asReadonly();

  readonly stats = computed<ProjectStats>(() => {
    const projects = this._projects();
    const today = new Date();
    const soonMs = 7 * 24 * 60 * 60 * 1000;
    return {
      activeCount: projects.filter(p => p.status === 'active').length,
      velocity: 84,
      dueSoonCount: projects.filter(p =>
        new Date(p.dueDate).getTime() - today.getTime() <= soonMs && p.status === 'active'
      ).length,
    };
  });

  load(): void {
    const h = { headers: this.auth.getAuthHeaders() };
    this.http.get<Project[]>(`${this.apiUrl}/projects`, h).subscribe(p => this._projects.set(p));
    this.http.get<Task[]>(`${this.apiUrl}/tasks`, h).subscribe(t => this._tasks.set(t));
  }

  getProjectById(id: string): Project | undefined {
    return this._projects().find(p => p.id === id);
  }

  getKanbanByProject(projectId: string) {
    const all = this._tasks().filter(t => t.projectId === projectId);
    return { todo: all.filter(t => t.status === 'todo'),
             inProgress: all.filter(t => t.status === 'in-progress'),
             done: all.filter(t => t.status === 'done') };
  }

  updateTaskStatus(taskId: string, status: Task['status']): void {
    this.http.patch<Task>(`${this.apiUrl}/tasks/${taskId}/status`, { status }, { headers: this.auth.getAuthHeaders() })
      .subscribe(updated => this._tasks.update(ts => ts.map(t => t.id === taskId ? updated : t)));
  }

  addTask(task: Task): void {
    this.http.post<Task>(`${this.apiUrl}/tasks`, task, { headers: this.auth.getAuthHeaders() })
      .subscribe(t => this._tasks.update(ts => [...ts, t]));
  }
}
```

- [ ] **Step 5: Update `schedule.service.ts`**

Replace mock JSON with API. The `updateEvent`, `resizeEvent`, `removeEvent` methods call PUT/DELETE respectively.

```ts
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ScheduledEvent, Meeting, UnscheduledTask } from '../models/schedule.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private apiUrl = environment.apiUrl;

  private _events = signal<ScheduledEvent[]>([]);
  private _meetings = signal<Meeting[]>([]);
  private _unscheduledTasks = signal<UnscheduledTask[]>([]);

  readonly events = this._events.asReadonly();
  readonly meetings = this._meetings.asReadonly();
  readonly unscheduledTasks = this._unscheduledTasks.asReadonly();

  load(): void {
    if (this._events().length) return;
    const h = { headers: this.auth.getAuthHeaders() };
    this.http.get<ScheduledEvent[]>(`${this.apiUrl}/events`, h).subscribe(e => this._events.set(e));
    this.http.get<Meeting[]>(`${this.apiUrl}/meetings`, h).subscribe(m => this._meetings.set(m));
    this.http.get<UnscheduledTask[]>(`${this.apiUrl}/unscheduled-tasks`, h).subscribe(u => this._unscheduledTasks.set(u));
  }

  getByDate(date: string): ScheduledEvent[] {
    return this._events().filter(e => e.date === date);
  }

  getByWeek(startDate: string): ScheduledEvent[] {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return this._events().filter(e => { const d = new Date(e.date); return d >= start && d <= end; });
  }

  getByMonth(year: number, month: number): ScheduledEvent[] {
    return this._events().filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }

  scheduleTask(taskId: string, minutes: number): void {
    this._unscheduledTasks.update(tasks => tasks.map(t =>
      t.id === taskId ? { ...t, remainingMinutes: Math.max(0, t.remainingMinutes - minutes) } : t
    ));
    const task = this._unscheduledTasks().find(t => t.id === taskId);
    if (task) {
      this.http.patch(`${this.apiUrl}/unscheduled-tasks/${taskId}`, { remainingMinutes: task.remainingMinutes },
        { headers: this.auth.getAuthHeaders() }).subscribe();
    }
  }

  returnTimeToTask(taskId: string, minutes: number): void {
    if (minutes <= 0) return;
    this._unscheduledTasks.update(tasks => tasks.map(t =>
      t.id === taskId ? { ...t, remainingMinutes: Math.min(t.durationMinutes, t.remainingMinutes + minutes) } : t
    ));
    const task = this._unscheduledTasks().find(t => t.id === taskId);
    if (task) {
      this.http.patch(`${this.apiUrl}/unscheduled-tasks/${taskId}`, { remainingMinutes: task.remainingMinutes },
        { headers: this.auth.getAuthHeaders() }).subscribe();
    }
  }

  resizeEvent(eventId: string, newDurationMinutes: number): void {
    const event = this._events().find(e => e.id === eventId);
    if (!event) return;
    const oldDuration = this.minutesBetween(event.startTime, event.endTime);
    const delta = oldDuration - newDurationMinutes;
    const newEnd = this.addMinutes(event.startTime, newDurationMinutes);
    this._events.update(events => events.map(e => e.id === eventId ? { ...e, endTime: newEnd } : e));
    this.http.put(`${this.apiUrl}/events/${eventId}`, { ...event, endTime: newEnd },
      { headers: this.auth.getAuthHeaders() }).subscribe();
    if (event.sourceTaskId && delta !== 0) {
      if (delta > 0) this.returnTimeToTask(event.sourceTaskId, delta);
      else this.scheduleTask(event.sourceTaskId, -delta);
    }
  }

  updateEvent(eventId: string, patch: { date?: string; startTime?: string; endTime?: string }): void {
    const event = this._events().find(e => e.id === eventId);
    if (!event) return;
    const updated = { ...event, ...patch };
    const oldDuration = this.minutesBetween(event.startTime, event.endTime);
    const newDuration = this.minutesBetween(updated.startTime, updated.endTime);
    const delta = oldDuration - newDuration;
    this._events.update(events => events.map(e => e.id === eventId ? updated : e));
    this.http.put(`${this.apiUrl}/events/${eventId}`, updated, { headers: this.auth.getAuthHeaders() }).subscribe();
    if (event.sourceTaskId && delta !== 0) {
      if (delta > 0) this.returnTimeToTask(event.sourceTaskId, delta);
      else this.scheduleTask(event.sourceTaskId, -delta);
    }
  }

  updateEventTime(eventId: string, startTime: string, endTime: string): void {
    this.updateEvent(eventId, { startTime, endTime });
  }

  removeEvent(eventId: string): void {
    const event = this._events().find(e => e.id === eventId);
    if (!event) return;
    const duration = this.minutesBetween(event.startTime, event.endTime);
    this._events.update(events => events.filter(e => e.id !== eventId));
    this.http.delete(`${this.apiUrl}/events/${eventId}`, { headers: this.auth.getAuthHeaders() }).subscribe();
    if (event.sourceTaskId) this.returnTimeToTask(event.sourceTaskId, duration);
  }

  addMeeting(meeting: Meeting): void {
    this._meetings.update(m => [...m, meeting]);
    this.http.post<Meeting>(`${this.apiUrl}/meetings`, meeting, { headers: this.auth.getAuthHeaders() })
      .subscribe();
  }

  addEvent(event: ScheduledEvent): void {
    this.http.post<ScheduledEvent>(`${this.apiUrl}/events`, event, { headers: this.auth.getAuthHeaders() })
      .subscribe(created => this._events.update(e => [...e, created]));
  }

  getMeetingsByProject(projectId: string): Meeting[] {
    return this._meetings().filter(m => m.projectId === projectId);
  }

  dismissUnscheduledBanner(): void { this._unscheduledTasks.set([]); }

  private minutesBetween(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  }

  private addMinutes(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`;
  }
}
```

- [ ] **Step 6: Update `reminder.service.ts`**

```ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Reminder } from '../models/reminder.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private api = `${environment.apiUrl}/reminders`;

  private _reminders = signal<Reminder[]>([]);
  readonly reminders = this._reminders.asReadonly();
  readonly activeCount = computed(() => this._reminders().filter(r => !r.dismissed).length);

  load(): void {
    if (this._reminders().length) return;
    this.http.get<Reminder[]>(this.api, { headers: this.auth.getAuthHeaders() })
      .subscribe(data => this._reminders.set(data));
  }

  dismiss(id: string): void {
    this.http.patch<Reminder>(`${this.api}/${id}/dismiss`, {}, { headers: this.auth.getAuthHeaders() })
      .subscribe(updated => this._reminders.update(rs => rs.map(r => r.id === id ? updated : r)));
  }

  snooze(id: string): void {
    this.http.patch<Reminder>(`${this.api}/${id}/snooze`, {}, { headers: this.auth.getAuthHeaders() })
      .subscribe(updated => this._reminders.update(rs => rs.map(r => r.id === id ? updated : r)));
  }
}
```

- [ ] **Step 7: Update `insight.service.ts`**

```ts
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { InsightSummary } from '../models/insight.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class InsightService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private api = `${environment.apiUrl}/insights`;

  private _summary = signal<InsightSummary | null>(null);
  readonly summary = this._summary.asReadonly();

  load(): void {
    if (this._summary()) return;
    this.http.get<InsightSummary>(`${this.api}/summary`, { headers: this.auth.getAuthHeaders() })
      .subscribe(data => this._summary.set(data));
  }

  getWeeklyStats(): { label: string; value: number }[] {
    const summary = this._summary();
    if (!summary) return [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((label, i) => ({
      label,
      value: Math.round(summary.goals.reduce((acc, g) => acc + g.completionRate, 0) / summary.goals.length * (0.7 + (i % 3) * 0.15)),
    }));
  }
}
```

- [ ] **Step 8: Add `provideHttpClient` if not already in `app.config.ts`**

Check `apps/frontend/src/app/app.config.ts` — ensure it has:
```ts
import { provideHttpClient } from '@angular/common/http';
// ...
provideHttpClient()
```

---

## Task 16: End-to-end smoke test

- [ ] **Step 1: Seed the database**
```bash
curl -s -X POST http://localhost:3000/seed | jq .
```
Expected: `{ ok: true, email: "demo@timixa.com", password: "demo123" }`

- [ ] **Step 2: Open the Angular app**
```bash
cd apps/frontend && ng serve
```
Navigate to `http://localhost:4200`.

- [ ] **Step 3: Login with demo credentials**
Email: `demo@timixa.com` | Password: `demo123`

Expected: redirected to `/dashboard`, habits and projects visible.

- [ ] **Step 4: Verify each page loads with real data**
- Dashboard: habits + progress visible
- Projects: 4 projects listed
- Schedule day view: events for today visible, drag/resize/edit work
- Schedule week view: events across the week visible
- Reminders: 2 reminders visible
- Insights: score + goals computed from real habits

- [ ] **Step 5: Verify state persists across refresh**
Move an event in the schedule → refresh the page → event should remain in its new time slot (data persisted in SQLite via API).

---

## Quick Reference: All API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | No | Create account |
| POST | /auth/login | No | Get JWT token |
| GET | /auth/me | Yes | Current user |
| GET | /habits | Yes | List habits |
| POST | /habits | Yes | Create habit |
| PUT | /habits/:id | Yes | Update habit |
| DELETE | /habits/:id | Yes | Delete habit |
| POST | /habits/:id/increment | Yes | Increment progress |
| GET | /projects | Yes | List projects |
| GET | /projects/stats | Yes | Stats summary |
| GET | /projects/:id | Yes | Single project |
| POST | /projects | Yes | Create project |
| PUT | /projects/:id | Yes | Update project |
| DELETE | /projects/:id | Yes | Delete project |
| GET | /tasks?projectId= | Yes | Tasks (optional filter) |
| POST | /tasks | Yes | Create task |
| PUT | /tasks/:id | Yes | Update task |
| PATCH | /tasks/:id/status | Yes | Update status only |
| PATCH | /tasks/:id/remaining-minutes | Yes | Update schedule time |
| DELETE | /tasks/:id | Yes | Delete task |
| GET | /events?date= | Yes | Events by date/week/month |
| POST | /events | Yes | Create event |
| PUT | /events/:id | Yes | Update event (move/resize) |
| DELETE | /events/:id | Yes | Delete event |
| GET | /meetings?projectId= | Yes | Meetings |
| POST | /meetings | Yes | Create meeting + event |
| DELETE | /meetings/:id | Yes | Delete meeting |
| GET | /unscheduled-tasks | Yes | Tasks with remaining time |
| PATCH | /unscheduled-tasks/:id | Yes | Update remaining minutes |
| GET | /reminders | Yes | List reminders |
| POST | /reminders | Yes | Create reminder |
| PATCH | /reminders/:id/dismiss | Yes | Dismiss |
| PATCH | /reminders/:id/snooze | Yes | Snooze 30 min |
| GET | /insights/summary | Yes | Computed analytics |
| POST | /seed | No (dev) | Populate demo data |
