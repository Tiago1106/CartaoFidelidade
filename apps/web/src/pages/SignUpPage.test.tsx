import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderRoutes } from '@/test/renderRoutes';

const nameField = () => screen.getByLabelText('Nome');
const submit = () => screen.getByRole('button', { name: 'Continuar' });

describe('SignUpPage (screen 05)', () => {
  it('RN-ENT-07: asks only for the name, with the texts of the design', () => {
    renderRoutes(['/sign-up'], 'needs-name');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Como podemos te chamar?' }),
    ).toBeVisible();
    expect(screen.getByText('É assim que você aparece para quem te atende.')).toBeVisible();
    expect(nameField()).toHaveAttribute('placeholder', 'Seu nome');
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('puts the cursor in the name field and offers the autofill of the name', () => {
    renderRoutes(['/sign-up'], 'needs-name');
    expect(nameField()).toHaveFocus();
    expect(nameField()).toHaveAttribute('autocomplete', 'name');
  });

  it('keeps Continue disabled until there is a name', async () => {
    renderRoutes(['/sign-up'], 'needs-name');
    expect(submit()).toBeDisabled();
    await userEvent.type(nameField(), '   ');
    expect(submit()).toBeDisabled();
    await userEvent.type(nameField(), 'Maria');
    expect(submit()).toBeEnabled();
  });

  it('limits the name to 60 characters', async () => {
    renderRoutes(['/sign-up'], 'needs-name');
    await userEvent.type(nameField(), 'a'.repeat(70));
    expect(nameField()).toHaveValue('a'.repeat(60));
  });

  it('RN-ENT-07: saving the name opens the session and goes Home', async () => {
    const { router } = renderRoutes(['/sign-up'], 'needs-name');
    await userEvent.type(nameField(), 'Maria');
    await userEvent.click(submit());
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('submits with the Enter key', async () => {
    const { router } = renderRoutes(['/sign-up'], 'needs-name');
    await userEvent.type(nameField(), 'Maria{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('back ends the half-open session and returns to the phone screen', async () => {
    const { router } = renderRoutes(['/sign-up'], 'needs-name');
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(router.state.location.pathname).toBe('/sign-in');
    expect(screen.getByRole('heading', { level: 1, name: 'Qual é o seu celular?' })).toBeVisible();
  });
});
