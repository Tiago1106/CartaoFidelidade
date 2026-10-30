import { useId, type ComponentProps } from 'react';
import { Icon, type IconName } from '@/components/product/Icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FieldType = 'tel' | 'text' | 'email' | 'password' | 'number';

const inputModes = {
  tel: 'tel',
  email: 'email',
  number: 'numeric',
  text: 'text',
  password: 'text',
} as const;
const autoCompletes = {
  tel: 'tel-national',
  email: 'email',
  password: 'current-password',
  text: 'name',
  number: 'name',
} as const;

export interface TextFieldProps extends Omit<ComponentProps<'input'>, 'type' | 'prefix'> {
  type?: FieldType;
  /** Visible label. Leave out for a field with no label, such as a search box. */
  label?: string;
  /** Text before the input, for example "+55". */
  prefix?: string;
  /** Text after the input, for example "dias". */
  suffix?: string;
  /** Icon on the left of the field. */
  icon?: IconName;
  /** Helper text under the field. Shown in the error color when `error` is set. */
  message?: string;
  error?: boolean;
}

/** Text field (design `Campo`): shadcn Label and Input inside a 56 px box. */
export function TextField({
  type = 'text',
  label,
  prefix,
  suffix,
  icon,
  message,
  error = false,
  id,
  className,
  'aria-label': ariaLabel,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      <div
        className={cn(
          'flex h-14 items-center gap-3 rounded-lg border-[1.5px] bg-card px-4',
          'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring',
          error ? 'border-destructive' : 'border-input',
        )}
      >
        {icon ? <Icon name={icon} size={22} className="shrink-0 text-muted-foreground" /> : null}
        {prefix ? (
          <>
            <span className="text-body-lg font-semibold text-foreground">{prefix}</span>
            <span aria-hidden="true" className="h-6 w-px bg-border" />
          </>
        ) : null}
        <Input
          id={inputId}
          type={type}
          inputMode={inputModes[type]}
          autoComplete={autoCompletes[type]}
          aria-label={label ? undefined : ariaLabel}
          aria-invalid={error || undefined}
          aria-describedby={message ? messageId : undefined}
          className="focus-visible:outline-none"
          {...props}
        />
        {suffix ? <span className="text-body-lg text-muted-foreground">{suffix}</span> : null}
      </div>
      {message ? (
        <span
          id={messageId}
          className={cn('text-caption', error ? 'text-destructive' : 'text-muted-foreground')}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
