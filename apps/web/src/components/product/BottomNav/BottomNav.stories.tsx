import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BottomNav, type CustomerTab, type OwnerTab } from './BottomNav';

const meta = {
  title: 'Product/BottomNav',
  component: BottomNav,
  args: { mode: 'customer', active: 'cards' },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BottomNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CustomerCards: Story = { args: { mode: 'customer', active: 'cards' } };
export const CustomerQr: Story = { args: { mode: 'customer', active: 'qr' } };
export const CustomerProfile: Story = { args: { mode: 'customer', active: 'profile' } };
export const OwnerDashboard: Story = { args: { mode: 'owner', active: 'dashboard' } };

function Interactive() {
  const [customer, setCustomer] = useState<CustomerTab>('cards');
  const [owner, setOwner] = useState<OwnerTab>('dashboard');
  return (
    <div className="flex flex-col gap-8 py-6">
      <BottomNav mode="customer" active={customer} onSelect={setCustomer} />
      <BottomNav mode="owner" active={owner} onSelect={setOwner} />
    </div>
  );
}

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 py-6">
      <BottomNav mode="customer" active="cards" />
      <BottomNav mode="customer" active="qr" />
      <BottomNav mode="customer" active="profile" />
      <BottomNav mode="owner" active="dashboard" />
      <BottomNav mode="owner" active="plan" />
    </div>
  ),
};

export const Playground: Story = { render: () => <Interactive /> };
