import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { generateRefreshToken, hashRefreshToken } from './refresh-token';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './refresh-cookie';

const requestWith = (cookie?: string) => ({ headers: { cookie } }) as unknown as Request;

describe('readRefreshCookie', () => {
  it('finds the token among other cookies', () => {
    expect(readRefreshCookie(requestWith('a=1; refresh_token=abc_DEF-123; b=2'))).toBe(
      'abc_DEF-123',
    );
  });

  it('keeps an equals sign that belongs to the value', () => {
    expect(readRefreshCookie(requestWith('refresh_token=abc=='))).toBe('abc==');
  });

  it.each([undefined, '', 'other=1', 'refresh_token=', 'xrefresh_token=abc'])(
    'is undefined for %j',
    (cookie) => {
      expect(readRefreshCookie(requestWith(cookie))).toBeUndefined();
    },
  );
});

describe('the refresh cookie (docs/API.md section 1)', () => {
  function capture() {
    const calls: { name: string; value?: string; options: Record<string, unknown> }[] = [];
    const response = {
      cookie: (name: string, value: string, options: Record<string, unknown>) =>
        calls.push({ name, value, options }),
      clearCookie: (name: string, options: Record<string, unknown>) =>
        calls.push({ name, options }),
    } as unknown as Response;
    return { calls, response };
  }

  it('is HttpOnly, SameSite=Lax and limited to the sign-in routes of the customer', () => {
    const { calls, response } = capture();
    setRefreshCookie(response, 'token', { maxAgeSeconds: 90 * 24 * 3600, secure: true });
    expect(calls[0]).toEqual({
      name: 'refresh_token',
      value: 'token',
      options: {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/v1/customer/auth',
        maxAge: 90 * 24 * 3600 * 1000,
      },
    });
  });

  it('is cleared with the same path, or the browser keeps it', () => {
    const { calls, response } = capture();
    clearRefreshCookie(response, { secure: false });
    expect(calls[0]!.options).toMatchObject({ path: '/v1/customer/auth', httpOnly: true });
  });
});

describe('refresh token (golden rule 9)', () => {
  it('is random and long', () => {
    const a = generateRefreshToken();
    expect(a).not.toBe(generateRefreshToken());
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is kept as a SHA-256 hash that does not contain it', () => {
    const token = generateRefreshToken();
    const hash = hashRefreshToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashRefreshToken(token)).toBe(hash);
  });
});
