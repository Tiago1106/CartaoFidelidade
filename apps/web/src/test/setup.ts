import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetFakeApi } from './fakeApi';

// jsdom does not implement this, and `input-otp` calls it on pointer events.
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

// Every test starts with a fresh fake API, no access token and no refresh cookie.
beforeEach(() => {
  resetFakeApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
