import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedControl } from './SegmentedControl';

const period = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
];

const filter = [
  { value: 'all', label: 'Todos' },
  { value: 'prize', label: 'Com prêmio' },
  { value: 'inactive', label: 'Parados' },
  { value: 'new', label: 'Novos' },
];

function Controlled({
  options,
  initial,
  label,
}: {
  options: typeof period;
  initial: string;
  label: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <SegmentedControl label={label} options={options} value={value} onValueChange={setValue} />
  );
}

const meta = {
  title: 'Product/SegmentedControl',
  component: SegmentedControl,
  args: { label: 'Período', options: period, value: '7d', onValueChange: () => {} },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Period: Story = {
  render: () => <Controlled options={period} initial="7d" label="Período" />,
};
export const FirstActive: Story = {
  render: () => <Controlled options={period} initial="today" label="Período" />,
};
export const FourOptions: Story = {
  render: () => <Controlled options={filter} initial="all" label="Filtro" />,
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Controlled options={period} initial="today" label="Período" />
      <Controlled options={period} initial="7d" label="Período" />
      <Controlled options={period} initial="30d" label="Período" />
      <Controlled options={filter} initial="prize" label="Filtro" />
    </div>
  ),
};
