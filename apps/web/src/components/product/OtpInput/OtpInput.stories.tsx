import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { OtpInput } from './OtpInput';

function Controlled({ initial = '', error }: { initial?: string; error?: string }) {
  const [value, setValue] = useState(initial);
  return <OtpInput value={value} onChange={setValue} error={error} />;
}

const meta = {
  title: 'Product/OtpInput',
  component: OtpInput,
  args: { value: '', onChange: () => {} },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OtpInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { render: () => <Controlled /> };
export const Partial: Story = { render: () => <Controlled initial="123" /> };
export const Complete: Story = { render: () => <Controlled initial="123456" /> };
export const WithError: Story = {
  render: () => <Controlled initial="123456" error="Código incorreto. Tente de novo." />,
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <Controlled />
      <Controlled initial="123" />
      <Controlled initial="123456" />
      <Controlled initial="123456" error="Código incorreto. Tente de novo." />
    </div>
  ),
};
