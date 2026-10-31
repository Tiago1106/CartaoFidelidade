import type { FormEventHandler, ReactNode } from 'react';
import { IconButton } from '@/components/product/IconButton';
import { messages } from '@/messages/pt-BR';

interface AuthLayoutProps {
  /** Developer label of the screen. */
  screen: string;
  title: string;
  description: ReactNode;
  onBack: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  /** The field area, under the title. */
  children: ReactNode;
  /** Pinned to the bottom of the screen: notes and the main button. */
  footer: ReactNode;
}

/** Layout shared by the sign-in screens (03 and 04): back button, title, field and footer. */
export function AuthLayout({
  screen,
  title,
  description,
  onBack,
  onSubmit,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <form
      data-screen={screen}
      onSubmit={onSubmit}
      noValidate
      className="relative flex h-full flex-col overflow-y-auto bg-background"
    >
      <IconButton
        icon="arrow-left"
        label={messages.common.back}
        onClick={onBack}
        className="absolute top-12 left-3"
      />
      <div className="flex flex-col gap-8 px-6 pt-28">
        <div className="flex flex-col gap-2">
          <h1 className="text-title-1 tracking-[-0.5px] text-foreground">{title}</h1>
          <p className="text-body-lg text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
      <div className="mt-auto flex flex-col gap-4 px-6 pt-8 pb-8">{footer}</div>
    </form>
  );
}
