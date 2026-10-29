import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

const colors = [
  'background',
  'foreground',
  'card',
  'primary',
  'primary-foreground',
  'primary-ink',
  'secondary',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'success',
  'border',
  'input',
  'ring',
  'viewfinder',
  'viewfinder-foreground',
] as const;

const typeScale = [
  ['display', 'text-display', '38/42 · 800'],
  ['title-1', 'text-title-1', '32/37 · 800'],
  ['title-2', 'text-title-2', '24/30 · 800'],
  ['title-3', 'text-title-3', '18/24 · 700'],
  ['metric', 'text-metric tabular-nums', '36/40 · 800'],
  ['body-lg', 'text-body-lg', '17/26 · 400'],
  ['body', 'text-body', '16/24 · 400'],
  ['body-sm', 'text-body-sm', '15/22 · 400'],
  ['caption', 'text-caption', '14/20 · 400'],
  ['micro', 'text-micro', '13/19 · 400'],
  ['label', 'text-label', '14/20 · 600'],
  ['button', 'text-button', '17/24 · 700'],
  ['overline', 'text-overline uppercase', '12/16 · 700'],
] as const;

const radii = [
  ['radius-lg (controls)', 'rounded-lg', '12px'],
  ['radius-card', 'rounded-card', '20px'],
  ['radius-panel', 'rounded-panel', '24px'],
  ['radius-bar', 'rounded-bar', '4px'],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-title-3">{title}</h2>
      {children}
    </section>
  );
}

function Tokens() {
  return (
    <div className="flex flex-col gap-8 bg-background p-4 text-foreground">
      <h1 className="text-title-2">Tokens</h1>

      <Section title="Colors">
        <ul className="grid grid-cols-2 gap-3">
          {colors.map((name) => (
            <li key={name} className="flex items-center gap-3">
              <span
                className="size-10 shrink-0 rounded-lg border"
                style={{ background: `var(--${name})` }}
              />
              <span className="text-micro">
                {name}
                <br />
                <span className="text-muted-foreground">--{name}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type scale">
        <ul className="flex flex-col gap-4">
          {typeScale.map(([name, cls, spec]) => (
            <li key={name} className="flex flex-col">
              <span className="text-micro text-muted-foreground">
                {name} · {spec}
              </span>
              <span className={cls}>Quem volta, ganha. 0123456789</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Radii">
        <ul className="grid grid-cols-2 gap-3">
          {radii.map(([name, cls, value]) => (
            <li key={name} className="flex flex-col gap-1">
              <span className={`h-16 border-2 border-foreground bg-card ${cls}`} />
              <span className="text-micro">
                {name} · {value}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Focus ring">
        <button type="button" className="h-14 rounded-lg border bg-card px-4 text-button">
          Tab here for the 2 px ring
        </button>
      </Section>
    </div>
  );
}

const meta = {
  title: 'Foundations/Tokens',
  component: Tokens,
} satisfies Meta<typeof Tokens>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
