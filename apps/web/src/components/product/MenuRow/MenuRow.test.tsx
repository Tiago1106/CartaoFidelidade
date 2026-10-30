import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MenuRow } from './MenuRow';

describe('MenuRow', () => {
  it('is a button with the label and the value when it has an arrow', async () => {
    const onClick = vi.fn();
    render(<MenuRow label="Nome" value="Maria" onClick={onClick} />);
    const row = screen.getByRole('button', { name: /Nome/ });
    expect(row).toHaveTextContent('Maria');
    await userEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is read-only, with no button, when the arrow is hidden', () => {
    render(<MenuRow label="Celular" value="(11) 98765-4321" showArrow={false} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Celular')).toBeInTheDocument();
    expect(screen.getByText('(11) 98765-4321')).toBeInTheDocument();
  });

  it('draws the divider only when asked', () => {
    const { rerender } = render(<MenuRow label="Nome" value="Maria" />);
    expect(screen.getByRole('button')).not.toHaveClass('border-t');
    rerender(<MenuRow label="Nome" value="Maria" divider />);
    expect(screen.getByRole('button')).toHaveClass('border-t');
  });
});
