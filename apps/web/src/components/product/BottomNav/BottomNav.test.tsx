import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BottomNav } from './BottomNav';

describe('BottomNav', () => {
  it('customer: has the three tabs', () => {
    render(<BottomNav mode="customer" active="cards" />);
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(
      within(nav)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Cartões', 'Meu QR', 'Perfil']);
  });

  it('owner: has the five tabs', () => {
    render(<BottomNav mode="owner" active="dashboard" />);
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(
      within(nav)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Painel', 'Cartões', 'Clientes', 'Equipe', 'Plano']);
  });

  it('marks only the active tab as the current page', () => {
    render(<BottomNav mode="customer" active="profile" />);
    expect(screen.getByRole('button', { name: 'Perfil' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Cartões' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Meu QR' })).not.toHaveAttribute('aria-current');
  });

  it('customer: the "Meu QR" tab is amber even when it is not the active one', () => {
    render(<BottomNav mode="customer" active="cards" />);
    expect(screen.getByRole('button', { name: 'Meu QR' }).firstElementChild).toHaveClass(
      'bg-primary',
    );
    expect(screen.getByRole('button', { name: 'Cartões' }).firstElementChild).not.toHaveClass(
      'bg-primary',
    );
  });

  it('owner: no tab is amber', () => {
    render(<BottomNav mode="owner" active="cards" />);
    for (const button of screen.getAllByRole('button')) {
      expect(button.firstElementChild).not.toHaveClass('bg-primary');
    }
  });

  it('tells which tab was chosen', async () => {
    const onSelect = vi.fn();
    render(<BottomNav mode="owner" active="dashboard" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clientes' }));
    expect(onSelect).toHaveBeenCalledWith('customers');
  });
});
