import { useEffect, useRef } from 'react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { messages } from '@/messages/pt-BR';
import { cn } from '@/lib/utils';

export const OTP_LENGTH = 6;

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called once, when the sixth digit is typed or pasted. */
  onComplete?: (value: string) => void;
  /** Error text shown under the boxes. Also puts the boxes in the error state. */
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/** Six boxes for the SMS code (design `Codigo`), on top of shadcn `InputOTP`. */
export function OtpInput({
  value,
  onChange,
  onComplete,
  error,
  disabled,
  autoFocus,
  className,
}: OtpInputProps) {
  const invalid = Boolean(error);
  const inputRef = useRef<HTMLInputElement>(null);

  // On an error, the focus comes back to the code with every digit selected, so the next
  // digit typed replaces the whole code instead of the person erasing six digits one by one.
  useEffect(() => {
    if (!error) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [error]);

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <InputOTP
        ref={inputRef}
        maxLength={OTP_LENGTH}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        pattern={REGEXP_ONLY_DIGITS}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label={messages.otp.label}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        autoFocus={autoFocus}
      >
        <InputOTPGroup>
          {Array.from({ length: OTP_LENGTH }, (_, index) => (
            <InputOTPSlot key={index} index={index} aria-invalid={invalid || undefined} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {error ? (
        <span role="alert" className="text-caption text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
