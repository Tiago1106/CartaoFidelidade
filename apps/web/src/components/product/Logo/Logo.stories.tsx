import type { Meta, StoryObj } from '@storybook/react-vite';
import { Logo } from './Logo';

const meta = {
  title: 'Brand/Logo',
  component: Logo,
  args: { layout: 'horizontal', tone: 'default' },
  argTypes: {
    layout: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
    tone: { control: 'inline-radio', options: ['default', 'onDark'] },
  },
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
};

export const VerticalWithTagline: Story = {
  args: { layout: 'vertical', className: 'w-56' },
  decorators: [
    (Story) => (
      <div className="flex justify-center p-6">
        <Story />
      </div>
    ),
  ],
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-card bg-background p-4">
        <Logo layout="horizontal" className="h-10" />
      </div>
      <div className="rounded-card bg-primary p-4">
        <Logo layout="horizontal" className="h-10" />
      </div>
      <div className="rounded-card bg-viewfinder p-4">
        <Logo layout="horizontal" tone="onDark" className="h-10" />
      </div>
      <div className="flex justify-center rounded-card bg-background p-4">
        <Logo layout="vertical" className="w-44" />
      </div>
      <div className="flex justify-center rounded-card bg-viewfinder p-4">
        <Logo layout="vertical" tone="onDark" className="w-44" />
      </div>
    </div>
  ),
};
