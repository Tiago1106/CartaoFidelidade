import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { requestOtp, resetSimulatedAuth } from '@/data/auth';
import { renderRoutes } from '@/test/renderRoutes';

beforeEach(() => resetSimulatedAuth());

const phoneField = () => screen.getByLabelText('Celular');
const submit = () => screen.getByRole('button', { name: 'Enviar código' });

describe('SignInPhonePage (screen 03)', () => {
  it('shows the title, the field with +55 and the terms notice', () => {
    renderRoutes(['/sign-in']);
    expect(screen.getByRole('heading', { level: 1, name: 'Qual é o seu celular?' })).toBeVisible();
    expect(screen.getByText('Enviamos um código por SMS para confirmar que é você.')).toBeVisible();
    expect(phoneField()).toHaveAttribute('placeholder', '(11) 90000-0000');
    expect(screen.getByText('+55')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Termos de uso' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Política de Privacidade' })).toBeVisible();
  });

  it('RN-ENT-08: tells that continuing accepts the Terms and the Privacy Policy', () => {
    renderRoutes(['/sign-in']);
    const notice = screen.getByRole('link', { name: 'Termos de uso' }).parentElement!;
    expect(notice).toHaveTextContent(
      'Ao continuar, você aceita os Termos de uso e a Política de Privacidade.',
    );
  });

  it('puts the cursor in the phone field', () => {
    renderRoutes(['/sign-in']);
    expect(phoneField()).toHaveFocus();
  });

  it('opens the phone keyboard and offers the autofill of the number', () => {
    renderRoutes(['/sign-in']);
    expect(phoneField()).toHaveAttribute('type', 'tel');
    expect(phoneField()).toHaveAttribute('autocomplete', 'tel-national');
  });

  it('formats the number while typing', async () => {
    renderRoutes(['/sign-in']);
    await userEvent.type(phoneField(), '11900000000');
    expect(phoneField()).toHaveValue('(11) 90000-0000');
  });

  it('lets the number be erased with Backspace all the way', async () => {
    renderRoutes(['/sign-in']);
    await userEvent.type(phoneField(), '11900');
    await userEvent.keyboard('{Backspace>9/}');
    expect(phoneField()).toHaveValue('');
  });

  it('ignores letters', async () => {
    renderRoutes(['/sign-in']);
    await userEvent.type(phoneField(), 'ab11cd9');
    expect(phoneField()).toHaveValue('(11) 9');
  });

  it('takes a pasted number with +55', async () => {
    renderRoutes(['/sign-in']);
    await userEvent.click(phoneField());
    await userEvent.paste('+55 (11) 90000-0000');
    expect(phoneField()).toHaveValue('(11) 90000-0000');
  });

  it('RN-AUT-01: keeps the button disabled until the number is a complete mobile', async () => {
    renderRoutes(['/sign-in']);
    expect(submit()).toBeDisabled();
    await userEvent.type(phoneField(), '1190000000');
    expect(submit()).toBeDisabled();
    await userEvent.type(phoneField(), '0');
    expect(submit()).toBeEnabled();
  });

  it('keeps the button disabled for a number that is not a mobile', async () => {
    renderRoutes(['/sign-in']);
    await userEvent.type(phoneField(), '11800000000');
    expect(submit()).toBeDisabled();
  });

  it('shows no error while the number is being typed', async () => {
    renderRoutes(['/sign-in']);
    await userEvent.type(phoneField(), '1190');
    expect(screen.queryByText('Confira o número. Use o DDD e 9 dígitos.')).toBeNull();
    expect(phoneField()).not.toHaveAttribute('aria-invalid');
  });

  it('shows an error when the field is left with an incomplete number', async () => {
    renderRoutes(['/sign-in']);
    await userEvent.type(phoneField(), '1190');
    await userEvent.tab();
    expect(phoneField()).toHaveAttribute('aria-invalid', 'true');
    expect(phoneField()).toHaveAccessibleDescription('Confira o número. Use o DDD e 9 dígitos.');
  });

  it('shows no error when the field is left empty', async () => {
    renderRoutes(['/sign-in']);
    await userEvent.tab();
    expect(phoneField()).not.toHaveAttribute('aria-invalid');
  });

  it('sends the code and goes to the code screen with the number', async () => {
    const { router } = renderRoutes(['/sign-in']);
    await userEvent.type(phoneField(), '11900000000');
    await userEvent.click(submit());
    expect(await screen.findByRole('heading', { name: 'Digite o código' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/sign-in/code');
    expect(router.state.location.state).toMatchObject({
      phone: '+5511900000000',
      retryAfterSeconds: 60,
    });
  });

  it('sends with the Enter key', async () => {
    renderRoutes(['/sign-in']);
    await userEvent.type(phoneField(), '11900000000{Enter}');
    expect(await screen.findByRole('heading', { name: 'Digite o código' })).toBeVisible();
  });

  it('RN-AUT-03: after 3 codes in an hour, the fourth request is refused with a message', async () => {
    for (let i = 0; i < 3; i++) await requestOtp('+5511900000000');
    const { router } = renderRoutes(['/sign-in']);
    await userEvent.type(phoneField(), '11900000000');
    await userEvent.click(submit());
    expect(
      await screen.findByText('Muitos pedidos de código. Tente de novo mais tarde.'),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/sign-in');
    expect(phoneField()).toHaveAttribute('aria-invalid', 'true');
  });

  it('clears the server error when the number is edited', async () => {
    for (let i = 0; i < 3; i++) await requestOtp('+5511900000000');
    renderRoutes(['/sign-in']);
    await userEvent.type(phoneField(), '11900000000');
    await userEvent.click(submit());
    await screen.findByText('Muitos pedidos de código. Tente de novo mais tarde.');
    await userEvent.type(phoneField(), '{Backspace}');
    expect(screen.queryByText('Muitos pedidos de código. Tente de novo mais tarde.')).toBeNull();
  });

  it('comes back with the number filled in (from "Alterar número")', () => {
    renderRoutes([{ pathname: '/sign-in', state: { phone: '+5511900000000' } }]);
    expect(phoneField()).toHaveValue('(11) 90000-0000');
  });

  it('the back button returns to the previous screen', async () => {
    const { router } = renderRoutes(['/profile-choice', '/sign-in'], 'signed-out', 1);
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(router.state.location.pathname).toBe('/profile-choice');
  });

  it('the back button goes to the profile choice when there is no previous screen', async () => {
    const { router } = renderRoutes(['/sign-in']);
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(router.state.location.pathname).toBe('/profile-choice');
  });
});
