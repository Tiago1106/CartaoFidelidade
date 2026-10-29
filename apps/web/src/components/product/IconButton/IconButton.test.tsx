import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('is named by its label', () => {
    render(<IconButton icon="x" label="Fechar" />);
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<IconButton icon="x" label="Fechar" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('hides the icon from assistive technology', () => {
    render(<IconButton icon="arrow-left" label="Voltar" />);
    expect(screen.getByRole('button').querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
