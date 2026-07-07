CREATE TABLE reminders (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(160) NOT NULL,
  description     VARCHAR(500) NOT NULL DEFAULT '',
  time            VARCHAR(40) NOT NULL DEFAULT '',
  type            VARCHAR(16) NOT NULL DEFAULT 'manual',
  related_habit_id VARCHAR(80),
  related_task_id  VARCHAR(80),
  fire_at         TIMESTAMPTZ,
  sent            BOOL NOT NULL DEFAULT false,
  dismissed       BOOL NOT NULL DEFAULT false,
  icon            VARCHAR(60) NOT NULL DEFAULT 'notifications',
  icon_color      VARCHAR(9) NOT NULL DEFAULT '#451de3',
  created_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_reminders_user ON reminders(user_id, created_at DESC);
