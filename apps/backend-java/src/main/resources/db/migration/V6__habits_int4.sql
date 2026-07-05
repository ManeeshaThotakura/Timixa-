-- V5 used plain `INT` which CockroachDB stores as INT8/BIGINT. The Habit/HabitCompletion
-- entities use `int` (32-bit) so schema validation fails. Match the project convention
-- (INT4) used everywhere else.
ALTER TABLE habits            ALTER COLUMN target_count TYPE INT4 USING target_count::INT4;
ALTER TABLE habit_completions ALTER COLUMN delta        TYPE INT4 USING delta::INT4;
