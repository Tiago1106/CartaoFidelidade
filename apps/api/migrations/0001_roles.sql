-- Database roles (docs/DATA_MODEL.md, section 9).
--
-- app_user:   used by every request. Subject to row level security. Owns nothing.
-- app_system: used only by the small system module (OTP and sign-in of the customer, QR
--             resolution, webhooks, cleanup). Ignores row level security.
--
-- Both are created without a password and without LOGIN. `pnpm db:migrate` gives them the
-- passwords found in DATABASE_URL and DATABASE_URL_SYSTEM and enables LOGIN, so no secret
-- lives in a migration.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_system') THEN
    CREATE ROLE app_system NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
  END IF;
END
$$;

-- The tables are owned by the role that runs the migrations, never by the two roles above.
-- Nobody can create objects in the schema, so a request can never change the structure.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_user, app_system;

-- Every table and sequence created later in a migration is usable by both roles. What each
-- one may do on a table is narrowed by row level security (app_user) and by the module that
-- holds app_system.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user, app_system;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user, app_system;
