import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StepDots } from './StepDots';

describe('StepDots', () => {
  it('announces the step', () => {
    render(<StepDots step={2} total={3} />);
    expect(screen.getByRole('img', { name: 'Passo 2 de 3' })).toBeInTheDocument();
  });

  it('draws one dot per step and marks only the current one', () => {
    const { container } = render(<StepDots step={2} total={4} />);
    const dots = container.querySelectorAll('[data-active]');
    expect(dots).toHaveLength(4);
    expect([...dots].map((d) => d.getAttribute('data-active'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
  });
});
