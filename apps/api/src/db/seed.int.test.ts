import { sql } from 'kysely';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/test-database';
import { id, seed, SEED_CUSTOMER } from './seed';
import { withTenantContext } from './tenant-context';

let t: TestDatabase;

async function runSeed() {
  const client = new pg.Client({ connectionString: t.urls.admin });
  await client.connect();
  try {
    await seed(client);
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  t = await createTestDatabase();
  await runSeed();
});
afterAll(() => t.close());

const asMaria = <T>(work: Parameters<typeof withTenantContext<T>>[2]) =>
  withTenantContext(t.db, { customerId: SEED_CUSTOMER.id }, work);

/** The count of a cycle, as in DATA_MODEL section 6: credits that have no reversal. */
const countOf = async (cycleId: string) => {
  const { rows } = await t.admin.query(
    `SELECT count(*)::int AS n FROM stamps c
     WHERE c.cycle_id = $1 AND c.type = 'credit'
       AND NOT EXISTS (SELECT 1 FROM stamps r WHERE r.reverses_stamp_id = c.id)`,
    [cycleId],
  );
  return rows[0].n as number;
};

describe('seed: Maria and her three cards', () => {
  it('Maria has the three enrollments of the design', async () => {
    const rows = await asMaria((trx) =>
      sql<{ business: string; program: string; color: string }>`
        SELECT b.name AS business, p.name AS program, p.card_color AS color
        FROM enrollments e
        JOIN businesses b ON b.id = e.business_id
        JOIN programs p ON p.id = e.program_id
        ORDER BY b.name`.execute(trx),
    );
    expect(rows.rows).toEqual([
      { business: 'Barbearia Navalha', program: 'Corte', color: '#16181B' },
      { business: 'Espaço Vita', program: 'Limpeza de pele', color: '#CFE3D4' },
      { business: 'Studio Bela', program: 'Escova', color: '#F4C6D7' },
    ]);
  });

  it('Studio Bela is complete: 10 of 10 and a prize waiting', async () => {
    expect(await countOf(id('cycle', 'bela', '1'))).toBe(10);
    const { rows } = await t.admin.query('SELECT status FROM redemptions WHERE id = $1', [
      id('redemption', 'bela', '1'),
    ]);
    expect(rows[0].status).toBe('available');
    const enrollment = await t.admin.query(
      'SELECT current_cycle_id FROM enrollments WHERE id = $1',
      [id('enrollment', 'bela')],
    );
    // A completed cycle leaves no current cycle (DATA_MODEL 10.1, step 9).
    expect(enrollment.rows[0].current_cycle_id).toBeNull();
  });

  it('Barbearia Navalha is on its second cycle, with 7 of 10', async () => {
    expect(await countOf(id('cycle', 'navalha', '2'))).toBe(7);
    expect(await countOf(id('cycle', 'navalha', '1'))).toBe(10);
    const { rows } = await t.admin.query(
      'SELECT number, status FROM cycles WHERE enrollment_id = $1 ORDER BY number',
      [id('enrollment', 'navalha')],
    );
    expect(rows).toEqual([
      { number: 1, status: 'completed' },
      { number: 2, status: 'open' },
    ]);
    const prize = await t.admin.query('SELECT status FROM redemptions WHERE id = $1', [
      id('redemption', 'navalha', '1'),
    ]);
    expect(prize.rows[0].status).toBe('redeemed');
  });

  it('Espaço Vita has 2 of 10', async () => {
    expect(await countOf(id('cycle', 'vita', '1'))).toBe(2);
  });

  it('the enrollment points to its open cycle, and has the date of the last visit', async () => {
    const { rows } = await t.admin.query(
      `SELECT e.current_cycle_id, e.last_stamp_at, c.last_stamp_at AS cycle_last
       FROM enrollments e JOIN cycles c ON c.id = e.current_cycle_id
       WHERE e.id = $1`,
      [id('enrollment', 'navalha')],
    );
    expect(rows[0].current_cycle_id).toBe(id('cycle', 'navalha', '2'));
    expect(rows[0].last_stamp_at).toEqual(rows[0].cycle_last);
    expect(new Date(rows[0].last_stamp_at).toISOString()).toBe('2026-10-20T14:10:00.000Z');
  });

  it('RN-VAL-04: the cycle is valid until the end of the day, in São Paulo time', async () => {
    // Last visit 2026-10-30 (14:32 in São Paulo) + 30 days: valid through the end of 2026-11-29.
    // The next day starts at 03:00 UTC (UTC-3), so the limit is 2026-11-30T03:00:00Z.
    const { rows } = await t.admin.query('SELECT expires_at FROM cycles WHERE id = $1', [
      id('cycle', 'bela', '1'),
    ]);
    expect(new Date(rows[0].expires_at).toISOString()).toBe('2026-11-30T03:00:00.000Z');
  });

  it('the visits of Studio Bela are the ten of the design, with the first names of the staff', async () => {
    const { rows } = await t.admin.query(
      `SELECT s.created_at, st.name FROM stamps s JOIN staff st ON st.id = s.staff_id
       WHERE s.cycle_id = $1 ORDER BY s.created_at DESC`,
      [id('cycle', 'bela', '1')],
    );
    expect(rows).toHaveLength(10);
    expect(new Date(rows[0].created_at).toISOString()).toBe('2026-10-30T17:32:00.000Z');
    expect(rows[0].name).toBe('Ana');
    expect(new Date(rows[1].created_at).toISOString()).toBe('2026-10-14T20:48:00.000Z');
  });

  it('every business has one owner and three employees', async () => {
    const { rows } = await t.admin.query(
      "SELECT business_id, count(*) FILTER (WHERE role = 'owner')::int AS owners, count(*)::int AS total FROM staff GROUP BY business_id",
    );
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row).toMatchObject({ owners: 1, total: 4 });
  });

  it('RLS: the Navalha sees its own staff, cycles and visits and none of the other businesses', async () => {
    const counts = await withTenantContext(
      t.db,
      { businessId: id('business', 'navalha') },
      async (trx) => {
        const staff = await sql<{ n: number }>`SELECT count(*)::int AS n FROM staff`.execute(trx);
        const stamps = await sql<{ n: number }>`SELECT count(*)::int AS n FROM stamps`.execute(trx);
        const customers = await sql<{ name: string }>`SELECT name FROM customers`.execute(trx);
        return { staff: staff.rows[0]!.n, stamps: stamps.rows[0]!.n, customers: customers.rows };
      },
    );
    expect(counts.staff).toBe(4);
    expect(counts.stamps).toBe(17);
    expect(counts.customers).toEqual([{ name: 'Maria' }]);
  });

  it('running it again changes nothing', async () => {
    const before = await t.admin.query(
      `SELECT (SELECT count(*) FROM stamps)::int AS stamps, (SELECT count(*) FROM cycles)::int AS cycles,
              (SELECT count(*) FROM enrollments)::int AS enrollments, (SELECT count(*) FROM staff)::int AS staff,
              (SELECT count(*) FROM redemptions)::int AS redemptions`,
    );
    await runSeed();
    const after = await t.admin.query(
      `SELECT (SELECT count(*) FROM stamps)::int AS stamps, (SELECT count(*) FROM cycles)::int AS cycles,
              (SELECT count(*) FROM enrollments)::int AS enrollments, (SELECT count(*) FROM staff)::int AS staff,
              (SELECT count(*) FROM redemptions)::int AS redemptions`,
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(before.rows[0]).toEqual({
      stamps: 29,
      cycles: 4,
      enrollments: 3,
      staff: 12,
      redemptions: 2,
    });
  });
});
