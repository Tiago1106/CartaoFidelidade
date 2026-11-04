import type { Enrollment, PastCycle, RedemptionEntry, RedemptionStatus } from '@fregues/shared';

// The shape the customer sees, built from rows the database already filtered to the customer.
// Pure functions: the time comes in as an argument (golden rule 6). Nothing is written here.
//
// Expiry is worked out at read time (RN-VAL-03, docs/DATA_MODEL.md 10.3). The customer has no
// right to write, so the row is not changed by a read; the next visit or redemption, which runs as
// the business, stores the state. What the customer sees is the same either way.

export interface EnrollmentRow {
  id: string;
  lastStampAt: Date | null;
  createdAt: Date;
  business: { id: string; name: string; slug: string; category: string | null };
  program: {
    id: string;
    name: string;
    rewardDescription: string;
    cardColor: string;
    stampsRequired: number;
    isActive: boolean;
  };
}

export interface CycleRow {
  id: string;
  number: number;
  status: 'open' | 'completed' | 'expired';
  stampsRequired: number;
  startedAt: Date;
  completedAt: Date | null;
  expiredAt: Date | null;
  lastStampAt: Date | null;
  expiresAt: Date | null;
}

export interface RedemptionRow {
  id: string;
  status: 'available' | 'redeemed' | 'expired' | 'canceled';
  rewardDescription: string;
  earnedAt: Date;
  expiresAt: Date;
  redeemedAt: Date | null;
}

/** An open cycle whose last visit is older than `validity_days` has lost its points (RN-VAL-01). */
export function isExpired(cycle: CycleRow, now: Date): boolean {
  return (
    cycle.status === 'open' &&
    cycle.lastStampAt !== null &&
    cycle.expiresAt !== null &&
    now.getTime() > cycle.expiresAt.getTime()
  );
}

/** The cycle that is open and still alive, or `undefined` (RN-VAL-02). */
export function liveCycle(cycles: CycleRow[], now: Date): CycleRow | undefined {
  return cycles.find((cycle) => cycle.status === 'open' && !isExpired(cycle, now));
}

/** A prize is available until the end of its last day; after that it is `expired`. */
export function redemptionStatus(redemption: RedemptionRow, now: Date): RedemptionStatus {
  return redemption.status === 'available' && redemption.expiresAt.getTime() < now.getTime()
    ? 'expired'
    : redemption.status;
}

/** The prizes the customer can still use, the one that expires first on top (RN-PRE-04). */
export function availablePrizes(redemptions: RedemptionRow[], now: Date): RedemptionRow[] {
  return redemptions
    .filter((redemption) => redemptionStatus(redemption, now) === 'available')
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
}

/**
 * A card leaves the list when its program is archived (RN-CAR-06), unless a prize is still there
 * to be redeemed.
 */
export function isVisible(row: EnrollmentRow, redemptions: RedemptionRow[], now: Date): boolean {
  return row.program.isActive || availablePrizes(redemptions, now).length > 0;
}

export function buildEnrollment(
  row: EnrollmentRow,
  cycles: CycleRow[],
  keptStamps: ReadonlyMap<string, number>,
  redemptions: RedemptionRow[],
  now: Date,
): Enrollment {
  const open = liveCycle(cycles, now);
  // Without a live cycle the card shows 0 of N with the current rules, and the cycle that the
  // next visit will open (the number after the last one) (docs/API.md section 5).
  const nextNumber = cycles.reduce((highest, cycle) => Math.max(highest, cycle.number), 0) + 1;
  return {
    id: row.id,
    business: row.business,
    program: {
      id: row.program.id,
      name: row.program.name,
      rewardDescription: row.program.rewardDescription,
      cardColor: row.program.cardColor,
    },
    progress: open
      ? {
          current: keptStamps.get(open.id) ?? 0,
          required: open.stampsRequired,
          cycleNumber: open.number,
          expiresAt: open.expiresAt?.toISOString() ?? null,
        }
      : {
          current: 0,
          required: row.program.stampsRequired,
          cycleNumber: nextNumber,
          expiresAt: null,
        },
    lastStampAt: row.lastStampAt?.toISOString() ?? null,
    availableRedemptions: availablePrizes(redemptions, now).map((redemption) => ({
      id: redemption.id,
      rewardDescription: redemption.rewardDescription,
      expiresAt: redemption.expiresAt.toISOString(),
    })),
  };
}

export function buildRedemptions(redemptions: RedemptionRow[], now: Date): RedemptionEntry[] {
  return [...redemptions]
    .sort((a, b) => b.earnedAt.getTime() - a.earnedAt.getTime())
    .map((redemption) => ({
      id: redemption.id,
      rewardDescription: redemption.rewardDescription,
      status: redemptionStatus(redemption, now),
      earnedAt: redemption.earnedAt.toISOString(),
      expiresAt: redemption.expiresAt.toISOString(),
      redeemedAt: redemption.redeemedAt?.toISOString() ?? null,
    }));
}

/** Cycles that are over, most recent first. A cycle that lapsed but is not stored yet counts. */
export function buildPastCycles(
  cycles: CycleRow[],
  keptStamps: ReadonlyMap<string, number>,
  now: Date,
): PastCycle[] {
  return cycles
    .filter((cycle) => cycle.status !== 'open' || isExpired(cycle, now))
    .sort((a, b) => b.number - a.number)
    .map((cycle) => {
      const expired = cycle.status !== 'completed';
      return {
        number: cycle.number,
        status: expired ? ('expired' as const) : ('completed' as const),
        stampsRequired: cycle.stampsRequired,
        stamps: keptStamps.get(cycle.id) ?? 0,
        startedAt: cycle.startedAt.toISOString(),
        completedAt: cycle.completedAt?.toISOString() ?? null,
        // The cycle ends on the day it lapsed, not on the day somebody noticed (DATA_MODEL 10.3).
        expiredAt: expired ? ((cycle.expiredAt ?? cycle.expiresAt)?.toISOString() ?? null) : null,
      };
    });
}
