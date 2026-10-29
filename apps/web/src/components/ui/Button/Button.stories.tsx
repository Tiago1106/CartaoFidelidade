import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta = {
  title: 'UI/Button',
  component: Button,
  args: { children: 'Continuar' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost'] },
    size: { control: 'inline-radio', options: ['large', 'small'] },
    disabled: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Small: Story = { args: { size: 'small' } };
export const Disabled: Story = { args: { disabled: true } };

const variants = ['primary', 'secondary', 'ghost'] as const;
const sizes = ['large', 'small'] as const;

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {sizes.map((size) => (
        <section key={size} className="flex flex-col items-start gap-3">
          <h2 className="text-overline text-muted-foreground uppercase">{size}</h2>
          {variants.map((variant) => (
            <div key={variant} className="flex w-full flex-col items-start gap-2">
              <span className="text-micro text-muted-foreground">{variant}</span>
              <Button variant={variant} size={size}>
                Continuar
              </Button>
              <Button variant={variant} size={size} disabled>
                Continuar (desativado)
              </Button>
            </div>
          ))}
        </section>
      ))}
    </div>
  ),
};
