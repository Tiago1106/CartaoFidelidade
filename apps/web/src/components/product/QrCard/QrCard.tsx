import type { ComponentProps, ReactNode } from 'react';
import { Icon } from '@/components/product/Icon';
import { Progress } from '@/components/ui/progress';
import { messages } from '@/messages/pt-BR';
import { cn } from '@/lib/utils';
import { QrCode } from './QrCode';

/** Seconds between two QR renewals (RN-QR-01). */
export const QR_RENEWAL_SECONDS = 30;

/** Formats seconds as `m:ss` ("0:24"). */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export interface QrCardProps extends Omit<ComponentProps<'div'>, 'children' | 'title'> {
  /** The signed QR token to encode. */
  value: string;
  /** Seconds left until the QR renews. */
  secondsLeft: number;
  totalSeconds?: number;
  /**
   * `panel`: the "Meu QR" screen. `attached`: the QR glued to the bottom of an open
   * `ProgramCard`.
   */
  variant?: 'panel' | 'attached';
  /** `panel` only: customer name under the countdown. */
  title?: ReactNode;
  /** `panel` only: hint under the name. */
  subtitle?: ReactNode;
  /** `attached` only: heading under the QR. Defaults to "Mostre este código". */
  heading?: ReactNode;
  /** `attached` only: shows the "Ver detalhes" link when set. */
  onDetails?: () => void;
}

function Countdown({
  secondsLeft,
  totalSeconds,
  className,
}: {
  secondsLeft: number;
  totalSeconds: number;
  className?: string;
}) {
  const clamped = Math.min(totalSeconds, Math.max(0, secondsLeft));
  const text = messages.qr.renewsIn(formatCountdown(clamped));
  return (
    <Progress
      value={clamped}
      max={totalSeconds}
      getValueLabel={() => text}
      aria-label={messages.qr.progressLabel}
      className={className}
    />
  );
}

/** QR code with the renewal countdown (design `Meu-QR` and `Inicio-Selecionado`). */
export function QrCard({
  value,
  secondsLeft,
  totalSeconds = QR_RENEWAL_SECONDS,
  variant = 'panel',
  title,
  subtitle,
  heading = messages.qr.showCode,
  onDetails,
  className,
  ...props
}: QrCardProps) {
  const countdownText = messages.qr.renewsIn(
    formatCountdown(Math.min(totalSeconds, Math.max(0, secondsLeft))),
  );

  if (variant === 'attached') {
    return (
      <div
        className={cn(
          'flex flex-col items-center gap-2 rounded-b-card border-[1.5px] border-t-0 bg-card p-4 text-center',
          className,
        )}
        {...props}
      >
        <QrCode value={value} className="size-32" />
        <Countdown secondsLeft={secondsLeft} totalSeconds={totalSeconds} className="w-32" />
        <span className="text-button font-bold text-foreground">{heading}</span>
        <div className="-my-1 flex items-center justify-between self-stretch">
          <span className="text-caption text-muted-foreground">{countdownText}</span>
          {onDetails ? (
            <button
              type="button"
              onClick={onDetails}
              className="-mx-3 -my-2 inline-flex min-h-11 cursor-pointer items-center gap-0.5 bg-transparent px-3 text-body-sm font-bold text-primary-ink"
            >
              {messages.qr.details}
              <Icon name="chevron-right" size={18} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-6 rounded-panel border-[1.5px] bg-card px-6 pt-8 pb-6 text-center',
        className,
      )}
      {...props}
    >
      <QrCode value={value} className="size-60" />
      <div className="flex w-60 flex-col items-center gap-2">
        <Countdown secondsLeft={secondsLeft} totalSeconds={totalSeconds} className="w-full" />
        <span className="text-body-sm font-semibold text-foreground">{countdownText}</span>
      </div>
      {title || subtitle ? (
        <div className="flex flex-col gap-1">
          {title ? (
            <span className="text-xl leading-[26px] font-bold text-foreground">{title}</span>
          ) : null}
          {subtitle ? <span className="text-body-sm text-muted-foreground">{subtitle}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
