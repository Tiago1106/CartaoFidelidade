import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BottomNav, type CustomerTab } from '@/components/product/BottomNav';

const paths: Record<CustomerTab, string> = { cards: '/', qr: '/my-qr', profile: '/profile' };

function tabFor(pathname: string): CustomerTab {
  if (pathname.startsWith('/my-qr')) return 'qr';
  if (pathname.startsWith('/profile')) return 'profile';
  return 'cards';
}

/** Screens with the customer bottom bar: Home, My QR and Profile. */
export function CustomerTabsLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav
        mode="customer"
        active={tabFor(pathname)}
        onSelect={(tab) => navigate(paths[tab])}
        className="shrink-0"
      />
    </>
  );
}
