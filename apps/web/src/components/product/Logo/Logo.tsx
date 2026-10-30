import type { ComponentProps } from 'react';
import horizontal from '@/assets/logo/horizontal.svg';
import horizontalOnDark from '@/assets/logo/horizontal-on-dark.svg';
import vertical from '@/assets/logo/vertical-with-tagline.svg';
import verticalOnDark from '@/assets/logo/vertical-with-tagline-on-dark.svg';
import { messages } from '@/messages/pt-BR';

export interface LogoProps extends Omit<ComponentProps<'img'>, 'src' | 'alt'> {
  /** `horizontal`: seal and name side by side. `vertical`: seal, name and tagline. */
  layout?: 'horizontal' | 'vertical';
  /** Use `onDark` on dark backgrounds, `default` on light or amber ones. */
  tone?: 'default' | 'onDark';
}

const sources = {
  horizontal: { default: horizontal, onDark: horizontalOnDark },
  vertical: { default: vertical, onDark: verticalOnDark },
} as const;

/** The logo, from the SVGs in docs/design/logo/svg (no redraw). */
export function Logo({ layout = 'horizontal', tone = 'default', ...props }: LogoProps) {
  const alt =
    layout === 'vertical' ? `${messages.app.name}. ${messages.app.tagline}` : messages.app.name;
  return <img src={sources[layout][tone]} alt={alt} {...props} />;
}
