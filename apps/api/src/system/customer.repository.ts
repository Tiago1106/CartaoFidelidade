import { Inject, Injectable } from '@nestjs/common';
import { SYSTEM_DATABASE, type SystemDatabase } from './system-database';

// The writes to `customers`. They run as `app_system` because the customer has no right to write
// there (docs/DATA_MODEL.md section 9, D-025); the id comes from the verified access token. The
// times come from the caller (golden rule 6).

export interface CustomerProfileRow {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
}

export interface ProfilePatch {
  name?: string;
  /** `null` removes the e-mail. */
  email?: string | null;
  /** Set when the request carries `acceptTerms`. */
  acceptTerms?: { at: Date; version: string };
}

export type ProfileUpdateOutcome =
  | { status: 'updated'; profile: CustomerProfileRow }
  | { status: 'terms_required' }
  | { status: 'not_found' };

@Injectable()
export class CustomerRepository {
  constructor(@Inject(SYSTEM_DATABASE) private readonly db: SystemDatabase) {}

  /**
   * Changes the profile in one transaction with the row locked. The first acceptance of the Terms
   * is kept: a second `acceptTerms` does not move the date (RN-LGP-02). An account that never
   * accepted them cannot be changed without `acceptTerms` (RN-ENT-08).
   */
  updateProfile(customerId: string, patch: ProfilePatch): Promise<ProfileUpdateOutcome> {
    return this.db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('customers')
        .select(['terms_accepted_at'])
        .where('id', '=', customerId)
        .where('anonymized_at', 'is', null)
        .forUpdate()
        .executeTakeFirst();
      if (!current) return { status: 'not_found' as const };

      const alreadyAccepted = current.terms_accepted_at !== null;
      if (!alreadyAccepted && !patch.acceptTerms) return { status: 'terms_required' as const };

      const row = await trx
        .updateTable('customers')
        .set({
          // `id = id` keeps the statement valid when nothing but an old acceptance was sent.
          id: customerId,
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.email !== undefined ? { email: patch.email } : {}),
          ...(!alreadyAccepted && patch.acceptTerms
            ? { terms_accepted_at: patch.acceptTerms.at, terms_version: patch.acceptTerms.version }
            : {}),
        })
        .where('id', '=', customerId)
        .returning(['id', 'phone_e164', 'name', 'email', 'terms_accepted_at', 'terms_version'])
        .executeTakeFirstOrThrow();

      return {
        status: 'updated' as const,
        profile: {
          id: row.id,
          phone: row.phone_e164,
          name: row.name,
          email: row.email,
          termsAcceptedAt: row.terms_accepted_at,
          termsVersion: row.terms_version,
        },
      };
    });
  }
}
