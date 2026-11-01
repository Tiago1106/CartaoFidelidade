import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

// Plain numbered SQL migrations (decision D-001). One file per change: `0002_customers.sql`.
// An applied migration is never edited: its checksum is saved, and a changed file is refused.

const FILE_NAME = /^\d{4}_[a-z0-9_]+\.sql$/;
// Any fixed number: it only has to be the same in every run, so two runs wait for each other.
const LOCK_ID = 727274;

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export interface MigrateOptions {
  /** Connection of the role that owns the tables (not `app_user`, not `app_system`). */
  url: string;
  /** Folder with the `.sql` files. */
  dir: string;
  /** Passwords for the two application roles. They get LOGIN only when a password is given. */
  rolePasswords?: { appUser?: string; appSystem?: string };
  log?: (message: string) => void;
}

export interface MigrateResult {
  applied: string[];
  skipped: string[];
}

export async function migrate(options: MigrateOptions): Promise<MigrateResult> {
  const log = options.log ?? (() => {});
  const files = (await readdir(options.dir)).filter((name) => FILE_NAME.test(name)).sort();

  const client = new pg.Client({ connectionString: options.url });
  await client.connect();
  const result: MigrateResult = { applied: [], skipped: [] };
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        checksum   text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

    const { rows } = await client.query<{ name: string; checksum: string }>(
      'SELECT name, checksum FROM schema_migrations',
    );
    const known = new Map(rows.map((row) => [row.name, row.checksum]));

    for (const name of known.keys()) {
      if (!files.includes(name)) {
        throw new MigrationError(`Migration ${name} was applied but its file is gone.`);
      }
    }

    for (const name of files) {
      const sql = await readFile(join(options.dir, name), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = known.get(name);

      if (previous !== undefined) {
        if (previous !== checksum) {
          throw new MigrationError(
            `Migration ${name} was already applied and has changed. Never edit an applied migration: add a new one.`,
          );
        }
        result.skipped.push(name);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
          name,
          checksum,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new MigrationError(
          `Migration ${name} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      log(`applied ${name}`);
      result.applied.push(name);
    }

    await setRolePasswords(client, options.rolePasswords);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    await client.end();
  }
  return result;
}

async function setRolePasswords(client: pg.Client, passwords: MigrateOptions['rolePasswords']) {
  const roles: [string, string | undefined][] = [
    ['app_user', passwords?.appUser],
    ['app_system', passwords?.appSystem],
  ];
  for (const [role, password] of roles) {
    if (!password) continue;
    // `ALTER ROLE` cannot take parameters, so the statement is built by `format` with %I and %L.
    const { rows } = await client.query<{ sql: string }>(
      "SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', $1::text, $2::text) AS sql",
      [role, password],
    );
    await client.query(rows[0]!.sql);
  }
}
