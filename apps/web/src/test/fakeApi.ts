import { vi } from 'vitest';
import { tokenStore } from '@/api/client';

// A stand-in for the API in the tests of the web app: it speaks the same HTTP (paths, statuses,
// error format, refresh cookie) as `docs/API.md` sections 1, 4 and 5 for the sign in and the
// profile, so the real client and the real screens run against it. The rules themselves (limits,
// lock, rotation) are proved against the real API in `apps/api`; this keeps the ones the screens
// show. Install it with `installFakeApi()`; `test/setup.ts` does so before every test.

export const EXISTING_PHONE = '+5511900000000';
export const CODE = '482913';

const MOBILE = /^\+55[1-9][1-9]9\d{8}$/;
const OTP_TTL_MS = 5 * 60_000;
const LOCK_MS = 15 * 60_000;
const HOUR_MS = 60 * 60_000;

interface PhoneState {
  code?: { value: string; expiresAt: number; attempts: number; used: boolean };
  requests: number[];
  lockedUntil: number;
}

interface Customer {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  termsAcceptedAt: string | null;
}

export interface Call {
  method: string;
  path: string;
  body: unknown;
  authorization: string | null;
}

export interface FakeApi {
  /** Every request the app made. */
  calls: Call[];
  /** The refresh cookie the browser would hold. */
  cookie: string | null;
  /** Makes the next access tokens answer `TOKEN_EXPIRED`, as 15 minutes later would. */
  expireAccessTokens(): void;
  /** Answers `refresh` only when the returned function is called. */
  holdRefresh(): () => void;
  /** Makes every request fail as if there were no network. */
  goOffline(): void;
  /** Makes `refresh` answer 500. */
  breakServer(): void;
  /** Opens a session without going through the screens (cookie and access token). */
  openSession(options: { complete: boolean }): Customer;
  customers: Map<string, Customer>;
}

export function installFakeApi(options: { code?: string } = {}): FakeApi {
  const code = options.code ?? CODE;
  const phones = new Map<string, PhoneState>();
  const customers = new Map<string, Customer>();
  const refreshTokens = new Set<string>();
  const accessTokens = new Map<string, string>(); // token -> customer id
  const expired = new Set<string>();
  let counter = 0;
  let offline = false;
  let broken = false;
  let gate: Promise<void> | undefined;
  const sessionOf = new Map<string, string>(); // refresh token -> customer id

  customers.set(EXISTING_PHONE, {
    id: 'cus_maria',
    phone: EXISTING_PHONE,
    name: 'Maria',
    email: null,
    termsAcceptedAt: '2026-06-24T12:30:00.000Z',
  });

  const fake: FakeApi = {
    calls: [],
    cookie: null,
    customers,
    expireAccessTokens: () => {
      for (const token of accessTokens.keys()) expired.add(token);
    },
    holdRefresh: () => {
      let release!: () => void;
      gate = new Promise((resolve) => (release = resolve));
      return () => {
        release();
        gate = undefined;
      };
    },
    goOffline: () => {
      offline = true;
    },
    breakServer: () => {
      broken = true;
    },
    openSession: ({ complete }) => {
      const phone = complete ? EXISTING_PHONE : `+55119${String(80000000 + ++counter)}`;
      const customer = customers.get(phone) ?? {
        id: `cus_${counter}`,
        phone,
        name: null,
        email: null,
        termsAcceptedAt: null,
      };
      customers.set(phone, customer);
      const refresh = issueRefresh(customer.id);
      fake.cookie = refresh;
      tokenStore.set(issueAccess(customer.id));
      return customer;
    },
  };

  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  const fail = (status: number, errorCode: string, details?: Record<string, unknown>) =>
    json(status, { error: { code: errorCode, message: errorCode, details, requestId: 'test' } });

  function issueAccess(customerId: string) {
    const token = `access-${++counter}`;
    accessTokens.set(token, customerId);
    return token;
  }
  function issueRefresh(customerId: string) {
    const token = `refresh-${++counter}`;
    refreshTokens.add(token);
    sessionOf.set(token, customerId);
    return token;
  }
  const profileOf = (c: Customer) => ({
    id: c.id,
    phone: c.phone,
    name: c.name,
    email: c.email,
    profileComplete: c.name !== null,
  });
  const sessionBody = (c: Customer) => ({
    accessToken: issueAccess(c.id),
    expiresIn: 900,
    customer: profileOf(c),
  });
  const stateOf = (phone: string) => {
    let state = phones.get(phone);
    if (!state) phones.set(phone, (state = { requests: [], lockedUntil: 0 }));
    return state;
  };
  const locked = (state: PhoneState, now: number) =>
    state.lockedUntil > now
      ? fail(423, 'OTP_LOCKED', { retryAfterSeconds: Math.ceil((state.lockedUntil - now) / 1000) })
      : undefined;

  /** The customer of a valid access token, or the error to answer. */
  function authenticate(authorization: string | null): Customer | Response {
    const token = /^Bearer (.+)$/.exec(authorization ?? '')?.[1];
    const id = token ? accessTokens.get(token) : undefined;
    if (!token || !id) return fail(401, 'UNAUTHENTICATED');
    if (expired.has(token)) return fail(401, 'TOKEN_EXPIRED');
    return [...customers.values()].find((c) => c.id === id) ?? fail(401, 'UNAUTHENTICATED');
  }

  async function handle(
    method: string,
    path: string,
    body: Record<string, unknown> | undefined,
    authorization: string | null,
  ) {
    const now = Date.now();
    switch (`${method} ${path}`) {
      case 'POST /v1/customer/auth/otp/request': {
        const phone = String(body?.phone ?? '');
        if (!MOBILE.test(phone)) return fail(422, 'PHONE_NOT_SUPPORTED');
        const state = stateOf(phone);
        const lock = locked(state, now);
        if (lock) return lock;
        state.requests = state.requests.filter((at) => at > now - HOUR_MS);
        if (state.requests.length >= 3)
          return fail(429, 'RATE_LIMITED', { retryAfterSeconds: 600 });
        state.requests.push(now);
        state.code = { value: code, expiresAt: now + OTP_TTL_MS, attempts: 0, used: false };
        return json(202, { retryAfterSeconds: 60 });
      }
      case 'POST /v1/customer/auth/otp/verify': {
        const phone = String(body?.phone ?? '');
        const state = stateOf(phone);
        const lock = locked(state, now);
        if (lock) return lock;
        const issued = state.code;
        if (!issued || issued.used || issued.expiresAt <= now) return fail(400, 'OTP_EXPIRED');
        if (body?.code !== issued.value) {
          issued.attempts += 1;
          if (issued.attempts >= 5) {
            state.code = undefined;
            state.lockedUntil = now + LOCK_MS;
            return fail(423, 'OTP_LOCKED', { retryAfterSeconds: LOCK_MS / 1000 });
          }
          return fail(400, 'OTP_INVALID', { attemptsLeft: 5 - issued.attempts });
        }
        issued.used = true;
        let customer = customers.get(phone);
        if (!customer) {
          customer = {
            id: `cus_${++counter}`,
            phone,
            name: null,
            email: null,
            termsAcceptedAt: null,
          };
          customers.set(phone, customer);
        }
        fake.cookie = issueRefresh(customer.id);
        return json(200, sessionBody(customer));
      }
      case 'POST /v1/customer/auth/refresh': {
        if (gate) await gate;
        if (broken) return fail(500, 'INTERNAL_ERROR');
        const token = fake.cookie;
        const id = token && refreshTokens.has(token) ? sessionOf.get(token) : undefined;
        const customer = [...customers.values()].find((c) => c.id === id);
        if (!token || !customer) {
          fake.cookie = null;
          return fail(401, 'UNAUTHENTICATED');
        }
        refreshTokens.delete(token); // rotation: the one used stops working
        fake.cookie = issueRefresh(customer.id);
        return json(200, sessionBody(customer));
      }
      case 'POST /v1/customer/auth/logout': {
        if (fake.cookie) refreshTokens.delete(fake.cookie);
        fake.cookie = null;
        return json(204, null);
      }
      case 'GET /v1/customer/me':
      case 'PATCH /v1/customer/me': {
        const customer = authenticate(authorization);
        if (customer instanceof Response) return customer;
        if (method === 'PATCH') {
          if (typeof body?.name === 'string') customer.name = body.name;
          if (body?.acceptTerms === true) customer.termsAcceptedAt ??= new Date(now).toISOString();
        }
        return json(200, { ...profileOf(customer), termsAcceptedAt: customer.termsAcceptedAt });
      }
      default:
        return fail(404, 'NOT_FOUND');
    }
  }

  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
      if (offline) throw new TypeError('Failed to fetch');
      const path = String(input);
      const method = init.method ?? 'GET';
      const headers = new Headers(init.headers);
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      fake.calls.push({ method, path, body, authorization: headers.get('Authorization') });
      return handle(method, path, body, headers.get('Authorization'));
    },
  );
  return fake;
}

let current: FakeApi | undefined;

/** The fake of the test that is running (installed by `test/setup.ts`). */
export function fakeApi(): FakeApi {
  if (!current) throw new Error('The fake API is not installed.');
  return current;
}

export function resetFakeApi(options: { code?: string } = {}): FakeApi {
  tokenStore.clear();
  current = installFakeApi(options);
  return current;
}
