import { createHmac, randomInt } from 'node:crypto';
import { OTP_CODE_LENGTH } from '@fregues/shared';

// Limits of the SMS code (docs/BUSINESS_RULES.md, RN-AUT-02 and RN-AUT-03).

/** The code is valid for 5 minutes (RN-AUT-02). */
export const OTP_TTL_SECONDS = 5 * 60;
/** How long the app waits before offering a new code. Told to the app; not enforced here. */
export const OTP_RETRY_AFTER_SECONDS = 60;
/** At most 3 codes per hour for each number (RN-AUT-03). */
export const OTP_MAX_REQUESTS_PER_PHONE = 3;
/** At most 20 requests per hour for each IP address (RN-AUT-03, [Premissa] for the value). */
export const OTP_MAX_REQUESTS_PER_IP = 20;
export const OTP_REQUEST_WINDOW_SECONDS = 60 * 60;

/** A random code of 6 digits, with leading zeros kept. */
export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_CODE_LENGTH)).padStart(OTP_CODE_LENGTH, '0');
}

/**
 * The code is kept only as a hash (golden rule 9, RN-AUT-05). A plain hash of 6 digits could be
 * undone in a blink, so it is a keyed hash that also depends on the number: the same code for
 * two numbers gives two different values, and nothing can be undone without the secret.
 */
export function hashOtpCode(secret: string, phone: string, code: string): string {
  return createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
}
