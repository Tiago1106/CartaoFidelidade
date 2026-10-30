import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QrCard, formatCountdown } from './QrCard';

describe('formatCountdown', () => {
  it.each([
    [24, '0:24'],
    [30, '0:30'],
    [5, '0:05'],
    [0, '0:00'],
    [-3, '0:00'],
    [24.9, '0:24'],
    [75, '1:15'],
  ])('formats %s seconds as %s', (seconds, expected) => {
    expect(formatCountdown(seconds)).toBe(expected);
  });
});

describe('QrCard', () => {
  it('RN-QR-01: shows the time left as a progress bar and as text', () => {
    render(<QrCard value="token-1" secondsLeft={24} />);
    const bar = screen.getByRole('progressbar', { name: 'Tempo até renovar o código' });
    expect(bar).toHaveAttribute('aria-valuenow', '24');
    expect(bar).toHaveAttribute('aria-valuemax', '30');
    expect(bar).toHaveAttribute('aria-valuetext', 'Renova em 0:24');
    expect(screen.getByText('Renova em 0:24')).toBeInTheDocument();
  });

  it('RN-QR-01: counts from 30 seconds by default', () => {
    render(<QrCard value="token-1" secondsLeft={30} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '30');
    expect(screen.getByText('Renova em 0:30')).toBeInTheDocument();
  });

  it('keeps the bar between 0 and the total', () => {
    const { rerender } = render(<QrCard value="token-1" secondsLeft={-4} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    rerender(<QrCard value="token-1" secondsLeft={99} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30');
  });

  it('draws a QR code for the token', () => {
    render(<QrCard value="token-1" secondsLeft={24} />);
    expect(screen.getByRole('img', { name: 'QR Code' }).querySelector('path')).not.toBeNull();
  });

  it('draws a different code when the token changes', () => {
    const { rerender } = render(<QrCard value="token-1" secondsLeft={24} />);
    const before = screen
      .getByRole('img', { name: 'QR Code' })
      .querySelector('path')
      ?.getAttribute('d');
    rerender(<QrCard value="token-2" secondsLeft={30} />);
    const after = screen
      .getByRole('img', { name: 'QR Code' })
      .querySelector('path')
      ?.getAttribute('d');
    expect(after).not.toBe(before);
  });

  it('panel: shows the name and the hint', () => {
    render(
      <QrCard
        value="token-1"
        secondsLeft={24}
        title="Maria"
        subtitle="Mostre este código para quem te atende."
      />,
    );
    expect(screen.getByText('Maria')).toBeInTheDocument();
    expect(screen.getByText('Mostre este código para quem te atende.')).toBeInTheDocument();
  });

  it('attached: shows the heading and opens the details', async () => {
    const onDetails = vi.fn();
    render(<QrCard variant="attached" value="token-1" secondsLeft={24} onDetails={onDetails} />);
    expect(screen.getByText('Mostre este código')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    expect(onDetails).toHaveBeenCalledTimes(1);
  });

  it('attached: has no details link without a handler', () => {
    render(<QrCard variant="attached" value="token-1" secondsLeft={24} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
