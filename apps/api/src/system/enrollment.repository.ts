import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { AppError } from '../errors/app-error';
import { SYSTEM_DATABASE, type SystemDatabase } from './system-database';

// What a customer cannot do alone, because the tables have no write policy for them (D-025), or
// cannot see, because the rows belong to a business: entering a business, the public page of a
// business and the first name of the staff on a visit. Each function receives the id from the
// verified access token and touches only what belongs to that customer or what is public.

export interface JoinInput {
  customerId: string;
  slug: string;
  marketingOptIn: boolean;
  programIds?: string[];
  now: Date;
}

export interface PublicBusinessRow {
  name: string;
  slug: string;
  programs: { id: string; name: string; stampsRequired: number; rewardDescription: string }[];
}

@Injectable()
export class EnrollmentRepository {
  constructor(@Inject(SYSTEM_DATABASE) private readonly db: SystemDatabase) {}

  /**
   * RN-ENT-04: the customer enters the active cards of a business (or the ones asked for).
   * Idempotent: a second call changes nothing but a consent that was still missing. The ids of
   * the enrollments come back so the caller can read them under the customer context.
   */
  join(input: JoinInput): Promise<string[]> {
    return this.db.transaction().execute(async (trx) => {
      const customer = await trx
        .selectFrom('customers')
        .select('id')
        .where('id', '=', input.customerId)
        .where('anonymized_at', 'is', null)
        .executeTakeFirst();
      if (!customer) throw new AppError('UNAUTHENTICATED');

      const business = await trx
        .selectFrom('businesses')
        .select('id')
        .where('slug', '=', input.slug)
        .executeTakeFirst();
      if (!business) throw new AppError('NOT_FOUND');

      const programs = await trx
        .selectFrom('programs')
        .select(['id', 'status'])
        .where('business_id', '=', business.id)
        .$if(input.programIds !== undefined, (qb) => qb.where('id', 'in', input.programIds!))
        .$if(input.programIds === undefined, (qb) => qb.where('status', '=', 'active'))
        .execute();

      if (input.programIds) {
        // A card that is not of this business is "not found", never "archived": the answer does
        // not tell anything about other businesses.
        const wanted = new Set(input.programIds);
        if (programs.length !== wanted.size) throw new AppError('NOT_FOUND');
        if (programs.some((program) => program.status !== 'active')) {
          throw new AppError('PROGRAM_NOT_ACTIVE');
        }
      }

      // Consent starts off and is only ever switched on here (RN-LGP-03); it changes through
      // `marketing-consent` afterwards.
      const optInAt = input.marketingOptIn ? input.now : null;
      await trx
        .insertInto('business_customers')
        .values({
          business_id: business.id,
          customer_id: input.customerId,
          first_seen_at: input.now,
          marketing_opt_in_at: optInAt,
          marketing_source: optInAt ? 'first_login' : null,
        })
        .onConflict((conflict) =>
          conflict.columns(['business_id', 'customer_id']).doUpdateSet({
            marketing_source: sql`CASE WHEN business_customers.marketing_opt_in_at IS NULL
                                        AND excluded.marketing_opt_in_at IS NOT NULL
                                       THEN excluded.marketing_source
                                       ELSE business_customers.marketing_source END`,
            marketing_opt_in_at: sql`COALESCE(business_customers.marketing_opt_in_at,
                                              excluded.marketing_opt_in_at)`,
          }),
        )
        .execute();

      if (programs.length === 0) return [];
      await trx
        .insertInto('enrollments')
        .values(
          programs.map((program) => ({
            business_id: business.id,
            customer_id: input.customerId,
            program_id: program.id,
            created_at: input.now,
          })),
        )
        .onConflict((conflict) => conflict.columns(['customer_id', 'program_id']).doNothing())
        .execute();

      const rows = await trx
        .selectFrom('enrollments')
        .select('id')
        .where('customer_id', '=', input.customerId)
        .where(
          'program_id',
          'in',
          programs.map((program) => program.id),
        )
        .execute();
      return rows.map((row) => row.id);
    });
  }

  /** The page `/s/<slug>` (RN-ENT-02): the name and the active cards. Nothing about people. */
  async publicBusiness(slug: string): Promise<PublicBusinessRow | undefined> {
    const business = await this.db
      .selectFrom('businesses')
      .select(['id', 'name', 'slug'])
      .where('slug', '=', slug)
      .executeTakeFirst();
    if (!business) return undefined;
    const programs = await this.db
      .selectFrom('programs')
      .select(['id', 'name', 'stamps_required', 'reward_description'])
      .where('business_id', '=', business.id)
      .where('status', '=', 'active')
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return {
      name: business.name,
      slug: business.slug,
      programs: programs.map((program) => ({
        id: program.id,
        name: program.name,
        stampsRequired: program.stamps_required,
        rewardDescription: program.reward_description,
      })),
    };
  }

  /**
   * The first name of staff members, for the history of a card (RN-PRE-08: the customer sees only
   * the first name). The customer cannot read `staff`, which holds e-mails and password hashes.
   */
  async staffFirstNames(staffIds: string[]): Promise<Map<string, string>> {
    if (staffIds.length === 0) return new Map();
    const rows = await this.db
      .selectFrom('staff')
      .select(['id', 'name'])
      .where('id', 'in', staffIds)
      .execute();
    return new Map(rows.map((row) => [row.id, row.name.trim().split(/\s+/)[0] ?? '']));
  }
}
