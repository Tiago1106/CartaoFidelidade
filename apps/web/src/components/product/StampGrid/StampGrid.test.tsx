import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StampGrid } from './StampGrid';

describe('StampGrid', () => {
  it('draws one slot per stamp, filled up to the current count', () => {
    const { container } = render(<StampGrid current={7} total={10} />);
    expect(container.querySelectorAll('[data-filled="true"]')).toHaveLength(7);
    expect(container.querySelectorAll('[data-filled="false"]')).toHaveLength(3);
  });

  it('describes the progress', () => {
    render(<StampGrid current={7} total={10} />);
    expect(screen.getByRole('img', { name: '7 de 10 carimbos' })).toBeInTheDocument();
  });

  it('never fills more than the total, nor less than zero', () => {
    const { container, rerender } = render(<StampGrid current={14} total={10} />);
    expect(container.querySelectorAll('[data-filled="true"]')).toHaveLength(10);
    rerender(<StampGrid current={-2} total={10} />);
    expect(container.querySelectorAll('[data-filled="true"]')).toHaveLength(0);
  });

  it('is hidden from assistive technology when decorative', () => {
    const { container } = render(<StampGrid current={3} total={10} decorative />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).toBeNull();
  });
});
