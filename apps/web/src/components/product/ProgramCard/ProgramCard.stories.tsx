import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgramCard } from './ProgramCard';

const meta = {
  title: 'Product/ProgramCard',
  component: ProgramCard,
  args: {
    name: 'Barbearia Navalha',
    subtitle: 'Barbearia',
    current: 7,
    total: 10,
    expiresOn: '31/12/2026',
    cardColor: '#16181B',
    joined: false,
  },
  argTypes: {
    current: { control: { type: 'range', min: 0, max: 10 } },
    total: { control: { type: 'range', min: 2, max: 10 } },
    cardColor: {
      control: 'select',
      options: [
        '#16181B',
        '#1F3A5F',
        '#5B3A29',
        '#F4C6D7',
        '#CFE3D4',
        '#CFE0F2',
        '#E3D5F0',
        '#E9E4D6',
      ],
    },
    joined: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgramCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dark: Story = {};

export const Light: Story = {
  args: {
    name: 'Espaço Vita',
    subtitle: 'Estética',
    current: 2,
    cardColor: '#CFE3D4',
    expiresOn: '15/03/2027',
  },
};

export const Complete: Story = {
  args: {
    name: 'Studio Bela',
    subtitle: 'Salão de beleza',
    current: 10,
    cardColor: '#F4C6D7',
    expiresOn: '30/11/2026',
  },
};

export const OneStampMissing: Story = { args: { current: 9 } };

export const Joined: Story = { args: { joined: true, current: 10, cardColor: '#F4C6D7' } };

const palette = [
  ['#16181B', 'Grafite'],
  ['#1F3A5F', 'Azul-marinho'],
  ['#5B3A29', 'Marrom'],
  ['#F4C6D7', 'Rosa'],
  ['#CFE3D4', 'Verde-claro'],
  ['#CFE0F2', 'Azul-claro'],
  ['#E3D5F0', 'Lilás'],
  ['#E9E4D6', 'Areia'],
] as const;

export const AllColors: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {palette.map(([color, name], i) => (
        <ProgramCard
          key={color}
          name={name}
          subtitle={color}
          current={i % 2 ? 10 : 4}
          total={10}
          expiresOn="31/12/2026"
          cardColor={color}
        />
      ))}
    </div>
  ),
};
