import type { AuthSessionResponse } from '@fregues/shared';
import { ApiError, type ApiErrorCode } from './errors';

// The client of the API (docs/API.md section 1). The app asks `/v1/...` of its own address (in
// development Vite forwards it to the API). The access token lives in memory only; the refresh
// token is an HttpOnly cookie the browser sends by itself and no script can read.
//
// Two rules keep the session safe:
// - There is one refresh at a time. The API revokes a whole login when an old refresh token is
//   shown again, so two requests must never refresh with the same cookie. Every caller that needs
//   a refresh waits for the one in flight (docs/API.md, [Premissa] of `refresh`).
// - A request that fails with `TOKEN_EXPIRED` is repeated once after a refresh, so the person
//   never notices the access token (15 minutes) running out.

let accessToken: string | undefined;
let refreshing: Promise<AuthSessionResponse | null> | undefined;
const lostListeners = new Set<() => void>();

export const tokenStore = {
  get: () => accessToken,
  set: (token: string) => {
    accessToken = token;
  },
  clear: () => {
    accessToken = undefined;
  },
};

/** Called when a signed in session can no longer be renewed (the person has to sign in again). */
export function onSessionLost(listener: () => void): () => void {
  lostListeners.add(listener);
  return () => lostListeners.delete(listener);
}

interface Options {
  body?: unknown;
  /** Sends the access token, renewing it when it has expired. */
  auth?: boolean;
}

async function send(method: string, path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(`/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    // No connection, or the server is down. The text is the app's own, never the browser's.
    throw new ApiError('NETWORK_ERROR');
  }
}

/** The error of an answer that is not a success. */
async function toError(response: Response): Promise<ApiError> {
  try {
    const { error } = (await response.json()) as {
      error?: { code?: ApiErrorCode; details?: Record<string, unknown> };
    };
    if (error?.code) return new ApiError(error.code, error.details ?? {}, response.status);
  } catch {
    // Not the format of the API (a proxy page, for example).
  }
  return new ApiError('INTERNAL_ERROR', {}, response.status);
}

async function read<T>(response: Response): Promise<T> {
  if (!response.ok) throw await toError(response);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

/**
 * Renews the access token with the refresh cookie. Resolves `null` when there is no valid session
 * (no cookie, expired or revoked): the person has to sign in. Rejects with `NETWORK_ERROR` or
 * `INTERNAL_ERROR` when the server could not answer, which says nothing about the session.
 */
export function refreshSession(): Promise<AuthSessionResponse | null> {
  refreshing ??= (async () => {
    const response = await send('POST', '/customer/auth/refresh', undefined);
    if (response.status === 401) {
      tokenStore.clear();
      return null;
    }
    const session = await read<AuthSessionResponse>(response);
    tokenStore.set(session.accessToken);
    return session;
  })().finally(() => {
    refreshing = undefined;
  });
  return refreshing;
}

function lose(): never {
  for (const listener of lostListeners) listener();
  throw new ApiError('UNAUTHENTICATED', {}, 401);
}

export async function request<T>(method: string, path: string, options: Options = {}): Promise<T> {
  if (!options.auth) return read<T>(await send(method, path, options.body));

  // After a reload there is no access token yet: the cookie gives one.
  if (!tokenStore.get() && !(await refreshSession())) return lose();
  let response = await send(method, path, options.body, tokenStore.get());

  if (response.status === 401) {
    const failure = await toError(response.clone());
    if (failure.code !== 'TOKEN_EXPIRED' && failure.code !== 'UNAUTHENTICATED') throw failure;
    if (!(await refreshSession())) return lose();
    response = await send(method, path, options.body, tokenStore.get());
  }
  return read<T>(response);
}

export const api = {
  get: <T>(path: string, options?: Options) => request<T>('GET', path, options),
  post: <T>(path: string, options?: Options) => request<T>('POST', path, options),
  patch: <T>(path: string, options?: Options) => request<T>('PATCH', path, options),
};
