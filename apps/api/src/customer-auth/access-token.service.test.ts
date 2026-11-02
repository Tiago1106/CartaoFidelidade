import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../clock/clock';
import { AppError } from '../errors/app-error';
import { ACCESS_TOKEN_TTL_SECONDS, AccessTokenService } from './access-token.service';

const SECRET = 'a-signing-key-with-at-least-32-characters';
const ID = '6f1c0f6e-3c1e-4f0a-9d0a-1d2f3a4b5c6d';

const make = (clock = new ManualClock('2026-11-02T12:00:00Z'), secret = SECRET) => ({
  clock,
  service: new AccessTokenService(secret, clock),
});

async function codeOf(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    if (error instanceof AppError) return error.code;
    throw error;
  }
}

describe('AccessTokenService (docs/API.md section 1)', () => {
  it('signs a token for 15 minutes and verifies it', async () => {
    const { service } = make();
    const { token, expiresIn } = await service.sign(ID);
    expect(expiresIn).toBe(15 * 60);
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    await expect(service.verify(token)).resolves.toEqual({ sub: ID, typ: 'customer' });
  });

  it('golden rule 6: the times come from the clock', async () => {
    const { service } = make(new ManualClock('2026-11-02T12:00:00Z'));
    const { token } = await service.sign(ID);
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    expect(payload).toMatchObject({
      sub: ID,
      typ: 'customer',
      iat: Date.parse('2026-11-02T12:00:00Z') / 1000,
      exp: Date.parse('2026-11-02T12:15:00Z') / 1000,
    });
  });

  it('works until the 15 minutes are over, and then answers TOKEN_EXPIRED', async () => {
    const { clock, service } = make();
    const { token } = await service.sign(ID);
    clock.advanceSeconds(15 * 60 - 1);
    expect(await codeOf(service.verify(token))).toBeNull();
    clock.advanceSeconds(1);
    expect(await codeOf(service.verify(token))).toBe('TOKEN_EXPIRED');
  });

  it('refuses a token signed with another key', async () => {
    const { token } = await make(
      undefined,
      'another-key-with-at-least-32-characters!',
    ).service.sign(ID);
    expect(await codeOf(make().service.verify(token))).toBe('UNAUTHENTICATED');
  });

  it('refuses a token that was changed', async () => {
    const { service } = make();
    const { token } = await service.sign(ID);
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'someone-else', typ: 'customer' })).toString(
      'base64url',
    );
    expect(await codeOf(service.verify(`${header}.${forged}.${signature}`))).toBe(
      'UNAUTHENTICATED',
    );
  });

  it('refuses a token that is not for a customer', async () => {
    const { service } = make();
    const key = new TextEncoder().encode(SECRET);
    const staffToken = await new SignJWT({ typ: 'staff' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(ID)
      .setIssuedAt(Date.parse('2026-11-02T12:00:00Z') / 1000)
      .setExpirationTime(Date.parse('2026-11-02T12:15:00Z') / 1000)
      .sign(key);
    expect(await codeOf(service.verify(staffToken))).toBe('UNAUTHENTICATED');
  });

  it('refuses a token with no subject', async () => {
    const { service } = make();
    const key = new TextEncoder().encode(SECRET);
    const token = await new SignJWT({ typ: 'customer' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(Date.parse('2026-11-02T12:15:00Z') / 1000)
      .sign(key);
    expect(await codeOf(service.verify(token))).toBe('UNAUTHENTICATED');
  });

  it('refuses the "none" algorithm', async () => {
    const { service } = make();
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({ sub: ID, typ: 'customer', exp: Date.parse('2026-11-02T12:15:00Z') / 1000 }),
    ).toString('base64url');
    expect(await codeOf(service.verify(`${header}.${body}.`))).toBe('UNAUTHENTICATED');
  });

  it.each(['', 'not-a-token', 'a.b.c'])('refuses garbage: %j', async (token) => {
    expect(await codeOf(make().service.verify(token))).toBe('UNAUTHENTICATED');
  });
});
