import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OnboardingArt } from './OnboardingArt';

describe('OnboardingArt', () => {
  it('slide 2 shows the sample card with 7 of 10 stamps', () => {
    const { container } = render(<OnboardingArt slide={2} />);
    expect(screen.getByText('Barbearia Navalha · 7 de 10')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-filled="true"]')).toHaveLength(7);
    expect(container.querySelectorAll('[data-filled="false"]')).toHaveLength(3);
  });

  it('slides 1 and 3 have no sample card', () => {
    const one = render(<OnboardingArt slide={1} />);
    expect(one.container.querySelector('[data-filled]')).toBeNull();
    one.unmount();
    const three = render(<OnboardingArt slide={3} />);
    expect(three.container.querySelector('[data-filled]')).toBeNull();
  });

  it.each([1, 2, 3] as const)(
    'slide %s is decorative, hidden from assistive technology',
    (slide) => {
      const { container } = render(<OnboardingArt slide={slide} />);
      expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    },
  );

  it('the logo slide shows the seal, with its name', () => {
    render(<OnboardingArt slide="logo" />);
    expect(screen.getByRole('img', { name: 'Freguês' })).toBeInTheDocument();
  });

  it('draws the 16 icons of the pattern on every slide', () => {
    const { container } = render(<OnboardingArt slide={1} />);
    expect(container.querySelectorAll('.opacity-40')).toHaveLength(16);
  });
});
