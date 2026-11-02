import type { Env } from '../config/env';
import { ConsoleOtpSender } from './console-otp-sender';
import type { OtpSender } from './otp-sender';

/** Picks the provider named in `SMS_PROVIDER`. In development, with none named, it is the console. */
export function createOtpSender(env: Pick<Env, 'NODE_ENV' | 'SMS_PROVIDER'>): OtpSender {
  const provider = env.SMS_PROVIDER ?? (env.NODE_ENV === 'development' ? 'console' : undefined);
  if (provider === 'console') return new ConsoleOtpSender(env.NODE_ENV);
  throw new Error('SMS_PROVIDER is not set: there is no way to send the code.');
}
