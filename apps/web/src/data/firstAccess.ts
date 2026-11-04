import type { CustomerProfile } from '@fregues/shared';
import { api } from '@/api/client';

// First access (docs/API.md section 5). RN-ENT-07: a new account gives only a name.
// RN-ENT-08: the Terms were accepted on the phone screen, so the app sends `acceptTerms: true`;
// the server records the version and the date.

export const NAME_MAX_LENGTH = 60;

/** The name as it is saved: no spaces around it and none repeated inside. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** `PATCH /v1/customer/me` with `{ name, acceptTerms: true }` */
export function saveFirstAccessName(name: string): Promise<CustomerProfile> {
  const clean = cleanName(name).slice(0, NAME_MAX_LENGTH);
  return api.patch('/customer/me', { auth: true, body: { name: clean, acceptTerms: true } });
}
