// Shapes of the customer API (docs/API.md, "Cliente"). Dates are ISO 8601 strings in UTC.

export interface CustomerMe {
  id: string;
  /** `null` until the customer finishes the sign-up step (RN-ENT-07). */
  name: string | null;
  /** E.164, for example "+5511900000000". */
  phone: string;
  email: string | null;
}

export interface EnrollmentBusiness {
  id: string;
  name: string;
  slug: string;
  /** Kind of business, shown under the name on the card (for example "Barbearia"). [Premissa] */
  category: string;
}

export interface EnrollmentProgram {
  id: string;
  name: string;
  rewardDescription: string;
  /** Hex color of the card. */
  cardColor: string;
}

export interface EnrollmentProgress {
  current: number;
  required: number;
  cycleNumber: number;
  /** `null` when there is no open cycle. */
  expiresAt: string | null;
}

export interface AvailableRedemption {
  id: string;
  rewardDescription: string;
  expiresAt: string;
}

/** One item of `GET /v1/customer/enrollments`. */
export interface Enrollment {
  id: string;
  business: EnrollmentBusiness;
  program: EnrollmentProgram;
  progress: EnrollmentProgress;
  lastStampAt: string | null;
  availableRedemptions: AvailableRedemption[];
}

export interface StampEntry {
  /** Position in the cycle, starting at 1. */
  number: number;
  createdAt: string;
  /** Customers only see the first name of the staff member (RN-PRE-08). */
  staffFirstName: string;
  reversed: boolean;
}

/** `GET /v1/customer/enrollments/:id`: the enrollment plus the stamps of the current cycle. */
export interface EnrollmentDetail extends Enrollment {
  /** Most recent first. */
  stamps: StampEntry[];
}

/** `POST /v1/customer/qr-token`. */
export interface QrToken {
  token: string;
  /** What the app draws in the QR code. */
  qrPayload: string;
  expiresAt: string;
  renewInSeconds: number;
}
