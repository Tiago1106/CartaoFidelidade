import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OtpInput } from './OtpInput';

function Harness({ onComplete, error }: { onComplete?: (v: string) => void; error?: string }) {
  const [value, setValue] = useState('');
  return <OtpInput value={value} onChange={setValue} onComplete={onComplete} error={error} />;
}

describe('OtpInput', () => {
  it('asks the browser for the SMS code and opens the numeric keypad', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Código de verificação de 6 dígitos');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('maxlength', '6');
  });

  it('calls onComplete once, with the six digits', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await userEvent.type(screen.getByLabelText('Código de verificação de 6 dígitos'), '123456');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('does not call onComplete before the sixth digit', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await userEvent.type(screen.getByLabelText('Código de verificação de 6 dígitos'), '12345');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('ignores letters', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Código de verificação de 6 dígitos');
    await userEvent.type(input, 'ab12');
    expect(input).toHaveValue('12');
  });

  it('shows the error message as an alert and marks the code invalid', () => {
    render(<Harness error="Código incorreto." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Código incorreto.');
    expect(screen.getByLabelText('Código de verificação de 6 dígitos')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('on an error, the focus comes back to the code and the next digits replace it all', async () => {
    function Wrong() {
      const [value, setValue] = useState('000000');
      const [error, setError] = useState<string>();
      return (
        <>
          <OtpInput
            value={value}
            onChange={(v) => {
              setValue(v);
              setError(undefined);
            }}
            error={error}
          />
          <button type="button" onClick={() => setError('Código incorreto.')}>
            Confirmar
          </button>
        </>
      );
    }
    render(<Wrong />);
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    const input = screen.getByLabelText('Código de verificação de 6 dígitos');
    expect(input).toHaveFocus();
    await userEvent.keyboard('654321');
    expect(input).toHaveValue('654321');
  });
});
