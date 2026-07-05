ALTER TABLE planned_tasks ADD COLUMN notify_at_start BOOL NOT NULL DEFAULT false;
ALTER TABLE planned_tasks ADD COLUMN notify_at_end   BOOL NOT NULL DEFAULT false;
