import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { api, tokenStore } from '@/api/client';
import { EXISTING_PHONE, fakeApi } from '@/test/fakeApi';
import { SessionProvider, useSession, type SessionStatus } from './SessionProvider';

function wrapperWith(initialStatus?: Exclude<SessionStatus, 'loading'>) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>
      <SessionProvider initialStatus={initialStatus}>{children}</SessionProvider>
    </QueryClientProvider>
  );
}

const sessionOf = (phone: string, name: string | null) => ({
  accessToken: 'token-from-the-server',
  expiresIn: 900,
  customer: { id: 'cus_1', phone, name, email: null, profileComplete: name !== null },
});

describe('SessionProvider', () => {
  it('RN-ENT-07: a new account still needs a name after the code', () => {
    const { result } = renderHook(() => useSession(), { wrapper: wrapperWith('signed-out') });
    act(() => result.current.signIn(sessionOf('+5521987654321', null)));
    expect(result.current.status).toBe('needs-name');
    expect(tokenStore.get()).toBe('token-from-the-server');
    act(() => result.current.completeSignUp(sessionOf('+5521987654321', 'Ana').customer));
    expect(result.current.status).toBe('signed-in');
    expect(result.current.customer?.name).toBe('Ana');
  });

  it('RN-ENT-07: an existing account goes straight in', () => {
    const { result } = renderHook(() => useSession(), { wrapper: wrapperWith('signed-out') });
    act(() => result.current.signIn(sessionOf(EXISTING_PHONE, 'Maria')));
    expect(result.current.status).toBe('signed-in');
  });

  it('signs out here at once, forgets the token and tells the server', async () => {
    const fake = fakeApi();
    fake.openSession({ complete: true });
    const { result } = renderHook(() => useSession(), { wrapper: wrapperWith('signed-in') });
    act(() => result.current.signOut());
    expect(result.current.status).toBe('signed-out');
    await waitFor(() => expect(tokenStore.get()).toBeUndefined());
    expect(fake.calls.some((c) => c.path === '/v1/customer/auth/logout')).toBe(true);
    expect(fake.cookie).toBeNull();
  });

  it('signs out even when the server cannot be reached', async () => {
    const fake = fakeApi();
    fake.openSession({ complete: true });
    const { result } = renderHook(() => useSession(), { wrapper: wrapperWith('signed-in') });
    fake.goOffline();
    act(() => result.current.signOut());
    expect(result.current.status).toBe('signed-out');
    await waitFor(() => expect(tokenStore.get()).toBeUndefined());
  });

  describe('opening the app (the refresh cookie)', () => {
    it('is loading until the server answers, then signed in with the customer', async () => {
      fakeApi().openSession({ complete: true });
      tokenStore.clear(); // a reload: the cookie is there, the memory is empty
      const { result } = renderHook(() => useSession(), { wrapper: wrapperWith() });
      expect(result.current.status).toBe('loading');
      await waitFor(() => expect(result.current.status).toBe('signed-in'));
      expect(result.current.customer).toMatchObject({ name: 'Maria', phone: EXISTING_PHONE });
      expect(tokenStore.get()).toBeDefined();
    });

    it('RN-ENT-07: a cookie of an account without a name goes back to the name step', async () => {
      fakeApi().openSession({ complete: false });
      tokenStore.clear();
      const { result } = renderHook(() => useSession(), { wrapper: wrapperWith() });
      await waitFor(() => expect(result.current.status).toBe('needs-name'));
    });

    it('is signed out when there is no cookie', async () => {
      const { result } = renderHook(() => useSession(), { wrapper: wrapperWith() });
      await waitFor(() => expect(result.current.status).toBe('signed-out'));
      expect(result.current.customer).toBeNull();
    });

    it('is signed out when the server is down, and the cookie is left alone', async () => {
      const fake = fakeApi();
      fake.openSession({ complete: true });
      tokenStore.clear();
      fake.breakServer();
      const { result } = renderHook(() => useSession(), { wrapper: wrapperWith() });
      await waitFor(() => expect(result.current.status).toBe('signed-out'));
      // The next visit may find the server back.
      expect(fake.cookie).not.toBeNull();
    });

    it('React runs the effect twice in development, but the cookie is used once', async () => {
      const fake = fakeApi();
      fake.openSession({ complete: true });
      tokenStore.clear();
      const { result } = renderHook(() => useSession(), {
        wrapper: wrapperWith(),
        reactStrictMode: true,
      });
      await waitFor(() => expect(result.current.status).toBe('signed-in'));
      expect(fake.calls.filter((c) => c.path === '/v1/customer/auth/refresh')).toHaveLength(1);
    });
  });

  it('goes to signed out when a request finds the session cannot be renewed', async () => {
    const fake = fakeApi();
    fake.openSession({ complete: true });
    const { result } = renderHook(() => useSession(), { wrapper: wrapperWith('signed-in') });
    fake.expireAccessTokens();
    fake.cookie = null; // revoked on another device
    await expect(api.get('/customer/me', { auth: true })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await waitFor(() => expect(result.current.status).toBe('signed-out'));
  });

  it('refuses to be used outside the provider', () => {
    expect(() => renderHook(() => useSession())).toThrow();
  });
});
