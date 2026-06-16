ALTER TABLE planned_tasks
  ADD COLUMN min_time_minutes INT4,
  ADD COLUMN max_time_minutes INT4,
  ADD COLUMN min_count        INT4,
  ADD COLUMN max_count        INT4;

CREATE TABLE planned_task_exceptions (
  task_id        UUID NOT NULL REFERENCES planned_tasks(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  exception_type VARCHAR(8) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (task_id, exception_date)
);
