import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { insertBusinessGraph, type BusinessGraph } from '../test/graph';
import { createTestDatabase, type TestDatabase } from '../test/test-database';
import { withTenantContext } from './tenant-context';

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

describe('stamps only grows (golden rule 2)', () => {
  it('UPDATE fails for the business, for the system and for the owner of the table', async () => {
    await expect(
      asBusiness(a.businessId, (trx) =>
        sql`UPDATE stamps SET method = 'phone' WHERE id = ${a.stampId}`.execute(trx),
      ),
    ).rejects.toThrow(/append-only/);
    await expect(
      sql`UPDATE stamps SET method = 'phone' WHERE id = ${a.stampId}`.execute(t.system),
    ).rejects.toThrow(/append-only/);
    await expect(t.admin.query("UPDATE stamps SET method = 'phone'")).rejects.toThrow(
      /append-only/,
    );
  });

  it('DELETE fails for the business, for the system and for the owner of the table', async () => {
    await expect(
      asBusiness(a.businessId, (trx) =>
        sql`DELETE FROM stamps WHERE id = ${a.stampId}`.execute(trx),
      ),
    ).rejects.toThrow(/append-only/);
    await expect(sql`DELETE FROM stamps`.execute(t.system)).rejects.toThrow(/append-only/);
    await expect(t.admin.query('DELETE FROM stamps')).rejects.toThrow(/append-only/);
  });

  it('TRUNCATE fails for the owner of the table', async () => {
    await expect(t.admin.query('TRUNCATE stamps CASCADE')).rejects.toThrow(/append-only/);
  });

  it('TRUNCATE is not even allowed to the application roles', async () => {
    await expect(sql`TRUNCATE stamps`.execute(t.db)).rejects.toThrow(/permission denied/);
    await expect(sql`TRUNCATE stamps`.execute(t.system)).rejects.toThrow(/permission denied/);
  });

  it('nothing was lost along the way', async () => {
    const { rows } = await t.admin.query('SELECT count(*)::int AS n FROM stamps');
    expect(rows[0].n).toBe(2);
  });
});

describe('stamps: credit and reversal (RN-EST-03)', () => {
  const reverse = (reason: string | null, staffId = a.ownerId) =>
    asBusiness(a.businessId, (trx) =>
      sql`INSERT INTO stamps (business_id, enrollment_id, cycle_id, customer_id, staff_id,
                              type, reverses_stamp_id, reason)
          VALUES (${a.businessId}, ${a.enrollmentId}, ${a.openCycleId}, ${a.customerId}, ${staffId},
                  'reversal', ${a.stampId}, ${reason})`.execute(trx),
    );

  it('a credit needs a method', async () => {
    await expect(
      t.admin.query(
        `INSERT INTO stamps (business_id, enrollment_id, cycle_id, customer_id, staff_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [a.businessId, a.enrollmentId, a.openCycleId, a.customerId, a.employeeId],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it('a credit cannot carry a reversal reason', async () => {
    await expect(
      t.admin.query(
        `INSERT INTO stamps (business_id, enrollment_id, cycle_id, customer_id, staff_id, method, reason)
         VALUES ($1, $2, $3, $4, $5, 'qr', 'why')`,
        [a.businessId, a.enrollmentId, a.openCycleId, a.customerId, a.employeeId],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it('a reversal needs a reason of at least 3 characters', async () => {
    await expect(reverse(null)).rejects.toThrow(/check constraint/);
    await expect(reverse('ab')).rejects.toThrow(/check constraint/);
  });

  it('a reversal is a new row, and the visit it reverses stays', async () => {
    await reverse('Registered by mistake');
    const { rows } = await t.admin.query(
      'SELECT type FROM stamps WHERE business_id = $1 ORDER BY created_at',
      [a.businessId],
    );
    expect(rows.map((r) => r.type)).toEqual(['credit', 'reversal']);
  });

  it('RN-EST-03: a visit is reversed only once', async () => {
    await expect(reverse('Second try')).rejects.toThrow(/unique|duplicate/);
  });

  it('the idempotency key is unique inside a business and free in another', async () => {
    const insert = (g: BusinessGraph, key: string) =>
      t.admin.query(
        `INSERT INTO stamps (business_id, enrollment_id, cycle_id, customer_id, staff_id, method, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, 'qr', $6)`,
        [g.businessId, g.enrollmentId, g.openCycleId, g.customerId, g.employeeId, key],
      );
    await insert(a, 'key-1');
    await expect(insert(a, 'key-1')).rejects.toThrow(/unique|duplicate/);
    await expect(insert(b, 'key-1')).resolves.toBeDefined();
  });
});

describe('cycles and enrollments', () => {
  it('there is at most one open cycle per enrollment', async () => {
    await expect(
      t.admin.query(
        `INSERT INTO cycles (business_id, enrollment_id, number, stamps_required, reward_description,
                             validity_days, reward_validity_days)
         VALUES ($1, $2, 3, 10, 'x', 30, 30)`,
        [a.businessId, a.enrollmentId],
      ),
    ).rejects.toThrow(/unique|duplicate/);
  });

  it('RN-CIC-02: a cycle keeps its own copy of the rules, so changing the card does not touch it', async () => {
    await t.admin.query(
      "UPDATE programs SET stamps_required = 5, reward_description = 'Changed', validity_days = 7 WHERE id = $1",
      [a.programId],
    );
    const { rows } = await t.admin.query(
      'SELECT stamps_required, reward_description, validity_days FROM cycles WHERE id = $1',
      [a.openCycleId],
    );
    expect(rows[0]).toEqual({
      stamps_required: 10,
      reward_description: 'Free one',
      validity_days: 30,
    });
  });

  it('a customer has one enrollment per card', async () => {
    await expect(
      t.admin.query(
        'INSERT INTO enrollments (business_id, customer_id, program_id) VALUES ($1, $2, $3)',
        [a.businessId, a.customerId, a.programId],
      ),
    ).rejects.toThrow(/unique|duplicate/);
  });

  it('a cycle has one prize at most', async () => {
    await expect(
      t.admin.query(
        `INSERT INTO redemptions (business_id, enrollment_id, cycle_id, customer_id, reward_description, earned_at, expires_at)
         VALUES ($1, $2, $3, $4, 'x', now(), now())`,
        [a.businessId, a.enrollmentId, a.completedCycleId, a.customerId],
      ),
    ).rejects.toThrow(/unique|duplicate/);
  });

  it('numbers its cycles 1, 2, 3 per enrollment, without repeating', async () => {
    await expect(
      t.admin.query(
        `INSERT INTO cycles (business_id, enrollment_id, number, status, stamps_required, reward_description,
                             validity_days, reward_validity_days)
         VALUES ($1, $2, 1, 'expired', 10, 'x', 30, 30)`,
        [a.businessId, a.enrollmentId],
      ),
    ).rejects.toThrow(/unique|duplicate/);
  });
});

describe('programs, businesses and staff', () => {
  const program = (extra: string, value: unknown) =>
    t.admin.query(
      `INSERT INTO programs (business_id, name, reward_description, stamps_required${extra})
       VALUES ($1, 'P', 'R', $2${extra ? ', $3' : ''})`,
      extra ? [a.businessId, 10, value] : [a.businessId, value],
    );

  it('RN-CAR: the number of stamps is between 2 and 30', async () => {
    await expect(program('', 1)).rejects.toThrow(/check constraint/);
    await expect(program('', 31)).rejects.toThrow(/check constraint/);
    await expect(program('', 2)).resolves.toBeDefined();
    await expect(program('', 30)).resolves.toBeDefined();
  });

  it('the color of the card is a #RRGGBB hex', async () => {
    await expect(program(', card_color', 'red')).rejects.toThrow(/check constraint/);
    await expect(program(', card_color', '#12345')).rejects.toThrow(/check constraint/);
    await expect(program(', card_color', '#F4C6D7')).resolves.toBeDefined();
  });

  it('RN-TEN-05: the slug is lowercase words with hyphens, and unique', async () => {
    const insert = (slug: string) =>
      t.admin.query('INSERT INTO businesses (name, slug, trial_ends_at) VALUES ($1, $2, now())', [
        'N',
        slug,
      ]);
    await expect(insert('Has Spaces')).rejects.toThrow(/check constraint/);
    await expect(insert('UPPER')).rejects.toThrow(/check constraint/);
    await expect(insert('-bad-')).rejects.toThrow(/check constraint/);
    await expect(insert('good-slug-2')).resolves.toBeDefined();
    await expect(insert('good-slug-2')).rejects.toThrow(/unique|duplicate/);
  });

  it('RN-TEN-05: the slug cannot be changed, not even by the owner of the table', async () => {
    await expect(
      t.admin.query("UPDATE businesses SET slug = 'new-one' WHERE id = $1", [a.businessId]),
    ).rejects.toThrow(/cannot be changed/);
    await expect(
      asBusiness(a.businessId, (trx) =>
        sql`UPDATE businesses SET slug = 'new-one' WHERE id = ${a.businessId}`.execute(trx),
      ),
    ).rejects.toThrow(/cannot be changed/);
  });

  it('the business can still change its name', async () => {
    await asBusiness(a.businessId, (trx) =>
      sql`UPDATE businesses SET name = 'Renamed' WHERE id = ${a.businessId}`.execute(trx),
    );
    const { rows } = await t.admin.query('SELECT name FROM businesses WHERE id = $1', [
      a.businessId,
    ]);
    expect(rows[0].name).toBe('Renamed');
  });

  it('RN-PER-01: a business has one owner only', async () => {
    await expect(
      t.admin.query(
        "INSERT INTO staff (business_id, name, email, role) VALUES ($1, 'Second', 'second@x.test', 'owner')",
        [a.businessId],
      ),
    ).rejects.toThrow(/unique|duplicate/);
  });

  it('RN-AUT-09: the e-mail of the staff is unique in the whole system, ignoring case', async () => {
    const email = `Dup-${randomUUID().slice(0, 6)}@X.test`;
    const add = (e: string) =>
      t.admin.query(
        "INSERT INTO staff (business_id, name, email, role) VALUES ($1, 'N', $2, 'employee')",
        [b.businessId, e],
      );
    await add(email);
    await expect(add(email.toLowerCase())).rejects.toThrow(/unique|duplicate/);
  });
});
