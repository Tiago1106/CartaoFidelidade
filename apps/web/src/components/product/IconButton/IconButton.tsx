import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from '../Icon';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-label'
> {
  icon: IconName;
  /** Accessible name. Required, because the button has no visible text. */
  label: string;
}

/** 44 px touch target with a 32 px circle and a 16 px icon. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        'flex size-11 cursor-pointer items-center justify-center bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-foreground">
        <Icon name={icon} size={16} />
      </span>
    </button>
  );
});
