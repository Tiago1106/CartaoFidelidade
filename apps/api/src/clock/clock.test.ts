import { describe, expect, it } from 'vitest';
import { ManualClock, systemClock } from './clock';

describe('Clock', () => {
  it('the system clock follows real time', () => {
    const before = Date.now();
    const now = systemClock.now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it('a manual clock stands still until it is moved', () => {
    const clock = new ManualClock('2026-03-01T10:00:00Z');
    expect(clock.now().toISOString()).toBe('2026-03-01T10:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-03-01T10:00:00.000Z');
    clock.advanceSeconds(90);
    expect(clock.now().toISOString()).toBe('2026-03-01T10:01:30.000Z');
  });

  it('changing the date it returned does not move the clock', () => {
    const clock = new ManualClock('2026-03-01T10:00:00Z');
    clock.now().setFullYear(2000);
    expect(clock.now().getUTCFullYear()).toBe(2026);
  });
});
