import { Inject, Injectable } from '@nestjs/common';
import type { Transaction } from 'kysely';
import type { DB } from '../db/types.generated';
import { SYSTEM_DATABASE, type SystemDatabase } from './system-database';

// The SQL of the sessions of the customer. It runs as `app_system` because `sessions` belongs to
// the system module alone (docs/DATA_MODEL.md section 9). The rules (lifetime, rotation, reuse)
// live in `CustomerSessionService`. Times always come from the caller (golden rule 6). Only the
// hash of a refresh token is ever written (golden rule 9).

export interface CustomerRow {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
}

export interface SessionRow {
  id: string;
  customerId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface NewSession {
  customerId: string;
  /** Rows of one login share it. A new login starts a new family. */
  familyId?: string;
  refreshTokenHash: string;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
}

/** Inserts a session of a customer. Also used when a code is confirmed, in the same transaction. */
export async function insertCustomerSession(
  trx: Transaction<DB>,
  session: NewSession,
): Promise<void> {
  await trx
    .insertInto('sessions')
    .values({
      principal_type: 'customer',
      principal_id: session.customerId,
      ...(session.familyId ? { family_id: session.familyId } : {}),
      refresh_token_hash: session.refreshTokenHash,
      user_agent: session.userAgent,
      created_at: session.createdAt,
      last_used_at: session.createdAt,
      expires_at: session.expiresAt,
    })
    .execute();
}

export interface SessionOperations {
  revoke(sessionId: string, at: Date): Promise<void>;
  /** Every session of one login stops working. */
  revokeFamily(familyId: string, at: Date): Promise<void>;
  createSession(session: NewSession): Promise<void>;
  customer(id: string): Promise<CustomerRow | null>;
}

function operations(trx: Transaction<DB>): SessionOperations {
  return {
    async revoke(sessionId, at) {
      await trx
        .updateTable('sessions')
        .set({ revoked_at: at })
        .where('id', '=', sessionId)
        .execute();
    },
    async revokeFamily(familyId, at) {
      await trx
        .updateTable('sessions')
        .set({ revoked_at: at })
        .where('family_id', '=', familyId)
        .where('revoked_at', 'is', null)
        .execute();
    },
    createSession: (session) => insertCustomerSession(trx, session),
    async customer(id) {
      const row = await trx
        .selectFrom('customers')
        .select(['id', 'phone_e164', 'name', 'email'])
        .where('id', '=', id)
        .where('anonymized_at', 'is', null)
        .executeTakeFirst();
      return row ? { id: row.id, phone: row.phone_e164, name: row.name, email: row.email } : null;
    },
  };
}

@Injectable()
export class SessionRepository {
  constructor(@Inject(SYSTEM_DATABASE) private readonly db: SystemDatabase) {}

  /**
   * Finds the session of a refresh token and locks its row until `work` ends, so two requests
   * with the same token cannot both rotate it. `found` is `null` for a token nobody knows.
   */
  rotating<T>(
    refreshTokenHash: string,
    work: (found: SessionRow | null, ops: SessionOperations) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom('sessions')
        .select(['id', 'principal_id', 'family_id', 'expires_at', 'revoked_at'])
        .where('refresh_token_hash', '=', refreshTokenHash)
        .where('principal_type', '=', 'customer')
        .forUpdate()
        .executeTakeFirst();
      const found: SessionRow | null = row
        ? {
            id: row.id,
            customerId: row.principal_id,
            familyId: row.family_id,
            expiresAt: row.expires_at,
            revokedAt: row.revoked_at,
          }
        : null;
      return work(found, operations(trx));
    });
  }

  /** Ends the session of a refresh token. Does nothing for a token nobody knows. */
  async revokeByToken(refreshTokenHash: string, at: Date): Promise<void> {
    await this.db
      .updateTable('sessions')
      .set({ revoked_at: at })
      .where('refresh_token_hash', '=', refreshTokenHash)
      .where('principal_type', '=', 'customer')
      .where('revoked_at', 'is', null)
      .execute();
  }
}
