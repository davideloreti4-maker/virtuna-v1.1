'use client';

/**
 * FollowupRow — the row of "what next" chips shown after any completed skill turn.
 *
 * A DIFFERENT visual TYPE from the card's forward CTA on purpose (owner, 2026-07-22: "add followup
 * actions everywhere in a different type than the buttons"). The card's primary action is a SOLID
 * tonal button (the single forward step — "Write the script →"); these are GHOST PILLS (rounded-full,
 * transparent, secondary text) offering the ALTERNATIVES — more / a sharper shape / jump ahead / fix
 * a weakness / ask about it. The two never read as the same control, so the one true next step still
 * wins the glance while the options stay one tap away.
 *
 * Each chip sends a NEW chat MESSAGE into the thread (onFollowup) — the agent routes it. The copy is
 * curated per skill in chat-followups.ts. Shared by ChatThreadView (chat-agent turns) and ThreadOutro
 * (the standalone skill views), so every skill shows the same treatment.
 *
 * onFollowup is optional: in the /dev/cards gallery the views render with no handler, so the pills
 * show for visual review but do nothing on tap. In production the composer wires the real send.
 */

import type { ChatFollowup } from '@/lib/tools/chat-followups';
import { useFollowupHandler } from '@/lib/followup-context';

export function FollowupRow({
  followups,
  onFollowup,
  className,
}: {
  followups: ChatFollowup[];
  /** Explicit send handler (ChatThreadView passes its own). Falls back to FollowupContext when omitted. */
  onFollowup?: (prompt: string) => void;
  className?: string;
}) {
  const ctxHandler = useFollowupHandler();
  const handler = onFollowup ?? ctxHandler;
  if (!followups.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ''}`} data-testid="followup-row">
      {followups.map((f) => (
        <button
          key={f.label}
          type="button"
          onClick={() => handler?.(f.prompt)}
          className="inline-flex items-center rounded-full border border-white/[0.08] bg-transparent px-3 py-1.5 text-[12.5px] font-medium leading-snug text-foreground-secondary transition-colors hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/15"
          aria-label={`Follow up: ${f.label}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
