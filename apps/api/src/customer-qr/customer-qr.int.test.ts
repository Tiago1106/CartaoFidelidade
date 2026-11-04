import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { ManualClock } from '../clock/clock';
import { loadEnv } from '../config/env';
import { AccessTokenService } from '../customer-auth/access-token.service';
import { createLogger } from '../logging/logger';
import { createTestDatabase, type TestDatabase } from '../test/test-database';
import { QrTokenService } from './qr-token.service';

const JWT_SECRET = 'a-signing-key-with-at-least-32-characters';
const QR_SECRET = 'a-qr-signing-key-with-at-least-32-chars';
const NOW = '2026-11-10T15:00:00Z';

let t: TestDatabase;
let app: Awaited<ReturnType<typeof createApp>>;
let clock: ManualClock;
let tokens: AccessTokenService;
let qr: QrTokenService;
let logLines: string[];
let counter = 0;

const http = () => request(app.getHttpServer());

async function newCustomer() {
  counter += 1;
  const id = randomUUID();
  await t.admin.query(`INSERT INTO customers (id, phone_e164, name) VALUES ($1, $2, 'Maria')`, [
    id,
    `+55119${String(40000000 + counter)}`,
  ]);
  return id;
}

/** The app asks for a token with a fresh access token, as it does in the foreground. */
async function ask(customerId: string) {
  const { token } = await tokens.sign(customerId);
  return http().post('/v1/customer/qr-token').set('Authorization', `Bearer ${token}`);
}

async function rowsOf(customerId: string) {
  return (
    await t.admin.query(`SELECT * FROM qr_tokens WHERE customer_id = $1 ORDER BY created_at, id`, [
      customerId,
    ])
  ).rows;
}

const claimsOf = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as Record<string, unknown>;

beforeAll(async () => {
  t = await createTestDatabase();
  clock = new ManualClock(NOW);
  logLines = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      logLines.push(String(chunk));
      callback();
    },
  });
  app = await createApp({
    env: loadEnv({ NODE_ENV: 'test' }),
    clock,
    logger: createLogger({ destination }),
    db: t.db,
    systemDb: t.system,
    otpSender: { name: 'test', send: async () => ({}) },
    jwtSecret: JWT_SECRET,
    qrTokenSecret: QR_SECRET,
  });
  await app.init();
  tokens = new AccessTokenService(JWT_SECRET, clock);
  qr = app.get(QrTokenService);
});
afterAll(async () => {
  await app.close();
  await t.close();
});
beforeEach(() => {
  // Far enough from the previous test that the limit per minute is not in play.
  clock.advanceSeconds(3600);
});

describe('POST /customer/qr-token', () => {
  it('needs the access token', async () => {
    const response = await http().post('/v1/customer/qr-token');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('RN-QR-02: issues a token of 45 seconds to renew every 30, and nothing may keep it', async () => {
    const customerId = await newCustomer();
    const issuedAt = clock.now();
    const response = await ask(customerId);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      token: expect.stringMatching(/^[\w-]+\.[\w-]+\.[\w-]+$/),
      qrPayload: `lc1.${response.body.token}`,
      expiresAt: new Date(Math.floor(issuedAt.getTime() / 1000) * 1000 + 45_000).toISOString(),
      renewInSeconds: 30,
    });
  });

  it('golden rules 8 and 9: the token holds no customer and the table holds no token', async () => {
    const customerId = await newCustomer();
    const { body } = await ask(customerId);
    const claims = claimsOf(body.token);
    expect(Object.keys(claims).sort()).toEqual(['exp', 'iat', 'jti']);
    expect(JSON.stringify(claims)).not.toContain(customerId);

    const [row] = await rowsOf(customerId);
    expect(row.id).toBe(claims.jti);
    expect(row.customer_id).toBe(customerId);
    expect(row.consumed_at).toBeNull();
    expect(row.expires_at.toISOString()).toBe(body.expiresAt);
    // Nothing stored could be shown to a reader as a token.
    expect(JSON.stringify(row)).not.toContain(body.token);
    expect(JSON.stringify(row)).not.toContain(body.token.split('.')[2]);
  });

  it('golden rule 8: the token is not written in the logs', async () => {
    const customerId = await newCustomer();
    const { body } = await ask(customerId);
    const logs = logLines.join('');
    expect(logs).not.toContain(body.token);
    expect(logs).not.toContain(body.token.split('.')[2]);
  });

  it('RN-QR-02: a new token replaces the previous ones, only the last is valid', async () => {
    const customerId = await newCustomer();
    const first = (await ask(customerId)).body;
    clock.advanceSeconds(30);
    const second = (await ask(customerId)).body;
    expect(second.token).not.toBe(first.token);

    const rows = await rowsOf(customerId);
    expect(rows.filter((r) => r.consumed_at === null)).toHaveLength(1);
    await expect(qr.consume(first.qrPayload)).rejects.toMatchObject({ code: 'QR_ALREADY_USED' });
    await expect(qr.consume(second.qrPayload)).resolves.toEqual({ customerId });
  });

  it('renewing every 30 seconds never reaches the limit', async () => {
    const customerId = await newCustomer();
    for (let i = 0; i < 20; i += 1) {
      expect((await ask(customerId)).status).toBe(200);
      clock.advanceSeconds(30);
    }
  });

  it('requests at the same time leave exactly one valid token', async () => {
    const customerId = await newCustomer();
    const answers = await Promise.all([1, 2, 3, 4, 5].map(() => ask(customerId)));
    expect(answers.map((a) => a.status)).toEqual([200, 200, 200, 200, 200]);
    const rows = await rowsOf(customerId);
    expect(rows).toHaveLength(5);
    expect(rows.filter((r) => r.consumed_at === null)).toHaveLength(1);
  });

  it('[Premissa] 6 per minute per customer: the 7th is RATE_LIMITED with Retry-After', async () => {
    const customerId = await newCustomer();
    for (let i = 0; i < 6; i += 1) {
      expect((await ask(customerId)).status).toBe(200);
      clock.advanceSeconds(5); // 6 tokens in 25 seconds
    }
    const limited = await ask(customerId);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    // The first token was 30 seconds ago; the window opens again 30 seconds from now.
    expect(limited.body.error.details.retryAfterSeconds).toBe(30);
    expect(limited.headers['retry-after']).toBe('30');
    expect(await rowsOf(customerId)).toHaveLength(6);

    clock.advanceSeconds(30);
    expect((await ask(customerId)).status).toBe(200);
  });

  it('the limit is per customer', async () => {
    const a = await newCustomer();
    const b = await newCustomer();
    for (let i = 0; i < 6; i += 1) await ask(a);
    expect((await ask(a)).status).toBe(429);
    expect((await ask(b)).status).toBe(200);
  });

  it('an anonymized account gets no token', async () => {
    const customerId = await newCustomer();
    await t.admin.query(
      `UPDATE customers SET anonymized_at = now(), phone_e164 = 'anon-' || id WHERE id = $1`,
      [customerId],
    );
    const response = await ask(customerId);
    expect(response.status).toBe(401);
    expect(await rowsOf(customerId)).toEqual([]);
  });
});

describe('reading the QR (RN-QR-03)', () => {
  it('uses the token once', async () => {
    const customerId = await newCustomer();
    const { qrPayload } = (await ask(customerId)).body;
    await expect(qr.consume(qrPayload)).resolves.toEqual({ customerId });
    await expect(qr.consume(qrPayload)).rejects.toMatchObject({
      code: 'QR_ALREADY_USED',
      status: 409,
    });
    const [row] = await rowsOf(customerId);
    expect(row.consumed_at.toISOString()).toBe(
      clock
        .now()
        .toISOString()
        .replace(/\.\d+Z$/, '.000Z'),
    );
  });

  it('two scans at the same time: one wins', async () => {
    const customerId = await newCustomer();
    const { qrPayload } = (await ask(customerId)).body;
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => qr.consume(qrPayload)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const result of results) {
      if (result.status === 'rejected') expect(result.reason.code).toBe('QR_ALREADY_USED');
    }
  });

  it('is valid for 45 seconds and expired a moment after', async () => {
    const customerId = await newCustomer();
    const { qrPayload, expiresAt } = (await ask(customerId)).body;
    clock.set(expiresAt);
    await expect(qr.consume(qrPayload)).resolves.toEqual({ customerId });

    const other = await newCustomer();
    const late = (await ask(other)).body;
    clock.set(new Date(new Date(late.expiresAt).getTime() + 1));
    await expect(qr.consume(late.qrPayload)).rejects.toMatchObject({
      code: 'QR_EXPIRED',
      status: 410,
    });
    // An expired token stays unused: nobody got in with it.
    expect((await rowsOf(other))[0].consumed_at).toBeNull();
  });

  it('a token whose app did not renew at 30 seconds still works until 45', async () => {
    const customerId = await newCustomer();
    const { qrPayload } = (await ask(customerId)).body;
    clock.advanceSeconds(44);
    await expect(qr.consume(qrPayload)).resolves.toEqual({ customerId });
  });

  describe('QR_INVALID', () => {
    const signed = async (
      claims: Record<string, unknown>,
      jti: string | undefined,
      secret = QR_SECRET,
    ) => {
      let jwt = new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h');
      if (jti) jwt = jwt.setJti(jti);
      return `lc1.${await jwt.sign(new TextEncoder().encode(secret))}`;
    };

    it.each([
      ['an empty text', ''],
      ['text that is not a token', 'lc1.abc'],
      ['a token without the prefix', 'eyJhbGciOiJIUzI1NiJ9.e30.x'],
      ['another prefix', 'lc2.eyJhbGciOiJIUzI1NiJ9.e30.x'],
      ['a phone number', '+5511999999999'],
    ])('%s', async (_label, payload) => {
      await expect(qr.consume(payload)).rejects.toMatchObject({ code: 'QR_INVALID', status: 400 });
    });

    it('a token without prefix, even a real one', async () => {
      const customerId = await newCustomer();
      const { token } = (await ask(customerId)).body;
      await expect(qr.consume(token)).rejects.toMatchObject({ code: 'QR_INVALID' });
      // It was not spent by the failed attempt.
      expect((await rowsOf(customerId))[0].consumed_at).toBeNull();
    });

    it('a token signed with another key', async () => {
      const payload = await signed({}, randomUUID(), 'another-key-with-at-least-32-characters!');
      await expect(qr.consume(payload)).rejects.toMatchObject({ code: 'QR_INVALID' });
    });

    it('a token signed by us that the table does not know', async () => {
      await expect(qr.consume(await signed({}, randomUUID()))).rejects.toMatchObject({
        code: 'QR_INVALID',
      });
    });

    it('a token without id, or with an id that is not a UUID', async () => {
      await expect(qr.consume(await signed({}, undefined))).rejects.toMatchObject({
        code: 'QR_INVALID',
      });
      await expect(qr.consume(await signed({}, 'not-a-uuid'))).rejects.toMatchObject({
        code: 'QR_INVALID',
      });
    });

    it('a token of somebody else with the id changed by hand', async () => {
      const customerId = await newCustomer();
      const { token } = (await ask(customerId)).body;
      const [header, , signature] = token.split('.');
      const forgedBody = Buffer.from(JSON.stringify({ jti: randomUUID() })).toString('base64url');
      await expect(qr.consume(`lc1.${header}.${forgedBody}.${signature}`)).rejects.toMatchObject({
        code: 'QR_INVALID',
      });
    });
  });
});

describe('OpenAPI', () => {
  it('describes the route', async () => {
    const { body } = await http().get('/docs-json');
    expect(Object.keys(body.paths)).toContain('/v1/customer/qr-token');
  });
});
