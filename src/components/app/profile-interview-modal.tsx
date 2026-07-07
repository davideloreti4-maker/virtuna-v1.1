"use client";

import * as React from "react";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

import { CardProgressDots } from "@/components/app/card-progress-dots";
import { InterviewCard } from "@/components/app/interview-card";
import { TruthfulnessCallout } from "@/components/app/truthfulness-callout";

import { PlatformPicker } from "@/components/app/cards/platform-picker";
import { NichePicker } from "@/components/app/cards/niche-picker";
import { AudiencePicker } from "@/components/app/cards/audience-picker";
import { GoalStagePicker } from "@/components/app/cards/goal-stage-picker";
import { ContentStylePicker } from "@/components/app/cards/content-style-picker";
import { ReferenceCreatorsInput } from "@/components/app/cards/reference-creators-input";
import { WinsFlopsInput } from "@/components/app/cards/wins-flops-input";
import { CadencePicker } from "@/components/app/cards/cadence-picker";
import { PainPointsInput } from "@/components/app/cards/pain-points-input";
import { VoiceSampleInput } from "@/components/app/cards/voice-sample-input";

import { useProfileInterviewStore } from "@/stores/profile-interview-store";

/**
 * ProfileInterviewModal — 9-card creator interview wizard shell.
 *
 * Composes:
 *   - Radix Dialog with mandatory-flow accessibility overrides (Escape and
 *     backdrop click are disabled per UI-SPEC §Accessibility — D-05 says the
 *     modal MUST be reached before the first upload can complete).
 *   - CardProgressDots (active card indicator) at the top.
 *   - InterviewCard frame per card (heading + description + body slot +
 *     Back/Continue/Skip-this-question footer).
 *   - The 9 picker components from `@/components/app/cards/*`.
 *   - TruthfulnessCallout on Card 0 and Card 6 (D-04).
 *
 * State lives in `useProfileInterviewStore` — the modal is a pure render
 * surface. No re-prompt / analyses-counter logic (D-14).
 */

export interface ProfileInterviewModalProps {
  open: boolean;
  onClose: () => void;
}

const TOTAL_CARDS = 10;
const MODAL_TITLE = "Tell us about your content";

interface CardCopy {
  heading: string;
  description: string;
}

const CARD_COPY: Record<number, CardCopy> = {
  0: {
    heading: "Tell us about your content",
    description:
      "Help Maven understand what you create so predictions are calibrated to you.",
  },
  1: {
    heading: "What's your niche?",
    description:
      "Start broad. We'll drill down to the exact content type.",
  },
  2: {
    heading: "Who's your audience?",
    description:
      "Approximate is fine — even rough demographics sharpen persona simulation.",
  },
  3: {
    heading: "What's your goal?",
    description: "Choose one goal and your current creator stage.",
  },
  4: {
    heading: "How do you make content?",
    description:
      "Style influences how hook and pacing signals are weighted in your predictions.",
  },
  5: {
    heading: "Who inspires you?",
    description: "Add up to 3 creators whose style you aim to match.",
  },
  6: {
    heading: "Your wins and flops",
    description:
      "Past performance helps the engine understand your baseline.",
  },
  7: {
    heading: "How often do you post?",
    description: "Cadence feeds the timing-awareness layer.",
  },
  8: {
    heading: "What's your biggest challenge?",
    description:
      "Freeform. The engine uses this to weight critique framing.",
  },
  9: {
    heading: "Your writing voice",
    description:
      "Paste a short script or caption you want to sound like. The engine emulates your style — not the content.",
  },
};

export function ProfileInterviewModal({
  open,
  onClose,
}: ProfileInterviewModalProps): React.JSX.Element | null {
  const currentCard = useProfileInterviewStore((s) => s.currentCard);
  const draft = useProfileInterviewStore((s) => s.draft);
  const isClosing = useProfileInterviewStore((s) => s.isClosing);
  const lastError = useProfileInterviewStore((s) => s.lastError);
  const setDraftField = useProfileInterviewStore((s) => s.setDraftField);
  const advanceCard = useProfileInterviewStore((s) => s.advanceCard);
  const skipCard = useProfileInterviewStore((s) => s.skipCard);
  const goBack = useProfileInterviewStore((s) => s.goBack);
  const skipInterview = useProfileInterviewStore((s) => s.skipInterview);
  const finalize = useProfileInterviewStore((s) => s.finalize);
  const reset = useProfileInterviewStore((s) => s.reset);

  const [isAdvancing, setIsAdvancing] = useState(false);

  // CR-03: close-effect uses a ref guard so it fires at-most-once per close
  // action, even when the parent re-renders (e.g., apolloTier change) while
  // `isClosing` is still true. Without the ref, a fresh inline `onClose`
  // reference from the parent would re-trigger `onClose() + reset()` — which
  // would re-fire the deferred submit via `resumeAfterModal()` and upload the
  // same video twice. The reset effect below clears the ref when the modal
  // re-opens so the wizard is reusable in the same session.
  const closedRef = React.useRef(false);

  useEffect(() => {
    if (isClosing && !closedRef.current) {
      closedRef.current = true;
      onClose();
      reset();
    }
  }, [isClosing, onClose, reset]);

  useEffect(() => {
    if (open) closedRef.current = false;
  }, [open]);

  // WR-10: zustand fires its `set` subscribers synchronously inside
  // `advanceCard`, so the modal re-renders with the NEW currentCard before
  // the post-await `setIsAdvancing(false)` is dispatched. That causes a
  // ~1-frame flash of the spinner on the next card's Continue button. By
  // clearing `isAdvancing` whenever currentCard changes, the flash is gone
  // — the post-await reset becomes redundant but stays as a fallback for
  // any flow that doesn't change currentCard (e.g., persist error).
  useEffect(() => {
    setIsAdvancing(false);
  }, [currentCard]);

  const card0Invalid = currentCard === 0 && draft.platforms.length === 0;

  // CR-02: surface persistence errors via `lastError`. `handleContinue` and
  // `handleSkipAll` swallow the throw so the spinner clears, but the message
  // remains in the store and is rendered inside the card body below.
  const handleContinue = async (): Promise<void> => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    try {
      if (currentCard === 9) {
        await finalize();
      } else {
        await advanceCard();
      }
    } catch {
      // Error message is already on `lastError`; nothing to do here.
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleSkipAll = async (): Promise<void> => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    try {
      await skipInterview();
    } catch {
      // Error message is already on `lastError`; nothing to do here.
    } finally {
      setIsAdvancing(false);
    }
  };

  const renderCardBody = (): React.ReactNode => {
    switch (currentCard) {
      case 0:
        return (
          <>
            <TruthfulnessCallout />
            <PlatformPicker
              value={draft.platforms}
              onChange={(p) => setDraftField("platforms", p)}
            />
            {card0Invalid && (
              <p
                className="text-sm text-error"
                role="alert"
                data-testid="card-0-error"
              >
                Select at least one platform to continue.
              </p>
            )}
          </>
        );
      case 1:
        return (
          <NichePicker
            primary={draft.niche_primary}
            sub={draft.niche_sub}
            onChange={({ primary, sub }) => {
              setDraftField("niche_primary", primary);
              setDraftField("niche_sub", sub);
            }}
          />
        );
      case 2:
        return (
          <AudiencePicker
            value={draft.audience}
            onChange={(a) => setDraftField("audience", a)}
          />
        );
      case 3:
        return (
          <GoalStagePicker
            goal={draft.goal}
            stage={draft.stage}
            onChange={({ goal, stage }) => {
              setDraftField("goal", goal);
              setDraftField("stage", stage);
            }}
          />
        );
      case 4:
        return (
          <ContentStylePicker
            style={draft.style}
            cuts={draft.cuts}
            onChange={({ style, cuts }) => {
              setDraftField("style", style);
              setDraftField("cuts", cuts);
            }}
          />
        );
      case 5:
        return (
          <ReferenceCreatorsInput
            value={draft.references}
            onChange={(r) => setDraftField("references", r)}
          />
        );
      case 6:
        return (
          <>
            <TruthfulnessCallout />
            <WinsFlopsInput
              wins={draft.wins}
              flops={draft.flops}
              onChange={({ wins, flops }) => {
                setDraftField("wins", wins);
                setDraftField("flops", flops);
              }}
            />
          </>
        );
      case 7:
        return (
          <CadencePicker
            frequency={draft.cadence}
            todAware={draft.todAware}
            onChange={({ frequency, todAware }) => {
              setDraftField("cadence", frequency);
              setDraftField("todAware", todAware);
            }}
          />
        );
      case 8:
        return (
          <PainPointsInput
            value={draft.pain}
            onChange={(p) => setDraftField("pain", p)}
          />
        );
      case 9:
        return (
          <VoiceSampleInput
            value={draft.voice}
            onChange={(v) => setDraftField("voice", v)}
          />
        );
      default:
        return null;
    }
  };

  // Fallback to Card 0 copy when currentCard falls outside 0..8 (defensive
  // — the store only ever sets values in range). The `!` is safe because
  // CARD_COPY[0] is statically defined above.
  const copy = CARD_COPY[currentCard] ?? CARD_COPY[0]!;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Mandatory-flow override: refuse all close attempts that did not
        // originate from finalize()/skipInterview() (which set isClosing).
        // Escape and outside-click are blocked at the DialogContent level
        // below, but Radix also calls onOpenChange in those cases — we
        // simply ignore `next === false`.
        if (next) return;
      }}
    >
      <DialogContent
        size="lg"
        data-testid="profile-interview-modal"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-xl"
      >
        <div className="p-6">
          <DialogTitle className="sr-only">{MODAL_TITLE}</DialogTitle>
          <div className="mb-4 flex items-center justify-center">
            <CardProgressDots
              currentIndex={currentCard}
              totalCards={TOTAL_CARDS}
            />
          </div>
          <div
            key={currentCard}
            className="transition-opacity duration-150 ease-in-out"
          >
            <InterviewCard
              heading={copy.heading}
              description={copy.description}
              cardIndex={currentCard}
              totalCards={TOTAL_CARDS}
              showBack={currentCard > 0}
              showSkipAll={currentCard === 0}
              isLastCard={currentCard === 9}
              primaryDisabled={card0Invalid}
              primaryLoading={isAdvancing}
              onBack={goBack}
              onContinue={() => {
                void handleContinue();
              }}
              onSkipCurrent={currentCard === 9 ? () => { void handleContinue(); } : skipCard}
              onSkipAll={() => {
                void handleSkipAll();
              }}
            >
              {renderCardBody()}
              {lastError && (
                <p
                  className="text-sm text-error"
                  role="alert"
                  data-testid="profile-interview-error"
                >
                  {lastError}
                </p>
              )}
            </InterviewCard>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
