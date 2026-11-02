import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/test-database';
import { withTenantContext } from './tenant-context';

const maria = { id: randomUUID(), phone: '+5511900000000', name: 'Maria' };
const carlos = { id: randomUUID(), phone: '+5521987654321', name: 'Carlos' };

let t: TestDatabase;
beforeAll(async () => {
  t = await createTestDatabase();
  await t.admin.query(
    'INSERT INTO customers (id, phone_e164, name) VALUES ($1, $2, $3), ($4, $5, $6)',
    [maria.id, maria.phone, maria.name, carlos.id, carlos.phone, carlos.name],
  );
});
afterAll(() => t.close());

const asCustomer = <T>(id: string, work: Parameters<typeof withTenantContext<T>>[2]) =>
  withTenantContext(t.db, { customerId: id }, work);
const names = (rows: { name: string | null }[]) => rows.map((r) => r.name);

describe('customers: row level security (RN-AUT, golden rule 1)', () => {
  it('RLS: a customer reads only the own row', async () => {
    const rows = await asCustomer(maria.id, (trx) =>
      sql<{ name: string }>`SELECT name FROM customers`.execute(trx),
    );
    expect(names(rows.rows)).toEqual(['Maria']);
  });

  it('RLS: another customer sees only theirs', async () => {
    const rows = await asCustomer(carlos.id, (trx) =>
      sql<{ name: string }>`SELECT name FROM customers`.execute(trx),
    );
    expect(names(rows.rows)).toEqual(['Carlos']);
  });

  it('RLS: asking for the id of another customer returns nothing', async () => {
    const rows = await asCustomer(maria.id, (trx) =>
      sql<{ name: string }>`SELECT name FROM customers WHERE id = ${carlos.id}`.execute(trx),
    );
    expect(rows.rows).toEqual([]);
  });

  it('RLS: without a context, no row is returned', async () => {
    const rows = await sql`SELECT * FROM customers`.execute(t.db);
    expect(rows.rows).toEqual([]);
  });

  it('RLS: the context of a business reads no customer until it has customers of its own', async () => {
    const rows = await withTenantContext(t.db, { businessId: randomUUID() }, (trx) =>
      sql`SELECT * FROM customers`.execute(trx),
    );
    expect(rows.rows).toEqual([]);
  });

  it('RLS: a customer cannot insert, update or delete, not even the own row', async () => {
    await expect(
      asCustomer(maria.id, (trx) =>
        sql`INSERT INTO customers (phone_e164) VALUES ('+5531977776666')`.execute(trx),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asCustomer(maria.id, (trx) =>
        sql`UPDATE customers SET name = 'Hacked' WHERE id = ${maria.id}`.execute(trx),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asCustomer(maria.id, (trx) => sql`DELETE FROM customers WHERE id = ${maria.id}`.execute(trx)),
    ).rejects.toThrow(/permission denied/);
  });

  it('app_system sees every customer and can write, as the system module needs', async () => {
    const all = await sql<{ name: string }>`SELECT name FROM customers ORDER BY name`.execute(
      t.system,
    );
    expect(names(all.rows)).toEqual(['Carlos', 'Maria']);
    await sql`UPDATE customers SET name = 'Maria S.' WHERE id = ${maria.id}`.execute(t.system);
    await sql`UPDATE customers SET name = 'Maria' WHERE id = ${maria.id}`.execute(t.system);
  });

  it('keeps RLS enabled and forced', async () => {
    const { rows } = await t.admin.query(
      "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'customers'",
    );
    expect(rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
  });
});

describe('customers: constraints', () => {
  const insert = (phone: string, extra = '') =>
    t.admin.query(
      `INSERT INTO customers (phone_e164${extra ? ', anonymized_at' : ''}) VALUES ($1${extra ? ', now()' : ''})`,
      [phone],
    );

  it('RN-AUT-01: accepts only +55 numbers', async () => {
    await expect(insert('+14155550100')).rejects.toThrow(/check constraint/);
    await expect(insert('11900000000')).rejects.toThrow(/check constraint/);
    await expect(insert('+5501900000000')).rejects.toThrow(/check constraint/);
    await expect(insert('+55119000')).rejects.toThrow(/check constraint/);
  });

  it('RN-AUT-01: accepts a valid +55 number', async () => {
    await expect(insert('+5585999998888')).resolves.toBeDefined();
  });

  it('a phone number is unique', async () => {
    await expect(insert(maria.phone)).rejects.toThrow(/unique/);
  });

  it('RN-LGP-04: an anonymized customer may have a placeholder instead of a phone', async () => {
    await expect(insert('anon:abc', 'anonymized')).resolves.toBeDefined();
  });

  it('keeps the e-mail case-insensitive (citext)', async () => {
    await t.admin.query("UPDATE customers SET email = 'Maria@Exemplo.com' WHERE id = $1", [
      maria.id,
    ]);
    const { rows } = await t.admin.query(
      "SELECT id FROM customers WHERE email = 'maria@exemplo.com'",
    );
    expect(rows).toHaveLength(1);
  });

  it('generates the id when it is left out', async () => {
    const { rows } = await t.admin.query(
      "INSERT INTO customers (phone_e164) VALUES ('+5548911112222') RETURNING id",
    );
    expect(rows[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
