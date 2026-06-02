const webpush = require('web-push');
const db = require('../db');
const config = require('../config');

webpush.setVapidDetails(
  config.VAPID_SUBJECT,
  config.VAPID_PUBLIC_KEY,
  config.VAPID_PRIVATE_KEY,
);

function sendToUser(userId, payload) {
  const subs = db
    .prepare('SELECT * FROM push_subscriptions WHERE user_id = ?')
    .all(userId);

  const body = JSON.stringify(payload);
  const results = [];

  for (const sub of subs) {
    const subscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    const promise = webpush
      .sendNotification(subscription, body)
      .then(() => ({ id: sub.id, ok: true }))
      .catch(err => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
        }
        return { id: sub.id, ok: false, error: err.statusCode || err.message };
      });
    results.push(promise);
  }

  return Promise.all(results);
}

module.exports = { sendToUser };
