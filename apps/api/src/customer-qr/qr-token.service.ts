import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { QrToken } from '@fregues/shared';
import { compactVerify, SignJWT } from 'jose';
import { CLOCK, type Clock } from '../clock/clock';
import { AppError } from '../errors/app-error';
import { QrTokenRepository } from '../system/qr-token.repository';

export const QR_TOKEN_SECRET = Symbol('QR_TOKEN_SECRET');

/** The token is valid for 45 seconds (RN-QR-02). */
export const QR_TOKEN_TTL_SECONDS = 45;
/** The app asks for a new one every 30 seconds, which leaves a margin of 15 (RN-QR-02). */
export const QR_RENEW_SECONDS = 30;
/** Prefix that tells the reader the format and the version (docs/API.md section 5). */
export const QR_PAYLOAD_PREFIX = 'lc1.';
/** 6 per minute per customer [Premissa] (docs/API.md, limits). */
export const QR_TOKENS_PER_MINUTE = 6;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The QR of the customer (docs/API.md section 5). The token is a JWT signed with `QR_TOKEN_SECRET`
 * that carries only an id (`jti`), the time of issue and the expiry. Who it belongs to and whether
 * it was used live in `qr_tokens`, so a copy of the token reveals nothing and works once.
 */
@Injectable()
export class QrTokenService {
  private readonly key: Uint8Array;

  constructor(
    @Inject(QR_TOKEN_SECRET) secret: string,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(QrTokenRepository) private readonly tokens: QrTokenRepository,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  /** A new token for the signed in customer. The previous ones stop working. */
  async issue(customerId: string): Promise<QrToken> {
    const now = this.clock.now();
    const issuedAt = Math.floor(now.getTime() / 1000);
    const id = randomUUID();
    const expiresAt = new Date((issuedAt + QR_TOKEN_TTL_SECONDS) * 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setJti(id)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + QR_TOKEN_TTL_SECONDS)
      .sign(this.key);

    await this.tokens.issue({
      id,
      customerId,
      // The row and the token share the same instants, whole seconds.
      now: new Date(issuedAt * 1000),
      expiresAt,
      limit: QR_TOKENS_PER_MINUTE,
      windowSeconds: 60,
    });
    return {
      token,
      qrPayload: `${QR_PAYLOAD_PREFIX}${token}`,
      expiresAt: expiresAt.toISOString(),
      renewInSeconds: QR_RENEW_SECONDS,
    };
  }

  /**
   * RN-QR-03: the staff reads the QR (`scan/resolve`, a later task). Uses the token once and
   * answers whose it is. `QR_INVALID`: not ours or unknown; `QR_ALREADY_USED`: used or replaced
   * by a newer one; `QR_EXPIRED`: older than 45 seconds.
   */
  async consume(qrPayload: string): Promise<{ customerId: string }> {
    const id = await this.idOf(qrPayload);
    const outcome = await this.tokens.consume(id, this.clock.now());
    switch (outcome.status) {
      case 'consumed':
        return { customerId: outcome.customerId };
      case 'used':
        throw new AppError('QR_ALREADY_USED');
      case 'expired':
        throw new AppError('QR_EXPIRED');
      default:
        throw new AppError('QR_INVALID');
    }
  }

  /** Checks the signature only; the validity is the one stored, so the app and the server agree. */
  private async idOf(qrPayload: string): Promise<string> {
    if (!qrPayload.startsWith(QR_PAYLOAD_PREFIX)) throw new AppError('QR_INVALID');
    try {
      const { payload } = await compactVerify(qrPayload.slice(QR_PAYLOAD_PREFIX.length), this.key, {
        algorithms: ['HS256'],
      });
      const jti = (JSON.parse(new TextDecoder().decode(payload)) as { jti?: unknown }).jti;
      if (typeof jti === 'string' && UUID.test(jti)) return jti;
    } catch {
      // A bad signature or text that is not a token: the same answer.
    }
    throw new AppError('QR_INVALID');
  }
}
