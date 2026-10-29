import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg cursor-pointer ' +
    'disabled:cursor-not-allowed disabled:border-0 disabled:bg-border disabled:text-muted-foreground',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground',
        secondary: 'border-[1.5px] border-input bg-card text-foreground',
        ghost: 'bg-transparent text-muted-foreground',
      },
      size: {
        large: 'h-14 w-full text-button',
        small: 'h-11 px-4 text-label',
      },
    },
    defaultVariants: { variant: 'primary', size: 'large' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});
