const router = require('express').Router();
const { randomUUID } = require('crypto');
const db = require('../db');
const pushService = require('../services/push');

function toReminder(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    time: r.time,
    type: r.type,
    relatedHabitId: r.related_habit_id ?? undefined,
    relatedTaskId: r.related_task_id ?? undefined,
    fireAt: r.fire_at ?? undefined,
    dismissed: r.dismissed === 1,
    icon: r.icon,
    iconColor: r.icon_color,
  };
}

router.get('/', (req, res) => {
  res.json(
    db.prepare('SELECT * FROM reminders WHERE user_id = ?').all(req.userId).map(toReminder),
  );
});

router.post('/', (req, res) => {
  const {
    title,
    description = '',
    time = '',
    type = 'manual',
    relatedHabitId = null,
    relatedTaskId = null,
    fireAt = null,
    icon = 'notifications',
    iconColor = '#451de3',
    sendNow = false,
  } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const id = randomUUID();
  db.prepare(
    `INSERT INTO reminders (id, user_id, title, description, time, type, related_habit_id, related_task_id, fire_at, sent, dismissed, icon, icon_color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
  ).run(
    id,
    req.userId,
    title,
    description,
    time,
    type,
    relatedHabitId,
    relatedTaskId,
    fireAt,
    icon,
    iconColor,
  );

  const created = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);

  if (sendNow) {
    pushService
      .sendToUser(req.userId, {
        title,
        body: description,
        icon,
        url: '/reminders',
        reminderId: id,
      })
      .then(() => {
        db.prepare('UPDATE reminders SET sent = 1 WHERE id = ?').run(id);
      })
      .catch(() => {});
  }

  res.status(201).json(toReminder(created));
});

router.patch('/:id/dismiss', (req, res) => {
  const info = db
    .prepare('UPDATE reminders SET dismissed = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(toReminder(db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id)));
});

router.patch('/:id/snooze', (req, res) => {
  const minutes = parseInt(req.body?.minutes ?? 30, 10);
  const newFireAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  const info = db
    .prepare(
      "UPDATE reminders SET time = ?, fire_at = ?, sent = 0 WHERE id = ? AND user_id = ?",
    )
    .run(`In ${minutes} min`, newFireAt, req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(toReminder(db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// Manual trigger: push the reminder right now (useful for "test notification" buttons)
router.post('/:id/send', async (req, res) => {
  const r = db
    .prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!r) return res.status(404).json({ error: 'Not found' });

  const result = await pushService.sendToUser(req.userId, {
    title: r.title,
    body: r.description,
    icon: r.icon,
    url: '/reminders',
    reminderId: r.id,
  });
  db.prepare('UPDATE reminders SET sent = 1 WHERE id = ?').run(r.id);
  res.json({ ok: true, deliveries: result });
});

module.exports = router;
