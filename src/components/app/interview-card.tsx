"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

/**
 * InterviewCard — per-card frame for the 9-card creator interview modal.
 *
 * Wraps the picker body slot with a heading + description above, and a footer
 * row with Back / Continue (or "Save Profile" on Card 8). Below the footer:
 * the always-visible "Skip this question" ghost link, plus an "I'll do this
 * later" ghost link only on Card 0 (per UI-SPEC §Interaction Contracts).
 *
 * The frame itself uses the Raycast subtle-elevated pattern — transparent bg
 * with a 6% border. The modal shell provides the solid dark surface.
 */
export interface InterviewCardProps {
  heading: string;
  description: string;
  cardIndex: number;
  totalCards: number;
  showBack: boolean;
  showSkipAll: boolean;
  isLastCard: boolean;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSkipCurrent: () => void;
  onSkipAll: () => void;
  children: React.ReactNode;
}

export function InterviewCard({
  heading,
  description,
  cardIndex,
  totalCards,
  showBack,
  showSkipAll,
  isLastCard,
  primaryDisabled,
  primaryLoading,
  onBack,
  onContinue,
  onSkipCurrent,
  onSkipAll,
  children,
}: InterviewCardProps): React.JSX.Element {
  return (
    <div
      data-testid={`interview-card-${cardIndex}`}
      aria-label={`Card ${cardIndex + 1} of ${totalCards}`}
      className="space-y-6 rounded-xl border border-white/[0.06] bg-transparent p-6"
    >
      <div className="space-y-1.5">
        <Heading level={3} className="font-medium">
          {heading}
        </Heading>
        <Text size="sm" muted>
          {description}
        </Text>
      </div>

      <div className="space-y-4">{children}</div>

      <div className={cn("flex items-center", showBack ? "justify-between" : "justify-end")}>
        {showBack && (
          <Button
            type="button"
            variant="secondary"
            onClick={onBack}
            data-testid={`interview-card-${cardIndex}-back`}
          >
            Back
          </Button>
        )}
        <Button
          type="button"
          variant="primary"
          disabled={primaryDisabled}
          loading={primaryLoading}
          onClick={onContinue}
          data-testid={`interview-card-${cardIndex}-continue`}
        >
          {isLastCard ? "Save Profile" : "Continue"}
        </Button>
      </div>

      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onSkipCurrent}
          data-testid={`interview-card-${cardIndex}-skip-current`}
          className="text-xs text-foreground-muted transition-colors hover:text-foreground-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-sm px-1 py-0.5"
        >
          Skip this question
        </button>
        {showSkipAll && (
          <button
            type="button"
            onClick={onSkipAll}
            data-testid={`interview-card-${cardIndex}-skip-all`}
            className="text-xs text-foreground-muted transition-colors hover:text-foreground-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-sm px-1 py-0.5"
          >
            I&apos;ll do this later
          </button>
        )}
      </div>
    </div>
  );
}
