import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/test-database';

let t: TestDatabase;
beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(() => t.close());

const role = async (name: string) =>
  (
    await t.admin.query(
      'SELECT rolsuper, rolbypassrls, rolcanlogin, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = $1',
      [name],
    )
  ).rows[0];

describe('database roles (docs/DATA_MODEL.md section 9)', () => {
  it('golden rule 1: app_user is subject to row level security', async () => {
    expect(await role('app_user')).toMatchObject({
      rolsuper: false,
      rolbypassrls: false,
      rolcanlogin: true,
      rolcreatedb: false,
      rolcreaterole: false,
    });
  });

  it('app_system ignores row level security but is not a superuser', async () => {
    expect(await role('app_system')).toMatchObject({
      rolsuper: false,
      rolbypassrls: true,
      rolcanlogin: true,
    });
  });

  it('both roles can connect with the passwords of their own URLs', async () => {
    const user = await sql<{ me: string }>`SELECT current_user AS me`.execute(t.db);
    const system = await sql<{ me: string }>`SELECT current_user AS me`.execute(t.system);
    expect(user.rows[0]!.me).toBe('app_user');
    expect(system.rows[0]!.me).toBe('app_system');
  });

  it('app_user cannot change the structure of the database', async () => {
    await expect(sql`CREATE TABLE intruder (id int)`.execute(t.db)).rejects.toThrow(
      /permission denied/,
    );
  });

  it('app_user owns no table, so it cannot drop or alter them', async () => {
    await t.admin.query('CREATE TABLE owned_by_admin (id int)');
    await expect(sql`DROP TABLE owned_by_admin`.execute(t.db)).rejects.toThrow(/must be owner/);
    await expect(sql`ALTER TABLE owned_by_admin ADD COLUMN x int`.execute(t.db)).rejects.toThrow(
      /must be owner/,
    );
  });

  it('a table created later is readable and writable by both roles', async () => {
    await t.admin.query('CREATE TABLE later (id int)');
    await sql`INSERT INTO later (id) VALUES (1)`.execute(t.db);
    const rows = await sql<{ id: number }>`SELECT id FROM later`.execute(t.system);
    expect(rows.rows).toEqual([{ id: 1 }]);
  });

  it('the application roles do not see the bookkeeping of the migrations', async () => {
    await expect(sql`SELECT * FROM schema_migrations`.execute(t.db)).rejects.toThrow(
      /permission denied/,
    );
  });
});
