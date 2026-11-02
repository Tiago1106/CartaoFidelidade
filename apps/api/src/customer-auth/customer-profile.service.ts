import { Inject, Injectable } from '@nestjs/common';
import { TERMS_VERSION, type CustomerProfile, type CustomerProfileUpdate } from '@fregues/shared';
import { CLOCK, type Clock } from '../clock/clock';
import { DATABASE, type Database } from '../db/database';
import { withTenantContext } from '../db/tenant-context';
import { AppError } from '../errors/app-error';
import { CustomerRepository, type CustomerProfileRow } from '../system/customer.repository';

function toProfile(row: CustomerProfileRow): CustomerProfile {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    email: row.email,
    // The first access is done once the customer has a name (RN-ENT-07).
    profileComplete: row.name !== null,
    termsAcceptedAt: row.termsAcceptedAt?.toISOString() ?? null,
    termsVersion: row.termsVersion,
  };
}

/** The profile of the signed in customer (docs/API.md section 5). */
@Injectable()
export class CustomerProfileService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CustomerRepository) private readonly customers: CustomerRepository,
  ) {}

  /** Read as `app_user` under the context of the customer: the database only shows the own row. */
  async get(customerId: string): Promise<CustomerProfile> {
    const row = await withTenantContext(this.db, { customerId }, (trx) =>
      trx
        .selectFrom('customers')
        .select(['id', 'phone_e164', 'name', 'email', 'terms_accepted_at', 'terms_version'])
        .where('anonymized_at', 'is', null)
        .executeTakeFirst(),
    );
    // A valid token of an account that is gone (anonymized) is no longer a way in.
    if (!row) throw new AppError('UNAUTHENTICATED');
    return toProfile({
      id: row.id,
      phone: row.phone_e164,
      name: row.name,
      email: row.email,
      termsAcceptedAt: row.terms_accepted_at,
      termsVersion: row.terms_version,
    });
  }

  async update(customerId: string, body: CustomerProfileUpdate): Promise<CustomerProfile> {
    // The app can only accept the version it shows, and the server only knows the current one.
    if (body.termsVersion !== undefined && body.termsVersion !== TERMS_VERSION) {
      throw new AppError('VALIDATION_ERROR', {
        details: { fields: [{ field: 'termsVersion', reason: 'outdated' }] },
      });
    }

    const outcome = await this.customers.updateProfile(customerId, {
      name: body.name,
      email: body.email,
      acceptTerms: body.acceptTerms ? { at: this.clock.now(), version: TERMS_VERSION } : undefined,
    });
    if (outcome.status === 'not_found') throw new AppError('UNAUTHENTICATED');
    if (outcome.status === 'terms_required') {
      throw new AppError('VALIDATION_ERROR', {
        details: { fields: [{ field: 'acceptTerms', reason: 'required' }] },
      });
    }
    return toProfile(outcome.profile);
  }
}
