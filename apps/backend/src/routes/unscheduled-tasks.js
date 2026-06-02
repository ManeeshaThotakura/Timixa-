const router = require('express').Router();
const db = require('../db');

function toUnscheduled(r) {
  return {
    id: r.id,
    title: r.title,
    projectId: r.project_id ?? '',
    dueDate: r.due_date,
    durationMinutes: r.duration_minutes,
    remainingMinutes: r.remaining_minutes,
  };
}

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      'SELECT * FROM tasks WHERE user_id = ? AND duration_minutes > 0 AND remaining_minutes > 0',
    )
    .all(req.userId);
  res.json(rows.map(toUnscheduled));
});

router.patch('/:id', (req, res) => {
  const { remainingMinutes } = req.body;
  if (remainingMinutes === undefined)
    return res.status(400).json({ error: 'remainingMinutes required' });

  const clamped = Math.max(0, remainingMinutes);
  const info = db
    .prepare('UPDATE tasks SET remaining_minutes = ? WHERE id = ? AND user_id = ?')
    .run(clamped, req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(toUnscheduled(row));
});

module.exports = router;
