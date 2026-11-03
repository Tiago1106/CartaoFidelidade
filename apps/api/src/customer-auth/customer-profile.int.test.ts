import { Writable } from 'node:stream';
import { TERMS_VERSION } from '@fregues/shared';
import { SignJWT } from 'jose';
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

class FakeSender implements OtpSender {
  readonly name = 'test';
  sent: { phone: string; code: string }[] = [];
  async send(message: { phone: string; code: string; expiresAt: Date }) {
    this.sent.push({ phone: message.phone, code: message.code });
    return {};
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

const newPhone = () => `+55119${String(70000000 + ++counter)}`;
const http = () => request(app.getHttpServer());
const getMe = (token?: string) => {
  const call = http().get('/v1/customer/me');
  return token ? call.set('Authorization', `Bearer ${token}`) : call;
};
const patchMe = (token: string, body: unknown) =>
  http()
    .patch('/v1/customer/me')
    .set('Authorization', `Bearer ${token}`)
    .send(body as object);

/** A real sign-in through the API: the account is new and still has no name. */
async function signIn(phone = newPhone()) {
  await http()
    .post('/v1/customer/auth/otp/request')
    .set('X-Forwarded-For', `198.51.100.${nextIp++ % 250}`)
    .send({ phone });
  const code = sender.sent.filter((m) => m.phone === phone).at(-1)!.code;
  const response = await http().post('/v1/customer/auth/otp/verify').send({ phone, code });
  expect(response.status).toBe(200);
  return {
    phone,
    token: response.body.accessToken as string,
    id: response.body.customer.id as string,
  };
}

const rowOf = async (id: string) =>
  (await t.admin.query('SELECT * FROM customers WHERE id = $1', [id])).rows[0];

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

describe('the access token guard', () => {
  it('no token: UNAUTHENTICATED', async () => {
    const response = await getMe();
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it.each(['', 'Bearer', 'Bearer a b', 'Basic abc', 'Bearer not-a-jwt'])(
    'a malformed header (%j): UNAUTHENTICATED',
    async (header) => {
      const response = await http().get('/v1/customer/me').set('Authorization', header);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    },
  );

  it('a token signed with another key: UNAUTHENTICATED', async () => {
    const { id } = await signIn();
    const forged = await new SignJWT({ typ: 'customer' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(id)
      .setIssuedAt(Math.floor(clock.now().getTime() / 1000))
      .setExpirationTime(Math.floor(clock.now().getTime() / 1000) + 600)
      .sign(new TextEncoder().encode('another-key-with-at-least-32-characters!'));
    expect((await getMe(forged)).body.error.code).toBe('UNAUTHENTICATED');
  });

  it('a token that is not of a customer: UNAUTHENTICATED', async () => {
    const { id } = await signIn();
    const staff = await new SignJWT({ typ: 'staff' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(id)
      .setIssuedAt(Math.floor(clock.now().getTime() / 1000))
      .setExpirationTime(Math.floor(clock.now().getTime() / 1000) + 600)
      .sign(new TextEncoder().encode(JWT_SECRET));
    expect((await getMe(staff)).body.error.code).toBe('UNAUTHENTICATED');
  });

  it('an expired token: TOKEN_EXPIRED, so the app tries the refresh', async () => {
    const { token } = await signIn();
    expect((await getMe(token)).status).toBe(200);
    clock.advanceSeconds(15 * 60 + 1);
    const response = await getMe(token);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('a valid token of an account that does not exist: UNAUTHENTICATED', async () => {
    const { token } = await tokens.sign('6f1c0a52-3b7e-4c1d-9a55-0d1f5b7e2a10');
    const response = await getMe(token);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('a valid token of an anonymized account: UNAUTHENTICATED', async () => {
    const { id, token } = await signIn();
    await t.admin.query(
      `UPDATE customers SET anonymized_at = now(), name = NULL, phone_e164 = 'anon-' || id WHERE id = $1`,
      [id],
    );
    expect((await getMe(token)).body.error.code).toBe('UNAUTHENTICATED');
    expect((await patchMe(token, { name: 'Carlos' })).body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('GET /v1/customer/me', () => {
  it('RN-ENT-07: a new account has no name yet', async () => {
    const { phone, token, id } = await signIn();
    const response = await getMe(token);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id,
      phone,
      name: null,
      email: null,
      profileComplete: false,
      termsAcceptedAt: null,
      termsVersion: null,
    });
  });

  it('shows only the own account', async () => {
    const a = await signIn();
    const b = await signIn();
    await patchMe(a.token, { name: 'Ana', acceptTerms: true });
    await patchMe(b.token, { name: 'Bruno', acceptTerms: true });
    expect((await getMe(a.token)).body).toMatchObject({ id: a.id, name: 'Ana', phone: a.phone });
    expect((await getMe(b.token)).body).toMatchObject({ id: b.id, name: 'Bruno', phone: b.phone });
  });
});

describe('PATCH /v1/customer/me: first access', () => {
  it('RN-ENT-07, RN-ENT-08, RN-LGP-02: name and acceptTerms finish the profile and record version and date', async () => {
    const { token, id, phone } = await signIn();
    const response = await patchMe(token, { name: 'Carlos Mendes', acceptTerms: true });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id,
      phone,
      name: 'Carlos Mendes',
      email: null,
      profileComplete: true,
      termsAcceptedAt: clock.now().toISOString(),
      termsVersion: TERMS_VERSION,
    });
    const row = await rowOf(id);
    expect(row.name).toBe('Carlos Mendes');
    expect(row.terms_version).toBe(TERMS_VERSION);
    expect(row.terms_accepted_at.toISOString()).toBe(clock.now().toISOString());
    expect((await getMe(token)).body.profileComplete).toBe(true);
  });

  it('RN-ENT-08: an account that never accepted the Terms cannot be changed without acceptTerms', async () => {
    const { token, id } = await signIn();
    const response = await patchMe(token, { name: 'Carlos' });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.fields).toEqual([
      { field: 'acceptTerms', reason: 'required' },
    ]);
    expect((await rowOf(id)).name).toBeNull();
  });

  it('acceptTerms: false is refused', async () => {
    const { token, id } = await signIn();
    const response = await patchMe(token, { name: 'Carlos', acceptTerms: false });
    expect(response.status).toBe(422);
    expect((await rowOf(id)).terms_accepted_at).toBeNull();
  });

  it('RN-LGP-02: a second acceptTerms keeps the first date, and later edits need no acceptance', async () => {
    const { token, id } = await signIn();
    await patchMe(token, { name: 'Carlos', acceptTerms: true });
    const firstDate = clock.now().toISOString();

    // A day later the first token is long expired, so the app would hold a new one.
    clock.advanceSeconds(86400);
    const { token: later } = await tokens.sign(id);
    const again = await patchMe(later, { acceptTerms: true });
    expect(again.status).toBe(200);
    expect(again.body.termsAcceptedAt).toBe(firstDate);

    const edit = await patchMe(later, { name: 'Carlos Mendes' });
    expect(edit.status).toBe(200);
    expect(edit.body).toMatchObject({ name: 'Carlos Mendes', termsAcceptedAt: firstDate });
    expect((await rowOf(id)).terms_accepted_at.toISOString()).toBe(firstDate);
  });

  it('the Terms version of the app must be the current one', async () => {
    const { token, id } = await signIn();
    const stale = await patchMe(token, {
      name: 'Carlos',
      acceptTerms: true,
      termsVersion: '2020-01-01',
    });
    expect(stale.status).toBe(422);
    expect(stale.body.error.details.fields).toEqual([
      { field: 'termsVersion', reason: 'outdated' },
    ]);
    expect((await rowOf(id)).name).toBeNull();

    const current = await patchMe(token, {
      name: 'Carlos',
      acceptTerms: true,
      termsVersion: TERMS_VERSION,
    });
    expect(current.status).toBe(200);
  });

  it('signing in again after the first access answers profileComplete: true', async () => {
    const { token, phone } = await signIn();
    await patchMe(token, { name: 'Carlos', acceptTerms: true });
    await http()
      .post('/v1/customer/auth/otp/request')
      .set('X-Forwarded-For', `198.51.100.${nextIp++ % 250}`)
      .send({ phone });
    const code = sender.sent.filter((m) => m.phone === phone).at(-1)!.code;
    const response = await http().post('/v1/customer/auth/otp/verify').send({ phone, code });
    expect(response.body.customer).toMatchObject({ name: 'Carlos', profileComplete: true });
  });
});

describe('PATCH /v1/customer/me: editing', () => {
  async function accepted() {
    const account = await signIn();
    await patchMe(account.token, { name: 'Carlos', acceptTerms: true });
    return account;
  }

  it('sets the e-mail in lower case and removes it with null', async () => {
    const { token, id } = await accepted();
    const set = await patchMe(token, { email: '  Carlos@Exemplo.COM ' });
    expect(set.status).toBe(200);
    expect(set.body.email).toBe('carlos@exemplo.com');
    expect((await rowOf(id)).email).toBe('carlos@exemplo.com');

    const removed = await patchMe(token, { email: null });
    expect(removed.status).toBe(200);
    expect(removed.body.email).toBeNull();
    expect((await rowOf(id)).email).toBeNull();
  });

  it('changing the name keeps the e-mail, and the other way round', async () => {
    const { token } = await accepted();
    await patchMe(token, { email: 'carlos@exemplo.com' });
    const response = await patchMe(token, { name: '  Carlos Mendes  ' });
    expect(response.body).toMatchObject({ name: 'Carlos Mendes', email: 'carlos@exemplo.com' });
  });

  it.each([
    ['an empty body', {}],
    ['a blank name', { name: '   ' }],
    ['a name that is too long', { name: 'a'.repeat(81) }],
    ['a name that is not text', { name: 7 }],
    ['an invalid e-mail', { email: 'not-an-email' }],
    ['an empty e-mail', { email: '' }],
    ['the phone, which cannot be changed', { phone: '+5511999999999' }],
    ['the id', { id: '6f1c0a52-3b7e-4c1d-9a55-0d1f5b7e2a10' }],
    ['a field of the terms the server owns', { termsAcceptedAt: '2020-01-01T00:00:00Z' }],
  ])('refuses %s with VALIDATION_ERROR and changes nothing', async (_label, body) => {
    const { token, id, phone } = await accepted();
    const before = await rowOf(id);
    const response = await patchMe(token, body);
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await rowOf(id)).toEqual(before);
    expect(before.phone_e164).toBe(phone);
  });

  it('one customer can never change another: only the token tells who', async () => {
    const a = await accepted();
    const b = await accepted();
    await patchMe(a.token, { name: 'Ana Souza' });
    expect((await rowOf(b.id)).name).toBe('Carlos');
    expect((await rowOf(a.id)).name).toBe('Ana Souza');
  });

  it('two edits at the same time both land, and the Terms date stays single', async () => {
    const { token, id } = await signIn();
    const [first, second] = await Promise.all([
      patchMe(token, { name: 'Carlos', acceptTerms: true }),
      patchMe(token, { email: 'carlos@exemplo.com', acceptTerms: true }),
    ]);
    expect([first.status, second.status]).toEqual([200, 200]);
    const row = await rowOf(id);
    expect(row.name).toBe('Carlos');
    expect(row.email).toBe('carlos@exemplo.com');
    expect(row.terms_accepted_at.toISOString()).toBe(clock.now().toISOString());
  });
});

describe('what the API shows and keeps', () => {
  it('golden rule 8: name, e-mail and phone are not written in the logs', async () => {
    const { token, phone } = await signIn();
    await patchMe(token, {
      name: 'Zeferino Raro',
      email: 'zeferino.raro@exemplo.com',
      acceptTerms: true,
    });
    await getMe(token);
    const logs = logLines.join('');
    expect(logs).not.toContain('Zeferino');
    expect(logs).not.toContain('zeferino.raro');
    expect(logs).not.toContain(phone);
    expect(logs).not.toContain(token);
  });

  it('OpenAPI describes the profile with the bearer token', async () => {
    const response = await http().get('/docs-json');
    expect(response.status).toBe(200);
    expect(Object.keys(response.body.paths['/v1/customer/me'])).toEqual(
      expect.arrayContaining(['get', 'patch']),
    );
    expect(response.body.components.securitySchemes.bearer).toMatchObject({ type: 'http' });
  });
});
