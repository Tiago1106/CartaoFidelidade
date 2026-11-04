import { z } from 'zod';
import type { EnrollmentDetail, Enrollment } from './customer';

// Cards of the customer and entering a business (docs/API.md sections 3 and 5).

/** `POST /v1/customer/businesses/:slug/join`. Both fields are optional. */
export const joinBusinessSchema = z
  .object({
    /** Starts `false` and counts only when the customer ticked it (RN-LGP-03). */
    marketingOptIn: z.boolean().optional(),
    /** Defaults to every active card of the business. */
    programIds: z.array(z.uuid()).max(50).optional(),
  })
  .strict();
export type JoinBusiness = z.infer<typeof joinBusinessSchema>;

/** Answer of `join` (`200`). */
export interface JoinBusinessResponse {
  enrollments: Enrollment[];
}

/** Answer of `GET /v1/customer/enrollments` (`200`). */
export interface EnrollmentList {
  items: Enrollment[];
}

export type RedemptionStatus = 'available' | 'redeemed' | 'expired' | 'canceled';

/** A prize of the enrollment, with the status as of now. */
export interface RedemptionEntry {
  id: string;
  rewardDescription: string;
  status: RedemptionStatus;
  earnedAt: string;
  expiresAt: string;
  redeemedAt: string | null;
}

/** A cycle that is over: completed with a prize, or expired. */
export interface PastCycle {
  number: number;
  status: 'completed' | 'expired';
  stampsRequired: number;
  /** Visits that stayed (not reversed) in the cycle. */
  stamps: number;
  startedAt: string;
  completedAt: string | null;
  expiredAt: string | null;
}

/** Answer of `GET /v1/customer/enrollments/:id`. */
export interface EnrollmentDetailResponse extends EnrollmentDetail {
  redemptions: RedemptionEntry[];
  pastCycles: PastCycle[];
}

/** Answer of `GET /v1/public/businesses/:slug` (RN-ENT-02). No data of customers or staff. */
export interface PublicBusiness {
  name: string;
  slug: string;
  programs: {
    id: string;
    name: string;
    stampsRequired: number;
    rewardDescription: string;
  }[];
}
