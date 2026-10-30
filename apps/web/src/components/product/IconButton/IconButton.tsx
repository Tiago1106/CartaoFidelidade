import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from '../Icon';

export interface IconButtonProps extends Omit<
  ComponentProps<typeof Button>,
  'children' | 'aria-label' | 'variant' | 'size'
> {
  icon: IconName;
  /** Accessible name. Required, because the button has no visible text. */
  label: string;
}

/** shadcn Button with a 44 px touch target, a 32 px circle and a 16 px icon (design `BotaoIcone`). */
export function IconButton({ icon, label, className, ...props }: IconButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      className={cn('disabled:bg-transparent disabled:opacity-50', className)}
      {...props}
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-foreground">
        <Icon name={icon} size={16} />
      </span>
    </Button>
  );
}
