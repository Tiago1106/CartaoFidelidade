/**
 * Source of the current time. Rules never call `new Date()` or `now()` themselves (golden rule 6):
 * they receive a `Clock`, so tests can move time.
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = { now: () => new Date() };

/** A clock that only moves when told to. For tests. */
export class ManualClock implements Clock {
  private current: Date;

  constructor(start: Date | string = '2026-01-01T12:00:00Z') {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  advanceSeconds(seconds: number) {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }

  set(date: Date | string) {
    this.current = new Date(date);
  }
}
