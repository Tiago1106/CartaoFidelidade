import { describe, expect, it } from 'vitest';
import { APP_SLUG } from './index';

describe('shared package', () => {
  it('exports the app slug', () => {
    expect(APP_SLUG).toBe('fregues');
  });
});
