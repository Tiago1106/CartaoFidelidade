import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

describe('Logo', () => {
  it('names the horizontal logo Freguês', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'Freguês' })).toBeInTheDocument();
  });

  it('adds the tagline to the name of the vertical logo', () => {
    render(<Logo layout="vertical" />);
    expect(screen.getByRole('img', { name: 'Freguês. Quem volta, ganha.' })).toBeInTheDocument();
  });

  it('uses a different file on dark backgrounds', () => {
    const { container, rerender } = render(<Logo />);
    const light = container.querySelector('img')?.getAttribute('src');
    rerender(<Logo tone="onDark" />);
    expect(container.querySelector('img')?.getAttribute('src')).not.toBe(light);
  });
});
