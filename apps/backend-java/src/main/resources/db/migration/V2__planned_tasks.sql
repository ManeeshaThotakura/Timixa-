CREATE TABLE planned_tasks (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(120) NOT NULL,
    goal            VARCHAR(80),
    color           VARCHAR(9) NOT NULL DEFAULT '#451de3',
    cadence         VARCHAR(16) NOT NULL,
    needs_time_slot BOOLEAN NOT NULL DEFAULT TRUE,
    start_time      VARCHAR(5),
    end_time        VARCHAR(5),
    scheduled_date  DATE,
    weekdays        VARCHAR(96),
    month_days      VARCHAR(96),
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_planned_tasks_user ON planned_tasks(user_id);

CREATE TABLE planned_task_completions (
    task_id        UUID NOT NULL REFERENCES planned_tasks(id) ON DELETE CASCADE,
    completed_date DATE NOT NULL,
    completed_at   TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (task_id, completed_date)
);
