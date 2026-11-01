import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/test-database';
import { withTenantContext } from './tenant-context';

const businessA = randomUUID();
const businessB = randomUUID();
const customerX = randomUUID();

let t: TestDatabase;
beforeAll(async () => {
  t = await createTestDatabase();
  // A table shaped like the real ones: `business_id`, RLS enabled and forced, the policy of
  // DATA_MODEL section 9. It stands in for them until the real tables arrive (T19, T20).
  await t.admin.query(`
    CREATE TABLE things (id serial PRIMARY KEY, business_id uuid NOT NULL, name text NOT NULL);
    ALTER TABLE things ENABLE ROW LEVEL SECURITY;
    ALTER TABLE things FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation ON things
      USING      (business_id = nullif(current_setting('app.business_id', true), '')::uuid)
      WITH CHECK (business_id = nullif(current_setting('app.business_id', true), '')::uuid);
  `);
  await t.admin.query('INSERT INTO things (business_id, name) VALUES ($1, $2), ($3, $4)', [
    businessA,
    'of A',
    businessB,
    'of B',
  ]);
});
afterAll(() => t.close());

const names = (rows: { name: string }[]) => rows.map((r) => r.name);
const readThings = (db = t.db) => sql<{ name: string }>`SELECT name FROM things`.execute(db);

describe('withTenantContext (golden rules 1 and 5)', () => {
  it('RLS: with the context of business A, nothing of B appears', async () => {
    const rows = await withTenantContext(t.db, { businessId: businessA }, (trx) => readThings(trx));
    expect(names(rows.rows)).toEqual(['of A']);
  });

  it('RLS: the context of business B shows only B', async () => {
    const rows = await withTenantContext(t.db, { businessId: businessB }, (trx) => readThings(trx));
    expect(names(rows.rows)).toEqual(['of B']);
  });

  it('RLS: without a context, no row is returned', async () => {
    const rows = await readThings();
    expect(rows.rows).toEqual([]);
  });

  it('RLS: with the context of a customer, a table of businesses stays empty', async () => {
    const rows = await withTenantContext(t.db, { customerId: customerX }, (trx) => readThings(trx));
    expect(rows.rows).toEqual([]);
  });

  it('RLS: an INSERT with the business_id of another business fails', async () => {
    await expect(
      withTenantContext(t.db, { businessId: businessA }, (trx) =>
        sql`INSERT INTO things (business_id, name) VALUES (${businessB}, 'intruder')`.execute(trx),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('RLS: an INSERT with its own business_id works and is seen only by it', async () => {
    await withTenantContext(t.db, { businessId: businessA }, (trx) =>
      sql`INSERT INTO things (business_id, name) VALUES (${businessA}, 'new of A')`.execute(trx),
    );
    const a = await withTenantContext(t.db, { businessId: businessA }, (trx) => readThings(trx));
    const b = await withTenantContext(t.db, { businessId: businessB }, (trx) => readThings(trx));
    expect(names(a.rows)).toEqual(['of A', 'new of A']);
    expect(names(b.rows)).toEqual(['of B']);
  });

  it('RLS: an UPDATE or DELETE cannot reach the rows of another business', async () => {
    const result = await withTenantContext(t.db, { businessId: businessA }, async (trx) => {
      const updated = await sql`UPDATE things SET name = 'hacked' WHERE name = 'of B'`.execute(trx);
      const deleted = await sql`DELETE FROM things WHERE name = 'of B'`.execute(trx);
      return [updated.numAffectedRows, deleted.numAffectedRows];
    });
    expect(result).toEqual([0n, 0n]);
    const b = await withTenantContext(t.db, { businessId: businessB }, (trx) => readThings(trx));
    expect(names(b.rows)).toEqual(['of B']);
  });

  it('app_system ignores RLS and sees every row', async () => {
    const rows = await readThings(t.system);
    expect(names(rows.rows)).toEqual(expect.arrayContaining(['of A', 'of B']));
  });

  it('SET LOCAL: the context ends with the transaction and does not leak to the pool', async () => {
    const inside = await withTenantContext(t.db, { businessId: businessA }, (trx) =>
      sql<{ v: string }>`SELECT current_setting('app.business_id', true) AS v`.execute(trx),
    );
    expect(inside.rows[0]!.v).toBe(businessA);

    // Many requests in a row, on a pool of 4: none may start with the id of the previous one.
    for (let i = 0; i < 12; i++) {
      const after = await sql<{ v: string | null }>`
        SELECT current_setting('app.business_id', true) AS v`.execute(t.db);
      expect(after.rows[0]!.v ?? '').toBe('');
    }
  });

  it('SET LOCAL: concurrent requests keep their own context', async () => {
    const results = await Promise.all(
      [businessA, businessB, businessA, businessB, businessA, businessB].map((id) =>
        withTenantContext(t.db, { businessId: id }, async (trx) => {
          await sql`SELECT pg_sleep(0.05)`.execute(trx);
          return names((await readThings(trx)).rows).every((n) =>
            id === businessA ? n.includes('A') : n === 'of B',
          );
        }),
      ),
    );
    expect(results.every(Boolean)).toBe(true);
  });

  it('rolls back everything when the work fails', async () => {
    await expect(
      withTenantContext(t.db, { businessId: businessA }, async (trx) => {
        await sql`INSERT INTO things (business_id, name) VALUES (${businessA}, 'ghost')`.execute(
          trx,
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const rows = await withTenantContext(t.db, { businessId: businessA }, (trx) => readThings(trx));
    expect(names(rows.rows)).not.toContain('ghost');
  });

  it.each(['', 'not-a-uuid', "x'; DROP TABLE things; --", randomUUID().slice(1)])(
    'refuses an id that is not a uuid: %j',
    async (id) => {
      await expect(withTenantContext(t.db, { businessId: id }, async () => 1)).rejects.toThrow(
        /Invalid id/,
      );
    },
  );
});
