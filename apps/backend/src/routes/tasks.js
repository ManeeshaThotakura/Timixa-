const router = require('express').Router();
const { randomUUID } = require('crypto');
const db = require('../db');

function toTask(r) {
  return {
    id: r.id,
    projectId: r.project_id ?? '',
    title: r.title,
    status: r.status,
    dueDate: r.due_date,
    assignees: JSON.parse(r.assignees || '[]'),
    priority: r.priority,
    durationMinutes: r.duration_minutes,
    remainingMinutes: r.remaining_minutes,
  };
}

router.get('/', (req, res) => {
  const { projectId } = req.query;
  const rows = projectId
    ? db.prepare('SELECT * FROM tasks WHERE project_id = ? AND user_id = ?').all(projectId, req.userId)
    : db.prepare('SELECT * FROM tasks WHERE user_id = ?').all(req.userId);
  res.json(rows.map(toTask));
});

router.post('/', (req, res) => {
  const {
    projectId,
    title,
    status = 'todo',
    dueDate = '',
    assignees = [],
    priority = 'medium',
    durationMinutes = 0,
    remainingMinutes = 0,
  } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const id = randomUUID();
  db.prepare(
    `INSERT INTO tasks (id, project_id, user_id, title, status, due_date, assignees, priority, duration_minutes, remaining_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId || null,
    req.userId,
    title,
    status,
    dueDate,
    JSON.stringify(assignees),
    priority,
    durationMinutes,
    remainingMinutes,
  );

  res.status(201).json(toTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)));
});

router.put('/:id', (req, res) => {
  const row = db
    .prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const { title, status, dueDate, assignees, priority, durationMinutes, remainingMinutes } = req.body;
  db.prepare(
    `UPDATE tasks SET title=?, status=?, due_date=?, assignees=?, priority=?, duration_minutes=?, remaining_minutes=? WHERE id=?`,
  ).run(
    title ?? row.title,
    status ?? row.status,
    dueDate ?? row.due_date,
    JSON.stringify(assignees ?? JSON.parse(row.assignees || '[]')),
    priority ?? row.priority,
    durationMinutes ?? row.duration_minutes,
    remainingMinutes ?? row.remaining_minutes,
    row.id,
  );

  res.json(toTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(row.id)));
});

router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });
  const info = db
    .prepare('UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?')
    .run(status, req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(toTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)));
});

router.patch('/:id/remaining-minutes', (req, res) => {
  const { remainingMinutes } = req.body;
  if (remainingMinutes === undefined)
    return res.status(400).json({ error: 'remainingMinutes required' });
  const info = db
    .prepare('UPDATE tasks SET remaining_minutes = ? WHERE id = ? AND user_id = ?')
    .run(remainingMinutes, req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(toTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

module.exports = router;
