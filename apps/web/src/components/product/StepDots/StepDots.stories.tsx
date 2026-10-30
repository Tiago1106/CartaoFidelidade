import type { Meta, StoryObj } from '@storybook/react-vite';
import { StepDots } from './StepDots';

const meta = {
  title: 'Brand/StepDots',
  component: StepDots,
  args: { step: 1, total: 3 },
  argTypes: {
    step: { control: { type: 'range', min: 1, max: 6 } },
    total: { control: { type: 'range', min: 2, max: 6 } },
  },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StepDots>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Step1: Story = {};
export const Step2: Story = { args: { step: 2 } };
export const Step3: Story = { args: { step: 3 } };

export const AllSteps: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {[1, 2, 3].map((step) => (
        <StepDots key={step} step={step} total={3} />
      ))}
    </div>
  ),
};
