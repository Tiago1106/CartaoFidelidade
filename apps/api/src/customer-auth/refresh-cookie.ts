import type { Request, Response } from 'express';

// The refresh token travels in a cookie that scripts cannot read (`HttpOnly`) and that is only
// sent to the sign-in routes of the customer (`Path`), as in docs/API.md section 1.

export const REFRESH_COOKIE = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/v1/customer/auth';

/** The token of the cookie, or `undefined`. Written by hand: one cookie does not need a library. */
export function readRefreshCookie(request: Request): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === REFRESH_COOKIE) {
      const token = value.join('=');
      return token.length > 0 ? decodeURIComponent(token) : undefined;
    }
  }
  return undefined;
}

export function setRefreshCookie(
  response: Response,
  token: string,
  options: { maxAgeSeconds: number; secure: boolean },
) {
  response.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: options.secure,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: options.maxAgeSeconds * 1000,
  });
}

export function clearRefreshCookie(response: Response, options: { secure: boolean }) {
  response.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: options.secure,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  });
}
