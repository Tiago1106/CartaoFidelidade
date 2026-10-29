import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/router';
import { messages } from '@/messages/pt-BR';

describe('HomePage', () => {
  it('renders the app name at the root route', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(<RouterProvider router={router} />);
    expect(screen.getByRole('heading', { name: messages.app.name })).toBeInTheDocument();
  });
});
