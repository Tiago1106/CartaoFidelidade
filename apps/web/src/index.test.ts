import { describe, expect, it } from 'vitest';
import { appSlug } from './index';

describe('web workspace', () => {
  it('resolves the shared package', () => {
    expect(appSlug).toBe('fregues');
  });
});
