import type { ComponentProps } from 'react';
import { messages } from '@/messages/pt-BR';
import { cn } from '@/lib/utils';

export interface StepDotsProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Current step, starting at 1. */
  step: number;
  total: number;
}

/** Page indicator of the onboarding: the active step is a pill (design `Pontos`). */
export function StepDots({ step, total, className, ...props }: StepDotsProps) {
  return (
    <div
      role="img"
      aria-label={messages.stepDots.label(step, total)}
      className={cn('inline-flex h-2 items-center gap-1.5', className)}
      {...props}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          data-active={i + 1 === step}
          className={cn(
            'block h-2 rounded-full',
            i + 1 === step ? 'w-6 bg-primary-ink' : 'w-2 bg-soft',
          )}
        />
      ))}
    </div>
  );
}
