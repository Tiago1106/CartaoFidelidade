import { Inject, Injectable } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import type { DB } from '../db/types.generated';
import { SYSTEM_DATABASE, type SystemDatabase } from './system-database';

// The SQL of the SMS codes of the customer. It runs as `app_system` because the tables
// `otp_codes`, `phone_lockouts` and `sms_messages` belong to the system module alone
// (docs/DATA_MODEL.md section 9). The rules (limits, lock, expiry) live in `OtpService`; this
// file only reads and writes. Times always come from the caller (golden rule 6).

/** What the rules may do inside one request for a code. */
export interface OtpOperations {
  /** Until when the number is locked, or `null`. */
  lockedUntil(phone: string): Promise<Date | null>;
  /** The newest `limit` requests of a number since `since`, newest first. */
  recentByPhone(phone: string, since: Date, limit: number): Promise<Date[]>;
  /** The same, for an IP address. */
  recentByIp(ip: string, since: Date, limit: number): Promise<Date[]>;
  /** The codes of the number that are still waiting stop working (RN-AUT-02). */
  invalidateOpenCodes(phone: string, at: Date): Promise<void>;
  insertCode(code: {
    phone: string;
    codeHash: string;
    ip: string | null;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<void>;
}

function operations(trx: Transaction<DB>): OtpOperations {
  return {
    async lockedUntil(phone) {
      const row = await trx
        .selectFrom('phone_lockouts')
        .select('locked_until')
        .where('phone_e164', '=', phone)
        .executeTakeFirst();
      return row?.locked_until ?? null;
    },
    async recentByPhone(phone, since, limit) {
      const rows = await trx
        .selectFrom('otp_codes')
        .select('created_at')
        .where('phone_e164', '=', phone)
        .where('created_at', '>', since)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .execute();
      return rows.map((row) => row.created_at);
    },
    async recentByIp(ip, since, limit) {
      const rows = await trx
        .selectFrom('otp_codes')
        .select('created_at')
        .where('ip', '=', ip)
        .where('created_at', '>', since)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .execute();
      return rows.map((row) => row.created_at);
    },
    async invalidateOpenCodes(phone, at) {
      await trx
        .updateTable('otp_codes')
        .set({ consumed_at: at })
        .where('phone_e164', '=', phone)
        .where('consumed_at', 'is', null)
        .execute();
    },
    async insertCode(code) {
      await trx
        .insertInto('otp_codes')
        .values({
          phone_e164: code.phone,
          code_hash: code.codeHash,
          ip: code.ip,
          created_at: code.createdAt,
          expires_at: code.expiresAt,
        })
        .execute();
    },
  };
}

@Injectable()
export class OtpRepository {
  constructor(@Inject(SYSTEM_DATABASE) private readonly db: SystemDatabase) {}

  /**
   * Runs `work` in a transaction that holds a lock on the number and on the IP, so two requests
   * at the same time cannot both slip under a limit. The locks are taken in a fixed order (number,
   * then IP), so two requests never wait for each other in a circle.
   */
  exclusive<T>(
    phone: string,
    ip: string | null,
    work: (operations: OtpOperations) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction().execute(async (trx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtext(${`phone:${phone}`}))`.execute(trx);
      if (ip) await sql`SELECT pg_advisory_xact_lock(hashtext(${`ip:${ip}`}))`.execute(trx);
      return work(operations(trx));
    });
  }

  /** Writes down that an SMS was sent, or that it failed (cost control and diagnosis). */
  async recordSms(sms: {
    phone: string;
    provider: string;
    providerMessageId?: string;
    status: 'sent' | 'failed';
    createdAt: Date;
  }): Promise<void> {
    await this.db
      .insertInto('sms_messages')
      .values({
        phone_e164: sms.phone,
        provider: sms.provider,
        provider_message_id: sms.providerMessageId ?? null,
        status: sms.status,
        created_at: sms.createdAt,
      })
      .execute();
  }

  /** Makes the code of a request stop working, when its SMS could not be sent. */
  async invalidateOpenCodes(phone: string, at: Date): Promise<void> {
    await this.db
      .updateTable('otp_codes')
      .set({ consumed_at: at })
      .where('phone_e164', '=', phone)
      .where('consumed_at', 'is', null)
      .execute();
  }
}
