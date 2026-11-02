import { z } from 'zod';
import type { AuthCustomer } from './auth';

// The profile of the customer (docs/API.md section 5). The API validates with these schemas and
// the web app imports the same types.

/**
 * The version of the Terms of use and of the Privacy policy that the app shows today. It is
 * recorded with the date when the customer accepts them (RN-LGP-02).
 */
export const TERMS_VERSION = '2026-10-01';

export const CUSTOMER_NAME_MAX_LENGTH = 80;
export const CUSTOMER_EMAIL_MAX_LENGTH = 254;

/**
 * `PATCH /v1/customer/me`. Every field is optional but one is needed. At the first access the app
 * sends only `name` and `acceptTerms: true` (RN-ENT-07, RN-ENT-08). The phone is not editable, so
 * any other field is refused. `email: null` removes the e-mail.
 */
export const customerProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(CUSTOMER_NAME_MAX_LENGTH).optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(CUSTOMER_EMAIL_MAX_LENGTH)
      .pipe(z.email())
      .nullable()
      .optional(),
    acceptTerms: z.literal(true).optional(),
    termsVersion: z.string().max(32).optional(),
  })
  .strict()
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'At least one field is needed.',
  });
export type CustomerProfileUpdate = z.infer<typeof customerProfileUpdateSchema>;

/** `GET` and `PATCH /v1/customer/me`. */
export interface CustomerProfile extends AuthCustomer {
  /** When the Terms were accepted, in UTC. `null` until then. */
  termsAcceptedAt: string | null;
  termsVersion: string | null;
}
