import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/test-database';

let t: TestDatabase;
beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(() => t.close());

describe('createDatabase', () => {
  it('survives a connection cut by the server and works again on the next query', async () => {
    await sql`SELECT 1`.execute(t.db); // opens a pooled connection
    await t.admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = 'app_user' AND datname = current_database()",
    );
    await new Promise((resolve) => setTimeout(resolve, 200)); // let the pool see the error

    const result = await sql<{ ok: number }>`SELECT 1 AS ok`.execute(t.db);
    expect(result.rows[0]!.ok).toBe(1);
  });
});
