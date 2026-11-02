-- Refresh tokens rotate on every use (docs/API.md section 1): the used row is revoked and a new
-- row takes its place. All the rows of one login share a `family_id`. If a refresh token that was
-- already used is shown again, somebody else has a copy, so the whole family is revoked.

ALTER TABLE sessions ADD COLUMN family_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE INDEX sessions_family ON sessions (family_id);
