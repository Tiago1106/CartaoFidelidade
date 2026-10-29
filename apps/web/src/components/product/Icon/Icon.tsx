import type { ComponentProps } from 'react';
import {
  ArrowLeft,
  ChartColumn,
  Check,
  ChevronRight,
  CircleCheck,
  Clock,
  CreditCard,
  Gift,
  Heart,
  QrCode,
  Scissors,
  Search,
  Smartphone,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

// Names follow the mapping table in CLAUDE.md (design name `Icone`).
export const icons = {
  user: User,
  scissors: Scissors,
  'chevron-right': ChevronRight,
  'qr-code': QrCode,
  star: Star,
  heart: Heart,
  gift: Gift,
  sparkles: Sparkles,
  smartphone: Smartphone,
  trophy: Trophy,
  'circle-check': CircleCheck,
  check: Check,
  x: X,
  'arrow-left': ArrowLeft,
  ticket: Ticket,
  clock: Clock,
  'bar-chart': ChartColumn,
  users: Users,
  'credit-card': CreditCard,
  search: Search,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

export const iconNames = Object.keys(icons) as IconName[];

export interface IconProps extends Omit<ComponentProps<'svg'>, 'ref'> {
  name: IconName;
  /** Size in px. The design default is 24. */
  size?: number;
}

/** Decorative icon: the color comes from `currentColor`, so set it with a text color class. */
export function Icon({ name, size = 24, strokeWidth = 2, ...props }: IconProps) {
  const Component = icons[name];
  return <Component size={size} strokeWidth={strokeWidth} aria-hidden="true" {...props} />;
}
