import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '@/router';
import { SessionProvider, type SessionStatus } from '@/session/SessionProvider';

type Entry = string | { pathname: string; state?: unknown };

/** Renders the customer routes with every provider of the app. Returns the router. */
export function renderRoutes(
  initialEntries: Entry[],
  status: SessionStatus = 'signed-out',
  initialIndex?: number,
) {
  const router = createMemoryRouter(routes, { initialEntries, initialIndex });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <SessionProvider initialStatus={status}>
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>,
  );
  return { router, ...view };
}
