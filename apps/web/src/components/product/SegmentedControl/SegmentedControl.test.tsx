import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

const options = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
];

function Harness() {
  const [value, setValue] = useState('7d');
  return (
    <SegmentedControl label="Período" options={options} value={value} onValueChange={setValue} />
  );
}

describe('SegmentedControl', () => {
  it('is a tab list with one tab per option and exactly one selected', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Período' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: '7 dias' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'false');
  });

  it('selects the option that was clicked', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('tab', { name: '30 dias' }));
    expect(screen.getByRole('tab', { name: '30 dias' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '7 dias' })).toHaveAttribute('aria-selected', 'false');
  });

  it('moves between options with the arrow keys', async () => {
    render(<Harness />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: '30 dias' })).toHaveAttribute('aria-selected', 'true');
  });
});
