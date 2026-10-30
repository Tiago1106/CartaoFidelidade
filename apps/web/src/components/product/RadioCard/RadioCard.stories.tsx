import type { Meta, StoryObj } from '@storybook/react-vite';
import { RadioGroup } from '@/components/ui/radio-group';
import { RadioCard } from './RadioCard';

const meta = {
  title: 'Product/RadioCard',
  component: RadioCard,
  args: { value: 'cut', title: 'Cartão Corte', detail: '7 de 10 carimbos' },
  decorators: [
    (Story) => (
      <div className="p-6">
        <RadioGroup defaultValue="cut" aria-label="Cartão">
          <Story />
        </RadioGroup>
      </div>
    ),
  ],
} satisfies Meta<typeof RadioCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Selected: Story = {};
export const Normal: Story = {
  args: { value: 'beard', title: 'Cartão Barba', detail: '2 de 8 carimbos' },
};
export const Blocked: Story = {
  args: { value: 'combo', title: 'Cartão Combo', detail: 'Disponível em 12 min', blocked: true },
};

export const AllStates: Story = {
  render: () => (
    <RadioGroup defaultValue="cut" aria-label="Cartão">
      <RadioCard value="cut" title="Cartão Corte" detail="7 de 10 carimbos" />
      <RadioCard value="beard" title="Cartão Barba" detail="2 de 8 carimbos" />
      <RadioCard value="combo" title="Cartão Combo" detail="Disponível em 12 min" blocked />
    </RadioGroup>
  ),
};
