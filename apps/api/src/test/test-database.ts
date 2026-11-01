import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { inject } from 'vitest';
import { createDatabase, type Database } from '../db/database';
import { APP_SYSTEM_PASSWORD, APP_USER_PASSWORD, TEMPLATE_DATABASE } from './constants';

export { MIGRATIONS_DIR } from './constants';

export interface TestDatabase {
  /** Connection of the owner: creates tables for a test, reads without RLS. */
  admin: pg.Pool;
  /** Role `app_user`: what a request uses. Subject to RLS. */
  db: Database;
  /** Role `app_system`: ignores RLS. */
  system: Database;
  urls: { admin: string; appUser: string; appSystem: string };
  close(): Promise<void>;
}

function withDatabase(base: string, database: string, user?: string, password?: string): string {
  const url = new URL(base);
  url.pathname = `/${database}`;
  if (user) url.username = user;
  if (password) url.password = password;
  return url.toString();
}

/**
 * A new database in the test container. By default it is a copy of the template, with every
 * migration applied and the roles ready. With `migrate: false` it is empty.
 */
export async function createTestDatabase(
  options: { migrate?: boolean } = {},
): Promise<TestDatabase> {
  const base = inject('postgresUrl');
  const name = `t_${randomBytes(6).toString('hex')}`;

  const server = new pg.Client({ connectionString: base });
  await server.connect();
  await server.query(
    options.migrate === false
      ? `CREATE DATABASE ${name}`
      : `CREATE DATABASE ${name} TEMPLATE ${TEMPLATE_DATABASE}`,
  );
  await server.end();

  const urls = {
    admin: withDatabase(base, name),
    appUser: withDatabase(base, name, 'app_user', APP_USER_PASSWORD),
    appSystem: withDatabase(base, name, 'app_system', APP_SYSTEM_PASSWORD),
  };
  const admin = new pg.Pool({ connectionString: urls.admin, max: 2 });
  const db = createDatabase(urls.appUser, { max: 4 });
  const system = createDatabase(urls.appSystem, { max: 2 });

  return {
    admin,
    db,
    system,
    urls,
    async close() {
      await db.destroy();
      await system.destroy();
      await admin.end();
      const cleanup = new pg.Client({ connectionString: base });
      await cleanup.connect();
      await cleanup.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await cleanup.end();
    },
  };
}
