import type { Meta, StoryObj } from '@storybook/react-vite';
import { MenuRow } from './MenuRow';

const meta = {
  title: 'Product/MenuRow',
  component: MenuRow,
  args: { label: 'Nome', value: 'Maria', showArrow: true, divider: false },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MenuRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithArrow: Story = {};
export const ReadOnly: Story = {
  args: { label: 'Celular', value: '(11) 98765-4321', showArrow: false },
};

export const List: Story = {
  render: () => (
    <div className="overflow-hidden rounded-card border">
      <MenuRow label="Nome" value="Maria" />
      <MenuRow label="Celular" value="(11) 98765-4321" showArrow={false} divider />
      <MenuRow label="Notificações" value="Ativadas" divider />
      <MenuRow
        label="Endereço de e-mail comprido para testar o corte do texto"
        value="maria.silva.exemplo@email.com.br"
        divider
      />
    </div>
  ),
};
