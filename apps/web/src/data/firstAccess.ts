import { fakeRequest } from './fakeRequest';

// Simulated first access (Phase B, decision D-008). RN-ENT-07: a new account gives only a name.
// RN-ENT-08: the Terms were accepted on the phone screen, so the app sends `acceptTerms: true`.
// Phase C replaces this with `PATCH /v1/customer/me`.

export const NAME_MAX_LENGTH = 60;

/** The name as it is saved: no spaces around it and none repeated inside. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** `PATCH /v1/customer/me` with `{ name, acceptTerms: true }` */
export async function saveFirstAccessName(name: string): Promise<{ name: string }> {
  const clean = cleanName(name).slice(0, NAME_MAX_LENGTH);
  return fakeRequest({ name: clean });
}
