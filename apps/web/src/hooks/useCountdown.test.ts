import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCountdown } from './useCountdown';

/** The countdown schedules the next second after each render, so it advances one second at a time. */
function tick(seconds: number) {
  for (let i = 0; i < seconds; i++) act(() => vi.advanceTimersByTime(1000));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useCountdown', () => {
  it('counts down one second at a time', () => {
    const { result } = renderHook(() => useCountdown(3));
    expect(result.current.seconds).toBe(3);
    tick(1);
    expect(result.current.seconds).toBe(2);
    tick(2);
    expect(result.current.seconds).toBe(0);
  });

  it('stops at zero', () => {
    const { result } = renderHook(() => useCountdown(1));
    tick(5);
    expect(result.current.seconds).toBe(0);
  });

  it('starts over with restart', () => {
    const { result } = renderHook(() => useCountdown(2));
    tick(2);
    expect(result.current.seconds).toBe(0);
    act(() => result.current.restart(60));
    expect(result.current.seconds).toBe(60);
    tick(1);
    expect(result.current.seconds).toBe(59);
  });
});
