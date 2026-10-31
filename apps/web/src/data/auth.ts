import { customerMe } from './fixtures/customer';
import { fakeRequest } from './fakeRequest';
import { ApiError, type AuthErrorCode } from './errors';
import { isValidMobile } from '@/lib/phone';

// Simulated customer sign-in (Phase B, decision D-008). It follows the rules of the real one,
// so the screens already handle every case:
//   RN-AUT-01  only +55 mobile numbers
//   RN-AUT-02  5 wrong attempts per code, then the number is locked for 15 minutes
//   RN-AUT-03  3 code requests per hour per number
//   RN-AUT-05  the answer to a request is the same for a new and for an existing number
// Phase C replaces the two functions below with calls to `/v1/customer/auth/otp/*`.

/** The code that the simulation accepts. In Phase C it arrives by SMS. */
export const DEV_OTP_CODE = '123456';

export const OTP_RETRY_AFTER_SECONDS = 60;
export const OTP_MAX_REQUESTS = 3;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LOCK_SECONDS = 15 * 60;

interface PhoneState {
  requests: number;
  attempts: number;
  locked: boolean;
}

const phones = new Map<string, PhoneState>();

function stateOf(phone: string): PhoneState {
  let state = phones.get(phone);
  if (!state) {
    state = { requests: 0, attempts: 0, locked: false };
    phones.set(phone, state);
  }
  return state;
}

/** For tests: forgets every number. */
export function resetSimulatedAuth() {
  phones.clear();
}

function isSupported(phone: string): boolean {
  return /^\+55\d{11}$/.test(phone) && isValidMobile(phone.slice(3));
}

function lockedError(): ApiError<AuthErrorCode> {
  return new ApiError('OTP_LOCKED', { retryAfterSeconds: OTP_LOCK_SECONDS });
}

/** `POST /v1/customer/auth/otp/request` */
export async function requestOtp(phone: string): Promise<{ retryAfterSeconds: number }> {
  await fakeRequest(null);
  if (!isSupported(phone)) throw new ApiError('PHONE_NOT_SUPPORTED');
  const state = stateOf(phone);
  if (state.locked) throw lockedError();
  if (state.requests >= OTP_MAX_REQUESTS) throw new ApiError('RATE_LIMITED');
  state.requests += 1;
  state.attempts = 0;
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
  const state = stateOf(phone);
  if (state.locked) throw lockedError();
  if (state.requests === 0) throw new ApiError('OTP_EXPIRED');

  if (code !== DEV_OTP_CODE) {
    state.attempts += 1;
    if (state.attempts >= OTP_MAX_ATTEMPTS) {
      state.locked = true;
      throw lockedError();
    }
    throw new ApiError('OTP_INVALID', { attemptsLeft: OTP_MAX_ATTEMPTS - state.attempts });
  }

  // The number of the design is the existing account. Any other number is a new account.
  const existing = phone === customerMe.phone;
  return {
    expiresIn: 900,
    customer: existing
      ? { ...customerMe, profileComplete: true }
      : { id: 'cus_new', phone, name: null, email: null, profileComplete: false },
  };
}
