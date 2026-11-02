import { Inject, Injectable } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import type { DB } from '../db/types.generated';
import { insertCustomerSession, type CustomerRow, type NewSession } from './session.repository';
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

  // Confirming a code (`otp/verify`).

  /** The newest code of the number that was not used, replaced or expired at `now`. */
  openCode(phone: string, now: Date): Promise<{ id: string; codeHash: string } | null>;
  /** Counts a wrong attempt and returns how many the code has now. */
  countWrongAttempt(codeId: string): Promise<number>;
  /** The code is used up: it never works again. */
  consumeCode(codeId: string, at: Date): Promise<void>;
  /** Blocks the number until `until` (RN-AUT-02). */
  lockPhone(phone: string, until: Date): Promise<void>;
  /** The account of the number. A new number gets one (docs/API.md, `otp/verify`). */
  findOrCreateCustomer(phone: string, at: Date): Promise<CustomerRow>;
  /** Opens the session of the customer, in the same transaction that used the code. */
  createSession(session: NewSession): Promise<void>;
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
    async openCode(phone, now) {
      const row = await trx
        .selectFrom('otp_codes')
        .select(['id', 'code_hash'])
        .where('phone_e164', '=', phone)
        .where('consumed_at', 'is', null)
        .where('expires_at', '>', now)
        .orderBy('created_at', 'desc')
        .limit(1)
        .executeTakeFirst();
      return row ? { id: row.id, codeHash: row.code_hash } : null;
    },
    async countWrongAttempt(codeId) {
      const row = await trx
        .updateTable('otp_codes')
        .set({ attempts: sql<number>`attempts + 1` })
        .where('id', '=', codeId)
        .returning('attempts')
        .executeTakeFirstOrThrow();
      return row.attempts;
    },
    async consumeCode(codeId, at) {
      await trx
        .updateTable('otp_codes')
        .set({ consumed_at: at })
        .where('id', '=', codeId)
        .execute();
    },
    async lockPhone(phone, until) {
      await trx
        .insertInto('phone_lockouts')
        .values({ phone_e164: phone, locked_until: until })
        .onConflict((conflict) =>
          conflict.column('phone_e164').doUpdateSet({ locked_until: until }),
        )
        .execute();
    },
    async findOrCreateCustomer(phone, at) {
      await trx
        .insertInto('customers')
        .values({ phone_e164: phone, created_at: at })
        .onConflict((conflict) => conflict.column('phone_e164').doNothing())
        .execute();
      const row = await trx
        .selectFrom('customers')
        .select(['id', 'phone_e164', 'name', 'email'])
        .where('phone_e164', '=', phone)
        .executeTakeFirstOrThrow();
      return { id: row.id, phone: row.phone_e164, name: row.name, email: row.email };
    },
    createSession: (session) => insertCustomerSession(trx, session),
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
