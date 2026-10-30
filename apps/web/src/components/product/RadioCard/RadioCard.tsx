import type { ComponentProps } from 'react';
import { RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

export interface RadioCardProps extends Omit<ComponentProps<typeof RadioGroupItem>, 'children'> {
  /** Name of the option. */
  title: string;
  /** Second line, for example "7 de 10 carimbos". */
  detail?: string;
  /** The option cannot be chosen, for example a card still in its minimum interval. */
  blocked?: boolean;
}

/**
 * Option card (design `OpcaoCartao`). Use inside shadcn `RadioGroup`. The whole card is
 * the click target and the radio inside it is the accessible control.
 */
export function RadioCard({
  title,
  detail,
  blocked = false,
  disabled,
  className,
  ...props
}: RadioCardProps) {
  const isDisabled = blocked || disabled;

  return (
    <label
      className={cn(
        'flex min-h-18 w-full cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] bg-card px-4 py-3',
        'has-[[data-state=checked]]:border-2 has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:bg-accent',
        'has-disabled:cursor-not-allowed has-disabled:bg-muted',
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span
          className={cn(
            'text-body font-bold',
            isDisabled ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {title}
        </span>
        {detail ? <span className="text-caption text-muted-foreground">{detail}</span> : null}
      </span>
      <RadioGroupItem disabled={isDisabled} {...props} />
    </label>
  );
}
