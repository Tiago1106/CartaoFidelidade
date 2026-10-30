import { Icon } from '@/components/product/Icon';
import { cn } from '@/lib/utils';

export interface MenuRowProps {
  label: string;
  value?: string;
  /** Shows the arrow and makes the row a button. Without it, the row is read-only. */
  showArrow?: boolean;
  /** Draws a line on top, to separate it from the previous row. */
  divider?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Row of a menu list: label, value and arrow (design `LinhaMenu`). */
export function MenuRow({
  label,
  value,
  showArrow = true,
  divider = false,
  onClick,
  className,
}: MenuRowProps) {
  const classes = cn(
    'flex min-h-14 w-full items-center gap-3 bg-card px-4 text-left',
    divider && 'border-t',
    showArrow && 'cursor-pointer',
    className,
  );
  const content = (
    <>
      <span className="flex-none text-body font-semibold text-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right text-body text-muted-foreground">
        {value}
      </span>
      {showArrow ? <Icon name="chevron-right" size={20} className="text-muted-foreground" /> : null}
    </>
  );

  if (!showArrow) return <div className={classes}>{content}</div>;
  return (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );
}
