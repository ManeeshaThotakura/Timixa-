CREATE TABLE planned_task_segments (
  id           UUID PRIMARY KEY,
  task_id      UUID NOT NULL REFERENCES planned_tasks(id) ON DELETE CASCADE,
  segment_date DATE NOT NULL,
  start_time   VARCHAR(5) NOT NULL,
  end_time     VARCHAR(5) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL,
  UNIQUE (task_id, segment_date, start_time)
);
CREATE INDEX idx_segments_task_date ON planned_task_segments(task_id, segment_date);
