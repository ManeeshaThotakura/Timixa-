const router = require('express').Router();
const { randomUUID } = require('crypto');
const db = require('../db');

function toEvent(r) {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    color: r.color,
    sourceTaskId: r.source_task_id ?? undefined,
  };
}

router.get('/', (req, res) => {
  const { date, weekStart, year, month } = req.query;
  let rows;

  if (date) {
    rows = db
      .prepare('SELECT * FROM events WHERE user_id = ? AND date = ?')
      .all(req.userId, date);
  } else if (weekStart) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    rows = db
      .prepare('SELECT * FROM events WHERE user_id = ? AND date >= ? AND date <= ?')
      .all(
        req.userId,
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0],
      );
  } else if (year && month !== undefined) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const startD = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const endD = new Date(y, m + 1, 0).toISOString().split('T')[0];
    rows = db
      .prepare('SELECT * FROM events WHERE user_id = ? AND date >= ? AND date <= ?')
      .all(req.userId, startD, endD);
  } else {
    rows = db.prepare('SELECT * FROM events WHERE user_id = ?').all(req.userId);
  }

  res.json(rows.map(toEvent));
});

router.post('/', (req, res) => {
  const {
    title,
    type = 'task',
    date,
    startTime,
    endTime,
    color = '#4b4f52',
    sourceTaskId = null,
  } = req.body;
  if (!title || !date || !startTime || !endTime)
    return res.status(400).json({ error: 'title, date, startTime, endTime required' });

  const id = randomUUID();
  db.prepare(
    `INSERT INTO events (id, user_id, title, type, date, start_time, end_time, color, source_task_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, req.userId, title, type, date, startTime, endTime, color, sourceTaskId);

  res.status(201).json(toEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(id)));
});

router.put('/:id', (req, res) => {
  const row = db
    .prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const { title, type, date, startTime, endTime, color } = req.body;
  db.prepare(
    `UPDATE events SET title=?, type=?, date=?, start_time=?, end_time=?, color=? WHERE id=?`,
  ).run(
    title ?? row.title,
    type ?? row.type,
    date ?? row.date,
    startTime ?? row.start_time,
    endTime ?? row.end_time,
    color ?? row.color,
    row.id,
  );

  res.json(toEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(row.id)));
});

router.delete('/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM events WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

module.exports = router;
