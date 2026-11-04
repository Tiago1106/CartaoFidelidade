import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthCustomer, AuthSessionResponse } from '@fregues/shared';
import { onSessionLost, refreshSession, tokenStore } from '@/api/client';
import { logout } from '@/data/auth';

/**
 * The session of the customer (docs/API.md section 1).
 *
 * - `loading`: the app has just opened and asks the server whether the refresh cookie still holds
 *   a session. The access token lives in memory only, so every reload goes through here.
 * - `signed-out`: no session.
 * - `needs-name`: signed in with a new account, still has to fill the name (RN-ENT-07).
 * - `signed-in`: signed in and with a name.
 */
export type SessionStatus = 'loading' | 'signed-out' | 'needs-name' | 'signed-in';

interface SessionValue {
  status: SessionStatus;
  /** The signed in customer. `null` when signed out (and in screens that fix the status). */
  customer: AuthCustomer | null;
  /** After the SMS code: keeps the access token and opens the session. */
  signIn: (session: AuthSessionResponse) => void;
  /** After the name step. */
  completeSignUp: (customer: AuthCustomer) => void;
  /** Ends the session here at once and tells the server in the background. */
  signOut: () => void;
}

interface State {
  status: SessionStatus;
  customer: AuthCustomer | null;
}

const SIGNED_OUT: State = { status: 'signed-out', customer: null };

function fromSession({ customer }: AuthSessionResponse): State {
  return { status: customer.profileComplete ? 'signed-in' : 'needs-name', customer };
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({
  initialStatus,
  children,
}: {
  /** Fixes the starting state and skips the check with the server. For tests and stories. */
  initialStatus?: Exclude<SessionStatus, 'loading'>;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>(() =>
    initialStatus
      ? { status: initialStatus, customer: null }
      : { status: 'loading', customer: null },
  );

  // Opening the app: the cookie may hold a session. A server that cannot answer tells nothing
  // about the session, so the person sees the sign in and the cookie stays for the next visit.
  useEffect(() => {
    if (initialStatus) return;
    let current = true;
    refreshSession()
      .then((session) => current && setState(session ? fromSession(session) : SIGNED_OUT))
      .catch(() => current && setState(SIGNED_OUT));
    return () => {
      current = false;
    };
  }, [initialStatus]);

  // A request found out that the session cannot be renewed any more.
  useEffect(
    () =>
      onSessionLost(() => {
        queryClient.clear();
        setState(SIGNED_OUT);
      }),
    [queryClient],
  );

  const signIn = useCallback((session: AuthSessionResponse) => {
    tokenStore.set(session.accessToken);
    setState(fromSession(session));
  }, []);

  const completeSignUp = useCallback((customer: AuthCustomer) => {
    setState({ status: 'signed-in', customer });
  }, []);

  const signOut = useCallback(() => {
    setState(SIGNED_OUT);
    queryClient.clear();
    // The server forgets this login; the cookie is cleared by its answer. A failure changes
    // nothing for the person, who is already out here.
    void logout()
      .catch(() => undefined)
      .finally(() => tokenStore.clear());
  }, [queryClient]);

  const value = useMemo<SessionValue>(
    () => ({ ...state, signIn, completeSignUp, signOut }),
    [state, signIn, completeSignUp, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
