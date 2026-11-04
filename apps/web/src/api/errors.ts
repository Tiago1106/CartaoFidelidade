/**
 * Error codes of docs/API.md section 2 that the app handles, plus `NETWORK_ERROR`, which is not
 * an answer of the API: the request never got one.
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'PHONE_NOT_SUPPORTED'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_LOCKED'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR';

/** Same shape as the error of the API: a code and, for some, details. */
export class ApiError<Code extends string = ApiErrorCode> extends Error {
  readonly code: Code;
  readonly details: Record<string, unknown>;
  /** HTTP status; 0 when there was no answer. */
  readonly status: number;

  constructor(code: Code, details: Record<string, unknown> = {}, status = 0) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}
