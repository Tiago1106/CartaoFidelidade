import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManualClock } from '@/lib/clock';
import {
  configureSimulatedAuth,
  OTP_LOCK_SECONDS,
  OTP_TTL_SECONDS,
  requestOtp,
  resetSimulatedAuth,
  verifyOtp,
} from './auth';
import { ApiError } from './errors';

const existing = '+5511900000000';
const stranger = '+5521987654321';

let clock: ManualClock;
let issued: { phone: string; code: string; expiresAt: number }[];

/** Codes the simulation will generate, in order. Then it keeps counting up. */
function codesFrom(first: number) {
  let next = first;
  return () => String(next++).padStart(6, '0');
}

async function codeOf<T>(promise: Promise<T>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
}

async function errorOf<T>(promise: Promise<T>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

beforeEach(() => {
  resetSimulatedAuth();
  clock = new ManualClock();
  issued = [];
  configureSimulatedAuth({
    clock,
    generateCode: codesFrom(100000),
    announce: (phone, code, expiresAt) => issued.push({ phone, code, expiresAt }),
  });
});

describe('requestOtp', () => {
  it('RN-AUT-05: answers the same for a new and for an existing number', async () => {
    expect(await requestOtp(existing)).toEqual(await requestOtp(stranger));
  });

  it('asks to wait 60 seconds before another code', async () => {
    expect((await requestOtp(existing)).retryAfterSeconds).toBe(60);
  });

  it.each(['+14155550100', '+5511800000000', '11900000000', '+551190000000', ''])(
    'RN-AUT-01: refuses %j',
    async (phone) => {
      expect(await codeOf(requestOtp(phone))).toBe('PHONE_NOT_SUPPORTED');
      expect(issued).toHaveLength(0);
    },
  );

  it('generates a code per request and announces it with the number and its expiry', async () => {
    await requestOtp(existing);
    expect(issued).toEqual([
      { phone: existing, code: '100000', expiresAt: clock.now() + OTP_TTL_SECONDS * 1000 },
    ]);
  });

  it('RN-AUT-02: the code is valid for 5 minutes', async () => {
    await requestOtp(existing);
    expect(issued[0]!.expiresAt - clock.now()).toBe(5 * 60 * 1000);
  });

  it('generates six digits, with leading zeros, by default', async () => {
    resetSimulatedAuth();
    const seen: string[] = [];
    configureSimulatedAuth({ clock, announce: (_phone, code) => seen.push(code) });
    for (let i = 0; i < 3; i++) {
      await requestOtp(existing);
      clock.advanceSeconds(1200);
    }
    for (let i = 0; i < 3; i++) {
      await requestOtp(stranger);
      clock.advanceSeconds(1200);
    }
    expect(seen).toHaveLength(6);
    for (const code of seen) expect(code).toMatch(/^\d{6}$/);
  });

  it('prints nothing in the console while running tests', async () => {
    resetSimulatedAuth();
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await requestOtp(existing);
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it('RN-AUT-03: allows 3 requests per hour per number and refuses the fourth', async () => {
    await requestOtp(existing);
    await requestOtp(existing);
    await requestOtp(existing);
    expect(await codeOf(requestOtp(existing))).toBe('RATE_LIMITED');
    expect(issued).toHaveLength(3);
  });

  it('RN-AUT-03: the limit is per number', async () => {
    for (let i = 0; i < 3; i++) await requestOtp(existing);
    expect(await codeOf(requestOtp(stranger))).toBeNull();
  });

  it('RN-AUT-03: after an hour the number can ask again', async () => {
    for (let i = 0; i < 3; i++) await requestOtp(existing);
    clock.advanceSeconds(60 * 60 - 1);
    expect(await codeOf(requestOtp(existing))).toBe('RATE_LIMITED');
    clock.advanceSeconds(2);
    expect(await codeOf(requestOtp(existing))).toBeNull();
  });
});

describe('verifyOtp', () => {
  it('accepts the code that was generated and opens the existing account', async () => {
    await requestOtp(existing);
    const { customer } = await verifyOtp(existing, issued[0]!.code);
    expect(customer.profileComplete).toBe(true);
    expect(customer.name).toBe('Maria');
  });

  it('RN-ENT-07: a new number creates an account that still needs a name', async () => {
    await requestOtp(stranger);
    const { customer } = await verifyOtp(stranger, issued[0]!.code);
    expect(customer.profileComplete).toBe(false);
    expect(customer.name).toBeNull();
  });

  it('the code belongs to one number: the code of another does not work', async () => {
    await requestOtp(existing);
    await requestOtp(stranger);
    expect(issued[0]!.code).not.toBe(issued[1]!.code);
    expect(await codeOf(verifyOtp(existing, issued[1]!.code))).toBe('OTP_INVALID');
    expect(await codeOf(verifyOtp(stranger, issued[1]!.code))).toBeNull();
  });

  it('refuses a number that asked for no code', async () => {
    expect(await codeOf(verifyOtp(existing, '123456'))).toBe('OTP_EXPIRED');
  });

  it('RN-AUT-02: the code works until the 5 minutes are over', async () => {
    await requestOtp(existing);
    clock.advanceSeconds(OTP_TTL_SECONDS - 1);
    expect(await codeOf(verifyOtp(existing, issued[0]!.code))).toBeNull();
  });

  it('RN-AUT-02: after 5 minutes the code has expired', async () => {
    await requestOtp(existing);
    clock.advanceSeconds(OTP_TTL_SECONDS);
    expect(await codeOf(verifyOtp(existing, issued[0]!.code))).toBe('OTP_EXPIRED');
  });

  it('RN-AUT-02: the code works only once', async () => {
    await requestOtp(existing);
    await verifyOtp(existing, issued[0]!.code);
    expect(await codeOf(verifyOtp(existing, issued[0]!.code))).toBe('OTP_EXPIRED');
  });

  it('RN-AUT-02: a new code replaces the previous one, which stops working', async () => {
    await requestOtp(existing);
    await requestOtp(existing);
    expect(await codeOf(verifyOtp(existing, issued[0]!.code))).toBe('OTP_INVALID');
    expect(await codeOf(verifyOtp(existing, issued[1]!.code))).toBeNull();
  });

  it('RN-AUT-02: a wrong code says how many attempts are left', async () => {
    await requestOtp(existing);
    const error = await errorOf(verifyOtp(existing, '000000'));
    expect(error.code).toBe('OTP_INVALID');
    expect(error.details.attemptsLeft).toBe(4);
  });

  it('RN-AUT-02: the fifth wrong code locks the number for 15 minutes', async () => {
    await requestOtp(existing);
    for (let i = 0; i < 4; i++)
      expect(await codeOf(verifyOtp(existing, '000000'))).toBe('OTP_INVALID');
    const error = await errorOf(verifyOtp(existing, '000000'));
    expect(error.code).toBe('OTP_LOCKED');
    expect(error.details.retryAfterSeconds).toBe(OTP_LOCK_SECONDS);
  });

  it('RN-AUT-02: a locked number refuses even the right code, and new requests', async () => {
    await requestOtp(existing);
    for (let i = 0; i < 5; i++) await codeOf(verifyOtp(existing, '000000'));
    expect(await codeOf(verifyOtp(existing, issued[0]!.code))).toBe('OTP_LOCKED');
    expect(await codeOf(requestOtp(existing))).toBe('OTP_LOCKED');
  });

  it('RN-AUT-02: the lock tells how long is left', async () => {
    await requestOtp(existing);
    for (let i = 0; i < 5; i++) await codeOf(verifyOtp(existing, '000000'));
    clock.advanceSeconds(10 * 60);
    const error = await errorOf(requestOtp(existing));
    expect(error.details.retryAfterSeconds).toBe(5 * 60);
  });

  it('RN-AUT-02: after 15 minutes the number is free and the old code is dead', async () => {
    await requestOtp(existing);
    for (let i = 0; i < 5; i++) await codeOf(verifyOtp(existing, '000000'));
    clock.advanceSeconds(OTP_LOCK_SECONDS);
    expect(await codeOf(verifyOtp(existing, issued[0]!.code))).toBe('OTP_EXPIRED');
    expect(await codeOf(requestOtp(existing))).toBeNull();
    expect(await codeOf(verifyOtp(existing, issued[1]!.code))).toBeNull();
  });

  it('RN-AUT-02: a new code starts the attempts again', async () => {
    await requestOtp(existing);
    await codeOf(verifyOtp(existing, '000000'));
    await codeOf(verifyOtp(existing, '000000'));
    await requestOtp(existing);
    const error = await errorOf(verifyOtp(existing, '000000'));
    expect(error.details.attemptsLeft).toBe(4);
  });
});
