import { timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  isBrazilianMobileE164,
  type AuthCustomer,
  type AuthSessionResponse,
} from '@fregues/shared';
import { CLOCK, type Clock } from '../clock/clock';
import { AppError } from '../errors/app-error';
import { OtpRepository } from '../system/otp.repository';
import { SessionRepository, type CustomerRow } from '../system/session.repository';
import { AccessTokenService } from './access-token.service';
import { hashOtpCode } from './otp-policy';
import { OTP_CONFIG, type OtpConfig } from './otp.service';
import { generateRefreshToken, hashRefreshToken } from './refresh-token';
import {
  OTP_LOCK_SECONDS,
  OTP_MAX_ATTEMPTS,
  REFRESH_TTL_SECONDS,
  USER_AGENT_MAX_LENGTH,
} from './session-policy';

/** What the controller needs to answer: the body, and the refresh token for the cookie. */
export interface SignedIn {
  response: AuthSessionResponse;
  refreshToken: string;
}

const secondsUntil = (from: Date, to: Date) =>
  Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 1000));

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

function toAuthCustomer(customer: CustomerRow): AuthCustomer {
  return { ...customer, profileComplete: customer.name !== null };
}

type VerifyOutcome =
  | { kind: 'locked'; retryAfterSeconds: number }
  | { kind: 'expired' }
  | { kind: 'invalid'; attemptsLeft: number }
  | { kind: 'ok'; customer: CustomerRow; refreshToken: string };

type RefreshOutcome =
  { kind: 'denied' } | { kind: 'ok'; customer: CustomerRow; refreshToken: string };

@Injectable()
export class CustomerSessionService {
  constructor(
    @Inject(OtpRepository) private readonly otp: OtpRepository,
    @Inject(SessionRepository) private readonly sessions: SessionRepository,
    @Inject(AccessTokenService) private readonly tokens: AccessTokenService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(OTP_CONFIG) private readonly config: OtpConfig,
  ) {}

  /**
   * `POST /v1/customer/auth/otp/verify`. Confirms the code and opens the session. A number that
   * has no account gets one (RN-ENT-07: the app then asks for the name).
   *
   * Everything that is decided (a wrong attempt, the lock) is saved before the error is raised:
   * the counting must survive the refusal.
   */
  async verify(phone: string, code: string, userAgent: string | undefined): Promise<SignedIn> {
    // RN-AUT-01: only +55 mobiles.
    if (!isBrazilianMobileE164(phone)) throw new AppError('PHONE_NOT_SUPPORTED');

    const now = this.clock.now();
    const outcome = await this.otp.exclusive<VerifyOutcome>(phone, null, async (db) => {
      // RN-AUT-02: while the number is locked, even the right code is refused.
      const lockedUntil = await db.lockedUntil(phone);
      if (lockedUntil && lockedUntil > now) {
        return { kind: 'locked', retryAfterSeconds: secondsUntil(now, lockedUntil) };
      }

      // No code, a used one, a replaced one and an expired one all answer the same.
      const open = await db.openCode(phone, now);
      if (!open) return { kind: 'expired' };

      if (!sameHash(hashOtpCode(this.config.hashSecret, phone, code), open.codeHash)) {
        const attempts = await db.countWrongAttempt(open.id);
        if (attempts >= OTP_MAX_ATTEMPTS) {
          await db.consumeCode(open.id, now);
          await db.lockPhone(phone, new Date(now.getTime() + OTP_LOCK_SECONDS * 1000));
          return { kind: 'locked', retryAfterSeconds: OTP_LOCK_SECONDS };
        }
        return { kind: 'invalid', attemptsLeft: OTP_MAX_ATTEMPTS - attempts };
      }

      // The code works once (RN-AUT-02).
      await db.consumeCode(open.id, now);
      const customer = await db.findOrCreateCustomer(phone, now);
      const refreshToken = generateRefreshToken();
      await db.createSession({
        customerId: customer.id,
        refreshTokenHash: hashRefreshToken(refreshToken),
        userAgent: userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
        createdAt: now,
        expiresAt: new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000),
      });
      return { kind: 'ok', customer, refreshToken };
    });

    switch (outcome.kind) {
      case 'locked':
        throw new AppError('OTP_LOCKED', {
          details: { retryAfterSeconds: outcome.retryAfterSeconds },
        });
      case 'expired':
        throw new AppError('OTP_EXPIRED');
      case 'invalid':
        throw new AppError('OTP_INVALID', { details: { attemptsLeft: outcome.attemptsLeft } });
      case 'ok':
        return this.signedIn(outcome.customer, outcome.refreshToken);
    }
  }

  /**
   * `POST /v1/customer/auth/refresh`. Trades a refresh token for a new access token and a new
   * refresh token (RN-AUT-06: the session renews on every use). The token that was used stops
   * working. If it is shown again, somebody else has a copy: the whole login is revoked.
   */
  async refresh(
    refreshToken: string | undefined,
    userAgent: string | undefined,
  ): Promise<SignedIn> {
    if (!refreshToken) throw new AppError('UNAUTHENTICATED');
    const now = this.clock.now();

    const outcome = await this.sessions.rotating<RefreshOutcome>(
      hashRefreshToken(refreshToken),
      async (found, ops) => {
        if (!found) return { kind: 'denied' };
        if (found.revokedAt) {
          await ops.revokeFamily(found.familyId, now);
          return { kind: 'denied' };
        }
        if (found.expiresAt <= now) {
          await ops.revoke(found.id, now);
          return { kind: 'denied' };
        }
        const customer = await ops.customer(found.customerId);
        if (!customer) {
          await ops.revokeFamily(found.familyId, now);
          return { kind: 'denied' };
        }

        await ops.revoke(found.id, now);
        const next = generateRefreshToken();
        await ops.createSession({
          customerId: customer.id,
          familyId: found.familyId,
          refreshTokenHash: hashRefreshToken(next),
          userAgent: userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
          createdAt: now,
          expiresAt: new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000),
        });
        return { kind: 'ok', customer, refreshToken: next };
      },
    );

    if (outcome.kind === 'denied') throw new AppError('UNAUTHENTICATED');
    return this.signedIn(outcome.customer, outcome.refreshToken);
  }

  /** `POST /v1/customer/auth/logout`. Ends the session. Doing it twice, or with no token, is fine. */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.sessions.revokeByToken(hashRefreshToken(refreshToken), this.clock.now());
  }

  private async signedIn(customer: CustomerRow, refreshToken: string): Promise<SignedIn> {
    const { token, expiresIn } = await this.tokens.sign(customer.id);
    return {
      refreshToken,
      response: { accessToken: token, expiresIn, customer: toAuthCustomer(customer) },
    };
  }
}
