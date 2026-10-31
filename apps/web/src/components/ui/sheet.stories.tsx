import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet';

const meta = {
  title: 'UI/Sheet',
  component: Sheet,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="relative h-[844px] w-full overflow-hidden bg-accent">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

function Content() {
  return (
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Como você vai usar o Freguês?</SheetTitle>
        <SheetDescription>Escolha uma opção para continuar.</SheetDescription>
      </SheetHeader>
      <div className="flex w-full flex-col gap-3">
        <Button>Sou cliente</Button>
        <Button variant="secondary">Sou prestador</Button>
      </div>
    </SheetContent>
  );
}

/** Open from the start. It closes with the X in the corner or with Escape. */
export const Open: Story = {
  render: () => (
    <Sheet defaultOpen>
      <Content />
    </Sheet>
  ),
};

/** Closed, with a trigger. */
export const WithTrigger: Story = {
  render: () => (
    <div className="p-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary" size="small">
            Abrir folha
          </Button>
        </SheetTrigger>
        <Content />
      </Sheet>
    </div>
  ),
};
