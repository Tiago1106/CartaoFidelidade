// Brazilian mobile numbers (RN-AUT-01: only +55 in the MVP). A national number here is
// 11 digits: a 2 digit area code (DDD), the leading 9 and 8 more digits.

const NATIONAL_LENGTH = 11;

/** Keeps only the digits. A pasted "+55" or "55" prefix is dropped when the rest is a full number. */
export function nationalDigits(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.length > NATIONAL_LENGTH && digits.startsWith('55')) digits = digits.slice(2);
  return digits.slice(0, NATIONAL_LENGTH);
}

/** Formats while typing: "(1", "(11", "(11) 9", "(11) 90000", "(11) 90000-0000". */
export function formatNationalPhone(digits: string): string {
  const d = digits.slice(0, NATIONAL_LENGTH);
  if (d.length === 0) return '';
  // No trailing space after the area code, so Backspace is never undone by the mask.
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** A mobile number: DDD from 11 to 99, then a 9 and 8 more digits. */
export function isValidMobile(digits: string): boolean {
  return /^[1-9][1-9]9\d{8}$/.test(digits);
}

/** "+5511900000000", the format of the API (docs/API.md). */
export function toE164(digits: string): string {
  return `+55${digits}`;
}

/** "+5511900000000" to "(11) 90000-0000". Returns the input when it is not a +55 mobile. */
export function formatE164(phone: string): string {
  const match = /^\+55(\d{11})$/.exec(phone);
  return match ? formatNationalPhone(match[1]!) : phone;
}
