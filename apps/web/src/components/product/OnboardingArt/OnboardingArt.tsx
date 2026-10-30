import type { CSSProperties } from 'react';
import { Icon, type IconName } from '@/components/product/Icon';
import { StampSeal } from '@/components/product/StampSeal';
import { messages } from '@/messages/pt-BR';
import { cn } from '@/lib/utils';

export type OnboardingSlide = 1 | 2 | 3 | 'logo';

export interface OnboardingArtProps {
  slide: OnboardingSlide;
  className?: string;
}

// The design canvas is 390 x 508. Every element is anchored to its center, so the art
// still works on narrower and shorter screens (the edges are clipped).
const CANVAS = { centerX: 195, centerY: 254 };

function anchor(x: number, y: number): CSSProperties {
  return {
    left: `calc(50% + ${x - CANVAS.centerX}px)`,
    top: `calc(50% + ${y - CANVAS.centerY}px)`,
  };
}

// [x, y, size, rotation, icon], from `Ilustracao.dc.html`.
const pattern: [number, number, number, number, IconName][] = [
  [28, 64, 30, -14, 'star'],
  [232, 40, 28, 12, 'heart'],
  [120, 36, 26, 8, 'sparkles'],
  [338, 150, 28, -10, 'scissors'],
  [34, 170, 32, 14, 'smartphone'],
  [92, 112, 26, -6, 'circle-check'],
  [286, 112, 24, 16, 'star'],
  [22, 290, 28, -12, 'gift'],
  [340, 282, 32, 10, 'sparkles'],
  [70, 392, 30, 12, 'heart'],
  [300, 402, 28, -14, 'trophy'],
  [190, 446, 26, 6, 'scissors'],
  [352, 372, 24, -8, 'circle-check'],
  [128, 468, 22, -12, 'star'],
  [260, 466, 24, 14, 'qr-code'],
  [14, 432, 24, 8, 'scissors'],
];

/** Illustration of the welcome screens (design `Ilustracao`): an icon pattern and one tile. */
export function OnboardingArt({ slide, className }: OnboardingArtProps) {
  return (
    <div
      aria-hidden={slide === 'logo' ? undefined : true}
      data-slide={slide}
      className={cn('relative size-full min-h-0 overflow-hidden bg-accent', className)}
    >
      {pattern.map(([x, y, size, rotation, icon]) => (
        <div
          key={`${x}-${y}`}
          className="absolute text-primary-ink opacity-40"
          style={{ ...anchor(x, y), transform: `rotate(${rotation}deg)` }}
        >
          <Icon name={icon} size={size} />
        </div>
      ))}

      {slide === 1 ? (
        <div
          className="absolute flex size-39 items-center justify-center rounded-panel bg-card shadow-art"
          style={anchor(117, 176)}
        >
          <Icon name="qr-code" size={92} className="text-foreground" />
        </div>
      ) : null}

      {slide === 2 ? (
        <div
          className="absolute flex w-[254px] flex-col gap-3.5 rounded-panel bg-card px-[22px] py-5 shadow-art"
          style={anchor(68, 190)}
        >
          <div className="text-caption font-semibold text-foreground">
            {messages.onboarding.sampleCard}
          </div>
          <div className="flex w-[210px] flex-wrap gap-2.5">
            {Array.from({ length: 10 }, (_, i) =>
              i < 7 ? (
                <div
                  key={i}
                  data-filled="true"
                  className="flex size-[34px] items-center justify-center rounded-full bg-primary text-primary-foreground"
                >
                  <Icon name="check" size={18} />
                </div>
              ) : (
                <div
                  key={i}
                  data-filled="false"
                  className="size-[34px] rounded-full border-2 border-dashed border-input"
                />
              ),
            )}
          </div>
        </div>
      ) : null}

      {slide === 3 ? (
        <>
          <div
            className="absolute flex size-36 items-center justify-center rounded-panel bg-primary text-primary-foreground shadow-art"
            style={anchor(123, 182)}
          >
            <Icon name="gift" size={76} />
          </div>
          <div
            className="absolute text-primary-ink"
            style={{ ...anchor(286, 176), rotate: '10deg' }}
          >
            <Icon name="sparkles" size={34} />
          </div>
          <div
            className="absolute text-primary-ink"
            style={{ ...anchor(66, 300), rotate: '-12deg' }}
          >
            <Icon name="sparkles" size={26} />
          </div>
        </>
      ) : null}

      {slide === 'logo' ? (
        <div className="absolute" style={anchor(129, 188)}>
          <StampSeal size={132} />
        </div>
      ) : null}
    </div>
  );
}
