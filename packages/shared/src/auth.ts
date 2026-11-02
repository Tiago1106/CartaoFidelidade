import { z } from 'zod';

// Request and response of the customer sign-in (docs/API.md, section 4). The API validates with
// these schemas and the web app imports the same types.

/** A Brazilian mobile in E.164: +55, a 2 digit area code (11 to 99), the leading 9 and 8 digits. */
export const BRAZILIAN_MOBILE_E164 = /^\+55[1-9][1-9]9\d{8}$/;

export function isBrazilianMobileE164(value: string): boolean {
  return BRAZILIAN_MOBILE_E164.test(value);
}

/** The code of the SMS has 6 digits (RN-AUT-01). */
export const OTP_CODE_LENGTH = 6;

/** `POST /v1/customer/auth/otp/request`. The format of the number is checked by the rule, which answers `PHONE_NOT_SUPPORTED`. */
export const otpRequestSchema = z.object({
  phone: z.string().max(32),
});
export type OtpRequest = z.infer<typeof otpRequestSchema>;

/** Answer of `otp/request` (`202`): how long the app waits before offering a new code. */
export interface OtpRequestResponse {
  retryAfterSeconds: number;
}
