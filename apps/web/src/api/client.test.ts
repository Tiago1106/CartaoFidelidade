import { describe, expect, it, vi } from 'vitest';
import { fakeApi } from '@/test/fakeApi';
import { api, onSessionLost, refreshSession, request, tokenStore } from './client';

const me = () => api.get<{ name: string }>('/customer/me', { auth: true });
const refreshCalls = () =>
  fakeApi().calls.filter((c) => c.path === '/v1/customer/auth/refresh').length;

describe('the client of the API', () => {
  it('sends the access token of the session', async () => {
    const fake = fakeApi();
    fake.openSession({ complete: true });
    expect(await me()).toMatchObject({ name: 'Maria' });
    expect(fake.calls[0]!.authorization).toBe(`Bearer ${tokenStore.get()}`);
    expect(refreshCalls()).toBe(0);
  });

  it('sends no token to the routes that do not ask for one', async () => {
    const fake = fakeApi();
    fake.openSession({ complete: true });
    await api.post('/customer/auth/otp/request', { body: { phone: '+5511900000000' } });
    expect(fake.calls[0]!.authorization).toBeNull();
  });

  it('RN-AUT: an expired access token is renewed and the request is repeated once', async () => {
    const fake = fakeApi();
    fake.openSession({ complete: true });
    const before = tokenStore.get();
    fake.expireAccessTokens();
    expect(await me()).toMatchObject({ name: 'Maria' });
    expect(refreshCalls()).toBe(1);
    expect(tokenStore.get()).not.toBe(before);
    expect(fake.calls.filter((c) => c.path === '/v1/customer/me')).toHaveLength(2);
  });

  it('after a reload (no token in memory) the cookie gives one before the request', async () => {
    const fake = fakeApi();
    fake.openSession({ complete: true });
    tokenStore.clear();
    expect(await me()).toMatchObject({ name: 'Maria' });
    expect(refreshCalls()).toBe(1);
    expect(fake.calls.filter((c) => c.path === '/v1/customer/me')).toHaveLength(1);
  });

  it('many requests that need a refresh share one (the API revokes a reused token)', async () => {
    const fake = fakeApi();
    fake.openSession({ complete: true });
    fake.expireAccessTokens();
    const release = fake.holdRefresh();
    const answers = Promise.all([me(), me(), me(), me(), me()]);
    await vi.waitFor(() => expect(refreshCalls()).toBe(1));
    release();
    expect((await answers).map((a) => a.name)).toEqual(Array(5).fill('Maria'));
    expect(refreshCalls()).toBe(1);
  });

  it('a refresh asked while another is in flight gets the same answer', async () => {
    const fake = fakeApi();
    fake.openSession({ complete: true });
    const release = fake.holdRefresh();
    const first = refreshSession();
    const second = refreshSession();
    release();
    expect(await first).toBe(await second);
    expect(refreshCalls()).toBe(1);
  });

  it('a new refresh can start once the last one is over', async () => {
    fakeApi().openSession({ complete: true });
    await refreshSession();
    await refreshSession();
    expect(refreshCalls()).toBe(2);
  });

  it('tells the app when the session cannot be renewed, and fails with UNAUTHENTICATED', async () => {
    const fake = fakeApi();
    fake.openSession({ complete: true });
    const lost = vi.fn();
    const stop = onSessionLost(lost);
    fake.expireAccessTokens();
    fake.cookie = null; // revoked on another device
    await expect(me()).rejects.toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });
    expect(lost).toHaveBeenCalledTimes(1);
    expect(tokenStore.get()).toBeUndefined();
    stop();
  });

  it('does not repeat a request that failed for another reason', async () => {
    const fake = fakeApi();
    fake.openSession({ complete: true });
    await expect(api.get('/customer/nothing', { auth: true })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(refreshCalls()).toBe(0);
  });

  it('reads the code and the details of an error of the API', async () => {
    await expect(
      api.post('/customer/auth/otp/verify', { body: { phone: '+5511900000000', code: '000000' } }),
    ).rejects.toMatchObject({ code: 'OTP_EXPIRED', status: 400 });
    await api.post('/customer/auth/otp/request', { body: { phone: '+5511900000000' } });
    await expect(
      api.post('/customer/auth/otp/verify', { body: { phone: '+5511900000000', code: '000000' } }),
    ).rejects.toMatchObject({ code: 'OTP_INVALID', details: { attemptsLeft: 4 } });
  });

  it('turns a failed connection into NETWORK_ERROR, never the message of the browser', async () => {
    fakeApi().goOffline();
    await expect(
      api.post('/customer/auth/otp/request', { body: { phone: '+5511900000000' } }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR', message: 'NETWORK_ERROR' });
  });

  it('an answer that is not in the format of the API is INTERNAL_ERROR', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(request('GET', '/x')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 502,
    });
  });

  it('a 204 has no body', async () => {
    await expect(api.post('/customer/auth/logout')).resolves.toBeUndefined();
  });

  it('an offline refresh is not a lost session', async () => {
    const fake = fakeApi();
    fake.openSession({ complete: true });
    const lost = vi.fn();
    const stop = onSessionLost(lost);
    fake.expireAccessTokens();
    fake.goOffline();
    await expect(me()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(lost).not.toHaveBeenCalled();
    stop();
  });
});
