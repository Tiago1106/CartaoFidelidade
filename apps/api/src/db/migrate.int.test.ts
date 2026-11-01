import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, MIGRATIONS_DIR, type TestDatabase } from '../test/test-database';
import { migrate, MigrationError } from './migrate';

describe('migrate (real migrations)', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(() => t.close());

  it('records every applied migration', async () => {
    const { rows } = await t.admin.query('SELECT name FROM schema_migrations ORDER BY name');
    expect(rows.map((r) => r.name)).toContain('0001_roles.sql');
  });

  it('running again changes nothing', async () => {
    const result = await migrate({ url: t.urls.admin, dir: MIGRATIONS_DIR });
    expect(result.applied).toEqual([]);
    expect(result.skipped).toContain('0001_roles.sql');
  });
});

describe('migrate (a folder of our own)', () => {
  let t: TestDatabase;
  let dir: string;
  beforeAll(async () => {
    t = await createTestDatabase({ migrate: false });
  });
  afterAll(() => t.close());

  const write = (name: string, sql: string) => writeFile(join(dir, name), sql);
  const run = () => migrate({ url: t.urls.admin, dir });

  it('applies the files in order and keeps the checksum', async () => {
    dir = await mkdtemp(join(tmpdir(), 'migrations-'));
    await write('0001_a.sql', 'CREATE TABLE a (id int)');
    await write('0002_b.sql', 'CREATE TABLE b (id int)');
    await write('notes.txt', 'not a migration');

    const result = await run();
    expect(result.applied).toEqual(['0001_a.sql', '0002_b.sql']);
    const { rows } = await t.admin.query('SELECT checksum FROM schema_migrations');
    expect(rows).toHaveLength(2);
    expect(rows[0].checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('applies only the new file on the next run', async () => {
    await write('0003_c.sql', 'CREATE TABLE c (id int)');
    const result = await run();
    expect(result.applied).toEqual(['0003_c.sql']);
    expect(result.skipped).toEqual(['0001_a.sql', '0002_b.sql']);
  });

  it('refuses an applied migration that was edited', async () => {
    await write('0001_a.sql', 'CREATE TABLE a (id int, extra int)');
    await expect(run()).rejects.toThrow(/already applied and has changed/);
    await write('0001_a.sql', 'CREATE TABLE a (id int)');
  });

  it('refuses when the file of an applied migration is gone', async () => {
    await rm(join(dir, '0003_c.sql'));
    await expect(run()).rejects.toBeInstanceOf(MigrationError);
    await write('0003_c.sql', 'CREATE TABLE c (id int)');
  });

  it('a failing migration changes nothing and is not recorded', async () => {
    await write('0004_bad.sql', 'CREATE TABLE d (id int); SELECT broken FROM nowhere;');
    await expect(run()).rejects.toThrow(/0004_bad.sql failed/);
    const { rows } = await t.admin.query("SELECT to_regclass('d') AS d");
    expect(rows[0].d).toBeNull();
    const recorded = await t.admin.query(
      "SELECT 1 FROM schema_migrations WHERE name = '0004_bad.sql'",
    );
    expect(recorded.rowCount).toBe(0);
    await rm(join(dir, '0004_bad.sql'));
  });

  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });
});
