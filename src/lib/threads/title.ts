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
  // A filename or a bare link is not a title (see isNonTopical) — refuse it so the
  // write-once guard stays OPEN and the next, better signal can claim the slot.
  if (isNonTopical(text)) return null;
  return text.slice(0, THREAD_TITLE_MAX).trimEnd();
}

/** File extensions a dropped asset arrives with. */
const ASSET_EXT =
  /\.(mp4|mov|m4v|webm|avi|mkv|mp3|wav|m4a|aac|png|jpe?g|gif|webp|heic|heif|pdf|docx?|txt|csv|zip)$/i;

// ─── isNonTopical ─────────────────────────────────────────────────────────────
/**
 * True when a candidate says nothing about what the thread is ABOUT.
 *
 * The write-once title takes the first signal it is handed. When someone drops a
 * video instead of typing an ask, that first signal is the upload's filename — so
 * threads were landing in the sidebar as "TikTok Video Downloader (1).mp4", and
 * because the write is write-once, the real subject could never replace it. The
 * same happens for a pasted TikTok URL.
 *
 * Rejecting here rather than at the call sites is deliberate: `cleanThreadTitle`
 * is the single choke point every writer already passes through (send path, skill
 * subject, and the /api/threads/list read-repair), and returning null leaves the
 * `title IS NULL` guard open so the next candidate — the skill subject, or a
 * derived card headline — gets the slot instead.
 *
 * Kept narrow ON PURPOSE. A real ask that merely CONTAINS a link ("react to
 * https://tiktok.com/… as a skeptic") is topical and must survive; only a bare
 * URL with nothing else to say is refused.
 */
export function isNonTopical(text: string): boolean {
  // A bare URL — the whole candidate is one link and nothing else.
  if (/^https?:\/\/\S+$/i.test(text)) return true;
  // A filename: no spaces before the extension, or the classic "name (1).mp4".
  // Requires the extension to END the string so "script.mp4 vs the original" —
  // an actual sentence — is not swallowed.
  if (ASSET_EXT.test(text) && /^[^\s]+(\s*\(\d+\))?\.[a-z0-9]+$/i.test(text)) return true;
  // Same, but tolerant of spaces inside the stem ("TikTok Video Downloader (1).mp4").
  if (ASSET_EXT.test(text) && text.split(/\s+/).length <= 6 && !/[.!?,;:]/.test(text.replace(ASSET_EXT, "")))
    return true;
  return false;
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
