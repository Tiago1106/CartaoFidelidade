import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges conflicting Tailwind classes, keeping the last', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('keeps a text color next to a type scale class', () => {
    expect(cn('text-primary-foreground', 'text-button')).toBe(
      'text-primary-foreground text-button',
    );
  });

  it('still replaces one type scale class with another', () => {
    expect(cn('text-body', 'text-title-1')).toBe('text-title-1');
  });

  it('skips falsy values', () => {
    expect(cn('a', false, undefined, 'b')).toBe('a b');
  });
});
