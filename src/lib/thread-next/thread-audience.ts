/**
 * thread-audience.ts — the "For {audience}" line under the thread title (spec §5).
 *
 * The `audienceLabel` of the LAST `run-header` across the thread's turns. Only when the thread has
 * no run header yet (a first run still streaming) does the live run's label stand in. A last header
 * without a label means the run named no audience: the line hides rather than reaching back to an
 * older run's audience. Hidden (null) when the label is missing, empty, "General" or the legacy
 * renderer's placeholder "your audience".
 *
 * Pure: no React.
 */

import { validateBlock } from "@/lib/tools/block-registry";
import type { RunHeaderBlock } from "@/lib/tools/blocks";

const HIDDEN: ReadonlySet<string> = new Set(["general", "your audience"]);

function shown(label: string | null | undefined): string | null {
  if (typeof label !== "string") return null;
  const t = label.trim();
  if (t.length === 0 || HIDDEN.has(t.toLowerCase())) return null;
  return t;
}

export function threadAudienceOf(
  turns: readonly { blocks: readonly unknown[] }[],
  liveLabel?: string | null,
): string | null {
  for (let t = turns.length - 1; t >= 0; t--) {
    const blocks = turns[t]?.blocks ?? [];
    for (let b = blocks.length - 1; b >= 0; b--) {
      // Validated like every rendered block: a malformed header is not a header.
      const v = validateBlock(blocks[b]);
      if (!v.ok || v.block.type !== "run-header") continue;
      return shown((v.block.props as RunHeaderBlock["props"]).audienceLabel);
    }
  }
  return shown(liveLabel);
}
