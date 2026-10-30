import type { Meta, StoryObj } from '@storybook/react-vite';
import { StampGrid } from './StampGrid';

const meta = {
  title: 'Product/StampGrid',
  component: StampGrid,
  args: { current: 7, total: 10, tone: 'dark' },
  argTypes: {
    current: { control: { type: 'range', min: 0, max: 10 } },
    total: { control: { type: 'range', min: 2, max: 10 } },
    tone: { control: 'inline-radio', options: ['light', 'dark'] },
  },
} satisfies Meta<typeof StampGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnLightCard: Story = {
  decorators: [
    (Story) => (
      <div className="m-6 rounded-card bg-[#F4C6D7] p-4">
        <Story />
      </div>
    ),
  ],
};

export const OnDarkCard: Story = {
  args: { tone: 'light' },
  decorators: [
    (Story) => (
      <div className="m-6 rounded-card bg-foreground p-4">
        <Story />
      </div>
    ),
  ],
};

export const Empty: Story = {
  args: { current: 0 },
  decorators: OnLightCard.decorators,
};

export const Complete: Story = {
  args: { current: 10 },
  decorators: OnDarkCard.decorators,
  parameters: {},
};
