/** Error codes of the customer sign-in (docs/API.md, sections 1 and 4). */
export type AuthErrorCode =
  'PHONE_NOT_SUPPORTED' | 'RATE_LIMITED' | 'OTP_INVALID' | 'OTP_EXPIRED' | 'OTP_LOCKED';

/** Same shape as the API error: a code and, for some, details. */
export class ApiError<Code extends string = string> extends Error {
  readonly code: Code;
  readonly details: Record<string, number>;

  constructor(code: Code, details: Record<string, number> = {}) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}
