import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon, iconNames } from './Icon';

const meta = {
  title: 'Product/Icon',
  component: Icon,
  args: { name: 'star', size: 24 },
  argTypes: {
    name: { control: 'select', options: iconNames },
    size: { control: { type: 'range', min: 12, max: 160, step: 4 } },
  },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllIcons: Story = {
  render: () => (
    <ul className="grid grid-cols-3 gap-4">
      {iconNames.map((name) => (
        <li key={name} className="flex flex-col items-center gap-2 text-center">
          <Icon name={name} />
          <span className="text-micro text-muted-foreground">{name}</span>
        </li>
      ))}
    </ul>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-4">
      {[16, 24, 32, 48].map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <Icon name="qr-code" size={size} />
          <span className="text-micro text-muted-foreground">{size}</span>
        </div>
      ))}
    </div>
  ),
};

export const Colors: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Icon name="gift" className="text-foreground" />
      <Icon name="gift" className="text-primary-ink" />
      <Icon name="gift" className="text-muted-foreground" />
      <Icon name="circle-check" className="text-success" />
      <Icon name="x" className="text-destructive" />
    </div>
  ),
};
