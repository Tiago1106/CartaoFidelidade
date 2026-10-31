import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type TextLinkProps = Omit<ComponentProps<'a'>, 'href'> &
  Omit<ComponentProps<'button'>, 'type'> & {
    /** With `href` it is a link. Without it, it is a button that looks like a link. */
    href?: string;
  };

const style =
  'inline cursor-pointer bg-transparent p-0 font-semibold text-primary-ink underline underline-offset-2';

/** Inline link for sentences: "Termos de uso", "Alterar número". Amber text uses `primary-ink`. */
export function TextLink({ href, className, ...props }: TextLinkProps) {
  if (href !== undefined) {
    return <a href={href} className={cn(style, className)} {...(props as ComponentProps<'a'>)} />;
  }
  return (
    <button
      type="button"
      className={cn(style, className)}
      {...(props as ComponentProps<'button'>)}
    />
  );
}
