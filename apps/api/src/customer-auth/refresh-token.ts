import { createHash, randomBytes } from 'node:crypto';

// The refresh token is a random string of 32 bytes. It has plenty of entropy, so a plain SHA-256
// is enough to keep it (golden rule 9): the database never holds a token that could be used.

export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
