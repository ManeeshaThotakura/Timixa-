-- Projects module: workspace lives as a column on the project; a real team_members
-- directory backs assignees/reporters/comment authors. Projects, sprints, issues
-- (epic/story/task/bug/subtask via self-referencing parent_id) and comments are all
-- scoped to the owning user through projects.user_id.

CREATE TABLE team_members (
  id         UUID PRIMARY KEY,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(80)  NOT NULL,
  initials   VARCHAR(4)   NOT NULL,
  color      VARCHAR(9)   NOT NULL DEFAULT '#451de3',
  avatar_url VARCHAR(512),
  created_at TIMESTAMPTZ  NOT NULL
);
-- One member row per real account (directory members have user_id NULL).
CREATE UNIQUE INDEX idx_team_members_user ON team_members(user_id);

CREATE TABLE projects (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id VARCHAR(64),
  title        VARCHAR(120)  NOT NULL,
  key_prefix   VARCHAR(4)    NOT NULL,
  description  VARCHAR(2000) NOT NULL DEFAULT '',
  priority     VARCHAR(8)    NOT NULL DEFAULT 'medium',
  status       VARCHAR(12)   NOT NULL DEFAULT 'active',
  start_date   VARCHAR(10),
  due_date     VARCHAR(10),
  tags         VARCHAR(1024) NOT NULL DEFAULT '[]',
  member_ids   VARCHAR(1024) NOT NULL DEFAULT '[]',
  color        VARCHAR(9)    NOT NULL DEFAULT '#451de3',
  icon         VARCHAR(48),
  issue_seq    INT4 NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_projects_user ON projects(user_id);

CREATE TABLE sprints (
  id         UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       VARCHAR(120) NOT NULL,
  goal       VARCHAR(255) NOT NULL DEFAULT '',
  status     VARCHAR(12)  NOT NULL DEFAULT 'future',
  start_date VARCHAR(10),
  end_date   VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_sprints_project ON sprints(project_id);

CREATE TABLE issues (
  id                  UUID PRIMARY KEY,
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  issue_key           VARCHAR(16)  NOT NULL,
  issue_number        INT4 NOT NULL,
  type                VARCHAR(8)   NOT NULL,
  parent_id           UUID REFERENCES issues(id) ON DELETE CASCADE,
  title               VARCHAR(255) NOT NULL,
  description         VARCHAR(4000) NOT NULL DEFAULT '',
  acceptance_criteria VARCHAR(4000),
  status              VARCHAR(12)  NOT NULL DEFAULT 'backlog',
  priority            VARCHAR(8)   NOT NULL DEFAULT 'medium',
  assignee_id         UUID REFERENCES team_members(id) ON DELETE SET NULL,
  reporter_id         UUID REFERENCES team_members(id) ON DELETE SET NULL,
  story_points        INT4,
  estimate_hours      INT4,
  sprint_id           UUID REFERENCES sprints(id) ON DELETE SET NULL,
  start_date          VARCHAR(10),
  due_date            VARCHAR(10),
  resolution          VARCHAR(20),
  color               VARCHAR(9),
  created_at          TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_issues_project ON issues(project_id);
CREATE INDEX idx_issues_parent  ON issues(parent_id);

CREATE TABLE issue_comments (
  id         UUID PRIMARY KEY,
  issue_id   UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  text       VARCHAR(4000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_issue_comments_issue ON issue_comments(issue_id);
