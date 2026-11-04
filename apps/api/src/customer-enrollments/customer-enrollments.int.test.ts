import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { ManualClock } from '../clock/clock';
import { loadEnv } from '../config/env';
import { AccessTokenService } from '../customer-auth/access-token.service';
import { createTestDatabase, type TestDatabase } from '../test/test-database';

const JWT_SECRET = 'a-signing-key-with-at-least-32-characters';
const NOW = '2026-11-10T15:00:00Z';
const NOW_ISO = new Date(NOW).toISOString();

let t: TestDatabase;
let app: Awaited<ReturnType<typeof createApp>>;
let clock: ManualClock;
let tokens: AccessTokenService;
let counter = 0;

const http = () => request(app.getHttpServer());
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// ---------------------------------------------------------------------------------------------
// Data, inserted as the owner of the tables (which ignores RLS)
// ---------------------------------------------------------------------------------------------

async function newCustomer() {
  counter += 1;
  const id = randomUUID();
  await t.admin.query(
    `INSERT INTO customers (id, phone_e164, name) VALUES ($1, $2, 'Maria Silva')`,
    [id, `+55119${String(50000000 + counter)}`],
  );
  const { token } = await tokens.sign(id);
  return { id, token };
}

async function newBusiness(slug = `negocio-${++counter}`, category: string | null = 'Barbearia') {
  const id = randomUUID();
  await t.admin.query(
    `INSERT INTO businesses (id, name, slug, category, trial_ends_at) VALUES ($1, $2, $3, $4, now())`,
    [id, `Negócio ${slug}`, slug, category],
  );
  return { id, slug };
}

async function newStaff(businessId: string, name: string) {
  const id = randomUUID();
  await t.admin.query(
    `INSERT INTO staff (id, business_id, name, email, role) VALUES ($1, $2, $3, $4, 'employee')`,
    [id, businessId, name, `${id}@segredo.test`],
  );
  return id;
}

async function newProgram(
  businessId: string,
  o: { name?: string; required?: number; status?: 'active' | 'archived'; color?: string } = {},
) {
  const id = randomUUID();
  await t.admin.query(
    `INSERT INTO programs (id, business_id, name, stamps_required, reward_description, status,
                          card_color, archived_at, created_at)
     VALUES ($1, $2, $3, $4, '1 corte grátis', $5, $6, $7, now() + ($8 || ' seconds')::interval)`,
    [
      id,
      businessId,
      o.name ?? `Cartão ${++counter}`,
      o.required ?? 10,
      o.status ?? 'active',
      o.color ?? '#16181B',
      o.status === 'archived' ? NOW : null,
      String(counter),
    ],
  );
  return id;
}

async function enroll(
  businessId: string,
  customerId: string,
  programId: string,
  o: { createdAt?: string; lastStampAt?: string; status?: 'active' | 'archived' } = {},
) {
  const id = randomUUID();
  await t.admin.query(
    `INSERT INTO business_customers (business_id, customer_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [businessId, customerId],
  );
  await t.admin.query(
    `INSERT INTO enrollments (id, business_id, customer_id, program_id, status, created_at, last_stamp_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      businessId,
      customerId,
      programId,
      o.status ?? 'active',
      o.createdAt ?? '2026-10-01T12:00:00Z',
      o.lastStampAt ?? null,
    ],
  );
  return id;
}

interface CycleOptions {
  number?: number;
  status?: 'open' | 'completed' | 'expired';
  required?: number;
  startedAt?: string;
  lastStampAt?: string | null;
  expiresAt?: string | null;
  completedAt?: string | null;
  expiredAt?: string | null;
}

async function addCycle(businessId: string, enrollmentId: string, o: CycleOptions = {}) {
  const id = randomUUID();
  const status = o.status ?? 'open';
  await t.admin.query(
    `INSERT INTO cycles (id, business_id, enrollment_id, number, status, stamps_required,
                         reward_description, validity_days, reward_validity_days, started_at,
                         last_stamp_at, expires_at, completed_at, expired_at)
     VALUES ($1, $2, $3, $4, $5, $6, '1 corte grátis', 30, 30, $7, $8, $9, $10, $11)`,
    [
      id,
      businessId,
      enrollmentId,
      o.number ?? 1,
      status,
      o.required ?? 10,
      o.startedAt ?? '2026-10-01T12:00:00Z',
      o.lastStampAt ?? null,
      o.expiresAt ?? null,
      o.completedAt ?? null,
      o.expiredAt ?? null,
    ],
  );
  if (status === 'open') {
    await t.admin.query(`UPDATE enrollments SET current_cycle_id = $1 WHERE id = $2`, [
      id,
      enrollmentId,
    ]);
  }
  return id;
}

async function addStamp(
  s: { businessId: string; enrollmentId: string; customerId: string; cycleId: string },
  staffId: string,
  createdAt: string,
) {
  const id = randomUUID();
  await t.admin.query(
    `INSERT INTO stamps (id, business_id, enrollment_id, cycle_id, customer_id, staff_id, method, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'qr', $7)`,
    [id, s.businessId, s.enrollmentId, s.cycleId, s.customerId, staffId, createdAt],
  );
  return id;
}

async function reverseStamp(
  s: { businessId: string; enrollmentId: string; customerId: string; cycleId: string },
  staffId: string,
  stampId: string,
  createdAt: string,
) {
  await t.admin.query(
    `INSERT INTO stamps (business_id, enrollment_id, cycle_id, customer_id, staff_id, type,
                         reverses_stamp_id, reason, created_at)
     VALUES ($1, $2, $3, $4, $5, 'reversal', $6, 'cliente pediu para desfazer', $7)`,
    [s.businessId, s.enrollmentId, s.cycleId, s.customerId, staffId, stampId, createdAt],
  );
}

async function addPrize(
  s: { businessId: string; enrollmentId: string; customerId: string },
  cycleId: string,
  o: {
    status?: 'available' | 'redeemed' | 'expired' | 'canceled';
    expiresAt: string;
    earnedAt?: string;
  },
) {
  const id = randomUUID();
  await t.admin.query(
    `INSERT INTO redemptions (id, business_id, enrollment_id, cycle_id, customer_id, status,
                              reward_description, earned_at, expires_at, redeemed_at)
     VALUES ($1, $2, $3, $4, $5, $6, '1 corte grátis', $7, $8, $9)`,
    [
      id,
      s.businessId,
      s.enrollmentId,
      cycleId,
      s.customerId,
      o.status ?? 'available',
      o.earnedAt ?? '2026-10-20T12:00:00Z',
      o.expiresAt,
      o.status === 'redeemed' ? '2026-10-25T12:00:00Z' : null,
    ],
  );
  return id;
}

const getList = (token: string) => http().get('/v1/customer/enrollments').set(auth(token));
const getOne = (token: string, id: string) =>
  http().get(`/v1/customer/enrollments/${id}`).set(auth(token));
const join = (token: string, slug: string, body: object = {}) =>
  http().post(`/v1/customer/businesses/${slug}/join`).set(auth(token)).send(body);

beforeAll(async () => {
  t = await createTestDatabase();
  clock = new ManualClock(NOW);
  app = await createApp({
    env: loadEnv({ NODE_ENV: 'test' }),
    clock,
    db: t.db,
    systemDb: t.system,
    // These tests never sign in with a code; the sender is only there to build the app.
    otpSender: { name: 'test', send: async () => ({}) },
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
  clock.set(NOW);
});

// ---------------------------------------------------------------------------------------------

describe('access', () => {
  it.each([
    ['GET', '/v1/customer/enrollments'],
    ['GET', `/v1/customer/enrollments/${randomUUID()}`],
    ['POST', '/v1/customer/businesses/qualquer/join'],
  ])('%s %s needs the access token', async (method, path) => {
    const response = await http()[method === 'GET' ? 'get' : 'post'](path);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('an expired token is TOKEN_EXPIRED', async () => {
    const { token } = await newCustomer();
    clock.advanceSeconds(16 * 60);
    const response = await getList(token);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('TOKEN_EXPIRED');
  });
});

describe('POST /customer/businesses/:slug/join', () => {
  it('RN-ENT-04: enters the active cards and leaves the archived ones out', async () => {
    const customer = await newCustomer();
    const business = await newBusiness('navalha', 'Barbearia');
    const corte = await newProgram(business.id, { name: 'Corte', required: 10, color: '#112233' });
    const barba = await newProgram(business.id, { name: 'Barba', required: 6 });
    await newProgram(business.id, { name: 'Antigo', status: 'archived' });

    const response = await join(customer.token, 'navalha');
    expect(response.status).toBe(200);
    expect(response.body.enrollments).toHaveLength(2);
    const byProgram = Object.fromEntries(
      response.body.enrollments.map((e: { program: { id: string } }) => [e.program.id, e]),
    );
    expect(byProgram[corte]).toEqual({
      id: expect.any(String),
      business: {
        id: business.id,
        name: 'Negócio navalha',
        slug: 'navalha',
        category: 'Barbearia',
      },
      program: {
        id: corte,
        name: 'Corte',
        rewardDescription: '1 corte grátis',
        cardColor: '#112233',
      },
      progress: { current: 0, required: 10, cycleNumber: 1, expiresAt: null },
      lastStampAt: null,
      availableRedemptions: [],
    });
    expect(byProgram[barba].progress.required).toBe(6);

    const rows = await t.admin.query(
      `SELECT count(*)::int AS n FROM enrollments WHERE customer_id = $1`,
      [customer.id],
    );
    expect(rows.rows[0].n).toBe(2);
    const link = await t.admin.query(
      `SELECT * FROM business_customers WHERE customer_id = $1 AND business_id = $2`,
      [customer.id, business.id],
    );
    expect(link.rows).toHaveLength(1);
    expect(link.rows[0].first_seen_at.toISOString()).toBe(NOW_ISO);
  });

  it('is idempotent: a second call gives the same cards and creates nothing', async () => {
    const customer = await newCustomer();
    const business = await newBusiness();
    await newProgram(business.id);
    await newProgram(business.id);

    const first = await join(customer.token, business.slug);
    const second = await join(customer.token, business.slug);
    expect(second.status).toBe(200);
    const ids = (r: request.Response) => r.body.enrollments.map((e: { id: string }) => e.id).sort();
    expect(ids(second)).toEqual(ids(first));
    const count = await t.admin.query(
      `SELECT count(*)::int AS n FROM enrollments WHERE customer_id = $1`,
      [customer.id],
    );
    expect(count.rows[0].n).toBe(2);
  });

  it('two calls at the same time make one enrollment per card', async () => {
    const customer = await newCustomer();
    const business = await newBusiness();
    await newProgram(business.id);
    const answers = await Promise.all([1, 2, 3, 4].map(() => join(customer.token, business.slug)));
    expect(answers.map((a) => a.status)).toEqual([200, 200, 200, 200]);
    const count = await t.admin.query(
      `SELECT count(*)::int AS n FROM enrollments WHERE customer_id = $1`,
      [customer.id],
    );
    expect(count.rows[0].n).toBe(1);
  });

  it('programIds limits the cards, and a card enrolled before stays', async () => {
    const customer = await newCustomer();
    const business = await newBusiness();
    const a = await newProgram(business.id);
    const b = await newProgram(business.id);
    const only = await join(customer.token, business.slug, { programIds: [b] });
    expect(only.body.enrollments.map((e: { program: { id: string } }) => e.program.id)).toEqual([
      b,
    ]);
    const both = await join(customer.token, business.slug, { programIds: [a, b] });
    expect(both.body.enrollments).toHaveLength(2);
  });

  it('a card of another business is NOT_FOUND and nothing is written', async () => {
    const customer = await newCustomer();
    const mine = await newBusiness();
    const other = await newBusiness();
    await newProgram(mine.id);
    const foreign = await newProgram(other.id);
    const response = await join(customer.token, mine.slug, { programIds: [foreign] });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    const rows = await t.admin.query(
      `SELECT count(*)::int AS n FROM business_customers WHERE customer_id = $1`,
      [customer.id],
    );
    expect(rows.rows[0].n).toBe(0);
  });

  it('an archived card asked for is PROGRAM_NOT_ACTIVE and nothing is written', async () => {
    const customer = await newCustomer();
    const business = await newBusiness();
    const active = await newProgram(business.id);
    const archived = await newProgram(business.id, { status: 'archived' });
    const response = await join(customer.token, business.slug, { programIds: [active, archived] });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PROGRAM_NOT_ACTIVE');
    const rows = await t.admin.query(
      `SELECT count(*)::int AS n FROM enrollments WHERE customer_id = $1`,
      [customer.id],
    );
    expect(rows.rows[0].n).toBe(0);
  });

  it('a business without active cards answers an empty list', async () => {
    const customer = await newCustomer();
    const business = await newBusiness();
    await newProgram(business.id, { status: 'archived' });
    const response = await join(customer.token, business.slug);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ enrollments: [] });
  });

  it.each(['nao-existe', 'UPPER', 'com espaço', '-x', 'a'.repeat(200)])(
    'the slug %j is NOT_FOUND',
    async (slug) => {
      const { token } = await newCustomer();
      const response = await join(token, encodeURIComponent(slug));
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    },
  );

  it.each([
    ['a field that does not exist', { nome: 'x' }],
    ['programIds that is not a list', { programIds: 'abc' }],
    ['a programId that is not a UUID', { programIds: ['abc'] }],
    ['marketingOptIn that is not a boolean', { marketingOptIn: 'sim' }],
  ])('refuses %s with VALIDATION_ERROR', async (_label, body) => {
    const customer = await newCustomer();
    const business = await newBusiness();
    await newProgram(business.id);
    const response = await join(customer.token, business.slug, body);
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('RN-LGP-03: consent starts off, is recorded with date and origin, and is never moved', async () => {
    const customer = await newCustomer();
    const business = await newBusiness();
    await newProgram(business.id);
    const consent = async () =>
      (
        await t.admin.query(
          `SELECT marketing_opt_in_at, marketing_source FROM business_customers
            WHERE customer_id = $1 AND business_id = $2`,
          [customer.id, business.id],
        )
      ).rows[0];

    await join(customer.token, business.slug);
    expect(await consent()).toEqual({ marketing_opt_in_at: null, marketing_source: null });

    await join(customer.token, business.slug, { marketingOptIn: false });
    expect((await consent()).marketing_opt_in_at).toBeNull();

    await join(customer.token, business.slug, { marketingOptIn: true });
    const first = await consent();
    expect(first.marketing_opt_in_at.toISOString()).toBe(NOW_ISO);
    expect(first.marketing_source).toBe('first_login');

    clock.advanceSeconds(3600);
    await join(customer.token, business.slug, { marketingOptIn: true });
    await join(customer.token, business.slug);
    expect(await consent()).toEqual(first);
  });

  it('what the customer has done with a business does not touch other customers', async () => {
    const a = await newCustomer();
    const b = await newCustomer();
    const business = await newBusiness();
    await newProgram(business.id);
    await join(a.token, business.slug);
    expect((await getList(b.token)).body).toEqual({ items: [] });
  });
});

describe('GET /customer/enrollments', () => {
  it('a customer without cards gets an empty list', async () => {
    const { token } = await newCustomer();
    const response = await getList(token);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
  });

  it('shows the progress of the open cycle, without the reversed visits', async () => {
    const customer = await newCustomer();
    const business = await newBusiness('salao-a');
    const staff = await newStaff(business.id, 'Rafael Souza');
    const program = await newProgram(business.id, { required: 10 });
    const enrollmentId = await enroll(business.id, customer.id, program, {
      lastStampAt: '2026-11-08T12:00:00Z',
    });
    const cycleId = await addCycle(business.id, enrollmentId, {
      number: 2,
      required: 8,
      lastStampAt: '2026-11-08T12:00:00Z',
      expiresAt: '2026-12-08T02:59:59Z',
    });
    const ctx = { businessId: business.id, enrollmentId, customerId: customer.id, cycleId };
    await addStamp(ctx, staff, '2026-11-01T12:00:00Z');
    const undone = await addStamp(ctx, staff, '2026-11-05T12:00:00Z');
    await addStamp(ctx, staff, '2026-11-08T12:00:00Z');
    await reverseStamp(ctx, staff, undone, '2026-11-05T13:00:00Z');

    const { items } = (await getList(customer.token)).body;
    expect(items).toHaveLength(1);
    expect(items[0].progress).toEqual({
      current: 2,
      required: 8,
      cycleNumber: 2,
      expiresAt: '2026-12-08T02:59:59.000Z',
    });
    expect(items[0].lastStampAt).toBe('2026-11-08T12:00:00.000Z');
  });

  it('RN-CAR-04: the open cycle keeps the rules it started with', async () => {
    const customer = await newCustomer();
    const business = await newBusiness();
    const program = await newProgram(business.id, { required: 12 });
    const enrollmentId = await enroll(business.id, customer.id, program);
    await addCycle(business.id, enrollmentId, {
      required: 10,
      lastStampAt: '2026-11-08T12:00:00Z',
      expiresAt: '2026-12-08T02:59:59Z',
    });
    const { items } = (await getList(customer.token)).body;
    expect(items[0].progress.required).toBe(10);
  });

  describe('validity (RN-VAL-01 to RN-VAL-04)', () => {
    async function withCycle(expiresAt: string) {
      const customer = await newCustomer();
      const business = await newBusiness();
      const staff = await newStaff(business.id, 'Rafael');
      const program = await newProgram(business.id, { required: 12 });
      const enrollmentId = await enroll(business.id, customer.id, program, {
        lastStampAt: '2026-10-01T12:00:00Z',
      });
      const cycleId = await addCycle(business.id, enrollmentId, {
        number: 3,
        required: 10,
        lastStampAt: '2026-10-01T12:00:00Z',
        expiresAt,
      });
      await addStamp(
        { businessId: business.id, enrollmentId, customerId: customer.id, cycleId },
        staff,
        '2026-10-01T12:00:00Z',
      );
      return { customer, enrollmentId, cycleId };
    }

    it('RN-VAL-02: a cycle past its date shows 0 of N with the current rules, and nothing is erased', async () => {
      const { customer, cycleId } = await withCycle('2026-11-10T02:59:59Z');
      const { items } = (await getList(customer.token)).body;
      expect(items[0].progress).toEqual({
        current: 0,
        required: 12,
        cycleNumber: 4,
        expiresAt: null,
      });
      const cycle = await t.admin.query(`SELECT status FROM cycles WHERE id = $1`, [cycleId]);
      expect(cycle.rows[0].status).toBe('open');
      const stamps = await t.admin.query(
        `SELECT count(*)::int AS n FROM stamps WHERE cycle_id = $1`,
        [cycleId],
      );
      expect(stamps.rows[0].n).toBe(1);
    });

    it('the cycle is alive until the last moment of its day and lapses right after', async () => {
      const { customer } = await withCycle('2026-11-10T15:00:00Z');
      clock.set('2026-11-10T15:00:00Z');
      expect((await getList(customer.token)).body.items[0].progress.current).toBe(1);
      clock.set('2026-11-10T15:00:01Z');
      const { items } = (await getList(customer.token)).body;
      expect(items[0].progress).toMatchObject({ current: 0, expiresAt: null });
    });

    it('a cycle with time left is shown as it is', async () => {
      const { customer } = await withCycle('2026-11-30T02:59:59Z');
      const { items } = (await getList(customer.token)).body;
      expect(items[0].progress).toEqual({
        current: 1,
        required: 10,
        cycleNumber: 3,
        expiresAt: '2026-11-30T02:59:59.000Z',
      });
    });

    it('a cycle that was stored as expired shows 0 of N too, and the next number', async () => {
      const customer = await newCustomer();
      const business = await newBusiness();
      const program = await newProgram(business.id, { required: 7 });
      const enrollmentId = await enroll(business.id, customer.id, program);
      await addCycle(business.id, enrollmentId, {
        number: 1,
        status: 'expired',
        lastStampAt: '2026-09-01T12:00:00Z',
        expiresAt: '2026-10-01T02:59:59Z',
        expiredAt: '2026-10-01T02:59:59Z',
      });
      const { items } = (await getList(customer.token)).body;
      expect(items[0].progress).toEqual({
        current: 0,
        required: 7,
        cycleNumber: 2,
        expiresAt: null,
      });
    });
  });

  describe('prizes (RN-PRE-01 to RN-PRE-06)', () => {
    it('lists the available prizes, the one that expires first on top', async () => {
      const customer = await newCustomer();
      const business = await newBusiness();
      const program = await newProgram(business.id);
      const enrollmentId = await enroll(business.id, customer.id, program);
      const s = { businessId: business.id, enrollmentId, customerId: customer.id };
      const late = await addCycle(business.id, enrollmentId, {
        number: 1,
        status: 'completed',
        completedAt: '2026-10-20T12:00:00Z',
      });
      const soon = await addCycle(business.id, enrollmentId, {
        number: 2,
        status: 'completed',
        completedAt: '2026-10-25T12:00:00Z',
      });
      await addPrize(s, late, { expiresAt: '2026-11-25T02:59:59Z' });
      const soonPrize = await addPrize(s, soon, { expiresAt: '2026-11-12T02:59:59Z' });

      const { items } = (await getList(customer.token)).body;
      expect(items[0].availableRedemptions).toHaveLength(2);
      expect(items[0].availableRedemptions[0]).toEqual({
        id: soonPrize,
        rewardDescription: '1 corte grátis',
        expiresAt: '2026-11-12T02:59:59.000Z',
      });
      // A completed cycle leaves no open cycle: the card starts again at 0 (RN-PRE-06).
      expect(items[0].progress).toMatchObject({ current: 0, cycleNumber: 3 });
    });

    it('does not list a prize that expired, was redeemed or was canceled', async () => {
      const customer = await newCustomer();
      const business = await newBusiness();
      const program = await newProgram(business.id);
      const enrollmentId = await enroll(business.id, customer.id, program);
      const s = { businessId: business.id, enrollmentId, customerId: customer.id };
      const cycle = (number: number) =>
        addCycle(business.id, enrollmentId, { number, status: 'completed' });
      await addPrize(s, await cycle(1), { expiresAt: '2026-11-09T02:59:59Z' }); // lapsed, still stored as available
      await addPrize(s, await cycle(2), { status: 'expired', expiresAt: '2026-11-01T02:59:59Z' });
      await addPrize(s, await cycle(3), { status: 'redeemed', expiresAt: '2026-11-20T02:59:59Z' });
      await addPrize(s, await cycle(4), { status: 'canceled', expiresAt: '2026-11-20T02:59:59Z' });
      const { items } = (await getList(customer.token)).body;
      expect(items[0].availableRedemptions).toEqual([]);
    });

    it('a prize is available until its expiry moment, not a second more', async () => {
      const customer = await newCustomer();
      const business = await newBusiness();
      const program = await newProgram(business.id);
      const enrollmentId = await enroll(business.id, customer.id, program);
      const cycle = await addCycle(business.id, enrollmentId, { status: 'completed' });
      await addPrize({ businessId: business.id, enrollmentId, customerId: customer.id }, cycle, {
        expiresAt: '2026-11-10T15:00:00Z',
      });
      expect((await getList(customer.token)).body.items[0].availableRedemptions).toHaveLength(1);
      clock.advanceSeconds(1);
      const response = await getList(await tokens.sign(customer.id).then((r) => r.token));
      expect(response.body.items[0].availableRedemptions).toHaveLength(0);
    });
  });

  describe('which cards show (RN-CAR-06)', () => {
    it('an archived card leaves the list', async () => {
      const customer = await newCustomer();
      const business = await newBusiness();
      const program = await newProgram(business.id, { status: 'archived' });
      await enroll(business.id, customer.id, program);
      expect((await getList(customer.token)).body.items).toEqual([]);
    });

    it('an archived card with a prize to redeem stays until the prize expires', async () => {
      const customer = await newCustomer();
      const business = await newBusiness();
      const program = await newProgram(business.id, { status: 'archived' });
      const enrollmentId = await enroll(business.id, customer.id, program);
      const cycle = await addCycle(business.id, enrollmentId, { status: 'completed' });
      await addPrize({ businessId: business.id, enrollmentId, customerId: customer.id }, cycle, {
        expiresAt: '2026-11-12T02:59:59Z',
      });
      expect((await getList(customer.token)).body.items).toHaveLength(1);
      clock.set('2026-11-13T00:00:00Z');
      const fresh = await tokens.sign(customer.id);
      expect((await getList(fresh.token)).body.items).toEqual([]);
    });

    it('an enrollment that is archived does not show', async () => {
      const customer = await newCustomer();
      const business = await newBusiness();
      const program = await newProgram(business.id);
      await enroll(business.id, customer.id, program, { status: 'archived' });
      expect((await getList(customer.token)).body.items).toEqual([]);
    });
  });

  it('puts the card with the most recent activity first', async () => {
    const customer = await newCustomer();
    const business = await newBusiness();
    const old = await newProgram(business.id, { name: 'Antiga' });
    const recent = await newProgram(business.id, { name: 'Recente' });
    const fresh = await newProgram(business.id, { name: 'Sem visita' });
    await enroll(business.id, customer.id, old, { lastStampAt: '2026-10-05T12:00:00Z' });
    await enroll(business.id, customer.id, recent, { lastStampAt: '2026-11-08T12:00:00Z' });
    await enroll(business.id, customer.id, fresh, { createdAt: '2026-10-20T12:00:00Z' });
    const names = (await getList(customer.token)).body.items.map(
      (i: { program: { name: string } }) => i.program.name,
    );
    expect(names).toEqual(['Recente', 'Sem visita', 'Antiga']);
  });

  it('category can be empty', async () => {
    const customer = await newCustomer();
    const business = await newBusiness('sem-categoria', null);
    const program = await newProgram(business.id);
    await enroll(business.id, customer.id, program);
    expect((await getList(customer.token)).body.items[0].business.category).toBeNull();
  });

  it('golden rule 1: a customer never sees the cards of another one', async () => {
    const a = await newCustomer();
    const b = await newCustomer();
    const business = await newBusiness();
    const program = await newProgram(business.id);
    const theirs = await enroll(business.id, a.id, program);
    await enroll(business.id, b.id, program);
    const seenByA = (await getList(a.token)).body.items.map((i: { id: string }) => i.id);
    expect(seenByA).toEqual([theirs]);
  });
});

describe('GET /customer/enrollments/:id', () => {
  async function card() {
    const customer = await newCustomer();
    const business = await newBusiness(`detalhe-${++counter}`);
    const rafael = await newStaff(business.id, 'Rafael Souza Lima');
    const bia = await newStaff(business.id, 'Bia');
    const program = await newProgram(business.id, { required: 10 });
    const enrollmentId = await enroll(business.id, customer.id, program, {
      lastStampAt: '2026-11-08T12:00:00Z',
    });
    return { customer, business, rafael, bia, program, enrollmentId };
  }

  it('RN-PRE-08: visits of the cycle, newest first, with the first name only and no reason', async () => {
    const { customer, business, rafael, bia, enrollmentId } = await card();
    const cycleId = await addCycle(business.id, enrollmentId, {
      number: 2,
      lastStampAt: '2026-11-08T12:00:00Z',
      expiresAt: '2026-12-08T02:59:59Z',
    });
    const ctx = { businessId: business.id, enrollmentId, customerId: customer.id, cycleId };
    await addStamp(ctx, rafael, '2026-11-01T12:00:00Z');
    const undone = await addStamp(ctx, bia, '2026-11-05T12:00:00Z');
    await addStamp(ctx, rafael, '2026-11-08T12:00:00Z');
    await reverseStamp(ctx, rafael, undone, '2026-11-05T13:00:00Z');

    const response = await getOne(customer.token, enrollmentId);
    expect(response.status).toBe(200);
    expect(response.body.stamps).toEqual([
      {
        number: 3,
        createdAt: '2026-11-08T12:00:00.000Z',
        staffFirstName: 'Rafael',
        reversed: false,
      },
      { number: 2, createdAt: '2026-11-05T12:00:00.000Z', staffFirstName: 'Bia', reversed: true },
      {
        number: 1,
        createdAt: '2026-11-01T12:00:00.000Z',
        staffFirstName: 'Rafael',
        reversed: false,
      },
    ]);
    expect(response.body.progress).toMatchObject({ current: 2, cycleNumber: 2 });
    const text = JSON.stringify(response.body);
    expect(text).not.toContain('Souza');
    expect(text).not.toContain('segredo.test');
    expect(text).not.toContain('desfazer');
    expect(text).not.toContain('reason');
  });

  it('has the same fields as the list item', async () => {
    const { customer, enrollmentId } = await card();
    const item = (await getList(customer.token)).body.items[0];
    const detail = (await getOne(customer.token, enrollmentId)).body;
    expect(detail).toMatchObject(item);
    expect(Object.keys(detail).sort()).toEqual(
      [...Object.keys(item), 'stamps', 'redemptions', 'pastCycles'].sort(),
    );
  });

  it('shows all the prizes with the status as of now, and the past cycles', async () => {
    const { customer, business, rafael, enrollmentId } = await card();
    const s = { businessId: business.id, enrollmentId, customerId: customer.id };
    const done = await addCycle(business.id, enrollmentId, {
      number: 1,
      status: 'completed',
      required: 3,
      startedAt: '2026-09-01T12:00:00Z',
      completedAt: '2026-09-20T12:00:00Z',
      lastStampAt: '2026-09-20T12:00:00Z',
      expiresAt: '2026-10-20T02:59:59Z',
    });
    for (const day of ['01', '10', '20']) {
      await addStamp({ ...s, cycleId: done }, rafael, `2026-09-${day}T12:00:00Z`);
    }
    const stored = await addCycle(business.id, enrollmentId, {
      number: 2,
      status: 'expired',
      startedAt: '2026-10-01T12:00:00Z',
      lastStampAt: '2026-10-02T12:00:00Z',
      expiresAt: '2026-11-01T02:59:59Z',
      expiredAt: '2026-11-01T02:59:59Z',
    });
    await addStamp({ ...s, cycleId: stored }, rafael, '2026-10-02T12:00:00Z');
    const lapsed = await addCycle(business.id, enrollmentId, {
      number: 3,
      startedAt: '2026-10-20T12:00:00Z',
      lastStampAt: '2026-10-21T12:00:00Z',
      expiresAt: '2026-11-09T02:59:59Z',
    });
    const old = await addStamp({ ...s, cycleId: lapsed }, rafael, '2026-10-21T12:00:00Z');
    await addStamp({ ...s, cycleId: lapsed }, rafael, '2026-10-22T12:00:00Z');
    await reverseStamp({ ...s, cycleId: lapsed }, rafael, old, '2026-10-21T13:00:00Z');
    await addPrize(s, done, {
      expiresAt: '2026-10-20T02:59:59Z',
      earnedAt: '2026-09-20T12:00:00Z',
    });

    const response = (await getOne(customer.token, enrollmentId)).body;
    expect(response.stamps).toEqual([]); // the open cycle lapsed: nothing to show for it
    expect(response.progress).toMatchObject({ current: 0, cycleNumber: 4 });
    expect(response.redemptions).toEqual([
      {
        id: expect.any(String),
        rewardDescription: '1 corte grátis',
        status: 'expired',
        earnedAt: '2026-09-20T12:00:00.000Z',
        expiresAt: '2026-10-20T02:59:59.000Z',
        redeemedAt: null,
      },
    ]);
    expect(response.pastCycles).toEqual([
      {
        number: 3,
        status: 'expired',
        stampsRequired: 10,
        stamps: 1,
        startedAt: '2026-10-20T12:00:00.000Z',
        completedAt: null,
        expiredAt: '2026-11-09T02:59:59.000Z',
      },
      {
        number: 2,
        status: 'expired',
        stampsRequired: 10,
        stamps: 1,
        startedAt: '2026-10-01T12:00:00.000Z',
        completedAt: null,
        expiredAt: '2026-11-01T02:59:59.000Z',
      },
      {
        number: 1,
        status: 'completed',
        stampsRequired: 3,
        stamps: 3,
        startedAt: '2026-09-01T12:00:00.000Z',
        completedAt: '2026-09-20T12:00:00.000Z',
        expiredAt: null,
      },
    ]);
  });

  it('golden rule 1: the card of somebody else, a missing card and a bad id are all NOT_FOUND', async () => {
    const { customer, enrollmentId } = await card();
    const stranger = await newCustomer();
    for (const id of [enrollmentId, randomUUID(), 'abc', '123']) {
      const response = await getOne(stranger.token, id);
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    }
    expect((await getOne(customer.token, enrollmentId)).status).toBe(200);
  });

  it('an archived program without a prize is NOT_FOUND, like in the list', async () => {
    const customer = await newCustomer();
    const business = await newBusiness();
    const program = await newProgram(business.id, { status: 'archived' });
    const enrollmentId = await enroll(business.id, customer.id, program);
    expect((await getOne(customer.token, enrollmentId)).status).toBe(404);
  });
});

describe('GET /public/businesses/:slug (RN-ENT-02)', () => {
  it('shows the name and the active cards, with no sign-in, and may be cached', async () => {
    const business = await newBusiness('publica');
    const first = await newProgram(business.id, { name: 'Corte', required: 10 });
    const second = await newProgram(business.id, { name: 'Barba', required: 6 });
    await newProgram(business.id, { name: 'Antigo', status: 'archived' });
    // A customer, a staff member and a stamp exist; none of them may leak.
    const customer = await newCustomer();
    await enroll(business.id, customer.id, first);
    await newStaff(business.id, 'Rafael Souza');

    const response = await http().get('/v1/public/businesses/publica');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=300');
    expect(response.body).toEqual({
      name: 'Negócio publica',
      slug: 'publica',
      programs: [
        { id: first, name: 'Corte', stampsRequired: 10, rewardDescription: '1 corte grátis' },
        { id: second, name: 'Barba', stampsRequired: 6, rewardDescription: '1 corte grátis' },
      ],
    });
    const text = JSON.stringify(response.body);
    expect(text).not.toContain('Rafael');
    expect(text).not.toContain('Maria');
  });

  it.each(['nao-existe', 'UPPER', '-x'])('the slug %j is NOT_FOUND', async (slug) => {
    const response = await http().get(`/v1/public/businesses/${slug}`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('OpenAPI', () => {
  it('describes the new routes', async () => {
    const { body } = await http().get('/docs-json');
    expect(Object.keys(body.paths)).toEqual(
      expect.arrayContaining([
        '/v1/customer/enrollments',
        '/v1/customer/enrollments/{id}',
        '/v1/customer/businesses/{slug}/join',
        '/v1/public/businesses/{slug}',
      ]),
    );
  });
});
