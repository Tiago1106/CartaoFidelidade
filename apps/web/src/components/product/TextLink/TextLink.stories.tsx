import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextLink } from './TextLink';

const meta = {
  title: 'Product/TextLink',
  component: TextLink,
  args: { children: 'Termos de uso' },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TextLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Link: Story = { args: { href: '#terms' } };
export const ButtonThatLooksLikeALink: Story = { args: { children: 'Alterar número' } };

export const InASentence: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <p className="text-center text-micro text-muted-foreground">
        Ao continuar, você aceita os <TextLink href="#terms">Termos de uso</TextLink> e a{' '}
        <TextLink href="#privacy">Política de Privacidade</TextLink>.
      </p>
      <p className="text-body-lg text-muted-foreground">
        Enviamos 6 dígitos por SMS para (11) 90000-0000. <TextLink>Alterar número</TextLink>
      </p>
    </div>
  ),
};
