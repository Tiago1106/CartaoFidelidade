import type { ComponentProps } from 'react';
import { messages } from '@/messages/pt-BR';
import { cn } from '@/lib/utils';

export interface StampSealProps extends Omit<ComponentProps<'svg'>, 'children'> {
  /** `inverted` is the stamped mark on a card: `primary` body and a dark F. */
  variant?: 'normal' | 'inverted';
  /** Size in px. The design default is 96. */
  size?: number;
}

// Geometry copied from docs/design/logo/svg/mark.svg: 40 dots on a 176 radius around (256, 256).
const dots = Array.from({ length: 40 }, (_, i) => {
  const angle = (i * 2 * Math.PI) / 40;
  return {
    cx: Number((256 + 176 * Math.cos(angle)).toFixed(2)),
    cy: Number((256 + 176 * Math.sin(angle)).toFixed(2)),
  };
});

/** The Freguês stamp seal (design `Selo`). */
export function StampSeal({ variant = 'normal', size = 96, className, ...props }: StampSealProps) {
  const inverted = variant === 'inverted';
  const bodyFill = inverted ? 'fill-primary' : 'fill-primary-foreground';
  const markFill = inverted ? 'fill-primary-foreground' : 'fill-primary';
  const markStroke = inverted ? 'stroke-primary-foreground' : 'stroke-primary';

  return (
    <svg
      width={size}
      height={size}
      viewBox="65 65 382 382"
      role="img"
      aria-label={messages.app.name}
      className={cn('block shrink-0', className)}
      {...props}
    >
      <g className={bodyFill}>
        {dots.map((dot) => (
          <circle key={`${dot.cx}-${dot.cy}`} cx={dot.cx} cy={dot.cy} r={15} />
        ))}
        <circle cx={256} cy={256} r={176} />
      </g>
      <circle
        cx={256}
        cy={256}
        r={140}
        fill="none"
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray="0 19.99"
        className={markStroke}
      />
      <path
        d="M207.11 336V176H304.89V206.22H237.33V240.89H291.56V271.11H237.33V336Z"
        className={markFill}
      />
    </svg>
  );
}
