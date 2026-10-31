import * as React from 'react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { IconButton } from '@/components/product/IconButton';
import { useFrameContainer } from '@/layouts/FrameContainer';
import { messages } from '@/messages/pt-BR';
import { cn } from '@/lib/utils';

// shadcn Sheet, restyled as the product's bottom sheet ("folha"): it opens from the bottom,
// has rounded top corners, and closes with the X in the top-right corner, never with a
// "Fechar" button at the bottom. It stays inside the phone frame (see `FrameContainer`).

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  const container = useFrameContainer();
  return (
    <SheetPrimitive.Portal data-slot="sheet-portal" container={container ?? undefined} {...props} />
  );
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn('absolute inset-0 z-50 bg-foreground/50', className)}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content>) {
  const contentRef = React.useRef<HTMLDivElement>(null);

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={contentRef}
        data-slot="sheet-content"
        // The sheet itself takes the focus, so no ring shows on the first action when it opens.
        // The title is announced, and the first Tab goes to the first action.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
        className={cn(
          'outline-none absolute inset-x-0 bottom-0 z-50 flex flex-col items-center gap-6 rounded-t-panel bg-card px-6 pt-10 pb-8',
          className,
        )}
        {...props}
      >
        {children}
        {/* Last in the DOM, so Tab reaches the actions first and the X last. */}
        <SheetPrimitive.Close asChild>
          <IconButton icon="x" label={messages.common.close} className="absolute top-2 right-3" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex w-full flex-col gap-2 text-center', className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-title-2 tracking-[-0.3px] text-foreground', className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-body text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription };
