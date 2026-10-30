/**
 * Stands in for a network call in Phase B (decision D-008). It answers asynchronously,
 * like the API will, and returns a copy so callers cannot change the fixture.
 */
export function fakeRequest<T>(value: T, delayMs = 0): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(structuredClone(value)), delayMs);
  });
}
