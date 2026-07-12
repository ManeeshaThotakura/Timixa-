CREATE TABLE planned_task_week_slots (
  id         UUID PRIMARY KEY,
  task_id    UUID NOT NULL REFERENCES planned_tasks(id) ON DELETE CASCADE,
  weekday    VARCHAR(9) NOT NULL,
  start_time VARCHAR(5) NOT NULL,
  end_time   VARCHAR(5) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (task_id, weekday, start_time)
);
CREATE INDEX idx_week_slots_task ON planned_task_week_slots(task_id, weekday);
