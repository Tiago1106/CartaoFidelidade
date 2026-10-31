import { isValidMobile } from '@/lib/phone';
import { systemClock, type Clock } from '@/lib/clock';
import { customerMe } from './fixtures/customer';
import { fakeRequest } from './fakeRequest';
import { ApiError, type AuthErrorCode } from './errors';

// Simulated customer sign-in (Phase B, decision D-008). There is no SMS yet, so the code is
// generated here, per number, and printed in the browser console (development only).
// It follows the rules of the real one, so the screens already handle every case:
//   RN-AUT-01  only +55 mobile numbers
//   RN-AUT-02  the code is valid for 5 minutes and works once; 5 wrong attempts invalidate it
//              and lock the number for 15 minutes
//   RN-AUT-03  3 code requests per hour per number
//   RN-AUT-05  the answer to a request is the same for a new and for an existing number
// Phase C replaces `requestOtp` and `verifyOtp` with calls to `/v1/customer/auth/otp/*`.

export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_RETRY_AFTER_SECONDS = 60;
export const OTP_MAX_REQUESTS = 3;
export const OTP_REQUEST_WINDOW_SECONDS = 60 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LOCK_SECONDS = 15 * 60;

interface IssuedCode {
  code: string;
  expiresAt: number;
  attempts: number;
  used: boolean;
}

interface PhoneState {
  issued?: IssuedCode;
  /** When each code was requested, for the limit of 3 per hour. */
  requests: number[];
  lockedUntil: number;
}

type Announce = (phone: string, code: string, expiresAt: number) => void;

interface Config {
  clock: Clock;
  generateCode: () => string;
  /** Where the code goes in place of an SMS. */
  announce: Announce;
}

function randomCode(): string {
  const [value] = crypto.getRandomValues(new Uint32Array(1)) as Uint32Array;
  return String((value ?? 0) % 1_000_000).padStart(6, '0');
}

/**
 * In place of an SMS, prints the code in the browser console of `pnpm dev`. Never in a
 * production build, and never in the real API: codes are not logged (golden rule 8).
 */
const consoleAnnounce: Announce = (phone, code, expiresAt) => {
  if (!import.meta.env.DEV || import.meta.env.MODE === 'test') return;
  const until = new Date(expiresAt).toLocaleTimeString('pt-BR');
  console.info(
    `[OTP simulado] ${phone} -> ${code} (vale ${OTP_TTL_SECONDS / 60} min, até ${until})`,
  );
};

const defaults = (): Config => ({
  clock: systemClock,
  generateCode: randomCode,
  announce: consoleAnnounce,
});

let config: Config = defaults();
const phones = new Map<string, PhoneState>();

/** For tests: replaces the clock, the code generator or where the code is announced. */
export function configureSimulatedAuth(options: Partial<Config>) {
  config = { ...config, ...options };
}

/** For tests: forgets every number and goes back to the default clock and generator. */
export function resetSimulatedAuth() {
  phones.clear();
  config = defaults();
}

function stateOf(phone: string): PhoneState {
  let state = phones.get(phone);
  if (!state) {
    state = { requests: [], lockedUntil: 0 };
    phones.set(phone, state);
  }
  return state;
}

function isSupported(phone: string): boolean {
  return /^\+55\d{11}$/.test(phone) && isValidMobile(phone.slice(3));
}

/** Throws `OTP_LOCKED` while the number is locked, and forgets the lock once it is over. */
function assertNotLocked(state: PhoneState, now: number) {
  if (state.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((state.lockedUntil - now) / 1000);
    throw new ApiError<AuthErrorCode>('OTP_LOCKED', { retryAfterSeconds });
  }
}

/** `POST /v1/customer/auth/otp/request` */
export async function requestOtp(phone: string): Promise<{ retryAfterSeconds: number }> {
  await fakeRequest(null);
  if (!isSupported(phone)) throw new ApiError('PHONE_NOT_SUPPORTED');

  const now = config.clock.now();
  const state = stateOf(phone);
  assertNotLocked(state, now);

  const windowStart = now - OTP_REQUEST_WINDOW_SECONDS * 1000;
  state.requests = state.requests.filter((at) => at > windowStart);
  if (state.requests.length >= OTP_MAX_REQUESTS) throw new ApiError('RATE_LIMITED');
  state.requests.push(now);

  // A new code replaces the previous one, which stops working (RN-AUT-02).
  const code = config.generateCode();
  const expiresAt = now + OTP_TTL_SECONDS * 1000;
  state.issued = { code, expiresAt, attempts: 0, used: false };
  config.announce(phone, code, expiresAt);

  return { retryAfterSeconds: OTP_RETRY_AFTER_SECONDS };
}

export interface VerifyResult {
  expiresIn: number;
  customer: {
    id: string;
    phone: string;
    name: string | null;
    email: string | null;
    profileComplete: boolean;
  };
}

/** `POST /v1/customer/auth/otp/verify` */
export async function verifyOtp(phone: string, code: string): Promise<VerifyResult> {
  await fakeRequest(null);
  const now = config.clock.now();
  const state = stateOf(phone);
  assertNotLocked(state, now);

  const issued = state.issued;
  // No code, a used one, an invalidated one or an old one: all the same answer (API.md).
  if (!issued || issued.used || issued.expiresAt <= now) throw new ApiError('OTP_EXPIRED');

  if (code !== issued.code) {
    issued.attempts += 1;
    if (issued.attempts >= OTP_MAX_ATTEMPTS) {
      state.issued = undefined;
      state.lockedUntil = now + OTP_LOCK_SECONDS * 1000;
      throw new ApiError('OTP_LOCKED', { retryAfterSeconds: OTP_LOCK_SECONDS });
    }
    throw new ApiError('OTP_INVALID', { attemptsLeft: OTP_MAX_ATTEMPTS - issued.attempts });
  }

  issued.used = true;

  // The number of the design is the existing account. Any other number is a new account.
  const existing = phone === customerMe.phone;
  return {
    expiresIn: 900,
    customer: existing
      ? { ...customerMe, profileComplete: true }
      : { id: 'cus_new', phone, name: null, email: null, profileComplete: false },
  };
}
