import { createHash } from 'node:crypto';
import type pg from 'pg';

// Sample data of the design: Maria and her three cards (Studio Bela, Barbearia Navalha and
// Espaço Vita), as in `docs/design/screens/` and in the fixtures of the web app. Used by
// `pnpm db:seed` and by the tests.
//
// Runs as the owner of the tables (it writes across businesses), never as `app_user`.
// Every id is derived from a name, so running it again changes nothing. The dates are fixed,
// as in the design; nothing here reads the clock (golden rule 6).

/** A stable uuid for a name, such as `id('business', 'bela')`. */
export function id(...parts: string[]): string {
  const hex = createHash('md5')
    .update(`fregues-seed:${parts.join(':')}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export const SEED_CUSTOMER = {
  id: id('customer', 'maria'),
  phone: '+5511900000000',
  name: 'Maria',
};

const STAFF = ['Ana', 'Rafael', 'Marina'] as const;
const DAY = 24 * 60 * 60 * 1000;

interface SeedCard {
  key: string;
  business: { name: string; slug: string; category: string };
  program: {
    name: string;
    reward: string;
    color: string;
    validityDays: number;
    rewardValidityDays: number;
  };
  /** Cycles of the enrollment, oldest first. The last one is the current one. */
  cycles: {
    number: number;
    stamps: { at: string; staff: (typeof STAFF)[number] }[];
    completed: boolean;
  }[];
}

/** Ten visits two weeks apart, ending at `last`. */
function every14Days(last: string, count: number, firstStaff = 0) {
  return Array.from({ length: count }, (_, i) => ({
    at: new Date(Date.parse(last) - (count - 1 - i) * 14 * DAY).toISOString(),
    staff: STAFF[(firstStaff + i) % STAFF.length]!,
  }));
}

const cards: SeedCard[] = [
  {
    key: 'bela',
    business: { name: 'Studio Bela', slug: 'studio-bela', category: 'Salão de beleza' },
    program: {
      name: 'Escova',
      reward: '1 escova grátis',
      color: '#F4C6D7',
      validityDays: 30,
      rewardValidityDays: 30,
    },
    cycles: [
      {
        number: 1,
        completed: true,
        // The ten visits of `Cartao-Detalhe.dc.html` (the first four are made up).
        stamps: [
          ['2026-06-24T12:40:00Z', 'Ana'],
          ['2026-07-08T21:15:00Z', 'Marina'],
          ['2026-07-22T13:30:00Z', 'Rafael'],
          ['2026-08-05T18:00:00Z', 'Ana'],
          ['2026-08-19T14:42:00Z', 'Marina'],
          ['2026-09-02T19:10:00Z', 'Ana'],
          ['2026-09-16T12:20:00Z', 'Marina'],
          ['2026-09-30T13:05:00Z', 'Rafael'],
          ['2026-10-14T20:48:00Z', 'Ana'],
          ['2026-10-30T17:32:00Z', 'Ana'],
        ].map(([at, staff]) => ({ at: at!, staff: staff as (typeof STAFF)[number] })),
      },
    ],
  },
  {
    key: 'navalha',
    business: { name: 'Barbearia Navalha', slug: 'navalha', category: 'Barbearia' },
    program: {
      name: 'Corte',
      reward: '1 corte grátis',
      color: '#16181B',
      validityDays: 90,
      rewardValidityDays: 30,
    },
    cycles: [
      { number: 1, completed: true, stamps: every14Days('2026-05-02T15:00:00Z', 10) },
      { number: 2, completed: false, stamps: every14Days('2026-10-20T14:10:00Z', 7, 1) },
    ],
  },
  {
    key: 'vita',
    business: { name: 'Espaço Vita', slug: 'espaco-vita', category: 'Estética' },
    program: {
      name: 'Limpeza de pele',
      reward: '1 limpeza de pele grátis',
      color: '#CFE3D4',
      validityDays: 180,
      rewardValidityDays: 30,
    },
    cycles: [{ number: 1, completed: false, stamps: every14Days('2026-09-28T19:05:00Z', 2) }],
  },
];

/** "End of the day" in São Paulo, `days` after `at`: the formula of DATA_MODEL section 5. */
// The `::timestamp` matters: `date AT TIME ZONE` would read the date in the session time zone
// (DATA_MODEL.md section 5 has that gap) and give the wrong hour.
const endOfDayAfter = `((date($1::timestamptz AT TIME ZONE 'America/Sao_Paulo') + $2::int + 1)::timestamp) AT TIME ZONE 'America/Sao_Paulo'`;

export async function seed(client: pg.Client): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO customers (id, phone_e164, name, terms_accepted_at, terms_version)
       VALUES ($1, $2, $3, '2026-06-24T12:30:00Z', '2026-06-01') ON CONFLICT DO NOTHING`,
      [SEED_CUSTOMER.id, SEED_CUSTOMER.phone, SEED_CUSTOMER.name],
    );

    for (const card of cards) {
      const businessId = id('business', card.key);
      const programId = id('program', card.key);
      const enrollmentId = id('enrollment', card.key);

      await client.query(
        `INSERT INTO businesses (id, name, slug, category, billing_status, trial_ends_at)
         VALUES ($1, $2, $3, $4, 'active', '2027-01-01T00:00:00Z') ON CONFLICT DO NOTHING`,
        [businessId, card.business.name, card.business.slug, card.business.category],
      );

      // One owner and three employees per business. They have no password: nobody can sign in
      // as them until the staff login exists.
      await client.query(
        `INSERT INTO staff (id, business_id, name, email, role)
         VALUES ($1, $2, 'Carla', $3, 'owner') ON CONFLICT DO NOTHING`,
        [id('staff', card.key, 'owner'), businessId, `dono@${card.business.slug}.example`],
      );
      for (const name of STAFF) {
        await client.query(
          `INSERT INTO staff (id, business_id, name, email, role)
           VALUES ($1, $2, $3, $4, 'employee') ON CONFLICT DO NOTHING`,
          [
            id('staff', card.key, name),
            businessId,
            name,
            `${name.toLowerCase()}@${card.business.slug}.example`,
          ],
        );
      }

      await client.query(
        `INSERT INTO programs (id, business_id, name, stamps_required, reward_description,
                               validity_days, reward_validity_days, card_color)
         VALUES ($1, $2, $3, 10, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
        [
          programId,
          businessId,
          card.program.name,
          card.program.reward,
          card.program.validityDays,
          card.program.rewardValidityDays,
          card.program.color,
        ],
      );

      const firstVisit = card.cycles[0]!.stamps[0]!.at;
      const lastCycle = card.cycles[card.cycles.length - 1]!;
      const lastVisit = lastCycle.stamps[lastCycle.stamps.length - 1]!.at;
      // A completed cycle leaves no current cycle (DATA_MODEL 10.1, step 9).
      const currentCycleId = lastCycle.completed
        ? null
        : id('cycle', card.key, String(lastCycle.number));

      await client.query(
        `INSERT INTO business_customers (business_id, customer_id, first_seen_at, marketing_source)
         VALUES ($1, $2, $3, 'first_login') ON CONFLICT DO NOTHING`,
        [businessId, SEED_CUSTOMER.id, firstVisit],
      );
      // The cycle is inserted below, in the same transaction: the foreign key is deferred.
      await client.query(
        `INSERT INTO enrollments (id, business_id, customer_id, program_id, current_cycle_id,
                                  last_stamp_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
        [
          enrollmentId,
          businessId,
          SEED_CUSTOMER.id,
          programId,
          currentCycleId,
          lastVisit,
          firstVisit,
        ],
      );

      for (const cycle of card.cycles) {
        const cycleId = id('cycle', card.key, String(cycle.number));
        const last = cycle.stamps[cycle.stamps.length - 1]!.at;
        const first = cycle.stamps[0]!.at;
        await client.query(
          `INSERT INTO cycles (id, business_id, enrollment_id, number, status, stamps_required,
                               reward_description, validity_days, reward_validity_days,
                               last_stamp_at, expires_at, started_at, completed_at)
           VALUES ($3, $4, $5, $6, $7, 10, $8, $9, $10, $1, ${endOfDayAfter}, $11, $12)
           ON CONFLICT DO NOTHING`,
          [
            last,
            card.program.validityDays,
            cycleId,
            businessId,
            enrollmentId,
            cycle.number,
            cycle.completed ? 'completed' : 'open',
            card.program.reward,
            card.program.validityDays,
            card.program.rewardValidityDays,
            first,
            cycle.completed ? last : null,
          ],
        );

        for (const [index, stamp] of cycle.stamps.entries()) {
          await client.query(
            `INSERT INTO stamps (id, business_id, enrollment_id, cycle_id, customer_id, staff_id,
                                 type, method, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'credit', 'qr', $7) ON CONFLICT DO NOTHING`,
            [
              id('stamp', card.key, String(cycle.number), String(index + 1)),
              businessId,
              enrollmentId,
              cycleId,
              SEED_CUSTOMER.id,
              id('staff', card.key, stamp.staff),
              stamp.at,
            ],
          );
        }

        if (cycle.completed) {
          // Studio Bela's prize is waiting; the one of the Navalha was used a while ago.
          const available = card.key === 'bela';
          await client.query(
            `INSERT INTO redemptions (id, business_id, enrollment_id, cycle_id, customer_id, status,
                                      reward_description, earned_at, expires_at,
                                      redeemed_at, redeemed_by_staff_id)
             VALUES ($3, $4, $5, $6, $7, $8, $9, $1, ${endOfDayAfter}, $10, $11)
             ON CONFLICT DO NOTHING`,
            [
              last,
              card.program.rewardValidityDays,
              id('redemption', card.key, String(cycle.number)),
              businessId,
              enrollmentId,
              cycleId,
              SEED_CUSTOMER.id,
              available ? 'available' : 'redeemed',
              card.program.reward,
              available ? null : new Date(Date.parse(last) + 3 * DAY).toISOString(),
              available ? null : id('staff', card.key, 'Ana'),
            ],
          );
        }
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
