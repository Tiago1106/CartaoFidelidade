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

/**
 * `POST /v1/customer/auth/otp/verify`. The code must be 6 digits: anything else is a
 * `VALIDATION_ERROR` and does not count as a wrong attempt.
 */
export const otpVerifySchema = z.object({
  phone: z.string().max(32),
  code: z.string().regex(new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`)),
});
export type OtpVerify = z.infer<typeof otpVerifySchema>;

/** The customer as the sign-in answers it. */
export interface AuthCustomer {
  id: string;
  phone: string;
  /** `null` until the first access is done (RN-ENT-07). */
  name: string | null;
  email: string | null;
  /** `false` takes the app to the first access screen. */
  profileComplete: boolean;
}

/** Answer of `otp/verify` and of `refresh` (`200`). The refresh token goes in a cookie, not here. */
export interface AuthSessionResponse {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  customer: AuthCustomer;
}
