import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppFrame } from './layouts/AppFrame';
import { CustomerTabsLayout } from './layouts/CustomerTabsLayout';
import { ScreenPlaceholder } from './pages/ScreenPlaceholder';
import { ProfileChoicePage } from './pages/ProfileChoicePage';
import { WelcomePage } from './pages/WelcomePage';
import { PublicOnly, RequireNameStep, RequireSession } from './session/guards';

// Customer routes (decision D-011). Each placeholder is replaced by its screen in Phase B.
export const routes: RouteObject[] = [
  {
    element: <AppFrame />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          { path: '/welcome', element: <WelcomePage /> },
          { path: '/profile-choice', element: <ProfileChoicePage /> },
          { path: '/sign-in', element: <ScreenPlaceholder screen="sign-in" /> },
          { path: '/sign-in/code', element: <ScreenPlaceholder screen="sign-in-code" /> },
        ],
      },
      {
        element: <RequireNameStep />,
        children: [{ path: '/sign-up', element: <ScreenPlaceholder screen="sign-up" /> }],
      },
      // [Premissa] The staff area is not built yet; /staff/sign-in is its future entry.
      { path: '/staff/sign-in', element: <ScreenPlaceholder screen="staff-sign-in" /> },
      { path: '/s/:slug', element: <ScreenPlaceholder screen="business-page" /> },
      {
        element: <RequireSession />,
        children: [
          {
            element: <CustomerTabsLayout />,
            children: [
              { path: '/', element: <ScreenPlaceholder screen="home" /> },
              { path: '/my-qr', element: <ScreenPlaceholder screen="my-qr" /> },
              { path: '/profile', element: <ScreenPlaceholder screen="profile" /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
