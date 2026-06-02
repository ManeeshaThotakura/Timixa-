const router = require('express').Router();
const { randomUUID } = require('crypto');
const db = require('../db');

function toProject(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    priority: r.priority,
    status: r.status,
    progress: r.progress,
    dueDate: r.due_date,
    tags: JSON.parse(r.tags || '[]'),
    color: r.color,
  };
}

router.get('/', (req, res) => {
  res.json(
    db.prepare('SELECT * FROM projects WHERE user_id = ?').all(req.userId).map(toProject),
  );
});

router.get('/stats', (req, res) => {
  const projects = db
    .prepare('SELECT * FROM projects WHERE user_id = ?')
    .all(req.userId);
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

router.get('/:id', (req, res) => {
  const row = db
    .prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(toProject(row));
});

router.post('/', (req, res) => {
  const {
    title,
    description = '',
    priority = 'medium',
    status = 'active',
    progress = 0,
    dueDate = '',
    tags = [],
    color = '#451de3',
  } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const id = randomUUID();
  db.prepare(
    `INSERT INTO projects (id, user_id, title, description, priority, status, progress, due_date, tags, color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, req.userId, title, description, priority, status, progress, dueDate, JSON.stringify(tags), color);

  res.status(201).json(toProject(db.prepare('SELECT * FROM projects WHERE id = ?').get(id)));
});

router.put('/:id', (req, res) => {
  const row = db
    .prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const { title, description, priority, status, progress, dueDate, tags, color } = req.body;
  db.prepare(
    `UPDATE projects SET title=?, description=?, priority=?, status=?, progress=?, due_date=?, tags=?, color=? WHERE id=?`,
  ).run(
    title ?? row.title,
    description ?? row.description,
    priority ?? row.priority,
    status ?? row.status,
    progress ?? row.progress,
    dueDate ?? row.due_date,
    JSON.stringify(tags ?? JSON.parse(row.tags || '[]')),
    color ?? row.color,
    row.id,
  );

  res.json(toProject(db.prepare('SELECT * FROM projects WHERE id = ?').get(row.id)));
});

router.delete('/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM projects WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

module.exports = router;
