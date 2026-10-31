import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TextField } from '@/components/product/TextField';
import { TextLink } from '@/components/product/TextLink';
import { Button } from '@/components/ui/button';
import { authErrorMessage } from '@/data/authErrorMessage';
import { useRequestOtp } from '@/data/hooks';
import { formatNationalPhone, isValidMobile, nationalDigits, toE164 } from '@/lib/phone';
import { messages } from '@/messages/pt-BR';
import { AuthLayout } from './AuthLayout';

/** What the code screen needs from this one. */
export interface SignInCodeState {
  phone: string;
  retryAfterSeconds: number;
}

/** Sign in, phone (screen 03). */
export function SignInPhonePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const text = messages.signIn.phone;

  // Coming back from "Alterar número", the number is still there.
  const previous = (location.state as { phone?: string } | null)?.phone;
  const [digits, setDigits] = useState(() => nationalDigits(previous?.replace(/^\+55/, '') ?? ''));
  const [touched, setTouched] = useState(false);
  const request = useRequestOtp();

  const valid = isValidMobile(digits);
  const incomplete = touched && digits.length > 0 && !valid;
  const error = incomplete || request.isError;
  const message = incomplete
    ? messages.signIn.errors.invalidPhone
    : request.isError
      ? authErrorMessage(request.error)
      : undefined;

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDigits(nationalDigits(event.target.value));
    if (request.isError) request.reset();
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid || request.isPending) return;
    const phone = toE164(digits);
    request.mutate(phone, {
      onSuccess: ({ retryAfterSeconds }) => {
        const state: SignInCodeState = { phone, retryAfterSeconds };
        navigate('/sign-in/code', { state });
      },
    });
  };

  const back = () => {
    if (location.key === 'default') navigate('/profile-choice', { replace: true });
    else navigate(-1);
  };

  return (
    <AuthLayout
      screen="sign-in"
      title={text.title}
      description={text.subtitle}
      onBack={back}
      onSubmit={onSubmit}
      footer={
        <>
          <p className="text-center text-micro text-muted-foreground">
            {text.termsBefore}
            <TextLink href="#terms">{text.termsLink}</TextLink>
            {text.termsMiddle}
            <TextLink href="#privacy">{text.privacyLink}</TextLink>
            {text.termsAfter}
          </p>
          <Button type="submit" disabled={!valid || request.isPending}>
            {text.submit}
          </Button>
        </>
      }
    >
      <TextField
        type="tel"
        label={text.label}
        prefix={text.prefix}
        placeholder={text.placeholder}
        value={formatNationalPhone(digits)}
        onChange={onChange}
        onBlur={() => setTouched(true)}
        error={error}
        message={message}
        autoFocus
      />
    </AuthLayout>
  );
}
