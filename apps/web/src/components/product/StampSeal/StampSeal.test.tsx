import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StampSeal } from './StampSeal';

describe('StampSeal', () => {
  it('is an image named Freguês', () => {
    render(<StampSeal />);
    expect(screen.getByRole('img', { name: 'Freguês' })).toBeInTheDocument();
  });

  it('draws 40 dots and the body circle', () => {
    const { container } = render(<StampSeal />);
    expect(container.querySelectorAll('g > circle')).toHaveLength(41);
  });

  it('defaults to 96 px and accepts another size', () => {
    const { container, rerender } = render(<StampSeal />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '96');
    rerender(<StampSeal size={44} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '44');
  });

  it('swaps the colors when inverted', () => {
    const { container, rerender } = render(<StampSeal />);
    expect(container.querySelector('g')).toHaveClass('fill-primary-foreground');
    rerender(<StampSeal variant="inverted" />);
    expect(container.querySelector('g')).toHaveClass('fill-primary');
    expect(container.querySelector('path')).toHaveClass('fill-primary-foreground');
  });
});
