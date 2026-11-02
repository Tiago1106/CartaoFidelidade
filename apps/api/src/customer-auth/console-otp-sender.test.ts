import { describe, expect, it } from 'vitest';
import { ConsoleOtpSender } from './console-otp-sender';
import { createOtpSender } from './otp-sender.factory';

describe('ConsoleOtpSender (decision D-022)', () => {
  it('prints the code with the number and the time it is valid until', async () => {
    const lines: string[] = [];
    const sender = new ConsoleOtpSender('development', (line) => lines.push(line));
    await sender.send({
      phone: '+5511900000000',
      code: '482913',
      expiresAt: new Date('2026-11-01T17:32:10Z'),
    });
    expect(lines).toEqual(['[OTP simulado] +5511900000000 -> 482913 (vale 5 min, até 14:32:10)']);
  });

  it.each(['production', 'test'])('refuses to exist when NODE_ENV is %s', (nodeEnv) => {
    expect(() => new ConsoleOtpSender(nodeEnv)).toThrow(/only runs in development/);
  });
});

describe('createOtpSender', () => {
  it('uses the console in development when no provider is named', () => {
    expect(createOtpSender({ NODE_ENV: 'development', SMS_PROVIDER: undefined }).name).toBe(
      'console',
    );
  });

  it('has no provider to fall back on outside development', () => {
    expect(() => createOtpSender({ NODE_ENV: 'production', SMS_PROVIDER: undefined })).toThrow(
      /SMS_PROVIDER is not set/,
    );
    expect(() => createOtpSender({ NODE_ENV: 'test', SMS_PROVIDER: undefined })).toThrow(
      /SMS_PROVIDER is not set/,
    );
  });

  it('the console provider is refused in production', () => {
    expect(() => createOtpSender({ NODE_ENV: 'production', SMS_PROVIDER: 'console' })).toThrow(
      /only runs in development/,
    );
  });
});
