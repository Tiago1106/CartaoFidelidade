import { Inject, Injectable } from '@nestjs/common';
import { isBrazilianMobileE164, type OtpRequestResponse } from '@fregues/shared';
import { CLOCK, type Clock } from '../clock/clock';
import { AppError } from '../errors/app-error';
import { OtpRepository } from '../system/otp.repository';
import {
  generateOtpCode,
  hashOtpCode,
  OTP_MAX_REQUESTS_PER_IP,
  OTP_MAX_REQUESTS_PER_PHONE,
  OTP_REQUEST_WINDOW_SECONDS,
  OTP_RETRY_AFTER_SECONDS,
  OTP_TTL_SECONDS,
} from './otp-policy';
import { InjectOtpSender, type OtpSender } from './otp-sender';

export const OTP_CONFIG = Symbol('OTP_CONFIG');

export interface OtpConfig {
  /** Key of the hash of the codes. */
  hashSecret: string;
  /** Replaced by a fixed one in tests. */
  generateCode?: () => string;
}

const secondsUntil = (from: Date, to: Date) =>
  Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 1000));

@Injectable()
export class OtpService {
  constructor(
    @Inject(OtpRepository) private readonly repository: OtpRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @InjectOtpSender() private readonly sender: OtpSender,
    @Inject(OTP_CONFIG) private readonly config: OtpConfig,
  ) {}

  /**
   * `POST /v1/customer/auth/otp/request`. Sends a code to a number.
   *
   * The answer is the same for a number that has an account and one that has not (RN-AUT-05):
   * no account is created or looked at here. The code of a previous request stops working
   * (RN-AUT-02).
   */
  async request(phone: string, ip: string | null): Promise<OtpRequestResponse> {
    // RN-AUT-01: only +55 mobiles.
    if (!isBrazilianMobileE164(phone)) throw new AppError('PHONE_NOT_SUPPORTED');

    const now = this.clock.now();
    const code = (this.config.generateCode ?? generateOtpCode)();
    const expiresAt = new Date(now.getTime() + OTP_TTL_SECONDS * 1000);
    const windowStart = new Date(now.getTime() - OTP_REQUEST_WINDOW_SECONDS * 1000);

    await this.repository.exclusive(phone, ip, async (db) => {
      // RN-AUT-02: a number locked for 15 minutes gets no new code.
      const lockedUntil = await db.lockedUntil(phone);
      if (lockedUntil && lockedUntil > now) {
        throw new AppError('OTP_LOCKED', {
          details: { retryAfterSeconds: secondsUntil(now, lockedUntil) },
        });
      }

      // RN-AUT-03: 3 per hour per number. The third newest request tells when the number is free
      // again: one hour after it, there are only 2 left in the window.
      const byPhone = await db.recentByPhone(phone, windowStart, OTP_MAX_REQUESTS_PER_PHONE);
      if (byPhone.length >= OTP_MAX_REQUESTS_PER_PHONE) {
        const oldest = byPhone[OTP_MAX_REQUESTS_PER_PHONE - 1]!;
        throw new AppError('RATE_LIMITED', {
          details: {
            retryAfterSeconds: secondsUntil(
              now,
              new Date(oldest.getTime() + OTP_REQUEST_WINDOW_SECONDS * 1000),
            ),
          },
        });
      }

      // RN-AUT-03: and per IP, so one device cannot drain the paid SMS of everybody.
      if (ip) {
        const byIp = await db.recentByIp(ip, windowStart, OTP_MAX_REQUESTS_PER_IP);
        if (byIp.length >= OTP_MAX_REQUESTS_PER_IP) {
          const oldest = byIp[OTP_MAX_REQUESTS_PER_IP - 1]!;
          throw new AppError('RATE_LIMITED', {
            details: {
              retryAfterSeconds: secondsUntil(
                now,
                new Date(oldest.getTime() + OTP_REQUEST_WINDOW_SECONDS * 1000),
              ),
            },
          });
        }
      }

      await db.invalidateOpenCodes(phone, now);
      await db.insertCode({
        phone,
        codeHash: hashOtpCode(this.config.hashSecret, phone, code),
        ip,
        createdAt: now,
        expiresAt,
      });
    });

    // The SMS goes out after the code is saved and the locks are released: a slow provider
    // never holds the database.
    let sent: { providerMessageId?: string };
    try {
      sent = await this.sender.send({ phone, code, expiresAt });
    } catch {
      await this.repository.recordSms({
        phone,
        provider: this.sender.name,
        status: 'failed',
        createdAt: now,
      });
      await this.repository.invalidateOpenCodes(phone, now);
      // The provider's error is not copied: it could carry the number or the code.
      throw new Error('The SMS could not be sent.');
    }
    await this.repository.recordSms({
      phone,
      provider: this.sender.name,
      providerMessageId: sent.providerMessageId,
      status: 'sent',
      createdAt: now,
    });

    return { retryAfterSeconds: OTP_RETRY_AFTER_SECONDS };
  }
}
