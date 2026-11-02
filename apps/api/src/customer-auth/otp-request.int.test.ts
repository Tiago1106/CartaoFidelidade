import { Writable } from 'node:stream';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { ManualClock } from '../clock/clock';
import { loadEnv } from '../config/env';
import { createLogger } from '../logging/logger';
import { createTestDatabase, type TestDatabase } from '../test/test-database';
import { hashOtpCode } from './otp-policy';
import type { OtpSender } from './otp-sender';

const SECRET = 'test-secret-with-16-or-more-chars';
const PATH = '/v1/customer/auth/otp/request';

class FakeSender implements OtpSender {
  readonly name = 'test';
  sent: { phone: string; code: string; expiresAt: Date }[] = [];
  failing = false;
  async send(message: { phone: string; code: string; expiresAt: Date }) {
    if (this.failing) throw new Error(`provider is down for ${message.phone} (${message.code})`);
    this.sent.push(message);
    return { providerMessageId: `msg-${this.sent.length}` };
  }
}

let t: TestDatabase;
let app: Awaited<ReturnType<typeof createApp>>;
let clock: ManualClock;
let sender: FakeSender;
let logLines: string[];
let counter = 0;
let nextCode = 100000;

/** A valid mobile number that no other test used. */
const newPhone = () => `+55119${String(40000000 + ++counter)}`;
/** Every request comes from `ip`: the API trusts one proxy, so the tests choose the address. */
const DEFAULT_IP = '198.51.100.7';
const post = (phone: unknown, ip = DEFAULT_IP) =>
  request(app.getHttpServer()).post(PATH).set('X-Forwarded-For', ip).send({ phone });

beforeAll(async () => {
  t = await createTestDatabase();
  clock = new ManualClock('2026-11-01T12:00:00Z');
  sender = new FakeSender();
  logLines = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      logLines.push(String(chunk));
      callback();
    },
  });
  app = await createApp({
    env: loadEnv({ NODE_ENV: 'test', TRUST_PROXY_HOPS: '1' }),
    clock,
    logger: createLogger({ destination }),
    db: t.db,
    systemDb: t.system,
    otpSender: sender,
    otp: { hashSecret: SECRET, generateCode: () => String(nextCode++) },
  });
  await app.init();
});
afterAll(async () => {
  await app.close();
  await t.close();
});

// The limit per IP is shared by every test, because they all come from the same address. Each
// test starts two hours later, so the hour of the previous one is over.
beforeEach(() => {
  clock.advanceSeconds(2 * 3600);
  sender.sent = [];
  sender.failing = false;
});

const codesOf = async (phone: string) =>
  (
    await t.admin.query('SELECT * FROM otp_codes WHERE phone_e164 = $1 ORDER BY created_at', [
      phone,
    ])
  ).rows;

describe('POST /v1/customer/auth/otp/request', () => {
  it('answers 202 with how long to wait before another code', async () => {
    const response = await post(newPhone());
    expect(response.status).toBe(202);
    expect(response.body).toEqual({ retryAfterSeconds: 60 });
  });

  it('RN-AUT-04: sends the code through the OtpSender', async () => {
    const phone = newPhone();
    await post(phone);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]).toMatchObject({ phone, code: String(nextCode - 1) });
  });

  it('RN-AUT-05: answers the same for a new number and for one that has an account', async () => {
    const existing = newPhone();
    await t.admin.query('INSERT INTO customers (phone_e164, name) VALUES ($1, $2)', [
      existing,
      'Maria',
    ]);
    const fresh = newPhone();

    const a = await post(existing);
    const b = await post(fresh);
    expect(b.status).toBe(a.status);
    expect(b.body).toEqual(a.body);
    expect(Object.keys(b.headers).sort()).toEqual(Object.keys(a.headers).sort());
  });

  it('RN-AUT-05: asking for a code does not create an account', async () => {
    const phone = newPhone();
    await post(phone);
    const { rows } = await t.admin.query('SELECT 1 FROM customers WHERE phone_e164 = $1', [phone]);
    expect(rows).toHaveLength(0);
  });

  it.each([
    '+14155550100',
    '+5511800000000',
    '11900000000',
    '+551190000000',
    '+5501900000000',
    '(11) 90000-0000',
    '',
  ])('RN-AUT-01: refuses %j with PHONE_NOT_SUPPORTED and sends nothing', async (phone) => {
    const response = await post(phone);
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('PHONE_NOT_SUPPORTED');
    expect(sender.sent).toEqual([]);
    expect(await codesOf(phone)).toEqual([]);
  });

  it.each([{}, { phone: 5511900000000 }, { phone: null }, []])(
    'VALIDATION_ERROR for a body that is not a phone: %j',
    async (body) => {
      const response = await request(app.getHttpServer()).post(PATH).send(body);
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(sender.sent).toEqual([]);
    },
  );
});

describe('the code (RN-AUT-02, golden rule 9)', () => {
  it('RN-AUT-02: is valid for 5 minutes', async () => {
    const phone = newPhone();
    const before = clock.now();
    await post(phone);
    const [row] = await codesOf(phone);
    expect(new Date(row.expires_at).getTime() - before.getTime()).toBe(5 * 60 * 1000);
    expect(sender.sent[0]!.expiresAt.getTime()).toBe(new Date(row.expires_at).getTime());
  });

  it('golden rule 9: only the hash is saved, never the code', async () => {
    const phone = newPhone();
    await post(phone);
    const code = sender.sent[0]!.code;
    const [row] = await codesOf(phone);
    expect(row.code_hash).toBe(hashOtpCode(SECRET, phone, code));
    expect(JSON.stringify(row)).not.toContain(code);
  });

  it('starts with no attempts and not used', async () => {
    const phone = newPhone();
    await post(phone);
    const [row] = await codesOf(phone);
    expect(row).toMatchObject({ attempts: 0, consumed_at: null });
  });

  it('RN-AUT-02: a new code makes the previous one stop working', async () => {
    const phone = newPhone();
    await post(phone);
    await post(phone);
    const rows = await codesOf(phone);
    expect(rows).toHaveLength(2);
    expect(rows[0].consumed_at).not.toBeNull();
    expect(rows[1].consumed_at).toBeNull();
    expect(sender.sent[0]!.code).not.toBe(sender.sent[1]!.code);
  });

  it('saves the address of the caller, for the limit per IP', async () => {
    const phone = newPhone();
    await post(phone);
    const [row] = await codesOf(phone);
    expect(row.ip).toBe(DEFAULT_IP);
  });

  it('writes down the SMS that went out', async () => {
    const phone = newPhone();
    await post(phone);
    const { rows } = await t.admin.query('SELECT * FROM sms_messages WHERE phone_e164 = $1', [
      phone,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ provider: 'test', status: 'sent', purpose: 'otp' });
    expect(rows[0].provider_message_id).toMatch(/^msg-/);
  });
});

describe('RN-AUT-03: 3 codes per hour for each number', () => {
  it('allows 3 and refuses the 4th with RATE_LIMITED and Retry-After', async () => {
    const phone = newPhone();
    for (let i = 0; i < 3; i++) expect((await post(phone)).status).toBe(202);
    const fourth = await post(phone);
    expect(fourth.status).toBe(429);
    expect(fourth.body.error.code).toBe('RATE_LIMITED');
    expect(Number(fourth.headers['retry-after'])).toBeGreaterThan(0);
    expect(sender.sent).toHaveLength(3);
    expect(await codesOf(phone)).toHaveLength(3);
  });

  it('tells how long until the number is free: one hour after the third newest request', async () => {
    const phone = newPhone();
    await post(phone); // minute 0
    clock.advanceSeconds(10 * 60);
    await post(phone); // minute 10
    clock.advanceSeconds(10 * 60);
    await post(phone); // minute 20
    clock.advanceSeconds(5 * 60); // minute 25
    const refused = await post(phone);
    // Free again when the one of minute 0 leaves the hour: at minute 60, so in 35 minutes.
    expect(refused.body.error.details.retryAfterSeconds).toBe(35 * 60);
    expect(refused.headers['retry-after']).toBe(String(35 * 60));
  });

  it('the limit is per number', async () => {
    const busy = newPhone();
    for (let i = 0; i < 3; i++) await post(busy);
    expect((await post(newPhone())).status).toBe(202);
  });

  it('after the hour the number can ask again', async () => {
    const phone = newPhone();
    for (let i = 0; i < 3; i++) await post(phone);
    clock.advanceSeconds(3600 - 1);
    expect((await post(phone)).status).toBe(429);
    clock.advanceSeconds(2);
    expect((await post(phone)).status).toBe(202);
  });

  it('refused requests do not send an SMS, nor count', async () => {
    const phone = newPhone();
    for (let i = 0; i < 6; i++) await post(phone);
    expect(sender.sent).toHaveLength(3);
    expect(await codesOf(phone)).toHaveLength(3);
  });

  it('requests at the same moment for one number cannot all slip under the limit', async () => {
    // Each one comes from another address, so only the lock of the number can hold them back.
    const phone = newPhone();
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, i) => post(phone, `203.0.113.${i + 1}`)),
    );
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 202)).toHaveLength(3);
    expect(statuses.filter((s) => s === 429)).toHaveLength(5);
    expect(await codesOf(phone)).toHaveLength(3);
    // Of the three codes, only the last one is still waiting.
    const open = (await codesOf(phone)).filter((row) => row.consumed_at === null);
    expect(open).toHaveLength(1);
  });
});

describe('RN-AUT-03: 20 requests per hour for each IP', () => {
  it('refuses the 21st request of the same address, whatever the number', async () => {
    for (let i = 0; i < 20; i++) expect((await post(newPhone())).status).toBe(202);
    const refused = await post(newPhone());
    expect(refused.status).toBe(429);
    expect(refused.body.error.code).toBe('RATE_LIMITED');
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
    expect(sender.sent).toHaveLength(20);
  });

  it('requests at the same moment from one address cannot all slip under the limit', async () => {
    // Different numbers, so only the lock of the address can hold them back.
    const ip = '192.0.2.99';
    const responses = await Promise.all(Array.from({ length: 30 }, () => post(newPhone(), ip)));
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 202)).toHaveLength(20);
    expect(statuses.filter((s) => s === 429)).toHaveLength(10);
  });

  it('another address is not affected by the limit of this one', async () => {
    for (let i = 0; i < 20; i++) await post(newPhone());
    expect((await post(newPhone(), '192.0.2.50')).status).toBe(202);
  });

  it('the address is free again after an hour', async () => {
    for (let i = 0; i < 20; i++) await post(newPhone());
    clock.advanceSeconds(3601);
    expect((await post(newPhone())).status).toBe(202);
  });
});

describe('the lock of a number (RN-AUT-02)', () => {
  it('OTP_LOCKED while the 15 minutes last, with how long is left', async () => {
    const phone = newPhone();
    const lockedUntil = new Date(clock.now().getTime() + 10 * 60 * 1000);
    await t.admin.query('INSERT INTO phone_lockouts (phone_e164, locked_until) VALUES ($1, $2)', [
      phone,
      lockedUntil,
    ]);
    const response = await post(phone);
    expect(response.status).toBe(423);
    expect(response.body.error.code).toBe('OTP_LOCKED');
    expect(response.body.error.details.retryAfterSeconds).toBe(600);
    expect(response.headers['retry-after']).toBe('600');
    expect(sender.sent).toEqual([]);
    expect(await codesOf(phone)).toEqual([]);
  });

  it('is over when the 15 minutes are over', async () => {
    const phone = newPhone();
    await t.admin.query('INSERT INTO phone_lockouts (phone_e164, locked_until) VALUES ($1, $2)', [
      phone,
      new Date(clock.now().getTime() + 60 * 1000),
    ]);
    expect((await post(phone)).status).toBe(423);
    clock.advanceSeconds(61);
    expect((await post(phone)).status).toBe(202);
  });

  it('the lock of one number does not stop another', async () => {
    const locked = newPhone();
    await t.admin.query('INSERT INTO phone_lockouts (phone_e164, locked_until) VALUES ($1, $2)', [
      locked,
      new Date(clock.now().getTime() + 600 * 1000),
    ]);
    expect((await post(newPhone())).status).toBe(202);
  });
});

describe('when the provider fails', () => {
  it('answers INTERNAL_ERROR, records the failure and leaves no code working', async () => {
    const phone = newPhone();
    sender.failing = true;
    const response = await post(phone);
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    // The error of the provider carried the number and the code: none of it reaches the caller.
    expect(JSON.stringify(response.body)).not.toContain(phone);

    const { rows } = await t.admin.query('SELECT status FROM sms_messages WHERE phone_e164 = $1', [
      phone,
    ]);
    expect(rows).toEqual([{ status: 'failed' }]);
    const codes = await codesOf(phone);
    expect(codes).toHaveLength(1);
    expect(codes[0].consumed_at).not.toBeNull();
  });
});

describe('golden rule 8: nothing personal in the logs', () => {
  it('never writes the number or the code, not even when the provider fails', async () => {
    logLines.length = 0;
    const phone = newPhone();
    await post(phone);
    const sentCode = sender.sent[0]!.code;
    sender.failing = true;
    const failing = newPhone();
    await post(failing);
    await post('+14155550100');

    const log = logLines.join('');
    expect(log).toContain('"path":"/v1/customer/auth/otp/request"');
    for (const secret of [phone, failing, sentCode, '+14155550100', SECRET]) {
      expect(log).not.toContain(secret);
    }
  });
});

describe('OpenAPI', () => {
  it('describes the endpoint', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json');
    expect(Object.keys(response.body.paths)).toContain('/v1/customer/auth/otp/request');
  });
});
