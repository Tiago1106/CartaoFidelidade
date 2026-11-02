import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { ManualClock } from '../clock/clock';
import { loadEnv } from '../config/env';
import { createLogger } from '../logging/logger';
import { createTestDatabase, type TestDatabase } from '../test/test-database';
import { AccessTokenService } from './access-token.service';
import type { OtpSender } from './otp-sender';

const JWT_SECRET = 'a-signing-key-with-at-least-32-characters';
const OTP_SECRET = 'test-secret-with-16-or-more-chars';
const BASE = '/v1/customer/auth';

class FakeSender implements OtpSender {
  readonly name = 'test';
  sent: { phone: string; code: string }[] = [];
  async send(message: { phone: string; code: string; expiresAt: Date }) {
    this.sent.push({ phone: message.phone, code: message.code });
    return {};
  }
  /** The last code sent to a number. */
  codeFor(phone: string): string {
    const found = [...this.sent].reverse().find((m) => m.phone === phone);
    if (!found) throw new Error(`no code was sent to ${phone}`);
    return found.code;
  }
}

let t: TestDatabase;
let app: Awaited<ReturnType<typeof createApp>>;
let clock: ManualClock;
let sender: FakeSender;
let tokens: AccessTokenService;
let logLines: string[];
let counter = 0;
let nextCode = 100000;
let nextIp = 1;

const newPhone = () => `+55119${String(60000000 + ++counter)}`;
const wrongCode = (right: string) => (right === '000000' ? '000001' : '000000');
/** A new address for each call: the limit per IP is not what these tests are about. */
const freshIp = () => `198.51.100.${nextIp++ % 250}`;

const http = () => request(app.getHttpServer());
const requestCode = (phone: string) =>
  http().post(`${BASE}/otp/request`).set('X-Forwarded-For', freshIp()).send({ phone });
const verify = (phone: string, code: string, userAgent = 'vitest') =>
  http().post(`${BASE}/otp/verify`).set('User-Agent', userAgent).send({ phone, code });

/** The value of the refresh cookie that a response sets, or `undefined`. */
function refreshOf(response: request.Response): string | undefined {
  const cookies = (response.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  const line = cookies.find((c) => c.startsWith('refresh_token='));
  const value = line?.split(';')[0]!.slice('refresh_token='.length);
  return value ? value : undefined;
}
const refresh = (token?: string) => {
  const call = http().post(`${BASE}/refresh`);
  return token ? call.set('Cookie', `refresh_token=${token}`).send() : call.send();
};
const logout = (token?: string) => {
  const call = http().post(`${BASE}/logout`);
  return token ? call.set('Cookie', `refresh_token=${token}`).send() : call.send();
};

/** A full sign-in: asks for the code and confirms it. */
async function signIn(phone = newPhone()) {
  await requestCode(phone);
  const response = await verify(phone, sender.codeFor(phone));
  expect(response.status).toBe(200);
  return { phone, response, refreshToken: refreshOf(response)! };
}

const sessionsOf = async (customerId: string) =>
  (
    await t.admin.query('SELECT * FROM sessions WHERE principal_id = $1 ORDER BY created_at, id', [
      customerId,
    ])
  ).rows;
const codesOf = async (phone: string) =>
  (
    await t.admin.query('SELECT * FROM otp_codes WHERE phone_e164 = $1 ORDER BY created_at', [
      phone,
    ])
  ).rows;

beforeAll(async () => {
  t = await createTestDatabase();
  clock = new ManualClock('2026-11-02T12:00:00Z');
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
    otp: { hashSecret: OTP_SECRET, generateCode: () => String(nextCode++) },
    jwtSecret: JWT_SECRET,
  });
  await app.init();
  tokens = new AccessTokenService(JWT_SECRET, clock);
});
afterAll(async () => {
  await app.close();
  await t.close();
});
beforeEach(() => {
  clock.advanceSeconds(3 * 3600);
});

describe('POST /otp/verify: opening the session', () => {
  it('RN-ENT-07: a new number gets an account that still needs a name', async () => {
    const phone = newPhone();
    await requestCode(phone);
    const response = await verify(phone, sender.codeFor(phone));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      accessToken: expect.any(String),
      expiresIn: 900,
      customer: { id: expect.any(String), phone, name: null, email: null, profileComplete: false },
    });
    const { rows } = await t.admin.query('SELECT id, name FROM customers WHERE phone_e164 = $1', [
      phone,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(response.body.customer.id);
  });

  it('a number that already gave its name goes straight in', async () => {
    const phone = newPhone();
    await t.admin.query('INSERT INTO customers (phone_e164, name) VALUES ($1, $2)', [
      phone,
      'Maria',
    ]);
    await requestCode(phone);
    const response = await verify(phone, sender.codeFor(phone));
    expect(response.body.customer).toMatchObject({ phone, name: 'Maria', profileComplete: true });
  });

  it('does not make a second account for the same number', async () => {
    const phone = newPhone();
    await signIn(phone);
    await signIn(phone);
    const { rows } = await t.admin.query('SELECT 1 FROM customers WHERE phone_e164 = $1', [phone]);
    expect(rows).toHaveLength(1);
  });

  it('the access token belongs to the customer and lasts 15 minutes', async () => {
    const { response } = await signIn();
    const claims = await tokens.verify(response.body.accessToken);
    expect(claims).toEqual({ sub: response.body.customer.id, typ: 'customer' });
    clock.advanceSeconds(15 * 60);
    await expect(tokens.verify(response.body.accessToken)).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
    });
  });

  it('RN-AUT-06: sets the refresh cookie: HttpOnly, SameSite=Lax, limited path, 90 days', async () => {
    const { response } = await signIn();
    const cookie = (response.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('refresh_token='),
    )!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/v1/customer/auth');
    expect(cookie).toContain(`Max-Age=${90 * 24 * 3600}`);
    // The test API is served over http, so the cookie is not marked Secure here.
    expect(cookie).not.toContain('Secure');
  });

  it('the refresh token is not in the body', async () => {
    const { response, refreshToken } = await signIn();
    expect(refreshToken).toBeTruthy();
    expect(JSON.stringify(response.body)).not.toContain(refreshToken);
  });

  it('golden rule 9: the session keeps only the hash of the refresh token', async () => {
    const { response, refreshToken } = await signIn();
    const [session] = await sessionsOf(response.body.customer.id);
    expect(session.refresh_token_hash).toBe(
      createHash('sha256').update(refreshToken).digest('hex'),
    );
    expect(JSON.stringify(session)).not.toContain(refreshToken);
    expect(session).toMatchObject({ principal_type: 'customer', revoked_at: null });
    expect(new Date(session.expires_at).getTime() - clock.now().getTime()).toBe(
      90 * 24 * 3600 * 1000,
    );
  });

  it('saves the user agent, cut when it is huge', async () => {
    const phone = newPhone();
    await requestCode(phone);
    const response = await verify(phone, sender.codeFor(phone), 'x'.repeat(1000));
    const [session] = await sessionsOf(response.body.customer.id);
    expect(session.user_agent).toHaveLength(255);
  });
});

describe('POST /otp/verify: the code (RN-AUT-02)', () => {
  it('the code works once', async () => {
    const phone = newPhone();
    await requestCode(phone);
    const code = sender.codeFor(phone);
    expect((await verify(phone, code)).status).toBe(200);
    const again = await verify(phone, code);
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('OTP_EXPIRED');
  });

  it('works until the 5 minutes are over', async () => {
    const phone = newPhone();
    await requestCode(phone);
    clock.advanceSeconds(5 * 60 - 1);
    expect((await verify(phone, sender.codeFor(phone))).status).toBe(200);
  });

  it('after 5 minutes it is expired', async () => {
    const phone = newPhone();
    await requestCode(phone);
    clock.advanceSeconds(5 * 60);
    const response = await verify(phone, sender.codeFor(phone));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('OTP_EXPIRED');
  });

  it('a number that asked for no code gets OTP_EXPIRED', async () => {
    const response = await verify(newPhone(), '123456');
    expect(response.body.error.code).toBe('OTP_EXPIRED');
  });

  it('a new code replaces the previous one, which now counts as a wrong code', async () => {
    const phone = newPhone();
    await requestCode(phone);
    const first = sender.codeFor(phone);
    await requestCode(phone);
    const second = sender.codeFor(phone);
    const old = await verify(phone, first);
    expect(old.status).toBe(400);
    expect(old.body.error.code).toBe('OTP_INVALID');
    expect((await verify(phone, second)).status).toBe(200);
  });

  it('the code of one number does not open another', async () => {
    const a = newPhone();
    const b = newPhone();
    await requestCode(a);
    await requestCode(b);
    const response = await verify(a, sender.codeFor(b));
    expect(response.body.error.code).toBe('OTP_INVALID');
  });

  it('a wrong code says how many attempts are left', async () => {
    const phone = newPhone();
    await requestCode(phone);
    const wrong = wrongCode(sender.codeFor(phone));
    for (const left of [4, 3, 2, 1]) {
      const response = await verify(phone, wrong);
      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: 'OTP_INVALID',
        details: { attemptsLeft: left },
      });
    }
  });

  it('the attempts are kept between requests, and the right code still works before the fifth', async () => {
    const phone = newPhone();
    await requestCode(phone);
    const right = sender.codeFor(phone);
    for (let i = 0; i < 4; i++) await verify(phone, wrongCode(right));
    const [row] = await codesOf(phone);
    expect(row.attempts).toBe(4);
    expect((await verify(phone, right)).status).toBe(200);
  });

  it('RN-AUT-02: the fifth wrong code kills the code and locks the number for 15 minutes', async () => {
    const phone = newPhone();
    await requestCode(phone);
    const right = sender.codeFor(phone);
    for (let i = 0; i < 4; i++) await verify(phone, wrongCode(right));

    const fifth = await verify(phone, wrongCode(right));
    expect(fifth.status).toBe(423);
    expect(fifth.body.error).toMatchObject({
      code: 'OTP_LOCKED',
      details: { retryAfterSeconds: 900 },
    });
    expect(fifth.headers['retry-after']).toBe('900');

    const [row] = await codesOf(phone);
    expect(row.consumed_at).not.toBeNull();
    const { rows: locks } = await t.admin.query(
      'SELECT locked_until FROM phone_lockouts WHERE phone_e164 = $1',
      [phone],
    );
    expect(new Date(locks[0].locked_until).getTime() - clock.now().getTime()).toBe(15 * 60 * 1000);
  });

  it('RN-AUT-02: a locked number is refused even with the right code, and cannot ask for another', async () => {
    const phone = newPhone();
    await requestCode(phone);
    const right = sender.codeFor(phone);
    for (let i = 0; i < 5; i++) await verify(phone, wrongCode(right));

    const withRight = await verify(phone, right);
    expect(withRight.status).toBe(423);
    expect(withRight.body.error.code).toBe('OTP_LOCKED');
    const asking = await requestCode(phone);
    expect(asking.status).toBe(423);
  });

  it('RN-AUT-02: the lock tells how long is left, and ends after 15 minutes', async () => {
    const phone = newPhone();
    await requestCode(phone);
    const right = sender.codeFor(phone);
    for (let i = 0; i < 5; i++) await verify(phone, wrongCode(right));

    clock.advanceSeconds(10 * 60);
    const during = await verify(phone, right);
    expect(during.body.error.details.retryAfterSeconds).toBe(5 * 60);

    clock.advanceSeconds(5 * 60);
    // The old code is dead; a new one works.
    expect((await verify(phone, right)).body.error.code).toBe('OTP_EXPIRED');
    expect((await requestCode(phone)).status).toBe(202);
    expect((await verify(phone, sender.codeFor(phone))).status).toBe(200);
  });

  it('a lock on one number does not touch another', async () => {
    const locked = newPhone();
    await requestCode(locked);
    for (let i = 0; i < 5; i++) await verify(locked, wrongCode(sender.codeFor(locked)));
    await expect(signIn()).resolves.toBeDefined();
  });

  it('a code with the wrong shape is a VALIDATION_ERROR and does not count as an attempt', async () => {
    const phone = newPhone();
    await requestCode(phone);
    for (const code of ['12345', '1234567', 'abcdef', '12 456', '']) {
      const response = await verify(phone, code);
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
    const [row] = await codesOf(phone);
    expect(row.attempts).toBe(0);
  });

  it('refuses a number outside +55', async () => {
    const response = await verify('+14155550100', '123456');
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('PHONE_NOT_SUPPORTED');
  });

  it('wrong attempts at the same moment are all counted: 4 refused, then the lock', async () => {
    const phone = newPhone();
    await requestCode(phone);
    const wrong = wrongCode(sender.codeFor(phone));
    const responses = await Promise.all(Array.from({ length: 8 }, () => verify(phone, wrong)));
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 400)).toHaveLength(4);
    expect(statuses.filter((s) => s === 423)).toHaveLength(4);
  });

  it('the same right code at the same moment opens one session only', async () => {
    const phone = newPhone();
    await requestCode(phone);
    const right = sender.codeFor(phone);
    const responses = await Promise.all(Array.from({ length: 5 }, () => verify(phone, right)));
    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 400)).toHaveLength(4);
    const { rows } = await t.admin.query(
      'SELECT 1 FROM sessions s JOIN customers c ON c.id = s.principal_id WHERE c.phone_e164 = $1',
      [phone],
    );
    expect(rows).toHaveLength(1);
  });
});

describe('POST /refresh (RN-AUT-06)', () => {
  it('trades the refresh token for a new access token and a new refresh token', async () => {
    const { response, refreshToken } = await signIn();
    clock.advanceSeconds(20 * 60);
    const renewed = await refresh(refreshToken);
    expect(renewed.status).toBe(200);
    expect(renewed.body.expiresIn).toBe(900);
    expect(renewed.body.customer).toEqual(response.body.customer);
    expect(renewed.body.accessToken).not.toBe(response.body.accessToken);
    await expect(tokens.verify(renewed.body.accessToken)).resolves.toMatchObject({
      sub: response.body.customer.id,
    });
    const next = refreshOf(renewed);
    expect(next).toBeTruthy();
    expect(next).not.toBe(refreshToken);
  });

  it('the refresh token rotates: the old row is revoked and the new one is in the same login', async () => {
    const { response, refreshToken } = await signIn();
    await refresh(refreshToken);
    const rows = await sessionsOf(response.body.customer.id);
    // Both rows were made at the same instant of the test clock, so they are told apart by state.
    const revoked = rows.filter((row) => row.revoked_at !== null);
    const open = rows.filter((row) => row.revoked_at === null);
    expect(revoked).toHaveLength(1);
    expect(open).toHaveLength(1);
    expect(open[0].family_id).toBe(revoked[0].family_id);
    expect(open[0].refresh_token_hash).not.toBe(revoked[0].refresh_token_hash);
  });

  it('the session renews on every use: 90 days from the last one', async () => {
    const { response, refreshToken } = await signIn();
    clock.advanceSeconds(60 * 24 * 3600);
    await refresh(refreshToken);
    const open = (await sessionsOf(response.body.customer.id)).filter(
      (row) => row.revoked_at === null,
    );
    expect(open).toHaveLength(1);
    expect(new Date(open[0].expires_at).getTime() - clock.now().getTime()).toBe(
      90 * 24 * 3600 * 1000,
    );
  });

  it('keeps working for many rounds', async () => {
    let { refreshToken } = await signIn();
    for (let i = 0; i < 5; i++) {
      clock.advanceSeconds(3600);
      const response = await refresh(refreshToken);
      expect(response.status).toBe(200);
      refreshToken = refreshOf(response)!;
    }
  });

  it('after 90 days without use the session is over', async () => {
    const { refreshToken } = await signIn();
    clock.advanceSeconds(90 * 24 * 3600);
    const response = await refresh(refreshToken);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('without a cookie it is UNAUTHENTICATED', async () => {
    const response = await refresh();
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('a token nobody knows is UNAUTHENTICATED, and the cookie is cleared', async () => {
    const response = await refresh('made-up-token');
    expect(response.status).toBe(401);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies.find((c) => c.startsWith('refresh_token=;'))).toBeTruthy();
  });

  it('a token that was already used is refused, and it ends the whole login (reuse)', async () => {
    const { response, refreshToken: first } = await signIn();
    const renewed = await refresh(first);
    const second = refreshOf(renewed)!;

    // Somebody shows the first token again.
    const reuse = await refresh(first);
    expect(reuse.status).toBe(401);

    // The newest token of that login stopped working too.
    const afterReuse = await refresh(second);
    expect(afterReuse.status).toBe(401);
    const rows = await sessionsOf(response.body.customer.id);
    expect(rows.every((row) => row.revoked_at !== null)).toBe(true);
  });

  it('the reuse of one login does not touch another login of the same customer', async () => {
    const { phone, response, refreshToken: phoneLogin } = await signIn();
    // The same customer signs in on a second device.
    await requestCode(phone);
    const second = await verify(phone, sender.codeFor(phone));
    const otherDevice = refreshOf(second)!;
    expect(second.body.customer.id).toBe(response.body.customer.id);

    await refresh(phoneLogin); // rotated
    await refresh(phoneLogin); // reuse: the first login dies
    expect((await refresh(otherDevice)).status).toBe(200);
  });

  it('two requests with the same token at the same moment: one wins, the other is refused', async () => {
    const { refreshToken } = await signIn();
    const responses = await Promise.all(Array.from({ length: 4 }, () => refresh(refreshToken)));
    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 401)).toHaveLength(3);
  });

  it('a customer that was anonymized no longer signs in by refresh', async () => {
    const { response, refreshToken } = await signIn();
    await t.admin.query(
      "UPDATE customers SET anonymized_at = now(), phone_e164 = 'anon:' || id, name = NULL WHERE id = $1",
      [response.body.customer.id],
    );
    expect((await refresh(refreshToken)).status).toBe(401);
  });

  it('an access token cannot be used as a refresh token', async () => {
    const { response } = await signIn();
    expect((await refresh(response.body.accessToken)).status).toBe(401);
  });
});

describe('POST /logout', () => {
  it('ends the session: the refresh token no longer works', async () => {
    const { response, refreshToken } = await signIn();
    const out = await logout(refreshToken);
    expect(out.status).toBe(204);
    expect(out.text).toBe('');
    const cookies = out.headers['set-cookie'] as unknown as string[];
    expect(cookies.find((c) => c.startsWith('refresh_token=;'))).toBeTruthy();
    expect((await refresh(refreshToken)).status).toBe(401);
    const rows = await sessionsOf(response.body.customer.id);
    expect(rows.every((row) => row.revoked_at !== null)).toBe(true);
  });

  it('doing it twice, or with no cookie, is fine', async () => {
    const { refreshToken } = await signIn();
    expect((await logout(refreshToken)).status).toBe(204);
    expect((await logout(refreshToken)).status).toBe(204);
    expect((await logout()).status).toBe(204);
    expect((await logout('made-up-token')).status).toBe(204);
  });

  it('does not end the other login of the same customer', async () => {
    const { phone, refreshToken } = await signIn();
    await requestCode(phone);
    const other = refreshOf(await verify(phone, sender.codeFor(phone)))!;
    await logout(refreshToken);
    expect((await refresh(other)).status).toBe(200);
  });
});

describe('golden rule 8: nothing secret in the logs', () => {
  it('never writes a number, a code, a token or the refresh cookie', async () => {
    logLines.length = 0;
    const phone = newPhone();
    await requestCode(phone);
    const code = sender.codeFor(phone);
    const signedIn = await verify(phone, code);
    const refreshToken = refreshOf(signedIn)!;
    await verify(phone, wrongCode(code));
    const renewed = await refresh(refreshToken);
    await refresh(refreshToken); // reuse
    await logout(refreshOf(renewed));

    const log = logLines.join('');
    expect(log).toContain('"path":"/v1/customer/auth/refresh"');
    for (const secret of [
      phone,
      code,
      refreshToken,
      refreshOf(renewed)!,
      signedIn.body.accessToken,
      renewed.body.accessToken,
      JWT_SECRET,
      OTP_SECRET,
    ]) {
      expect(log).not.toContain(secret);
    }
  });
});

describe('OpenAPI', () => {
  it('describes the four endpoints', async () => {
    const response = await http().get('/docs-json');
    expect(Object.keys(response.body.paths)).toEqual(
      expect.arrayContaining([
        `${BASE}/otp/request`,
        `${BASE}/otp/verify`,
        `${BASE}/refresh`,
        `${BASE}/logout`,
      ]),
    );
  });
});
