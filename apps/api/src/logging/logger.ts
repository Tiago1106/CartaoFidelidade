import { pino, type DestinationStream, type Logger } from 'pino';

// Golden rule 8: never log SMS codes, QR tokens, refresh tokens, passwords or a full phone number.
// These keys are replaced even if some code logs them by mistake, at the top level and one level in.
const SENSITIVE_KEYS = [
  'phone',
  'code',
  'otp',
  'token',
  'accessToken',
  'refreshToken',
  'qrToken',
  'password',
  'authorization',
  'cookie',
  'setCookie',
];

export const REDACTED = '[redacted]';

export const redactPaths = [
  ...SENSITIVE_KEYS,
  ...SENSITIVE_KEYS.map((key) => `*.${key}`),
  'req.headers.authorization',
  'req.headers.cookie',
];

/** `+5511900000000` becomes `+55 ** *****-0000`: enough to tell two numbers apart, no more. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `+55 ** *****-${digits.slice(-4)}`;
}

export function createLogger(
  options: { level?: string; destination?: DestinationStream } = {},
): Logger {
  return pino(
    {
      level: options.level ?? 'info',
      redact: { paths: redactPaths, censor: REDACTED },
    },
    options.destination,
  );
}
