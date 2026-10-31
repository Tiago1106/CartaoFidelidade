import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { OtpInput, OTP_LENGTH } from '@/components/product/OtpInput';
import { formatCountdown } from '@/components/product/QrCard';
import { TextLink } from '@/components/product/TextLink';
import { Button } from '@/components/ui/button';
import { authErrorMessage } from '@/data/authErrorMessage';
import { useRequestOtp, useVerifyOtp } from '@/data/hooks';
import { useCountdown } from '@/hooks/useCountdown';
import { formatE164 } from '@/lib/phone';
import { messages } from '@/messages/pt-BR';
import { useSession } from '@/session/SessionProvider';
import { AuthLayout } from './AuthLayout';
import type { SignInCodeState } from './SignInPhonePage';

/** Sign in, SMS code (screen 04). Without a number from screen 03, it goes back to it. */
export function SignInCodePage() {
  const location = useLocation();
  const state = location.state as Partial<SignInCodeState> | null;
  if (!state?.phone) return <Navigate to="/sign-in" replace />;
  return <SignInCode phone={state.phone} retryAfterSeconds={state.retryAfterSeconds ?? 60} />;
}

function SignInCode({ phone, retryAfterSeconds }: SignInCodeState) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useSession();
  const text = messages.signIn.code;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const { seconds, restart } = useCountdown(retryAfterSeconds);
  const verify = useVerifyOtp();
  const resend = useRequestOtp();

  const complete = code.length === OTP_LENGTH;
  const busy = verify.isPending || resend.isPending;

  const onChange = (value: string) => {
    setCode(value);
    setError(undefined);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!complete || busy) return;
    verify.mutate(
      { phone, code },
      {
        // RN-ENT-07: a new account still has to give a name, so the session is half open.
        onSuccess: ({ customer }) => signIn({ isNewAccount: !customer.profileComplete }),
        onError: (e) => setError(authErrorMessage(e)),
      },
    );
  };

  const onResend = () => {
    if (busy) return;
    resend.mutate(phone, {
      onSuccess: ({ retryAfterSeconds: next }) => {
        restart(next);
        setCode('');
        setError(undefined);
      },
      onError: (e) => setError(authErrorMessage(e)),
    });
  };

  // "Alterar número" and the back button both return to the phone, with the number filled in.
  const changeNumber = () => navigate('/sign-in', { state: { phone }, replace: true });
  const back = () => {
    if (location.key === 'default') changeNumber();
    else navigate(-1);
  };

  return (
    <AuthLayout
      screen="sign-in-code"
      title={text.title}
      description={
        <>
          {text.sentToBefore}
          <span className="whitespace-nowrap">{formatE164(phone)}</span>
          {text.sentToAfter} <TextLink onClick={changeNumber}>{text.change}</TextLink>
        </>
      }
      onBack={back}
      onSubmit={onSubmit}
      footer={
        <Button type="submit" disabled={!complete || busy}>
          {text.confirm}
        </Button>
      }
    >
      <OtpInput value={code} onChange={onChange} error={error} autoFocus />
      <p className="text-center text-body-sm text-muted-foreground">
        {seconds > 0 ? (
          text.resendIn(formatCountdown(seconds))
        ) : (
          <TextLink onClick={onResend}>{text.resend}</TextLink>
        )}
      </p>
    </AuthLayout>
  );
}
