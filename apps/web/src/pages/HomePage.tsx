import { messages } from '@/messages/pt-BR';

export function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col justify-center gap-2 px-6">
      <h1 className="text-title-1">{messages.app.name}</h1>
      <p className="text-body text-muted-foreground">{messages.app.tagline}</p>
      <p className="text-caption text-muted-foreground">{messages.home.placeholder}</p>
    </main>
  );
}
