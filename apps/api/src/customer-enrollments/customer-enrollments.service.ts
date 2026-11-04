import { Inject, Injectable } from '@nestjs/common';
import type { Transaction } from 'kysely';
import type {
  Enrollment,
  EnrollmentDetailResponse,
  EnrollmentList,
  JoinBusiness,
  JoinBusinessResponse,
  PublicBusiness,
  StampEntry,
} from '@fregues/shared';
import { CLOCK, type Clock } from '../clock/clock';
import { DATABASE, type Database } from '../db/database';
import { withTenantContext } from '../db/tenant-context';
import type { DB } from '../db/types.generated';
import { AppError } from '../errors/app-error';
import { EnrollmentRepository } from '../system/enrollment.repository';
import {
  buildEnrollment,
  buildPastCycles,
  buildRedemptions,
  isVisible,
  liveCycle,
  type CycleRow,
  type EnrollmentRow,
  type RedemptionRow,
} from './enrollment-view';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface Loaded {
  enrollment: EnrollmentRow;
  cycles: CycleRow[];
  redemptions: RedemptionRow[];
}

/** The cards of the signed in customer (docs/API.md section 5) and the entry in a business. */
@Injectable()
export class CustomerEnrollmentsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(EnrollmentRepository) private readonly system: EnrollmentRepository,
  ) {}

  async list(customerId: string): Promise<EnrollmentList> {
    const now = this.clock.now();
    return withTenantContext(this.db, { customerId }, async (trx) => {
      const loaded = await this.load(trx, now);
      const kept = await this.keptStamps(trx, loaded);
      return { items: loaded.map((l) => this.toItem(l, kept, now)) };
    });
  }

  async detail(customerId: string, id: string): Promise<EnrollmentDetailResponse> {
    // An id that is not a UUID cannot exist; the database would answer with an error instead.
    if (!UUID.test(id)) throw new AppError('NOT_FOUND');
    const now = this.clock.now();
    const read = await withTenantContext(this.db, { customerId }, async (trx) => {
      const [loaded] = await this.load(trx, now, id);
      if (!loaded) return undefined;
      const kept = await this.keptStamps(trx, [loaded]);
      const stamps = await this.stampsOfLiveCycle(trx, loaded, now);
      return { loaded, kept, stamps };
    });
    // Somebody else's card and a card that does not exist look the same (RN-TEN, golden rule 1).
    if (!read) throw new AppError('NOT_FOUND');

    const names = await this.system.staffFirstNames([
      ...new Set(read.stamps.map((stamp) => stamp.staffId)),
    ]);
    const stamps: StampEntry[] = read.stamps.map((stamp) => ({
      number: stamp.number,
      createdAt: stamp.createdAt,
      staffFirstName: names.get(stamp.staffId) ?? '',
      reversed: stamp.reversed,
    }));
    const { loaded, kept } = read;
    return {
      ...this.toItem(loaded, kept, now),
      stamps,
      redemptions: buildRedemptions(loaded.redemptions, now),
      pastCycles: buildPastCycles(loaded.cycles, kept, now),
    };
  }

  /** RN-ENT-04. Answers the cards of the business that were asked for, new or already there. */
  async join(customerId: string, slug: string, body: JoinBusiness): Promise<JoinBusinessResponse> {
    if (!SLUG.test(slug)) throw new AppError('NOT_FOUND');
    const now = this.clock.now();
    const ids = await this.system.join({
      customerId,
      slug,
      marketingOptIn: body.marketingOptIn ?? false,
      programIds: body.programIds,
      now,
    });
    const { items } = await this.list(customerId);
    const wanted = new Set(ids);
    return { enrollments: items.filter((item) => wanted.has(item.id)) };
  }

  /** RN-ENT-02: what the page of the business shows before the customer signs in. */
  async publicBusiness(slug: string): Promise<PublicBusiness> {
    const business = SLUG.test(slug) ? await this.system.publicBusiness(slug) : undefined;
    if (!business) throw new AppError('NOT_FOUND');
    return business;
  }

  // ---------------------------------------------------------------------------------------------

  /** The cards the customer sees, with their cycles and prizes. The database applies the filter by customer. */
  private async load(trx: Transaction<DB>, now: Date, id?: string): Promise<Loaded[]> {
    const rows = await trx
      .selectFrom('enrollments as e')
      .innerJoin('programs as p', 'p.id', 'e.program_id')
      .innerJoin('businesses as b', 'b.id', 'e.business_id')
      .select([
        'e.id as id',
        'e.last_stamp_at as last_stamp_at',
        'e.created_at as created_at',
        'b.id as business_id',
        'b.name as business_name',
        'b.slug as business_slug',
        'b.category as business_category',
        'p.id as program_id',
        'p.name as program_name',
        'p.reward_description as program_reward',
        'p.card_color as program_color',
        'p.stamps_required as program_required',
        'p.status as program_status',
      ])
      .where('e.status', '=', 'active')
      .$if(id !== undefined, (qb) => qb.where('e.id', '=', id!))
      .execute();
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const [cycleRows, redemptionRows] = await Promise.all([
      trx
        .selectFrom('cycles')
        .select([
          'id',
          'enrollment_id',
          'number',
          'status',
          'stamps_required',
          'started_at',
          'completed_at',
          'expired_at',
          'last_stamp_at',
          'expires_at',
        ])
        .where('enrollment_id', 'in', ids)
        .execute(),
      trx
        .selectFrom('redemptions')
        .select([
          'id',
          'enrollment_id',
          'status',
          'reward_description',
          'earned_at',
          'expires_at',
          'redeemed_at',
        ])
        .where('enrollment_id', 'in', ids)
        .execute(),
    ]);

    const loaded = rows.map<Loaded>((row) => ({
      enrollment: {
        id: row.id,
        lastStampAt: row.last_stamp_at,
        createdAt: row.created_at,
        business: {
          id: row.business_id,
          name: row.business_name,
          slug: row.business_slug,
          category: row.business_category,
        },
        program: {
          id: row.program_id,
          name: row.program_name,
          rewardDescription: row.program_reward,
          cardColor: row.program_color,
          stampsRequired: row.program_required,
          isActive: row.program_status === 'active',
        },
      },
      cycles: cycleRows
        .filter((cycle) => cycle.enrollment_id === row.id)
        .map((cycle) => ({
          id: cycle.id,
          number: cycle.number,
          status: cycle.status,
          stampsRequired: cycle.stamps_required,
          startedAt: cycle.started_at,
          completedAt: cycle.completed_at,
          expiredAt: cycle.expired_at,
          lastStampAt: cycle.last_stamp_at,
          expiresAt: cycle.expires_at,
        })),
      redemptions: redemptionRows
        .filter((redemption) => redemption.enrollment_id === row.id)
        .map((redemption) => ({
          id: redemption.id,
          status: redemption.status,
          rewardDescription: redemption.reward_description,
          earnedAt: redemption.earned_at,
          expiresAt: redemption.expires_at,
          redeemedAt: redemption.redeemed_at,
        })),
    }));

    // The most recent activity on top, as a wallet does.
    const activity = (l: Loaded) => (l.enrollment.lastStampAt ?? l.enrollment.createdAt).getTime();
    return loaded
      .filter((l) => isVisible(l.enrollment, l.redemptions, now))
      .sort((a, b) => activity(b) - activity(a) || a.enrollment.id.localeCompare(b.enrollment.id));
  }

  private toItem(l: Loaded, kept: ReadonlyMap<string, number>, now: Date): Enrollment {
    return buildEnrollment(l.enrollment, l.cycles, kept, l.redemptions, now);
  }

  /** Visits per cycle that were not reversed. */
  private async keptStamps(trx: Transaction<DB>, loaded: Loaded[]): Promise<Map<string, number>> {
    const ids = loaded.map((l) => l.enrollment.id);
    if (ids.length === 0) return new Map();
    const rows = await trx
      .selectFrom('stamps as s')
      .select(['s.cycle_id', (eb) => eb.fn.countAll<string>().as('count')])
      .where('s.enrollment_id', 'in', ids)
      .where('s.type', '=', 'credit')
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('stamps as r')
              .select('r.id')
              .whereRef('r.reverses_stamp_id', '=', 's.id'),
          ),
        ),
      )
      .groupBy('s.cycle_id')
      .execute();
    return new Map(rows.map((row) => [row.cycle_id, Number(row.count)]));
  }

  /**
   * The visits of the cycle that is open, most recent first (RN-PRE-08 shows no reason of a
   * reversal). `number` counts the visits of the cycle in order, reversed ones included.
   */
  private async stampsOfLiveCycle(trx: Transaction<DB>, l: Loaded, now: Date) {
    const cycle = liveCycle(l.cycles, now);
    if (!cycle) return [];
    const [credits, reversals] = await Promise.all([
      trx
        .selectFrom('stamps')
        .select(['id', 'staff_id', 'created_at'])
        .where('cycle_id', '=', cycle.id)
        .where('type', '=', 'credit')
        .orderBy('created_at')
        .orderBy('id')
        .execute(),
      trx
        .selectFrom('stamps')
        .select('reverses_stamp_id')
        .where('enrollment_id', '=', l.enrollment.id)
        .where('type', '=', 'reversal')
        .execute(),
    ]);
    const reversed = new Set(reversals.map((reversal) => reversal.reverses_stamp_id));
    return credits
      .map((credit, index) => ({
        number: index + 1,
        createdAt: credit.created_at.toISOString(),
        staffId: credit.staff_id,
        reversed: reversed.has(credit.id),
      }))
      .reverse();
  }
}
