/**
 * title.ts — thread-title derivation (pure functions, no I/O)
 *
 * Sidebar labels must be short, topical, and DISTINCT per thread. The old
 * derivation ("first human-readable string in the earliest message") titled
 * every hooks Auto thread from the model follow-up, which opens near-identically
 * ("Hook #1 wins by…" × N). These helpers pick the most topical string available:
 *
 *   cleanThreadTitle    — normalise any raw candidate into a clipped label
 *   deriveTitleFromBlocks — pick a block-type-aware headline from a blocks array
 *                           (hook-card → hookLine, idea-card → title, …), falling
 *                           back to the generic text-ish prop keys.
 *
 * Consumers: threads.ts setThreadTitleIfEmpty (write path) and the
 * /api/threads/list fallback derivation + read-repair (legacy threads).
 */

/** Max stored title length (chars) — the sidebar CSS-truncates anyway. */
export const THREAD_TITLE_MAX = 48;

// ─── cleanThreadTitle ─────────────────────────────────────────────────────────
/**
 * Normalise a raw title candidate: collapse all whitespace runs (incl. newlines)
 * to single spaces, strip one layer of wrapping quotes (hook lines are often
 * quoted), clip to THREAD_TITLE_MAX. Returns null when nothing usable remains.
 */
export function cleanThreadTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let text = raw.replace(/\s+/g, " ").trim();
  // Strip a single layer of matching wrapping quotes ("…", '…', “…”).
  const wrapped = /^(["'“‘])(.+)["'”’]$/.exec(text);
  if (wrapped?.[2]) text = wrapped[2].trim();
  if (!text) return null;
  return text.slice(0, THREAD_TITLE_MAX).trimEnd();
}

// ─── deriveTitleFromBlocks ────────────────────────────────────────────────────

/**
 * Headline prop per block type — the most topical string each card carries.
 * Anything not listed falls through to GENERIC_KEYS (legacy behaviour).
 */
const BLOCK_HEADLINE: Record<string, (props: Record<string, unknown>) => unknown> = {
  markdown: (p) => p.text,
  "idea-card": (p) => p.title,
  "hook-card": (p) => p.hookLine,
  "script-card": (p) => p.openingBeatSeed,
  "remix-card": (p) => p.adaptedHook,
  "persona-chat-turn": (p) => p.text,
  "account-read": (p) => p.handle,
  "multi-audience-read": (p) => p.name,
  "outlier-grid": (p) => {
    const first = Array.isArray(p.tiles) ? (p.tiles[0] as Record<string, unknown> | undefined) : undefined;
    return first?.caption;
  },
};

/** Generic fallback keys, in priority order (pre-existing derivation contract). */
const GENERIC_KEYS = ["text", "ask", "seed", "prompt", "title", "query"] as const;

/**
 * Pull the most topical title candidate out of a blocks array. Tries the
 * block-type-aware headline first, then the generic text-ish keys. First block
 * that yields a non-empty cleaned string wins; null when none do.
 */
export function deriveTitleFromBlocks(blocks: unknown[]): string | null {
  for (const block of blocks) {
    const b = block as { type?: unknown; props?: Record<string, unknown> } | null;
    const props = b?.props;
    if (!props) continue;

    const headline = typeof b?.type === "string" ? BLOCK_HEADLINE[b.type] : undefined;
    if (headline) {
      const title = cleanThreadTitle(headline(props));
      if (title) return title;
    }

    for (const key of GENERIC_KEYS) {
      const title = cleanThreadTitle(props[key]);
      if (title) return title;
    }
  }
  return null;
}
