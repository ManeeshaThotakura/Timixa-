CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(80) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'MEMBER',
  age INT4,
  occupation VARCHAR(80),
  bedtime VARCHAR(5),
  wake_time VARCHAR(5),
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_users_email_lower ON users (LOWER(email));
