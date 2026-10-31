import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureSimulatedAuth, requestOtp, resetSimulatedAuth } from '@/data/auth';
import { renderRoutes } from '@/test/renderRoutes';

/** The code the simulation generates in these tests. */
const CODE = '482913';
const existing = '+5511900000000';
const stranger = '+5521987654321';

const codeInput = () => screen.getByLabelText('Código de verificação de 6 dígitos');
const confirm = () => screen.getByRole('button', { name: 'Confirmar' });

/** Opens the code screen as if the phone screen had just sent the code. */
async function openCodeScreen(phone = existing, { requested = true } = {}) {
  if (requested) await requestOtp(phone);
  return renderRoutes([{ pathname: '/sign-in/code', state: { phone, retryAfterSeconds: 60 } }]);
}

/** The countdown schedules the next second after each render, so it advances one at a time. */
function tick(seconds: number) {
  for (let i = 0; i < seconds; i++) act(() => vi.advanceTimersByTime(1000));
}

beforeEach(() => {
  resetSimulatedAuth();
  configureSimulatedAuth({ generateCode: () => CODE, announce: () => {} });
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => vi.useRealTimers());

const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

describe('SignInCodePage (screen 04)', () => {
  it('shows the title, the number the code went to and "Alterar número"', async () => {
    await openCodeScreen();
    expect(screen.getByRole('heading', { level: 1, name: 'Digite o código' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Alterar número' }).parentElement).toHaveTextContent(
      'Enviamos 6 dígitos por SMS para (11) 90000-0000. Alterar número',
    );
    expect(screen.getByRole('button', { name: 'Alterar número' })).toBeVisible();
  });

  it('asks the browser for the SMS code', async () => {
    await openCodeScreen();
    expect(codeInput()).toHaveAttribute('autocomplete', 'one-time-code');
  });

  it('puts the cursor in the code field', async () => {
    await openCodeScreen();
    expect(codeInput()).toHaveFocus();
  });

  it('shows the time to resend, from 1:00', async () => {
    await openCodeScreen();
    expect(screen.getByText('Reenviar código em 1:00')).toBeVisible();
  });

  it('keeps "Confirmar" disabled until the six digits are typed', async () => {
    await openCodeScreen();
    expect(confirm()).toBeDisabled();
    await user().type(codeInput(), '12345');
    expect(confirm()).toBeDisabled();
    await user().type(codeInput(), '6');
    expect(confirm()).toBeEnabled();
  });

  it('RN-ENT-07: the code of an existing account signs in and goes Home', async () => {
    const { router } = await openCodeScreen(existing);
    await user().type(codeInput(), CODE);
    await user().click(confirm());
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('RN-ENT-07: the code of a new account goes to the name step', async () => {
    const { router } = await openCodeScreen(stranger);
    await user().type(codeInput(), CODE);
    await user().click(confirm());
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/sign-up'));
  });

  it('confirms with the Enter key', async () => {
    const { router } = await openCodeScreen(existing);
    await user().type(codeInput(), `${CODE}{Enter}`);
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('RN-AUT-02: a wrong code shows an error and stays on the screen', async () => {
    const { router } = await openCodeScreen();
    await user().type(codeInput(), '000000');
    await user().click(confirm());
    expect(await screen.findByRole('alert')).toHaveTextContent('Código incorreto. Tente de novo.');
    expect(codeInput()).toHaveAttribute('aria-invalid', 'true');
    expect(router.state.location.pathname).toBe('/sign-in/code');
  });

  it('clears the error when the code is edited', async () => {
    await openCodeScreen();
    await user().type(codeInput(), '000000');
    await user().click(confirm());
    await screen.findByRole('alert');
    await user().type(codeInput(), '{Backspace}');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('RN-AUT-02: after 5 wrong codes the number is locked, with a message', async () => {
    await openCodeScreen();
    for (let i = 0; i < 5; i++) {
      await user().clear(codeInput());
      await user().type(codeInput(), '000000');
      await user().click(confirm());
      await screen.findByRole('alert');
    }
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Muitas tentativas. Tente de novo em 15 minutos.',
    );
  });

  it('RN-AUT-02: a code that is 5 minutes old has expired', async () => {
    await openCodeScreen();
    act(() => vi.advanceTimersByTime(5 * 60 * 1000));
    await user().type(codeInput(), CODE);
    await user().click(confirm());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Código vencido. Peça um novo código.',
    );
  });

  it('RN-AUT-02: a code that is 4 minutes old still works', async () => {
    const { router } = await openCodeScreen();
    act(() => vi.advanceTimersByTime(4 * 60 * 1000));
    await user().type(codeInput(), CODE);
    await user().click(confirm());
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('RN-AUT-02: says the code expired when no code was asked for', async () => {
    await openCodeScreen(existing, { requested: false });
    await user().type(codeInput(), CODE);
    await user().click(confirm());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Código vencido. Peça um novo código.',
    );
  });

  it('counts down and, at 0:00, offers to resend', async () => {
    await openCodeScreen();
    tick(41);
    expect(screen.getByText('Reenviar código em 0:19')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Reenviar código' })).toBeNull();
    tick(19);
    expect(screen.getByRole('button', { name: 'Reenviar código' })).toBeVisible();
    expect(screen.queryByText(/Reenviar código em/)).toBeNull();
  });

  it('resends: starts the count again and clears the code', async () => {
    await openCodeScreen();
    await user().type(codeInput(), '123');
    tick(60);
    await user().click(screen.getByRole('button', { name: 'Reenviar código' }));
    expect(await screen.findByText('Reenviar código em 1:00')).toBeVisible();
    expect(codeInput()).toHaveValue('');
  });

  it('RN-AUT-03: the third code is the last of the hour; asking again shows the limit', async () => {
    await openCodeScreen();
    for (let i = 0; i < 2; i++) {
      tick(60);
      await user().click(screen.getByRole('button', { name: 'Reenviar código' }));
      await screen.findByText('Reenviar código em 1:00');
    }
    tick(60);
    await user().click(screen.getByRole('button', { name: 'Reenviar código' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitos pedidos de código. Tente de novo mais tarde.',
    );
  });

  it('"Alterar número" goes back to the phone with the number filled in', async () => {
    const { router } = await openCodeScreen();
    await user().click(screen.getByRole('button', { name: 'Alterar número' }));
    expect(router.state.location.pathname).toBe('/sign-in');
    expect(screen.getByLabelText('Celular')).toHaveValue('(11) 90000-0000');
  });

  it('the back button goes back to the phone', async () => {
    const { router } = await openCodeScreen();
    await user().click(screen.getByRole('button', { name: 'Voltar' }));
    expect(router.state.location.pathname).toBe('/sign-in');
  });
});
