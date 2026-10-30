import type { ComponentProps } from 'react';
import { Icon } from '@/components/product/Icon';
import { StampGrid } from '@/components/product/StampGrid';
import { getReadableTone } from '@/lib/contrast';
import { messages } from '@/messages/pt-BR';
import { cn } from '@/lib/utils';

export interface ProgramCardProps extends Omit<ComponentProps<'button'>, 'children' | 'color'> {
  name: string;
  /** Business type, for example "Barbearia". */
  subtitle: string;
  current: number;
  total: number;
  /** Expiry date, already formatted for the user (for example "31/12/2026"). */
  expiresOn: string;
  /** Hex color of the card (`programs.card_color`). The text color follows from it. */
  cardColor: string;
  /** Attaches the card to the QR below it: the bottom corners become square. */
  joined?: boolean;
}

const textByTone = {
  light: { main: 'text-white', sub: 'text-white/78' },
  dark: { main: 'text-foreground', sub: 'text-foreground/72' },
} as const;

/** Loyalty card of the wallet (design `CartaoFidelidade`). */
export function ProgramCard({
  name,
  subtitle,
  current,
  total,
  expiresOn,
  cardColor,
  joined = false,
  className,
  style,
  ...props
}: ProgramCardProps) {
  const tone = getReadableTone(cardColor);
  const text = textByTone[tone];
  const complete = current >= total;

  return (
    <button
      type="button"
      aria-label={messages.programCard.label(name, current, total)}
      className={cn(
        'flex min-h-60 w-full cursor-pointer flex-col items-start gap-4 border-0 p-4 text-left shadow-card-stack',
        joined ? 'rounded-t-card rounded-b-none' : 'rounded-card',
        text.main,
        className,
      )}
      style={{ ...style, backgroundColor: cardColor }}
      {...props}
    >
      <div className="flex h-10 w-full items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col text-left">
          <span className="truncate text-body-lg leading-[22px] font-bold">{name}</span>
          <span className={cn('text-micro leading-[18px]', text.sub)}>{subtitle}</span>
        </div>
        {complete ? (
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary px-3 text-caption font-bold text-primary-foreground">
            <Icon name="gift" size={16} />
            {messages.programCard.reward}
          </span>
        ) : (
          <span className="text-button">
            {current}/{total}
          </span>
        )}
      </div>

      <StampGrid current={current} total={total} tone={tone} decorative />

      <div className="flex w-full items-end justify-between">
        <div className="flex flex-col text-left">
          <span className={cn('text-xs', text.sub)}>{messages.programCard.expiry}</span>
          <span className="text-caption font-bold">{expiresOn}</span>
        </div>
        <div className="flex flex-col text-right">
          <span className={cn('text-xs', text.sub)}>{messages.programCard.reward}</span>
          <span className="text-caption font-bold">
            {complete
              ? messages.programCard.available
              : messages.programCard.remaining(total - current)}
          </span>
        </div>
      </div>
    </button>
  );
}
