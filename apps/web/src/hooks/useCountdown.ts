import { useCallback, useEffect, useState } from 'react';

/** Counts down once per second, from `initialSeconds` to 0. `restart` starts over. */
export function useCountdown(initialSeconds: number) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const restart = useCallback((next: number) => setSeconds(next), []);

  return { seconds, restart };
}
