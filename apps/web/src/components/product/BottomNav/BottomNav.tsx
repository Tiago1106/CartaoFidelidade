import { Icon, type IconName } from '@/components/product/Icon';
import { messages } from '@/messages/pt-BR';
import { cn } from '@/lib/utils';

export type CustomerTab = 'cards' | 'qr' | 'profile';
export type OwnerTab = 'dashboard' | 'cards' | 'customers' | 'staff' | 'plan';

interface Tab<K extends string> {
  key: K;
  icon: IconName;
  label: string;
}

const customerTabs: Tab<CustomerTab>[] = [
  { key: 'cards', icon: 'ticket', label: messages.nav.customer.cards },
  { key: 'qr', icon: 'qr-code', label: messages.nav.customer.qr },
  { key: 'profile', icon: 'user', label: messages.nav.customer.profile },
];

const ownerTabs: Tab<OwnerTab>[] = [
  { key: 'dashboard', icon: 'bar-chart', label: messages.nav.owner.dashboard },
  { key: 'cards', icon: 'ticket', label: messages.nav.owner.cards },
  { key: 'customers', icon: 'users', label: messages.nav.owner.customers },
  { key: 'staff', icon: 'user', label: messages.nav.owner.staff },
  { key: 'plan', icon: 'credit-card', label: messages.nav.owner.plan },
];

type BottomNavProps =
  | {
      mode: 'customer';
      active: CustomerTab;
      onSelect?: (tab: CustomerTab) => void;
      className?: string;
    }
  | { mode: 'owner'; active: OwnerTab; onSelect?: (tab: OwnerTab) => void; className?: string };

/**
 * Bottom tab bar (design `BarraAbas`). The customer bar has three tabs and highlights
 * "Meu QR" in amber; the owner bar has five.
 */
export function BottomNav(props: BottomNavProps) {
  const { mode, active, className } = props;
  const tabs: Tab<string>[] = mode === 'owner' ? ownerTabs : customerTabs;
  const select = props.onSelect as ((tab: string) => void) | undefined;

  return (
    <nav
      aria-label={messages.nav.label}
      className={cn('flex h-22 w-full border-t bg-card px-2 pt-2 pb-6', className)}
    >
      {tabs.map(({ key, icon, label }) => {
        const on = key === active;
        const isQr = mode === 'customer' && key === 'qr';
        return (
          <button
            key={key}
            type="button"
            aria-current={on ? 'page' : undefined}
            onClick={() => select?.(key)}
            className="flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 bg-transparent p-0"
          >
            <span
              className={cn(
                'flex h-8 items-center justify-center rounded-full',
                mode === 'customer' && !isQr ? 'w-16' : 'w-14',
                isQr
                  ? 'bg-primary text-primary-foreground'
                  : on
                    ? 'bg-accent text-primary-ink'
                    : 'text-muted-foreground',
              )}
            >
              <Icon name={icon} size={24} />
            </span>
            <span
              className={cn(
                'text-xs',
                on || isQr ? 'font-bold' : 'font-semibold',
                on ? 'text-primary-ink' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
