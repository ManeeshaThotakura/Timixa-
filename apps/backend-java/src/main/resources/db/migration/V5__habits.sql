CREATE TABLE habits (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(120) NOT NULL,
  category     VARCHAR(80),
  icon         VARCHAR(60) NOT NULL DEFAULT 'task_alt',
  target_count INT NOT NULL DEFAULT 1,
  unit         VARCHAR(24) NOT NULL DEFAULT 'time',
  color        VARCHAR(9) NOT NULL DEFAULT '#00c1fd',
  goal_id      VARCHAR(80),
  created_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_habits_user ON habits(user_id, created_at DESC);

CREATE TABLE habit_completions (
  habit_id       UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  delta          INT  NOT NULL DEFAULT 1,
  completed_at   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (habit_id, completed_date)
);
CREATE INDEX idx_habit_completions_lookup ON habit_completions(habit_id, completed_date DESC);
