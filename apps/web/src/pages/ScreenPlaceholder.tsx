import { messages } from '@/messages/pt-BR';

/** Stands in for a screen until its task. `screen` is a developer label, not user text. */
export function ScreenPlaceholder({ screen }: { screen: string }) {
  return (
    <section data-screen={screen} className="flex h-full flex-col justify-center gap-2 px-6">
      <p className="text-title-3 text-foreground">{messages.shell.placeholder}</p>
      <p className="text-caption text-muted-foreground">{screen}</p>
    </section>
  );
}
