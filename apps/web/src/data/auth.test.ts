import { beforeEach, describe, expect, it } from 'vitest';
import { DEV_OTP_CODE, OTP_LOCK_SECONDS, requestOtp, resetSimulatedAuth, verifyOtp } from './auth';
import { ApiError } from './errors';

const existing = '+5511900000000';
const stranger = '+5521987654321';

async function codeOf<T>(promise: Promise<T>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
}

beforeEach(() => resetSimulatedAuth());

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
    },
  );

  it('RN-AUT-03: allows 3 requests per number and refuses the fourth', async () => {
    await requestOtp(existing);
    await requestOtp(existing);
    await requestOtp(existing);
    expect(await codeOf(requestOtp(existing))).toBe('RATE_LIMITED');
  });

  it('RN-AUT-03: the limit is per number', async () => {
    for (let i = 0; i < 3; i++) await requestOtp(existing);
    expect(await codeOf(requestOtp(stranger))).toBeNull();
  });
});

describe('verifyOtp', () => {
  it('opens the session of the existing account, with its profile complete', async () => {
    await requestOtp(existing);
    const { customer } = await verifyOtp(existing, DEV_OTP_CODE);
    expect(customer.profileComplete).toBe(true);
    expect(customer.name).toBe('Maria');
  });

  it('RN-ENT-07: a new number creates an account that still needs a name', async () => {
    await requestOtp(stranger);
    const { customer } = await verifyOtp(stranger, DEV_OTP_CODE);
    expect(customer.profileComplete).toBe(false);
    expect(customer.name).toBeNull();
  });

  it('refuses a number that asked for no code', async () => {
    expect(await codeOf(verifyOtp(existing, DEV_OTP_CODE))).toBe('OTP_EXPIRED');
  });

  it('RN-AUT-02: a wrong code says how many attempts are left', async () => {
    await requestOtp(existing);
    try {
      await verifyOtp(existing, '000000');
      expect.unreachable();
    } catch (error) {
      expect((error as ApiError).code).toBe('OTP_INVALID');
      expect((error as ApiError).details.attemptsLeft).toBe(4);
    }
  });

  it('RN-AUT-02: the fifth wrong code locks the number for 15 minutes', async () => {
    await requestOtp(existing);
    for (let i = 0; i < 4; i++)
      expect(await codeOf(verifyOtp(existing, '000000'))).toBe('OTP_INVALID');
    try {
      await verifyOtp(existing, '000000');
      expect.unreachable();
    } catch (error) {
      expect((error as ApiError).code).toBe('OTP_LOCKED');
      expect((error as ApiError).details.retryAfterSeconds).toBe(OTP_LOCK_SECONDS);
    }
  });

  it('RN-AUT-02: a locked number refuses even the right code, and new requests', async () => {
    await requestOtp(existing);
    for (let i = 0; i < 5; i++) await codeOf(verifyOtp(existing, '000000'));
    expect(await codeOf(verifyOtp(existing, DEV_OTP_CODE))).toBe('OTP_LOCKED');
    expect(await codeOf(requestOtp(existing))).toBe('OTP_LOCKED');
  });

  it('RN-AUT-02: a new code starts the attempts again', async () => {
    await requestOtp(existing);
    await codeOf(verifyOtp(existing, '000000'));
    await codeOf(verifyOtp(existing, '000000'));
    await requestOtp(existing);
    try {
      await verifyOtp(existing, '000000');
      expect.unreachable();
    } catch (error) {
      expect((error as ApiError).details.attemptsLeft).toBe(4);
    }
  });
});
