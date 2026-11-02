import { describe, expect, it } from 'vitest';
import { isBrazilianMobileE164, otpRequestSchema } from './auth';

describe('isBrazilianMobileE164 (RN-AUT-01)', () => {
  it.each(['+5511900000000', '+5521987654321', '+5585999998888'])('accepts %s', (phone) => {
    expect(isBrazilianMobileE164(phone)).toBe(true);
  });

  it.each([
    '+14155550100', // not +55
    '11900000000', // no +55
    '+5511800000000', // not a mobile: no leading 9
    '+551190000000', // too short
    '+55119000000000', // too long
    '+5501900000000', // area code starting with 0
    '+5511 90000-0000', // formatted
    '',
  ])('refuses %j', (phone) => {
    expect(isBrazilianMobileE164(phone)).toBe(false);
  });
});

describe('otpRequestSchema', () => {
  it('needs a text phone', () => {
    expect(otpRequestSchema.safeParse({ phone: '+5511900000000' }).success).toBe(true);
    expect(otpRequestSchema.safeParse({}).success).toBe(false);
    expect(otpRequestSchema.safeParse({ phone: 5511900000000 }).success).toBe(false);
  });
});
