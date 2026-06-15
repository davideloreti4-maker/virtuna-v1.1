'use client';

import { Composer } from '@/components/app/home/composer';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { Reading } from './reading';
import { FollowUpProvider } from './follow-up-context';
import { FollowUpThread } from './follow-up-thread';

/**
 * ReadingThread (Phase 5) — the client shell for /analyze/[id]. It composes the
 * Simulation (Reading) with its follow-up tail (FollowUpThread) and the
 * bottom-pinned composer (the SAME Composer the home uses, in its pinned layout),
 * all sharing one chat state via FollowUpProvider.
 *
 * GATING: the follow-up composer + tail appear only once the Simulation is
 * COMPLETE — you can't ask about a Reading that's still loading. During the
 * in-flight wait the Reading owns the screen (its skeleton). usePermalinkAnalysis
 * is deduped by TanStack on the route id, so this second call shares the Reading's
 * cached row with no extra fetch.
 *
 * On the no-id /analyze base route the Reading is inert (renders nothing) and no
 * composer mounts — the /home composer is the only entry point for a new Simulation.
 */
export function ReadingThread() {
  const { id, data } = usePermalinkAnalysis();

  if (!id) {
    // /analyze base — inert (Reading returns null; home owns the composer).
    return <Reading />;
  }

  const ready =
    !!data &&
    (data as { overall_score?: number | null }).overall_score != null &&
    !(data as { analysis_unavailable?: boolean }).analysis_unavailable;

  return (
    <FollowUpProvider analysisId={id}>
      <div className={ready ? 'pb-40' : undefined}>
        <Reading />
        {ready && <FollowUpThread />}
      </div>

      {ready && (
        <div
          data-testid="follow-up-composer"
          className="sticky bottom-0 z-10 border-t border-white/[0.06] bg-background px-4 py-3"
        >
          <Composer />
        </div>
      )}
    </FollowUpProvider>
  );
}

ReadingThread.displayName = 'ReadingThread';
