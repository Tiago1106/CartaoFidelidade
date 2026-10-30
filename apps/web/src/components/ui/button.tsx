import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

// shadcn Button, restyled with the product tokens (design file `Botao`).
const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg ' +
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
        /** 44 px touch target with no padding, for `IconButton`. */
        icon: 'size-11 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'large' },
  },
);

function Button({
  className,
  variant = 'primary',
  size = 'large',
  type = 'button',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
