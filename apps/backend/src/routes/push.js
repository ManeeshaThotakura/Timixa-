const router = require('express').Router();
const { randomUUID } = require('crypto');
const db = require('../db');
const config = require('../config');
const pushService = require('../services/push');

router.get('/public-key', (_req, res) => {
  res.json({ publicKey: config.VAPID_PUBLIC_KEY });
});

router.post('/subscribe', (req, res) => {
  const { endpoint, keys, userAgent = '' } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'invalid subscription' });
  }

  const existing = db
    .prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?')
    .get(endpoint);

  if (existing) {
    db.prepare(
      'UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ?, user_agent = ? WHERE endpoint = ?',
    ).run(req.userId, keys.p256dh, keys.auth, userAgent, endpoint);
    return res.json({ ok: true, id: existing.id });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, req.userId, endpoint, keys.p256dh, keys.auth, userAgent);

  res.status(201).json({ ok: true, id });
});

router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(
    endpoint,
    req.userId,
  );
  res.json({ ok: true });
});

// Send a test push to all of the user's devices
router.post('/test', async (req, res) => {
  const result = await pushService.sendToUser(req.userId, {
    title: req.body?.title || 'Timixa',
    body: req.body?.body || 'Push notifications are working!',
    icon: 'notifications',
    url: '/dashboard',
  });
  res.json({ ok: true, deliveries: result });
});

module.exports = router;
