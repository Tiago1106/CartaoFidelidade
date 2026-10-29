import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges conflicting Tailwind classes, keeping the last', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('skips falsy values', () => {
    expect(cn('a', false, undefined, 'b')).toBe('a b');
  });
});
