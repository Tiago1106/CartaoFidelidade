import { Inject, Injectable } from '@nestjs/common';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';
import { CLOCK, type Clock } from '../clock/clock';
import { AppError } from '../errors/app-error';

export const ACCESS_TOKEN_SECRET = Symbol('ACCESS_TOKEN_SECRET');

/** The access token lives 15 minutes (docs/API.md section 1). */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface CustomerClaims {
  /** The id of the customer. */
  sub: string;
  typ: 'customer';
}

/**
 * The JWT of the app (docs/API.md section 1): `sub` and `typ`, 15 minutes, signed with HS256.
 * The app keeps it in memory only. The time of issue and of expiry come from the `Clock`.
 */
@Injectable()
export class AccessTokenService {
  private readonly key: Uint8Array;

  constructor(
    @Inject(ACCESS_TOKEN_SECRET) secret: string,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async sign(customerId: string): Promise<{ token: string; expiresIn: number }> {
    const issuedAt = Math.floor(this.clock.now().getTime() / 1000);
    const token = await new SignJWT({ typ: 'customer' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(customerId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ACCESS_TOKEN_TTL_SECONDS)
      .sign(this.key);
    return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  /** `TOKEN_EXPIRED` tells the app to try the refresh; anything else is `UNAUTHENTICATED`. */
  async verify(token: string): Promise<CustomerClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        currentDate: this.clock.now(),
      });
      if (payload.typ !== 'customer' || typeof payload.sub !== 'string') {
        throw new AppError('UNAUTHENTICATED');
      }
      return { sub: payload.sub, typ: 'customer' };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof joseErrors.JWTExpired) throw new AppError('TOKEN_EXPIRED');
      throw new AppError('UNAUTHENTICATED');
    }
  }
}
