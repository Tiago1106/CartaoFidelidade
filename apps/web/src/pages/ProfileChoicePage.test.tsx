import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { SessionStatus } from '@/session/SessionProvider';
import { renderRoutes } from '@/test/renderRoutes';

function renderAt(entries: string[], status: SessionStatus = 'signed-out', index?: number) {
  return renderRoutes(entries, status, index).router;
}

describe('ProfileChoicePage', () => {
  it('shows the title, the hint and the two options in a dialog', () => {
    renderAt(['/profile-choice']);
    const dialog = screen.getByRole('dialog', { name: 'Como você vai usar o Freguês?' });
    expect(dialog).toHaveAccessibleDescription('Escolha uma opção para continuar.');
    expect(screen.getByRole('button', { name: 'Sou cliente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sou prestador' })).toBeInTheDocument();
    expect(
      screen.getByText('Chegou pela tag NFC ou pelo QR do negócio? Escolha “Sou cliente”.'),
    ).toBeInTheDocument();
  });

  it('the title is the level 1 heading of the screen', () => {
    renderAt(['/profile-choice']);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Como você vai usar o Freguês?' }),
    ).toBeInTheDocument();
  });

  it('closes with the X in the corner and has no "Fechar" button at the bottom', () => {
    renderAt(['/profile-choice']);
    const closers = screen.getAllByRole('button', { name: 'Fechar' });
    expect(closers).toHaveLength(1);
    const dialog = screen.getByRole('dialog');
    const lastTab = [...dialog.querySelectorAll('button')].at(-1);
    expect(lastTab).toBe(closers[0]);
    expect(closers[0]!.className).toContain('top-2');
    expect(closers[0]!.className).toContain('right-3');
  });

  it('starts with the focus on the sheet, and Tab goes to the first option', async () => {
    renderAt(['/profile-choice']);
    expect(screen.getByRole('dialog')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Sou cliente' })).toHaveFocus();
  });

  it('"Sou cliente" goes to the phone sign-in', async () => {
    const router = renderAt(['/profile-choice']);
    await userEvent.click(screen.getByRole('button', { name: 'Sou cliente' }));
    expect(router.state.location.pathname).toBe('/sign-in');
  });

  it('"Sou prestador" goes to the staff area', async () => {
    const router = renderAt(['/profile-choice']);
    await userEvent.click(screen.getByRole('button', { name: 'Sou prestador' }));
    expect(router.state.location.pathname).toBe('/staff/sign-in');
  });

  it('the X goes back to the previous screen', async () => {
    const router = renderAt(['/welcome?step=3', '/profile-choice'], 'signed-out', 1);
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(router.state.location.pathname).toBe('/welcome');
  });

  it('the X goes to the welcome when there is no previous screen', async () => {
    const router = renderAt(['/profile-choice']);
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(router.state.location.pathname).toBe('/welcome');
  });

  it('the Escape key closes the sheet too', async () => {
    const router = renderAt(['/profile-choice']);
    await userEvent.keyboard('{Escape}');
    expect(router.state.location.pathname).toBe('/welcome');
  });

  it('keeps the focus inside the sheet while tabbing', async () => {
    renderAt(['/profile-choice']);
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('is closed to a signed in customer', () => {
    const router = renderAt(['/profile-choice'], 'signed-in');
    expect(router.state.location.pathname).toBe('/');
  });
});
