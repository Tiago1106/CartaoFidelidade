import { errorMessages } from '../messages/pt-BR';

/** HTTP status of each error code (docs/API.md, section 2). `INTERNAL_ERROR` is the 500 fallback. */
export const errorStatus = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  TOKEN_EXPIRED: 401,
  FORBIDDEN_ROLE: 403,
  STAFF_INACTIVE: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  PHONE_NOT_SUPPORTED: 422,
  OTP_INVALID: 400,
  OTP_EXPIRED: 400,
  OTP_LOCKED: 423,
  INVALID_CREDENTIALS: 401,
  EMAIL_TAKEN: 409,
  INVITE_INVALID: 410,
  QR_INVALID: 400,
  QR_EXPIRED: 410,
  QR_ALREADY_USED: 409,
  SCAN_SESSION_INVALID: 410,
  CUSTOMER_NOT_FOUND: 404,
  PROGRAM_NOT_ACTIVE: 409,
  STAMP_TOO_SOON: 409,
  PRIZE_NOT_AVAILABLE: 409,
  PRIZE_EXPIRED: 410,
  REVERSAL_NOT_ALLOWED: 409,
  ALREADY_REVERSED: 409,
  PROGRAM_LIMIT_REACHED: 409,
  PROGRAM_HAS_HISTORY: 409,
  IDEMPOTENCY_CONFLICT: 409,
  BILLING_READ_ONLY: 402,
  INTERNAL_ERROR: 500,
} as const satisfies Record<keyof typeof errorMessages, number>;

export type ErrorCode = keyof typeof errorStatus;

export type ErrorDetails = Record<string, unknown>;

/**
 * The one error the rules throw. The filter turns it into the body of docs/API.md section 1.
 * `message` defaults to the Portuguese text of the code; pass one when it carries a value.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ErrorDetails;

  constructor(code: ErrorCode, options: { message?: string; details?: ErrorDetails } = {}) {
    super(options.message ?? errorMessages[code]);
    this.name = 'AppError';
    this.code = code;
    this.status = errorStatus[code];
    this.details = options.details;
  }
}
