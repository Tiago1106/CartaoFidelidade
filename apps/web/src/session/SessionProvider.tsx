import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Simulated customer session (Phase B). The real one comes from the API in Phase C.
 *
 * - `signed-out`: no session.
 * - `needs-name`: signed in with a new account, still has to fill the name (RN-ENT-07).
 * - `signed-in`: signed in and with a name.
 */
export type SessionStatus = 'signed-out' | 'needs-name' | 'signed-in';

interface SessionValue {
  status: SessionStatus;
  /** After the SMS code. A new account still needs a name. */
  signIn: (options: { isNewAccount: boolean }) => void;
  /** After the name step. */
  completeSignUp: () => void;
  signOut: () => void;
}

const STORAGE_KEY = 'fregues.session';
const statuses: SessionStatus[] = ['signed-out', 'needs-name', 'signed-in'];

function isStatus(value: unknown): value is SessionStatus {
  return typeof value === 'string' && (statuses as string[]).includes(value);
}

function readInitialStatus(): SessionStatus {
  try {
    // In development, `?session=signed-in` jumps straight to a state, to look at screens.
    if (import.meta.env.DEV) {
      const fromUrl = new URLSearchParams(window.location.search).get('session');
      if (isStatus(fromUrl)) {
        window.localStorage.setItem(STORAGE_KEY, fromUrl);
        return fromUrl;
      }
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isStatus(stored)) return stored;
  } catch {
    // Storage can be blocked. The session then lives in memory only.
  }
  return 'signed-out';
}

function persist(status: SessionStatus) {
  try {
    window.localStorage.setItem(STORAGE_KEY, status);
  } catch {
    // Ignore: see `readInitialStatus`.
  }
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({
  initialStatus,
  children,
}: {
  /** Fixes the starting state, for tests and stories. */
  initialStatus?: SessionStatus;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<SessionStatus>(() => initialStatus ?? readInitialStatus());

  const update = useCallback((next: SessionStatus) => {
    setStatus(next);
    persist(next);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      signIn: ({ isNewAccount }) => update(isNewAccount ? 'needs-name' : 'signed-in'),
      completeSignUp: () => update('signed-in'),
      signOut: () => update('signed-out'),
    }),
    [status, update],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
