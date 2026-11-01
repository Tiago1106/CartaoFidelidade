import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/test-database';
import { withTenantContext } from './tenant-context';

let t: TestDatabase;
beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(() => t.close());

const tables = ['sessions', 'otp_codes', 'phone_lockouts', 'sms_messages'] as const;

describe('tables of sign-in: only the system module touches them', () => {
  it.each(tables)('app_user has no right at all on %s', async (table) => {
    await expect(sql`SELECT * FROM ${sql.table(table)}`.execute(t.db)).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      withTenantContext(t.db, { customerId: randomUUID() }, (trx) =>
        sql`SELECT * FROM ${sql.table(table)}`.execute(trx),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(sql`DELETE FROM ${sql.table(table)}`.execute(t.db)).rejects.toThrow(
      /permission denied/,
    );
  });

  it.each(tables)('app_system can read %s', async (table) => {
    await expect(sql`SELECT * FROM ${sql.table(table)}`.execute(t.system)).resolves.toBeDefined();
  });
});

describe('otp_codes (RN-AUT-02, RN-AUT-03, golden rule 9)', () => {
  const insert = (phone: string, createdAt?: string) =>
    sql`INSERT INTO otp_codes (phone_e164, code_hash, expires_at, created_at)
        VALUES (${phone}, 'hash-of-the-code', now() + interval '5 minutes',
                ${createdAt ?? sql`now()`})`.execute(t.system);

  it('starts with no attempts and not consumed', async () => {
    await insert('+5511900000000');
    const { rows } = await t.admin.query(
      "SELECT attempts, consumed_at FROM otp_codes WHERE phone_e164 = '+5511900000000'",
    );
    expect(rows[0]).toEqual({ attempts: 0, consumed_at: null });
  });

  it('has no column that could hold the code itself', async () => {
    const { rows } = await t.admin.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'otp_codes'",
    );
    const columns = rows.map((r) => r.column_name);
    expect(columns).toContain('code_hash');
    expect(columns).not.toContain('code');
  });

  it('does not accept negative attempts', async () => {
    await expect(
      t.admin.query(
        "INSERT INTO otp_codes (phone_e164, code_hash, expires_at, attempts) VALUES ('+5511911112222', 'h', now(), -1)",
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it('RN-AUT-03: the requests of a number in the last hour can be counted by index', async () => {
    const phone = '+5511933334444';
    await insert(phone, new Date(Date.now() - 2 * 3600_000).toISOString());
    await insert(phone);
    await insert(phone);
    const { rows } = await t.admin.query(
      "SELECT count(*)::int AS n FROM otp_codes WHERE phone_e164 = $1 AND created_at > now() - interval '1 hour'",
      [phone],
    );
    expect(rows[0].n).toBe(2);
  });
});

describe('sessions (golden rule 9)', () => {
  it('keeps only the hash of the refresh token, and it is unique', async () => {
    const insert = () =>
      sql`INSERT INTO sessions (principal_type, principal_id, refresh_token_hash, expires_at)
          VALUES ('customer', ${randomUUID()}, 'same-hash', now() + interval '90 days')`.execute(
        t.system,
      );
    await insert();
    await expect(insert()).rejects.toThrow(/unique/);
    const { rows } = await t.admin.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'sessions'",
    );
    expect(rows.map((r) => r.column_name)).not.toContain('refresh_token');
  });

  it('accepts only the principal types customer and staff', async () => {
    await expect(
      t.admin.query(
        "INSERT INTO sessions (principal_type, principal_id, refresh_token_hash, expires_at) VALUES ('robot', gen_random_uuid(), 'h2', now())",
      ),
    ).rejects.toThrow(/invalid input value for enum/);
  });
});

describe('phone_lockouts and sms_messages', () => {
  it('RN-AUT-02: one lock per number', async () => {
    const lock = () =>
      sql`INSERT INTO phone_lockouts (phone_e164, locked_until)
          VALUES ('+5511955556666', now() + interval '15 minutes')`.execute(t.system);
    await lock();
    await expect(lock()).rejects.toThrow(/unique|duplicate/);
  });

  it('sms_messages accepts only the statuses queued, sent and failed', async () => {
    const insert = (status: string) =>
      t.admin.query(
        "INSERT INTO sms_messages (phone_e164, provider, status) VALUES ('+5511900000000', 'console', $1)",
        [status],
      );
    await expect(insert('sent')).resolves.toBeDefined();
    await expect(insert('lost')).rejects.toThrow(/check constraint/);
  });
});
