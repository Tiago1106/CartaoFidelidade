import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TextField } from './TextField';

describe('TextField', () => {
  it('ties the label to the input', async () => {
    render(<TextField label="Celular" />);
    await userEvent.type(screen.getByLabelText('Celular'), '11999990000');
    expect(screen.getByLabelText('Celular')).toHaveValue('11999990000');
  });

  it('uses the phone keyboard and autofill for a tel field', () => {
    render(<TextField type="tel" label="Celular" />);
    const input = screen.getByLabelText('Celular');
    expect(input).toHaveAttribute('type', 'tel');
    expect(input).toHaveAttribute('inputmode', 'tel');
    expect(input).toHaveAttribute('autocomplete', 'tel-national');
  });

  it('uses a numeric keypad for a number field', () => {
    render(<TextField type="number" label="Dias" />);
    expect(screen.getByLabelText('Dias')).toHaveAttribute('inputmode', 'numeric');
  });

  it('shows the prefix and the suffix', () => {
    render(<TextField label="Prazo" prefix="+55" suffix="dias" />);
    expect(screen.getByText('+55')).toBeInTheDocument();
    expect(screen.getByText('dias')).toBeInTheDocument();
  });

  it('marks the input invalid and links the error message to it', () => {
    render(<TextField label="Celular" error message="Confira o número." />);
    const input = screen.getByLabelText('Celular');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Confira o número.');
  });

  it('is valid by default', () => {
    render(<TextField label="Celular" />);
    expect(screen.getByLabelText('Celular')).not.toHaveAttribute('aria-invalid');
  });

  it('names a field with no visible label by aria-label', () => {
    render(<TextField aria-label="Buscar" icon="search" />);
    expect(screen.getByRole('textbox', { name: 'Buscar' })).toBeInTheDocument();
  });
});
