import * as React from 'react';
import { cn } from '@/lib/utils';

// shadcn Input. It is borderless here because `TextField` draws the box around it
// (design file `Campo`).
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-body-lg text-foreground outline-none',
        'placeholder:text-muted-foreground disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
