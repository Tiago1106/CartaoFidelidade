import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SessionProvider, useSession, type SessionStatus } from './SessionProvider';

function wrapperWith(initialStatus: SessionStatus) {
  return ({ children }: { children: ReactNode }) => (
    <SessionProvider initialStatus={initialStatus}>{children}</SessionProvider>
  );
}

afterEach(() => window.localStorage.clear());

describe('SessionProvider', () => {
  it('RN-ENT-07: a new account still needs a name after the code', () => {
    const { result } = renderHook(() => useSession(), { wrapper: wrapperWith('signed-out') });
    act(() => result.current.signIn({ isNewAccount: true }));
    expect(result.current.status).toBe('needs-name');
    act(() => result.current.completeSignUp());
    expect(result.current.status).toBe('signed-in');
  });

  it('RN-ENT-07: an existing account goes straight in', () => {
    const { result } = renderHook(() => useSession(), { wrapper: wrapperWith('signed-out') });
    act(() => result.current.signIn({ isNewAccount: false }));
    expect(result.current.status).toBe('signed-in');
  });

  it('signs out', () => {
    const { result } = renderHook(() => useSession(), { wrapper: wrapperWith('signed-in') });
    act(() => result.current.signOut());
    expect(result.current.status).toBe('signed-out');
  });

  it('remembers the session across a reload', () => {
    const first = renderHook(() => useSession(), { wrapper: SessionProvider });
    act(() => first.result.current.signIn({ isNewAccount: false }));
    first.unmount();
    const second = renderHook(() => useSession(), { wrapper: SessionProvider });
    expect(second.result.current.status).toBe('signed-in');
  });

  it('starts signed out when nothing is stored', () => {
    const { result } = renderHook(() => useSession(), { wrapper: SessionProvider });
    expect(result.current.status).toBe('signed-out');
  });

  it('ignores a stored value it does not know', () => {
    window.localStorage.setItem('fregues.session', 'admin');
    const { result } = renderHook(() => useSession(), { wrapper: SessionProvider });
    expect(result.current.status).toBe('signed-out');
  });

  it('refuses to be used outside the provider', () => {
    expect(() => renderHook(() => useSession())).toThrow();
  });
});
