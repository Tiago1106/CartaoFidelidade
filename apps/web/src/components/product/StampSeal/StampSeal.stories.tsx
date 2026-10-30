import type { Meta, StoryObj } from '@storybook/react-vite';
import { StampSeal } from './StampSeal';

const meta = {
  title: 'Brand/StampSeal',
  component: StampSeal,
  args: { variant: 'normal', size: 96 },
  argTypes: {
    variant: { control: 'inline-radio', options: ['normal', 'inverted'] },
    size: { control: { type: 'range', min: 24, max: 240, step: 4 } },
  },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StampSeal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Inverted: Story = {
  args: { variant: 'inverted' },
  decorators: [
    (Story) => (
      <div className="inline-block rounded-card bg-foreground p-4">
        <Story />
      </div>
    ),
  ],
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-4">
      {[24, 44, 96, 160].map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <StampSeal size={size} />
          <span className="text-micro text-muted-foreground">{size}</span>
        </div>
      ))}
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <StampSeal size={96} />
        <span className="text-micro text-muted-foreground">normal</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-card bg-foreground p-3">
          <StampSeal size={96} variant="inverted" />
        </div>
        <span className="text-micro text-muted-foreground">inverted (on a dark card)</span>
      </div>
    </div>
  ),
};
