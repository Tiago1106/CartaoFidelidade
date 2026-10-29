import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Custom type scale from index.css: without this, `text-button` is treated as a color
// and removes `text-primary-foreground` when merged.
export const typeScale = [
  'display',
  'title-1',
  'title-2',
  'title-3',
  'metric',
  'body-lg',
  'body',
  'body-sm',
  'caption',
  'micro',
  'label',
  'button',
  'overline',
] as const;

const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: [...typeScale] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
