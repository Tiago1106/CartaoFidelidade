import { useLocation, useNavigate } from 'react-router-dom';
import { OnboardingArt } from '@/components/product/OnboardingArt';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { messages } from '@/messages/pt-BR';

/** Profile choice: customer or business (screen 02), a sheet over the logo. */
export function ProfileChoicePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // [Premissa] Closing the sheet goes back to where the customer came from, or to the welcome.
  const close = () => {
    if (location.key === 'default') navigate('/welcome', { replace: true });
    else navigate(-1);
  };

  return (
    <section data-screen="profile-choice" className="relative h-full bg-accent">
      <div className="h-[508px] max-h-full">
        <OnboardingArt slide="logo" />
      </div>

      <Sheet open onOpenChange={(open) => !open && close()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle asChild>
              <h1>{messages.profileChoice.title}</h1>
            </SheetTitle>
            <SheetDescription>{messages.profileChoice.description}</SheetDescription>
          </SheetHeader>
          <div className="flex w-full flex-col gap-3">
            <Button onClick={() => navigate('/sign-in')}>{messages.profileChoice.customer}</Button>
            <Button variant="secondary" onClick={() => navigate('/staff/sign-in')}>
              {messages.profileChoice.staff}
            </Button>
          </div>
          <p className="text-center text-micro text-muted-foreground">
            {messages.profileChoice.hint}
          </p>
        </SheetContent>
      </Sheet>
    </section>
  );
}
