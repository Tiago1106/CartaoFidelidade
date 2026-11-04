import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../errors/app-error';
import { SYSTEM_DATABASE, type SystemDatabase } from './system-database';

// The SQL of the QR tokens. `qr_tokens` belongs to the system module alone: app_user has no right
// on it (docs/DATA_MODEL.md section 9). The row holds only the id that goes inside the signed
// token (`jti`), the owner and the times, so there is nothing in it that could be shown to a
// reader as a token (golden rules 8 and 9). The rules (lifetime, limit) live in `QrTokenService`.
// Times always come from the caller (golden rule 6).

export type ConsumeOutcome =
  { status: 'consumed'; customerId: string } | { status: 'invalid' | 'expired' | 'used' };

export interface NewQrToken {
  id: string;
  customerId: string;
  now: Date;
  expiresAt: Date;
  /** How many tokens a customer may be given in `windowSeconds`. */
  limit: number;
  windowSeconds: number;
}

@Injectable()
export class QrTokenRepository {
  constructor(@Inject(SYSTEM_DATABASE) private readonly db: SystemDatabase) {}

  /**
   * RN-QR-02: stores a new token and retires the previous ones, so that only the last is valid.
   * The row of the customer is locked, so two requests at the same time cannot both leave a valid
   * token behind. More than `limit` tokens in the window is `RATE_LIMITED`.
   */
  issue(token: NewQrToken): Promise<void> {
    return this.db.transaction().execute(async (trx) => {
      const customer = await trx
        .selectFrom('customers')
        .select('id')
        .where('id', '=', token.customerId)
        .where('anonymized_at', 'is', null)
        .forUpdate()
        .executeTakeFirst();
      if (!customer) throw new AppError('UNAUTHENTICATED');

      const windowStart = new Date(token.now.getTime() - token.windowSeconds * 1000);
      const recent = await trx
        .selectFrom('qr_tokens')
        .select('created_at')
        .where('customer_id', '=', token.customerId)
        .where('created_at', '>', windowStart)
        .orderBy('created_at', 'desc')
        .limit(token.limit)
        .execute();
      if (recent.length >= token.limit) {
        // The window opens again when the oldest of the counted tokens leaves it.
        const oldest = recent[recent.length - 1]!.created_at;
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((oldest.getTime() + token.windowSeconds * 1000 - token.now.getTime()) / 1000),
        );
        throw new AppError('RATE_LIMITED', { details: { retryAfterSeconds } });
      }

      // A token that was replaced counts as used: scanning it answers QR_ALREADY_USED.
      await trx
        .updateTable('qr_tokens')
        .set({ consumed_at: token.now })
        .where('customer_id', '=', token.customerId)
        .where('consumed_at', 'is', null)
        .execute();
      await trx
        .insertInto('qr_tokens')
        .values({
          id: token.id,
          customer_id: token.customerId,
          created_at: token.now,
          expires_at: token.expiresAt,
        })
        .execute();
    });
  }

  /**
   * RN-QR-03: uses the token once (the scan). The row is locked, so two scans at the same time
   * cannot both win. The check order is: unknown, used (also replaced), expired.
   */
  consume(id: string, now: Date): Promise<ConsumeOutcome> {
    return this.db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom('qr_tokens')
        .select(['customer_id', 'expires_at', 'consumed_at'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!row) return { status: 'invalid' as const };
      if (row.consumed_at) return { status: 'used' as const };
      if (now.getTime() > row.expires_at.getTime()) return { status: 'expired' as const };
      await trx.updateTable('qr_tokens').set({ consumed_at: now }).where('id', '=', id).execute();
      return { status: 'consumed' as const, customerId: row.customer_id };
    });
  }
}
