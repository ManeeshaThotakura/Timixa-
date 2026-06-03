const express = require('express');
const cors = require('cors');
const config = require('./config');
require('./db'); // creates tables on startup
const scheduler = require('./services/scheduler');
const authMiddleware = require('./middleware/auth');

const app = express();

app.use(
  cors({
    origin: ['http://localhost:4200', 'http://localhost:8100'],
    credentials: true,
  }),
);
app.use(express.json());

// Public
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/auth', require('./routes/auth'));

// Public (push public key is safe to expose)
app.get('/push/public-key', (_req, res) =>
  res.json({ publicKey: config.VAPID_PUBLIC_KEY }),
);

// Protected
app.use('/habits', authMiddleware, require('./routes/habits'));
app.use('/projects', authMiddleware, require('./routes/projects'));
app.use('/tasks', authMiddleware, require('./routes/tasks'));
app.use('/events', authMiddleware, require('./routes/events'));
app.use('/meetings', authMiddleware, require('./routes/meetings'));
app.use('/unscheduled-tasks', authMiddleware, require('./routes/unscheduled-tasks'));
app.use('/reminders', authMiddleware, require('./routes/reminders'));
app.use('/insights', authMiddleware, require('./routes/insights'));
app.use('/push', authMiddleware, require('./routes/push'));

if (process.env.NODE_ENV !== 'production') {
  app.use('/seed', require('./routes/seed'));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

scheduler.start();

app.listen(config.PORT, () => {
  console.log(`Timixa API running on http://localhost:${config.PORT}`);
});


