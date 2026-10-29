import type { Meta, StoryObj } from '@storybook/react-vite';
import { iconNames } from '../Icon';
import { IconButton } from './IconButton';

const meta = {
  title: 'Product/IconButton',
  component: IconButton,
  args: { icon: 'x', label: 'Fechar' },
  argTypes: {
    icon: { control: 'select', options: iconNames },
    disabled: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Close: Story = {};
export const Back: Story = { args: { icon: 'arrow-left', label: 'Voltar' } };
export const Profile: Story = { args: { icon: 'user', label: 'Perfil' } };
export const Disabled: Story = { args: { disabled: true } };

const used = [
  ['x', 'Fechar'],
  ['arrow-left', 'Voltar'],
  ['chevron-right', 'Avançar'],
  ['check', 'Confirmar'],
  ['user', 'Perfil'],
  ['qr-code', 'Ler QR Code'],
  ['bar-chart', 'Painel'],
  ['users', 'Clientes'],
  ['credit-card', 'Plano'],
] as const;

export const AllIcons: Story = {
  render: () => (
    <ul className="grid grid-cols-3 gap-4">
      {used.map(([icon, label]) => (
        <li key={icon} className="flex flex-col items-center gap-1">
          <IconButton icon={icon} label={label} />
          <span className="text-micro text-muted-foreground">{icon}</span>
        </li>
      ))}
    </ul>
  ),
};
