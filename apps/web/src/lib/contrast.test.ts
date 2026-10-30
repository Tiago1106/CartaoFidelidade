import { describe, expect, it } from 'vitest';
import { contrastRatio, getReadableTone } from './contrast';

// The eight card colors of RN-CAR-03 (docs/BUSINESS_RULES.md).
const darkCards = ['#16181B', '#1F3A5F', '#5B3A29'];
const lightCards = ['#F4C6D7', '#CFE3D4', '#CFE0F2', '#E3D5F0', '#E9E4D6'];

describe('getReadableTone', () => {
  it.each(darkCards)('RN-CAR-03: %s is a dark card and gets light text', (color) => {
    expect(getReadableTone(color)).toBe('light');
  });

  it.each(lightCards)('RN-CAR-03: %s is a light card and gets dark text', (color) => {
    expect(getReadableTone(color)).toBe('dark');
  });

  it('accepts lower case hex', () => {
    expect(getReadableTone('#16181b')).toBe('light');
  });

  it('rejects values that are not a 6 digit hex color', () => {
    expect(() => getReadableTone('red')).toThrow();
  });
});

describe('contrastRatio', () => {
  it('is 21 between black and white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('is 1 between a color and itself', () => {
    expect(contrastRatio('#F2B84B', '#F2B84B')).toBeCloseTo(1, 5);
  });

  it.each([...darkCards, ...lightCards])('keeps %s readable (at least 4.5:1)', (color) => {
    const text = getReadableTone(color) === 'light' ? '#FFFFFF' : '#16181B';
    expect(contrastRatio(color, text)).toBeGreaterThanOrEqual(4.5);
  });
});
