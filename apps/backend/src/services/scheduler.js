const db = require('../db');
const pushService = require('./push');

// Polls reminders every 30s. Any reminder where fire_at is in the past
// and not yet sent gets pushed once, then marked sent.
function start() {
  setInterval(tick, 30 * 1000);
  // Fire one check on boot too (after a small delay to let DB warm up)
  setTimeout(tick, 5 * 1000);
}

async function tick() {
  const nowIso = new Date().toISOString();
  const due = db
    .prepare(
      `SELECT * FROM reminders
       WHERE sent = 0 AND dismissed = 0 AND fire_at IS NOT NULL AND fire_at <= ?`,
    )
    .all(nowIso);

  for (const r of due) {
    try {
      await pushService.sendToUser(r.user_id, {
        title: r.title,
        body: r.description,
        icon: r.icon,
        url: '/reminders',
        reminderId: r.id,
      });
    } catch {
      /* swallow — push errors per-subscription handled inside sendToUser */
    }
    db.prepare('UPDATE reminders SET sent = 1 WHERE id = ?').run(r.id);
  }
}

module.exports = { start };
