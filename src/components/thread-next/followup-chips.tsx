"use client";

import { Chip } from "@/components/ui/chip";
import type { ChatFollowup } from "@/lib/tools/chat-followups";
import { cn } from "@/lib/utils";

/**
 * The next-step chips (new look, spec 2026-11-20 §4.4; reference
 * `.scratch/next-look/part3/design/field.html`, `.f1-chips`): the curated prompts as quiet pills,
 * the card `Chip` (32 tall, 14 / 560). Shown under the last answer only (`PersistedThreadStream`).
 *
 * OUTLINED, not filled: the answer-system drawing approved on 2026-11-21 (`answers.html`,
 * `.ax .tq-nx > span`) draws them transparent with an inset 1 px ring of the ink at 16%, so they
 * never look like the field's filled skill pills. A hover lays the sunken tint inside the ring.
 *
 * Wrap gaps as drawn: 6 across, 12 down. 12 down also clears the touch halo: `.tap-44` grows each
 * 32 pill by 6 above and below, so two wrapped rows' halos meet and never overlap (32 + 12 = 44).
 *
 * Rendered by `FollowupRow` under the flag, which keeps what a tap sends (and the rewrite pack a
 * chip carries) and passes it as `onPick`. The row keeps `data-testid="followup-row"`; each chip
 * keeps its name, "Follow up: <label>".
 */
const OUTLINED = "bg-transparent inset-ring inset-ring-foreground/16 hover:bg-surface-sunken";

export function FollowupChips({
  followups,
  onPick,
  className,
}: {
  followups: ChatFollowup[];
  onPick: (followup: ChatFollowup) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-x-1.5 gap-y-3", className)} data-testid="followup-row">
      {followups.map((f) => (
        <Chip key={f.label} surface="card" aria-label={`Follow up: ${f.label}`} onClick={() => onPick(f)} className={OUTLINED}>
          {f.label}
        </Chip>
      ))}
    </div>
  );
}
