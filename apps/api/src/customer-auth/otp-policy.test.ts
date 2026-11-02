import { describe, expect, it } from 'vitest';
import { generateOtpCode, hashOtpCode } from './otp-policy';

describe('generateOtpCode (RN-AUT-01)', () => {
  it('always has 6 digits, with leading zeros kept', () => {
    for (let i = 0; i < 2000; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it('is not always the same', () => {
    const codes = new Set(Array.from({ length: 50 }, generateOtpCode));
    expect(codes.size).toBeGreaterThan(40);
  });
});

describe('hashOtpCode (golden rule 9, RN-AUT-05)', () => {
  const secret = 'a-secret-of-at-least-16-chars';

  it('is the same for the same secret, number and code', () => {
    expect(hashOtpCode(secret, '+5511900000000', '123456')).toBe(
      hashOtpCode(secret, '+5511900000000', '123456'),
    );
  });

  it('does not contain the code', () => {
    expect(hashOtpCode(secret, '+5511900000000', '123456')).not.toContain('123456');
    expect(hashOtpCode(secret, '+5511900000000', '123456')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes with the code, the number and the secret', () => {
    const base = hashOtpCode(secret, '+5511900000000', '123456');
    expect(hashOtpCode(secret, '+5511900000000', '123457')).not.toBe(base);
    expect(hashOtpCode(secret, '+5511900000001', '123456')).not.toBe(base);
    expect(hashOtpCode('another-secret-16-chars', '+5511900000000', '123456')).not.toBe(base);
  });
});
