'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface GoalRecheckBannerProps {
  /** Creator's primary_goal from Card 3 — displayed in the banner question. */
  goal: string;
  /** Called when user confirms goal is still correct or dismisses the banner. */
  onDismiss: () => void;
  className?: string;
}

/** Inline banner shown post-result when analysis_count % 10 === 0 (PROFILE-16/D-07).
 *  Non-blocking, dismissable. NOT the full ProfileInterviewModal. */
export function GoalRecheckBanner({
  goal,
  onDismiss,
  className,
}: GoalRecheckBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  return (
    <div
      data-testid="goal-recheck-banner"
      className={cn(
        'rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 flex items-center gap-3',
        className
      )}
      style={{ boxShadow: 'rgba(255,255,255,0.05) 0px 1px 0px 0px inset' }}
    >
      <p className="text-sm text-foreground flex-1">
        Quick check — is your goal still{' '}
        <span className="text-accent font-medium">{goal}</span>?
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-xs text-foreground-muted hover:text-foreground transition-colors shrink-0"
      >
        Yes, still right
      </button>
    </div>
  );
}
