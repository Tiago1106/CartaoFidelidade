import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgramCard } from '@/components/product/ProgramCard';
import { QrCard } from './QrCard';

const meta = {
  title: 'Product/QrCard',
  component: QrCard,
  args: { value: 'fregues-demo-token-0001', secondsLeft: 24, variant: 'panel' },
  argTypes: {
    secondsLeft: { control: { type: 'range', min: 0, max: 30 } },
    variant: { control: 'inline-radio', options: ['panel', 'attached'] },
  },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof QrCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Panel: Story = {
  args: {
    title: 'Maria',
    subtitle: 'Mostre este código para quem te atende.',
  },
};

export const Attached: Story = {
  args: { variant: 'attached', onDetails: () => {} },
};

export const OpenCard: Story = {
  render: () => (
    <div className="flex flex-col">
      <ProgramCard
        name="Studio Bela"
        subtitle="Salão de beleza"
        current={10}
        total={10}
        expiresOn="30/11/2026"
        cardColor="#F4C6D7"
        joined
      />
      <QrCard
        variant="attached"
        value="fregues-demo-token-0001"
        secondsLeft={24}
        onDetails={() => {}}
      />
    </div>
  ),
};

function Ticking() {
  const [left, setLeft] = useState(30);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s <= 1 ? 30 : s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <QrCard
      value={`fregues-demo-token-${left > 29 ? 'a' : 'b'}`}
      secondsLeft={left}
      title="Maria"
      subtitle="Mostre este código para quem te atende."
    />
  );
}

export const Counting: Story = { render: () => <Ticking /> };

export const LastSeconds: Story = {
  args: { secondsLeft: 3, title: 'Maria', subtitle: 'Mostre este código para quem te atende.' },
};
