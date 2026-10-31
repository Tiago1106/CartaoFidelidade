import { useNavigate, useSearchParams } from 'react-router-dom';
import { OnboardingArt } from '@/components/product/OnboardingArt';
import { StepDots } from '@/components/product/StepDots';
import { Button } from '@/components/ui/button';
import { messages } from '@/messages/pt-BR';

const slides = messages.welcome.slides;
const TOTAL = slides.length;

/** After the welcome: the next step of the flow. [Premissa] The profile choice (02) comes in T10. */
const AFTER_WELCOME = '/sign-in';

function parseStep(value: string | null): number {
  const step = Number(value);
  return Number.isInteger(step) && step >= 1 && step <= TOTAL ? step : 1;
}

/** Welcome, "Como funciona" in three steps (screens 01.1, 01.2 and 01.3). */
export function WelcomePage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const step = parseStep(params.get('step'));
  const slide = slides[step - 1]!;
  const isLast = step === TOTAL;

  const finish = () => navigate(AFTER_WELCOME);
  // `push` keeps each step in the history, so the browser back button goes to the previous one.
  const next = () => setParams({ step: String(step + 1) });

  return (
    <section data-screen="welcome" className="relative flex h-full flex-col bg-accent">
      <div className="min-h-40 flex-1">
        <OnboardingArt slide={step as 1 | 2 | 3} />
      </div>

      {isLast ? null : (
        <div className="absolute top-12 right-6">
          <Button variant="secondary" size="small" onClick={finish}>
            {messages.welcome.skip}
          </Button>
        </div>
      )}

      <div className="flex shrink-0 flex-col items-center rounded-t-panel bg-card px-6 pt-10 pb-8">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-title-2 tracking-[-0.3px] text-foreground">{slide.title}</h1>
          <p className="text-body text-muted-foreground">{slide.body}</p>
        </div>
        <StepDots step={step} total={TOTAL} className="mt-6" />
        <div className="mt-4 w-full">
          <Button onClick={isLast ? finish : next}>
            {isLast ? messages.welcome.start : messages.welcome.next}
          </Button>
        </div>
      </div>
    </section>
  );
}
