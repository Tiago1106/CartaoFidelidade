import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { SessionStatus } from './session/SessionProvider';
import { renderRoutes } from './test/renderRoutes';

function renderAt(path: string, status: SessionStatus) {
  const { router, container } = renderRoutes([path], status);
  const screenName = () =>
    container.querySelector('[data-screen]')?.getAttribute('data-screen') ?? null;
  return { router, screenName };
}

describe('customer routes and the simulated guard', () => {
  it.each([
    ['/', 'home'],
    ['/my-qr', 'my-qr'],
    ['/profile', 'profile'],
  ])('signed in: %s shows the %s screen', (path, screen) => {
    expect(renderAt(path, 'signed-in').screenName()).toBe(screen);
  });

  it.each(['/', '/my-qr', '/profile'])('signed out: %s sends to the welcome screen', (path) => {
    const { router, screenName } = renderAt(path, 'signed-out');
    expect(router.state.location.pathname).toBe('/welcome');
    expect(screenName()).toBe('welcome');
  });

  it.each(['/', '/my-qr', '/profile'])(
    'RN-ENT-07: a new account without a name goes from %s to the name step',
    (path) => {
      const { router, screenName } = renderAt(path, 'needs-name');
      expect(router.state.location.pathname).toBe('/sign-up');
      expect(screenName()).toBe('sign-up');
    },
  );

  it.each(['/welcome', '/profile-choice', '/sign-in', '/sign-in/code', '/sign-up'])(
    'a signed in customer is sent Home from %s',
    (path) => {
      const { router, screenName } = renderAt(path, 'signed-in');
      expect(router.state.location.pathname).toBe('/');
      expect(screenName()).toBe('home');
    },
  );

  it.each([
    ['/welcome', 'welcome'],
    ['/profile-choice', 'profile-choice'],
    ['/sign-in', 'sign-in'],
  ])('signed out: %s is open', (path, screen) => {
    expect(renderAt(path, 'signed-out').screenName()).toBe(screen);
  });

  it('the code screen needs the number of the previous screen, or goes back to it', () => {
    const { router, screenName } = renderAt('/sign-in/code', 'signed-out');
    expect(router.state.location.pathname).toBe('/sign-in');
    expect(screenName()).toBe('sign-in');
  });

  it('RN-ENT-07: the name step is closed to who has not signed in', () => {
    const { router } = renderAt('/sign-up', 'signed-out');
    expect(router.state.location.pathname).toBe('/sign-in');
  });

  it('RN-ENT-07: the name step is open right after the code of a new account', () => {
    expect(renderAt('/sign-up', 'needs-name').screenName()).toBe('sign-up');
  });

  it('RN-ENT-02: the business page is open to everyone', () => {
    expect(renderAt('/s/navalha', 'signed-out').screenName()).toBe('business-page');
    expect(renderAt('/s/navalha', 'signed-in').screenName()).toBe('business-page');
  });

  it('sends an unknown address Home, and then through the guard', () => {
    const { router } = renderAt('/nope', 'signed-out');
    expect(router.state.location.pathname).toBe('/welcome');
  });

  it('RN-ENT-10: the three tabs show only on the signed in screens', () => {
    renderAt('/', 'signed-in');
    expect(screen.getByRole('button', { name: 'Cartões' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Meu QR' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Perfil' })).toBeInTheDocument();
  });

  it('has no tab bar on the welcome screen', () => {
    renderAt('/welcome', 'signed-out');
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('moves between the tabs and marks the current one', async () => {
    const { router, screenName } = renderAt('/', 'signed-in');
    await userEvent.click(screen.getByRole('button', { name: 'Meu QR' }));
    expect(router.state.location.pathname).toBe('/my-qr');
    expect(screenName()).toBe('my-qr');
    expect(screen.getByRole('button', { name: 'Meu QR' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    expect(router.state.location.pathname).toBe('/profile');
    await userEvent.click(screen.getByRole('button', { name: 'Cartões' }));
    expect(router.state.location.pathname).toBe('/');
  });
});
