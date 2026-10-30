import type { ComponentProps } from 'react';
import { StampSeal } from '@/components/product/StampSeal';
import { messages } from '@/messages/pt-BR';
import { cn } from '@/lib/utils';

export interface StampGridProps extends Omit<ComponentProps<'div'>, 'children'> {
  current: number;
  total: number;
  /**
   * `light` is for light text on a dark card, `dark` for dark text on a light card.
   * It sets the color of the empty (dashed) stamps.
   */
  tone?: 'light' | 'dark';
  /** Hides the grid from assistive technology when the parent already describes it. */
  decorative?: boolean;
}

const emptyByTone = {
  light: 'border-white/60',
  dark: 'border-foreground/50',
} as const;

/** Grid of stamps, five per row (used inside `ProgramCard`). */
export function StampGrid({
  current,
  total,
  tone = 'dark',
  decorative = false,
  className,
  ...props
}: StampGridProps) {
  const filled = Math.min(total, Math.max(0, current));
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img', 'aria-label': messages.stampGrid.label(filled, total) };

  return (
    <div
      className={cn('grid w-full grid-cols-[repeat(5,44px)] justify-between gap-y-3', className)}
      {...a11y}
      {...props}
    >
      {Array.from({ length: total }, (_, i) =>
        i < filled ? (
          <div key={i} data-filled="true" className="flex size-11 items-center justify-center">
            <StampSeal variant="inverted" size={44} role="presentation" aria-hidden="true" />
          </div>
        ) : (
          <div
            key={i}
            data-filled="false"
            className={cn('size-11 rounded-full border-2 border-dashed', emptyByTone[tone])}
          />
        ),
      )}
    </div>
  );
}
