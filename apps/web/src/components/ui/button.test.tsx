import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Continuar</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('activates with the keyboard', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Continuar</Button>);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Continuar
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Continuar</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('accepts type="submit"', () => {
    render(<Button type="submit">Enviar</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('renders as the child element with asChild', () => {
    render(
      <Button asChild>
        <a href="/s/studio-bela">Abrir</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Abrir' });
    expect(link).toHaveAttribute('href', '/s/studio-bela');
    expect(link).not.toHaveAttribute('type');
  });
});
