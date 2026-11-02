import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { insertBusinessGraph, type BusinessGraph } from '../test/graph';
import { createTestDatabase, type TestDatabase } from '../test/test-database';
import { withTenantContext } from './tenant-context';

// Isolation between businesses and between customers (golden rule 1, docs/DATA_MODEL.md
// section 9). Two complete businesses, A and B, each with a row in every table.

let t: TestDatabase;
let a: BusinessGraph;
let b: BusinessGraph;

beforeAll(async () => {
  t = await createTestDatabase();
  a = await insertBusinessGraph(t.admin, 'A');
  b = await insertBusinessGraph(t.admin, 'B');
});
afterAll(() => t.close());

const asBusiness = <T>(id: string, work: Parameters<typeof withTenantContext<T>>[2]) =>
  withTenantContext(t.db, { businessId: id }, work);
const asCustomer = <T>(id: string, work: Parameters<typeof withTenantContext<T>>[2]) =>
  withTenantContext(t.db, { customerId: id }, work);

/** Tables with `business_id`, and the column that tells to which business a row belongs. */
const tenantTables = [
  ['businesses', 'id'],
  ['staff', 'business_id'],
  ['programs', 'business_id'],
  ['business_customers', 'business_id'],
  ['enrollments', 'business_id'],
  ['cycles', 'business_id'],
  ['stamps', 'business_id'],
  ['redemptions', 'business_id'],
] as const;

describe.each(tenantTables)('%s: isolation by business', (table, column) => {
  const ownerOf = (trx: Parameters<Parameters<typeof asBusiness>[1]>[0]) =>
    sql<{
      owner: string;
    }>`SELECT DISTINCT ${sql.ref(column)}::text AS owner FROM ${sql.table(table)}`.execute(trx);

  it('RLS: with the context of business A, nothing of B appears', async () => {
    const rows = await asBusiness(a.businessId, ownerOf);
    expect(rows.rows.map((r) => r.owner)).toEqual([a.businessId]);
  });

  it('RLS: with the context of business B, nothing of A appears', async () => {
    const rows = await asBusiness(b.businessId, ownerOf);
    expect(rows.rows.map((r) => r.owner)).toEqual([b.businessId]);
  });

  it('RLS: without a context, no row is returned', async () => {
    const rows = await sql`SELECT * FROM ${sql.table(table)}`.execute(t.db);
    expect(rows.rows).toEqual([]);
  });

  it('RLS: the context of a customer shows no row of the business side, only its own', async () => {
    // A customer reads rows that belong to them (see the customer tests below); never a
    // row of the other customer's business.
    const rows = await asCustomer(a.customerId, (trx) =>
      sql<{
        owner: string;
      }>`SELECT DISTINCT ${sql.ref(column)}::text AS owner FROM ${sql.table(table)}`.execute(trx),
    );
    expect(rows.rows.map((r) => r.owner)).not.toContain(b.businessId);
  });

  it('RLS: an UPDATE cannot reach a row of another business', async () => {
    const updated = await asBusiness(a.businessId, (trx) =>
      sql`UPDATE ${sql.table(table)} SET ${sql.ref(column)} = ${sql.ref(column)}
          WHERE ${sql.ref(column)} = ${b.businessId}`.execute(trx),
    );
    expect(updated.numAffectedRows).toBe(0n);
  });

  it('RLS: a DELETE cannot reach a row of another business', async () => {
    // `stamps` refuses DELETE for everyone, so it never gets this far (tested below).
    if (table === 'stamps') return;
    const deleted = await asBusiness(a.businessId, (trx) =>
      sql`DELETE FROM ${sql.table(table)} WHERE ${sql.ref(column)} = ${b.businessId}`.execute(trx),
    );
    expect(deleted.numAffectedRows).toBe(0n);
    const { rows } = await t.admin.query(
      `SELECT count(*)::int AS n FROM ${table} WHERE ${column} = $1`,
      [b.businessId],
    );
    expect(rows[0].n).toBeGreaterThan(0);
  });
});

describe('RLS: INSERT with the business_id of another business fails', () => {
  const foreign = (
    work: (trx: Parameters<Parameters<typeof asBusiness>[1]>[0]) => Promise<unknown>,
  ) => expect(asBusiness(a.businessId, work)).rejects.toThrow(/row-level security/);

  it('programs', () =>
    foreign((trx) =>
      sql`INSERT INTO programs (business_id, name, stamps_required, reward_description)
          VALUES (${b.businessId}, 'Intruder', 10, 'x')`.execute(trx),
    ));

  it('staff', () =>
    foreign((trx) =>
      sql`INSERT INTO staff (business_id, name, email, role)
          VALUES (${b.businessId}, 'Intruder', 'intruder@x.test', 'employee')`.execute(trx),
    ));

  it('business_customers', () =>
    foreign((trx) =>
      sql`INSERT INTO business_customers (business_id, customer_id)
          VALUES (${b.businessId}, ${a.customerId})`.execute(trx),
    ));

  it('enrollments', () =>
    foreign((trx) =>
      sql`INSERT INTO enrollments (business_id, customer_id, program_id)
          VALUES (${b.businessId}, ${a.customerId}, ${b.programId})`.execute(trx),
    ));

  it('stamps', () =>
    foreign((trx) =>
      sql`INSERT INTO stamps (business_id, enrollment_id, cycle_id, customer_id, staff_id, method)
          VALUES (${b.businessId}, ${b.enrollmentId}, ${b.openCycleId}, ${b.customerId},
                  ${b.employeeId}, 'qr')`.execute(trx),
    ));

  it('a business can create the row of its own', async () => {
    await asBusiness(a.businessId, (trx) =>
      sql`INSERT INTO programs (business_id, name, stamps_required, reward_description)
          VALUES (${a.businessId}, 'Second card', 8, 'Free')`.execute(trx),
    );
    const rows = await asBusiness(a.businessId, (trx) =>
      sql<{ name: string }>`SELECT name FROM programs ORDER BY name`.execute(trx),
    );
    expect(rows.rows.map((r) => r.name)).toEqual(['Card', 'Second card']);
  });
});

describe('customers read only what is theirs', () => {
  const countOf = (table: string, id: string) =>
    asCustomer(id, (trx) =>
      sql<{ n: number }>`SELECT count(*)::int AS n FROM ${sql.table(table)}`.execute(trx),
    ).then((r) => r.rows[0]!.n);

  it.each(['enrollments', 'stamps', 'redemptions', 'business_customers'])(
    'RLS: a customer reads the own rows of %s and none of the other customer',
    async (table) => {
      expect(await countOf(table, a.customerId)).toBeGreaterThan(0);
      const other = await asCustomer(a.customerId, (trx) =>
        sql`SELECT * FROM ${sql.table(table)} WHERE customer_id = ${b.customerId}`.execute(trx),
      );
      expect(other.rows).toEqual([]);
    },
  );

  it('RLS: a customer reads the cycles of the own enrollment only', async () => {
    const rows = await asCustomer(a.customerId, (trx) =>
      sql<{ enrollment_id: string }>`SELECT enrollment_id FROM cycles`.execute(trx),
    );
    expect(rows.rows.length).toBe(2);
    expect(new Set(rows.rows.map((r) => r.enrollment_id))).toEqual(new Set([a.enrollmentId]));
  });

  it('RLS: a customer reads the business and the card of the own enrollment, not others', async () => {
    const businesses = await asCustomer(a.customerId, (trx) =>
      sql<{ id: string }>`SELECT id FROM businesses`.execute(trx),
    );
    const programs = await asCustomer(a.customerId, (trx) =>
      sql<{ id: string }>`SELECT id FROM programs`.execute(trx),
    );
    expect(businesses.rows.map((r) => r.id)).toEqual([a.businessId]);
    expect(programs.rows.map((r) => r.id)).toEqual([a.programId]);
  });

  it('RLS: a customer without enrollments sees no business and no card', async () => {
    const lonely = randomUUID();
    expect(await countOf('businesses', lonely)).toBe(0);
    expect(await countOf('programs', lonely)).toBe(0);
    expect(await countOf('enrollments', lonely)).toBe(0);
  });

  it('RLS: a customer cannot read the staff of a business', async () => {
    expect(await countOf('staff', a.customerId)).toBe(0);
  });

  it('RLS: a customer cannot write anything, even in the own enrollment', async () => {
    await expect(
      asCustomer(a.customerId, (trx) =>
        sql`INSERT INTO enrollments (business_id, customer_id, program_id)
            VALUES (${b.businessId}, ${a.customerId}, ${b.programId})`.execute(trx),
      ),
    ).rejects.toThrow(/row-level security/);

    const updated = await asCustomer(a.customerId, (trx) =>
      sql`UPDATE enrollments SET status = 'archived' WHERE id = ${a.enrollmentId}`.execute(trx),
    );
    expect(updated.numAffectedRows).toBe(0n);
    const deleted = await asCustomer(a.customerId, (trx) =>
      sql`DELETE FROM redemptions WHERE id = ${a.redemptionId}`.execute(trx),
    );
    expect(deleted.numAffectedRows).toBe(0n);
    const { rows } = await t.admin.query('SELECT status FROM enrollments WHERE id = $1', [
      a.enrollmentId,
    ]);
    expect(rows[0].status).toBe('active');
  });
});

describe('a business reads only the customers it has', () => {
  const customersSeenBy = (businessId: string) =>
    asBusiness(businessId, (trx) =>
      sql<{ name: string }>`SELECT name FROM customers`.execute(trx),
    ).then((r) => r.rows.map((x) => x.name));

  it('RLS: business A sees its customer and not the one of B', async () => {
    expect(await customersSeenBy(a.businessId)).toEqual(['Customer A']);
    expect(await customersSeenBy(b.businessId)).toEqual(['Customer B']);
  });

  it('RLS: a customer that is not linked to the business is not visible to it', async () => {
    const stranger = randomUUID();
    await t.admin.query(
      "INSERT INTO customers (id, phone_e164, name) VALUES ($1, '+5531900001111', 'Stranger')",
      [stranger],
    );
    expect(await customersSeenBy(a.businessId)).not.toContain('Stranger');
    expect(await customersSeenBy(b.businessId)).not.toContain('Stranger');
  });

  it('RLS: a business cannot change a customer', async () => {
    await expect(
      asBusiness(a.businessId, (trx) => sql`UPDATE customers SET name = 'Hacked'`.execute(trx)),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('RLS is enabled and forced on every table of a business', () => {
  it.each(tenantTables.map(([table]) => table))('%s', async (table) => {
    const { rows } = await t.admin.query(
      'SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1',
      [table],
    );
    expect(rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
  });
});

describe('qr_tokens: only the system module', () => {
  it('app_user has no right on it', async () => {
    await expect(sql`SELECT * FROM qr_tokens`.execute(t.db)).rejects.toThrow(/permission denied/);
  });

  it('app_system can use it', async () => {
    await sql`INSERT INTO qr_tokens (customer_id, expires_at)
              VALUES (${a.customerId}, now() + interval '45 seconds')`.execute(t.system);
    const rows = await sql`SELECT * FROM qr_tokens`.execute(t.system);
    expect(rows.rows).toHaveLength(1);
  });
});
