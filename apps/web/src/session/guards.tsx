import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from './SessionProvider';

/** Routes of the signed-in customer: Home, My QR and Profile. */
export function RequireSession() {
  const { status } = useSession();
  if (status === 'signed-out') return <Navigate to="/welcome" replace />;
  if (status === 'needs-name') return <Navigate to="/sign-up" replace />;
  return <Outlet />;
}

/** Welcome and sign-in: only for who is not signed in. Everyone else goes Home. */
export function PublicOnly() {
  const { status } = useSession();
  if (status === 'signed-in') return <Navigate to="/" replace />;
  if (status === 'needs-name') return <Navigate to="/sign-up" replace />;
  return <Outlet />;
}

/** The name step shows only right after the SMS code of a new account (RN-ENT-07). */
export function RequireNameStep() {
  const { status } = useSession();
  if (status === 'signed-in') return <Navigate to="/" replace />;
  if (status === 'signed-out') return <Navigate to="/sign-in" replace />;
  return <Outlet />;
}
