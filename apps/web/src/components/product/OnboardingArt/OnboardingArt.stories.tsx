import type { Meta, StoryObj } from '@storybook/react-vite';
import { OnboardingArt } from './OnboardingArt';

const meta = {
  title: 'Product/OnboardingArt',
  component: OnboardingArt,
  args: { slide: 1 },
  argTypes: { slide: { control: 'inline-radio', options: [1, 2, 3, 'logo'] } },
  decorators: [
    (Story) => (
      <div className="h-[508px] w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OnboardingArt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Slide1: Story = { args: { slide: 1 } };
export const Slide2: Story = { args: { slide: 2 } };
export const Slide3: Story = { args: { slide: 3 } };
export const Logo: Story = { args: { slide: 'logo' } };

export const AllSlides: Story = {
  decorators: [],
  render: () => (
    <div className="flex flex-col gap-4 p-4">
      {([1, 2, 3, 'logo'] as const).map((slide) => (
        <div key={slide} className="h-[508px] overflow-hidden rounded-panel border">
          <OnboardingArt slide={slide} />
        </div>
      ))}
    </div>
  ),
};
