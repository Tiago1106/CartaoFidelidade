import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { iconNames } from '@/components/product/Icon';
import { TextField } from './TextField';

const meta = {
  title: 'Product/TextField',
  component: TextField,
  args: { label: 'Celular', prefix: '+55', placeholder: '(11) 90000-0000', type: 'tel' },
  argTypes: {
    type: { control: 'select', options: ['tel', 'text', 'email', 'password', 'number'] },
    icon: { control: 'select', options: [undefined, ...iconNames] },
    error: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Phone: Story = {};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByLabelText('Celular'));
    await userEvent.tab({ shift: true });
    await userEvent.tab();
    await expect(within(canvasElement).getByLabelText('Celular')).toHaveFocus();
  },
};

export const Error: Story = {
  args: { error: true, message: 'Confira o número e tente de novo.', defaultValue: '11 9999' },
};

export const WithSuffix: Story = {
  args: {
    type: 'number',
    label: 'Intervalo mínimo',
    prefix: undefined,
    suffix: 'minutos',
    placeholder: '60',
  },
};

export const Search: Story = {
  args: {
    type: 'text',
    label: undefined,
    prefix: undefined,
    icon: 'search',
    placeholder: 'Buscar cliente',
    'aria-label': 'Buscar cliente',
  },
};

export const Email: Story = {
  args: { type: 'email', label: 'E-mail', prefix: undefined, placeholder: 'voce@exemplo.com' },
};

export const Disabled: Story = { args: { disabled: true, defaultValue: '11 90000-0000' } };

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <TextField label="Padrão" prefix="+55" placeholder="(11) 90000-0000" type="tel" />
      <TextField label="Com valor" prefix="+55" type="tel" defaultValue="(11) 98765-4321" />
      <TextField
        label="Com erro"
        prefix="+55"
        type="tel"
        error
        message="Confira o número."
        defaultValue="11 9999"
      />
      <TextField label="Com sufixo" type="number" suffix="dias" placeholder="30" />
      <TextField
        type="text"
        icon="search"
        aria-label="Buscar cliente"
        placeholder="Buscar cliente"
      />
    </div>
  ),
};
