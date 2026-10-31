import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextLink } from './TextLink';

describe('TextLink', () => {
  it('is a link when it has an href', () => {
    render(<TextLink href="#terms">Termos de uso</TextLink>);
    expect(screen.getByRole('link', { name: 'Termos de uso' })).toHaveAttribute('href', '#terms');
  });

  it('is a button, not a submit button, when it has no href', async () => {
    const onClick = vi.fn();
    render(<TextLink onClick={onClick}>Alterar número</TextLink>);
    const button = screen.getByRole('button', { name: 'Alterar número' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('uses primary-ink for the amber text, never plain primary', () => {
    render(<TextLink href="#a">Link</TextLink>);
    expect(screen.getByRole('link')).toHaveClass('text-primary-ink');
    expect(screen.getByRole('link')).not.toHaveClass('text-primary');
  });

  it('is underlined, so it is not told apart only by color', () => {
    render(<TextLink href="#a">Link</TextLink>);
    expect(screen.getByRole('link')).toHaveClass('underline');
  });
});
