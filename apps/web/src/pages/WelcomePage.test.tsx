import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/router';
import { SessionProvider } from '@/session/SessionProvider';

function renderWelcome(path = '/welcome') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <SessionProvider initialStatus="signed-out">
      <RouterProvider router={router} />
    </SessionProvider>,
  );
  return router;
}

describe('WelcomePage', () => {
  it('01.1: starts with "Mostre seu QR Code", step 1 of 3 and a Skip button', () => {
    renderWelcome();
    expect(screen.getByRole('heading', { name: 'Mostre seu QR Code' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Passo 1 de 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pular' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
  });

  it('shows the text of the design on the three steps', async () => {
    renderWelcome();
    expect(
      screen.getByText(
        'Em cada visita, abra o app e mostre seu código. Quem atende escaneia em segundos, sem cartão de papel.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('heading', { name: 'Junte carimbos' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Passo 2 de 3' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'A cada visita você ganha um carimbo. Acompanhe no app quantos faltam em cada salão.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('heading', { name: 'Troque por prêmios' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Passo 3 de 3' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Completou o cartão? O prêmio fica disponível para você resgatar na próxima visita.',
      ),
    ).toBeInTheDocument();
  });

  it('01.3: the last step has "Começar" and no Skip button', () => {
    renderWelcome('/welcome?step=3');
    expect(screen.getByRole('button', { name: 'Começar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pular' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull();
  });

  it('Skip leaves the welcome from any step', async () => {
    const router = renderWelcome('/welcome?step=2');
    await userEvent.click(screen.getByRole('button', { name: 'Pular' }));
    expect(router.state.location.pathname).toBe('/sign-in');
  });

  it('"Começar" leaves the welcome', async () => {
    const router = renderWelcome('/welcome?step=3');
    await userEvent.click(screen.getByRole('button', { name: 'Começar' }));
    expect(router.state.location.pathname).toBe('/sign-in');
  });

  it('the back button of the browser goes to the previous step', async () => {
    const router = renderWelcome();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('heading', { name: 'Junte carimbos' })).toBeInTheDocument();
    await router.navigate(-1);
    expect(await screen.findByRole('heading', { name: 'Mostre seu QR Code' })).toBeInTheDocument();
  });

  it.each(['0', '4', 'abc', '1.5', ''])('falls back to step 1 for step=%s', (value) => {
    renderWelcome(`/welcome?step=${value}`);
    expect(screen.getByRole('heading', { name: 'Mostre seu QR Code' })).toBeInTheDocument();
  });

  it('has a single level 1 heading', () => {
    renderWelcome();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
