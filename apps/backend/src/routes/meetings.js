const router = require('express').Router();
const { randomUUID } = require('crypto');
const db = require('../db');

function toMeeting(r) {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    participants: JSON.parse(r.participants || '[]'),
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    location: r.location,
  };
}

router.get('/', (req, res) => {
  const { projectId } = req.query;
  const rows = projectId
    ? db.prepare('SELECT * FROM meetings WHERE project_id = ? AND user_id = ?').all(projectId, req.userId)
    : db.prepare('SELECT * FROM meetings WHERE user_id = ?').all(req.userId);
  res.json(rows.map(toMeeting));
});

router.post('/', (req, res) => {
  const {
    projectId,
    title,
    participants = [],
    date,
    startTime,
    endTime,
    location = '',
  } = req.body;
  if (!projectId || !title || !date || !startTime || !endTime) {
    return res
      .status(400)
      .json({ error: 'projectId, title, date, startTime, endTime required' });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO meetings (id, project_id, user_id, title, participants, date, start_time, end_time, location)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    req.userId,
    title,
    JSON.stringify(participants),
    date,
    startTime,
    endTime,
    location,
  );

  // Mirror as a calendar event
  const eventId = randomUUID();
  db.prepare(
    `INSERT INTO events (id, user_id, title, type, date, start_time, end_time, color, source_task_id)
     VALUES (?, ?, ?, 'meeting', ?, ?, ?, '#006688', NULL)`,
  ).run(eventId, req.userId, title, date, startTime, endTime);

  const meetingRow = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id);
  const eventRow = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  res.status(201).json({
    meeting: toMeeting(meetingRow),
    event: {
      id: eventRow.id,
      title: eventRow.title,
      type: eventRow.type,
      date: eventRow.date,
      startTime: eventRow.start_time,
      endTime: eventRow.end_time,
      color: eventRow.color,
      sourceTaskId: eventRow.source_task_id ?? undefined,
    },
  });
});

router.delete('/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM meetings WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

module.exports = router;
