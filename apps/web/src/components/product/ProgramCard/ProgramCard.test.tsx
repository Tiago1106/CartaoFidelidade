import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProgramCard } from './ProgramCard';

const base = {
  name: 'Barbearia Navalha',
  subtitle: 'Barbearia',
  current: 7,
  total: 10,
  expiresOn: '31/12/2026',
  cardColor: '#16181B',
};

describe('ProgramCard', () => {
  it('is a button named by the card and its progress', () => {
    render(<ProgramCard {...base} />);
    expect(
      screen.getByRole('button', { name: 'Cartão Barbearia Navalha, 7 de 10 carimbos' }),
    ).toBeInTheDocument();
  });

  it('shows the count and how many stamps are missing', () => {
    render(<ProgramCard {...base} />);
    expect(screen.getByText('7/10')).toBeInTheDocument();
    expect(screen.getByText('Faltam 3 carimbos')).toBeInTheDocument();
  });

  it('uses the singular when one stamp is missing', () => {
    render(<ProgramCard {...base} current={9} />);
    expect(screen.getByText('Falta 1 carimbo')).toBeInTheDocument();
  });

  it('shows the reward tag and says it is available when complete', () => {
    render(<ProgramCard {...base} current={10} />);
    expect(screen.getByText('Disponível')).toBeInTheDocument();
    expect(screen.queryByText('10/10')).toBeNull();
    // "Prêmio" is the tag and the footer label.
    expect(screen.getAllByText('Prêmio')).toHaveLength(2);
  });

  it('shows the expiry date', () => {
    render(<ProgramCard {...base} />);
    expect(screen.getByText('Validade')).toBeInTheDocument();
    expect(screen.getByText('31/12/2026')).toBeInTheDocument();
  });

  it('paints the card with its color', () => {
    render(<ProgramCard {...base} cardColor="#F4C6D7" />);
    expect(screen.getByRole('button')).toHaveStyle({ backgroundColor: '#F4C6D7' });
  });

  it('uses light text on a dark card and dark text on a light card', () => {
    const { rerender } = render(<ProgramCard {...base} cardColor="#1F3A5F" />);
    expect(screen.getByRole('button')).toHaveClass('text-white');
    rerender(<ProgramCard {...base} cardColor="#E9E4D6" />);
    expect(screen.getByRole('button')).toHaveClass('text-foreground');
  });

  it('squares the bottom corners when joined to the QR', () => {
    const { rerender } = render(<ProgramCard {...base} />);
    expect(screen.getByRole('button')).toHaveClass('rounded-card');
    rerender(<ProgramCard {...base} joined />);
    expect(screen.getByRole('button')).toHaveClass('rounded-b-none');
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<ProgramCard {...base} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
