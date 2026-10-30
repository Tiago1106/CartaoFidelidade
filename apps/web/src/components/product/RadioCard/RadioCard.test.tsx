import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RadioGroup } from '@/components/ui/radio-group';
import { RadioCard } from './RadioCard';

function Options({ onValueChange }: { onValueChange?: (v: string) => void }) {
  return (
    <RadioGroup defaultValue="cut" onValueChange={onValueChange} aria-label="Cartão">
      <RadioCard value="cut" title="Cartão Corte" detail="7 de 10 carimbos" />
      <RadioCard value="beard" title="Cartão Barba" detail="2 de 8 carimbos" />
      <RadioCard value="combo" title="Cartão Combo" detail="Disponível em 12 min" blocked />
    </RadioGroup>
  );
}

describe('RadioCard', () => {
  it('is a group of radios named by the title and the detail', () => {
    render(<Options />);
    expect(screen.getByRole('radiogroup', { name: 'Cartão' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: /Cartão Corte/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Cartão Barba/ })).not.toBeChecked();
  });

  it('chooses an option by clicking anywhere on the card', async () => {
    const onValueChange = vi.fn();
    render(<Options onValueChange={onValueChange} />);
    await userEvent.click(screen.getByText('2 de 8 carimbos'));
    expect(onValueChange).toHaveBeenCalledWith('beard');
    expect(screen.getByRole('radio', { name: /Cartão Barba/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Cartão Corte/ })).not.toBeChecked();
  });

  it('chooses an option with the keyboard', async () => {
    render(<Options />);
    await userEvent.tab();
    // Radix checks the radio on focus only while the arrow key is still down, so hold it.
    await userEvent.keyboard('{ArrowDown>}');
    await waitFor(() => expect(screen.getByRole('radio', { name: /Cartão Barba/ })).toBeChecked());
    await userEvent.keyboard('{/ArrowDown}');
  });

  it('does not choose a blocked option', async () => {
    const onValueChange = vi.fn();
    render(<Options onValueChange={onValueChange} />);
    const blocked = screen.getByRole('radio', { name: /Cartão Combo/ });
    expect(blocked).toBeDisabled();
    await userEvent.click(screen.getByText('Disponível em 12 min'));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(blocked).not.toBeChecked();
  });
});
