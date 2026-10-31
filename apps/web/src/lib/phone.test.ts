import { describe, expect, it } from 'vitest';
import { formatE164, formatNationalPhone, isValidMobile, nationalDigits, toE164 } from './phone';

describe('formatNationalPhone', () => {
  it.each([
    ['', ''],
    ['1', '(1'],
    ['11', '(11'],
    ['119', '(11) 9'],
    ['1190000', '(11) 90000'],
    ['11900000', '(11) 90000-0'],
    ['11900000000', '(11) 90000-0000'],
  ])('formats %j as %j', (digits, expected) => {
    expect(formatNationalPhone(digits)).toBe(expected);
  });

  it('never ends with a space or a dash, so Backspace is not undone by the mask', () => {
    for (let n = 0; n <= 11; n++) {
      expect(formatNationalPhone('11900000000'.slice(0, n))).not.toMatch(/[ -]$/);
    }
  });

  it('ignores digits beyond 11', () => {
    expect(formatNationalPhone('119000000001234')).toBe('(11) 90000-0000');
  });
});

describe('nationalDigits', () => {
  it('keeps only the digits', () => {
    expect(nationalDigits('(11) 90000-0000')).toBe('11900000000');
  });

  it('drops a pasted +55', () => {
    expect(nationalDigits('+55 (11) 90000-0000')).toBe('11900000000');
    expect(nationalDigits('5511900000000')).toBe('11900000000');
  });

  it('does not drop a leading 55 that is a real area code', () => {
    expect(nationalDigits('55999990000')).toBe('55999990000');
  });

  it('limits to 11 digits', () => {
    expect(nationalDigits('1190000000099')).toBe('11900000000');
  });

  it('returns nothing for letters', () => {
    expect(nationalDigits('abc')).toBe('');
  });
});

describe('isValidMobile', () => {
  it.each(['11900000000', '21987654321', '99999999999'])('RN-AUT-01: %s is valid', (digits) => {
    expect(isValidMobile(digits)).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['1190000000', 'one digit short'],
    ['119000000000', 'one digit too many'],
    ['11800000000', 'does not have the leading 9'],
    ['01900000000', 'area code starting with 0'],
    ['10900000000', 'area code ending with 0'],
    ['1190000000a', 'has a letter'],
  ])('%j is invalid (%s)', (digits) => {
    expect(isValidMobile(digits)).toBe(false);
  });
});

describe('E.164', () => {
  it('builds the +55 number of the API', () => {
    expect(toE164('11900000000')).toBe('+5511900000000');
  });

  it('shows a +55 mobile as a national number', () => {
    expect(formatE164('+5511900000000')).toBe('(11) 90000-0000');
  });

  it('leaves anything else as it is', () => {
    expect(formatE164('+14155550100')).toBe('+14155550100');
  });
});
