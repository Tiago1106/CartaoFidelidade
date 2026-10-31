/**
 * The time source of the rules. Rules ask the clock, never `Date.now()` directly, so tests
 * can use a simulated time (golden rule 6 of CLAUDE.md).
 */
export interface Clock {
  /** Milliseconds since the Unix epoch, in UTC. */
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/** A clock that only moves when told to. For tests. */
export class ManualClock implements Clock {
  constructor(private current = Date.UTC(2026, 9, 31, 15, 0, 0)) {}

  now(): number {
    return this.current;
  }

  advanceSeconds(seconds: number): void {
    this.current += seconds * 1000;
  }
}
