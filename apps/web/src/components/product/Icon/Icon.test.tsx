import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon, iconNames } from './Icon';

describe('Icon', () => {
  it('has the 20 icons of the design', () => {
    expect(iconNames).toHaveLength(20);
  });

  it('renders every icon as a decorative svg', () => {
    for (const name of iconNames) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector('svg');
      expect(svg, name).not.toBeNull();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      unmount();
    }
  });

  it('defaults to 24 px with a 2 px stroke and accepts another size', () => {
    const { container, rerender } = render(<Icon name="star" />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '24');
    expect(container.querySelector('svg')).toHaveAttribute('stroke-width', '2');
    rerender(<Icon name="star" size={16} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '16');
  });
});
