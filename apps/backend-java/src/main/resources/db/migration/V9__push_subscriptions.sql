CREATE TABLE push_subscriptions (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   VARCHAR(500) NOT NULL UNIQUE,
  p256dh     VARCHAR(255) NOT NULL,
  auth       VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);
