const router = require('express').Router();
const { randomUUID } = require('crypto');
const db = require('../db');

function toHabit(r) {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    icon: r.icon,
    targetCount: r.target_count,
    currentCount: r.current_count,
    unit: r.unit,
    goalId: r.goal_id,
    streak: r.streak,
    color: r.color,
  };
}

router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM habits WHERE user_id = ?')
    .all(req.userId);
  res.json(rows.map(toHabit));
});

router.post('/', (req, res) => {
  const {
    title,
    category = '',
    icon = 'check',
    targetCount = 1,
    unit = 'times',
    goalId = '',
    streak = 0,
    color = '#5e43fb',
  } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const id = randomUUID();
  db.prepare(
    `INSERT INTO habits (id, user_id, title, category, icon, target_count, current_count, unit, goal_id, streak, color)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
  ).run(id, req.userId, title, category, icon, targetCount, unit, goalId, streak, color);

  const row = db.prepare('SELECT * FROM habits WHERE id = ?').get(id);
  res.status(201).json(toHabit(row));
});

router.put('/:id', (req, res) => {
  const row = db
    .prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const { title, category, icon, targetCount, unit, goalId, streak, color } = req.body;
  db.prepare(
    `UPDATE habits SET title=?, category=?, icon=?, target_count=?, unit=?, goal_id=?, streak=?, color=? WHERE id=?`,
  ).run(
    title ?? row.title,
    category ?? row.category,
    icon ?? row.icon,
    targetCount ?? row.target_count,
    unit ?? row.unit,
    goalId ?? row.goal_id,
    streak ?? row.streak,
    color ?? row.color,
    row.id,
  );

  res.json(toHabit(db.prepare('SELECT * FROM habits WHERE id = ?').get(row.id)));
});

router.delete('/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM habits WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

router.post('/:id/increment', (req, res) => {
  const row = db
    .prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });

  if (row.current_count < row.target_count) {
    db.prepare('UPDATE habits SET current_count = current_count + 1 WHERE id = ?').run(row.id);
  }

  res.json(toHabit(db.prepare('SELECT * FROM habits WHERE id = ?').get(row.id)));
});

module.exports = router;
