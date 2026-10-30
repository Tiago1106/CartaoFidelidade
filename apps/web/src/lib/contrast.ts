export type ReadableTone = 'light' | 'dark';

const LIGHT_TEXT = '#ffffff';
const DARK_TEXT = '#16181b';

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Invalid hex color: ${hex}`);
  const n = parseInt(match[1]!, 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** WCAG contrast ratio between two hex colors (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Tone of the text to print on a card of `cardColor`.
 * `'light'` means light text (the card is dark), `'dark'` means dark text (the card is light).
 */
export function getReadableTone(cardColor: string): ReadableTone {
  return contrastRatio(cardColor, LIGHT_TEXT) >= contrastRatio(cardColor, DARK_TEXT)
    ? 'light'
    : 'dark';
}
