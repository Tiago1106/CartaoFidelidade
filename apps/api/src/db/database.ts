import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { DB } from './types.generated';

/** Typed query builder over the database. */
export type Database = Kysely<DB>;

export const DATABASE = Symbol('DATABASE');

/**
 * Connects with the given URL. Requests use `DATABASE_URL` (role `app_user`, subject to RLS).
 * The role that ignores RLS has its own function in `src/system/`.
 */
export function createDatabase(url: string, options: { max?: number } = {}): Database {
  const pool = new pg.Pool({ connectionString: url, max: options.max });
  // An idle connection can be cut by the server (restart, failover). `pg` then emits `error`, and
  // with no listener Node stops the whole process. The pool drops that connection and the next
  // query opens a new one, so there is nothing else to do here.
  pool.on('error', () => {});
  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}
