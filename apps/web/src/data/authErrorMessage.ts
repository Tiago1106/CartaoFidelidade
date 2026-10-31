import { messages } from '@/messages/pt-BR';
import { ApiError } from './errors';

/** User-facing text for an error of the sign-in (docs/API.md, error codes). */
export function authErrorMessage(error: unknown): string {
  const text = messages.signIn.errors;
  if (!(error instanceof ApiError)) return text.generic;
  switch (error.code) {
    case 'PHONE_NOT_SUPPORTED':
      return text.phoneNotSupported;
    case 'RATE_LIMITED':
      return text.rateLimited;
    case 'OTP_INVALID':
      return text.otpInvalid;
    case 'OTP_EXPIRED':
      return text.otpExpired;
    case 'OTP_LOCKED':
      return text.otpLocked;
    default:
      return text.generic;
  }
}
