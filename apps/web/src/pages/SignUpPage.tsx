import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField } from '@/components/product/TextField';
import { Button } from '@/components/ui/button';
import { useSaveFirstAccessName } from '@/data/hooks';
import { cleanName, NAME_MAX_LENGTH } from '@/data/firstAccess';
import { messages } from '@/messages/pt-BR';
import { useSession } from '@/session/SessionProvider';
import { AuthLayout } from './AuthLayout';

/** First access, name (screen 05). Only for a new account, right after the SMS code (RN-ENT-07). */
export function SignUpPage() {
  const navigate = useNavigate();
  const { completeSignUp, signOut } = useSession();
  const text = messages.signUp;

  const [name, setName] = useState('');
  const save = useSaveFirstAccessName();

  const filled = cleanName(name).length > 0;

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
    if (save.isError) save.reset();
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!filled || save.isPending) return;
    // The session opens fully and the guard sends the customer Home.
    save.mutate(name, { onSuccess: () => completeSignUp() });
  };

  // The account has no name yet, so leaving the step ends the half-open session.
  const back = () => {
    signOut();
    navigate('/sign-in', { replace: true });
  };

  return (
    <AuthLayout
      screen="sign-up"
      title={text.title}
      description={text.subtitle}
      onBack={back}
      onSubmit={onSubmit}
      footer={
        <Button type="submit" disabled={!filled || save.isPending}>
          {text.submit}
        </Button>
      }
    >
      <TextField
        type="text"
        label={text.label}
        placeholder={text.placeholder}
        value={name}
        onChange={onChange}
        maxLength={NAME_MAX_LENGTH}
        error={save.isError}
        message={save.isError ? text.error : undefined}
        autoFocus
      />
    </AuthLayout>
  );
}
