/**
 * evidence.ts — RUN EVIDENCE: the artifacts the engine actually touched, on the wire.
 *
 * The thread's loading state told the user WHICH STEP was running and nothing about the WORK. But
 * the pipelines handle real artifacts mid-flight and then throw them away at the glass: the grounded
 * skills retrieve proven outlier videos (cover, @handle, views, multiplier) ~40s BEFORE the first
 * card exists; remix resolves the pasted post (cover, @handle, views) in the first seconds of a
 * ~90s run; the Test's extractor cuts real keyframes out of the creator's own footage while they
 * wait. Every one of those was already in memory on the server, or already on the wire, and the
 * wait rendered a shimmer instead.
 *
 * This is the shared contract for showing them: one `evidence` SSE frame, one render idiom.
 *
 * HONESTY (copy-floor §2 — the same floor the stage copy answers to):
 *  - An item is only ever built from data the engine HAS. Nothing here interpolates, estimates or
 *    predicts; there is no placeholder item and no "N sources" count without N real sources.
 *  - `headline` states what the artifacts ARE ("Reading 3 real videos matched to this subject"),
 *    never what the result will be. It is an input claim, so it is still true if the run then fails.
 *    ⚠️ This example used to read "Drafting against 3 proven videos" — which breaks the very rule
 *    the line states ("drafting" is the result) and, on a topical batch, claims a proof the cosine
 *    floor does not support. Fixed 2026-08-15; see evidenceHeadline in gather-for-run.ts.
 *  - A metric is a MEASURED number, pre-formatted by the emitter from a real column. `multiplier`
 *    only ships when it cleared the outlier bar upstream (build-proof.ts provenMultiplier) — the
 *    loading rail must never print a boast the receipt card would refuse to.
 *
 * SHAPE: pure types + parse/format. No server imports, no React — both halves of the wire depend
 * on this file, so it must stay loadable in either.
 */

/**
 * What KIND of artifact this is — drives the render, not the meaning.
 *  - `video`   a post: 9:16 cover thumbnail + @handle + a measured stat.
 *  - `profile` an account: circular avatar + @handle + a measured stat.
 *  - `frame`   one keyframe cut from the user's own video → renders as a contiguous FILMSTRIP.
 */
export type EvidenceKind = 'video' | 'profile' | 'frame';

export interface EvidenceItem {
  kind: EvidenceKind;
  /**
   * Cover / avatar / keyframe URL. Ephemeral CDN + signed URLs both land here, so the renderer
   * treats a load failure as normal and keeps the slot rather than showing a broken tile.
   */
  image?: string | null;
  /** @handle or short name. Rendered verbatim — the emitter strips any leading '@'. */
  label?: string | null;
  /** ONE honest measured stat, pre-formatted ("2.4M views", "44× vs followers"). */
  metric?: string | null;
  /** Link to the original, when the row carries one. */
  href?: string | null;
  /** Filmstrip ordering — a frame's segment index, so out-of-order arrivals still draw in order. */
  idx?: number;
}

export interface RunEvidence {
  /** What these artifacts are, in the creator's language. An INPUT claim, never a result claim. */
  headline: string;
  items: EvidenceItem[];
  /**
   * Filmstrip only: how many slots the run will ultimately fill. The strip draws them all up front
   * and fills in order, so it reads as progress and never reflows as frames land. Absent ⇒ the rail
   * draws exactly the items it has.
   */
  slots?: number;
  /**
   * Which plan row these artifacts belong to, by row name.
   *
   * Set it when a run's phases can finish OUT OF ORDER. The rail otherwise hangs off whichever row
   * is currently active, which is right for a sequential pipeline and wrong for a concurrent one:
   * the account read fires two independent Apify scrapes, and a live run measured the 30-post pull
   * landing 18s AHEAD of the profile — so the covers were drawn under "Finding your profile", a
   * step that was still running.
   *
   * Absent ⇒ the active-row fallback, byte-identical to every emitter that does not set it.
   */
  step?: string;
}

/** Cap on items rendered in one rail — a wall of thumbnails stops being evidence. */
export const MAX_EVIDENCE_ITEMS = 8;

/**
 * Is this a URL we are willing to put in an `<img src>` or an `<a href>`?
 *
 * The rail renders URLs that originate off-platform — TikTok's CDN, a signed storage URL, the link
 * back to a scraped post — arriving over SSE or out of a row a scrape wrote. http(s) and
 * app-relative are the only two shapes any real emitter produces, so anything else is malformed by
 * definition and is dropped rather than rendered. That also closes the `javascript:` href door on a
 * value that reaches an anchor tag, which is worth shutting whether or not it is reachable today.
 *
 * `//host/path` is refused with the rest: it is scheme-relative, not app-relative, and the leading
 * `/` check must not be fooled into treating a remote host as a local path.
 */
export function isSafeEvidenceUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v.length === 0) return false;
  if (v.startsWith('/') && !v.startsWith('//')) return true;
  return /^https?:\/\//i.test(v);
}

/** Internal alias — the guard reads as its purpose at the image call sites. */
const isRenderableImage = isSafeEvidenceUrl;

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v.length > 0 ? v : null;
}

function parseKind(value: unknown): EvidenceKind | null {
  return value === 'video' || value === 'profile' || value === 'frame' ? value : null;
}

/**
 * Parse ONE item off the wire. Returns null unless the item carries something worth drawing:
 * a renderable image, or a label. A tile with neither is an empty box asserting that evidence
 * exists — exactly the thing this feature is meant to replace.
 */
function parseItem(raw: unknown): EvidenceItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const kind = parseKind(r.kind);
  if (!kind) return null;

  const image = isRenderableImage(r.image) ? r.image.trim() : null;
  const label = cleanString(r.label);
  if (!image && !label) return null;

  const href = isRenderableImage(r.href) ? r.href.trim() : null;
  const idx = typeof r.idx === 'number' && Number.isInteger(r.idx) && r.idx >= 0 ? r.idx : undefined;

  return {
    kind,
    ...(image ? { image } : {}),
    ...(label ? { label } : {}),
    ...(cleanString(r.metric) ? { metric: cleanString(r.metric) } : {}),
    ...(href ? { href } : {}),
    ...(idx !== undefined ? { idx } : {}),
  };
}

/**
 * Parse an `evidence` SSE payload. Malformed items are dropped individually; a payload with no
 * surviving item returns null so the caller renders nothing rather than an empty labelled rail.
 *
 * Defensive by intent, not by ceremony: this runs inside the SSE read loop of a live run, and a
 * throw there kills the whole stream — the cards, the receipt and the closing line with it.
 */
export function parseRunEvidence(raw: unknown): RunEvidence | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const headline = cleanString(r.headline);
  if (!headline) return null;

  const items = (Array.isArray(r.items) ? r.items : [])
    .map(parseItem)
    .filter((i): i is EvidenceItem => i !== null)
    .slice(0, MAX_EVIDENCE_ITEMS);
  if (items.length === 0) return null;

  const slots =
    typeof r.slots === 'number' && Number.isInteger(r.slots) && r.slots > 0
      ? Math.min(r.slots, MAX_EVIDENCE_ITEMS)
      : undefined;

  // `step` has to survive the parse or the client silently loses the routing and falls back to the
  // active row — the exact bug this field exists to fix, reintroduced one layer down.
  const step = cleanString(r.step);

  return {
    headline,
    items,
    ...(slots !== undefined ? { slots } : {}),
    ...(step ? { step } : {}),
  };
}

// ── Emitter-side builders ───────────────────────────────────────────────────────

/** "@zachking" / "zachking" → "zachking". The rail owns the '@', so the data must not carry it. */
export function normalizeHandle(handle: string | null | undefined): string | null {
  const h = cleanString(handle);
  return h ? h.replace(/^@+/, '') || null : null;
}

/**
 * The measured stat line for a source video: the outlier multiplier when the row has one that
 * cleared the bar, else its view count, else nothing.
 *
 * Order matters. The multiplier is the interesting claim ("44× vs followers" is WHY this video is
 * evidence); raw views are the fallback that always tells the truth. Showing both would crowd a
 * 12px line, and showing neither is honest when the row carries neither.
 */
export function evidenceMetric(input: {
  multiplier?: number | null;
  views?: number | null;
  baselineLabel?: string | null;
  formatCount: (n: number) => string;
}): string | null {
  const { multiplier, views, baselineLabel, formatCount } = input;
  if (typeof multiplier === 'number' && Number.isFinite(multiplier) && multiplier > 0) {
    const rounded = multiplier >= 10 ? Math.round(multiplier) : Math.round(multiplier * 10) / 10;
    const basis = cleanString(baselineLabel);
    return `${rounded}×${basis ? ` ${basis}` : ''}`;
  }
  if (typeof views === 'number' && Number.isFinite(views) && views > 0) {
    return `${formatCount(views)} views`;
  }
  return null;
}

/**
 * Build the evidence payload for a set of source videos. Returns null when nothing survives —
 * a grounded run whose rows all lack a handle AND a cover has no evidence to show, and saying
 * "3 proven videos" over three blank tiles would be the fabrication this module exists to avoid.
 */
export function buildVideoEvidence(
  headline: (count: number) => string,
  rows: Array<{ handle: string | null; image: string | null; metric: string | null; href: string | null }>,
): RunEvidence | null {
  const items: EvidenceItem[] = rows
    .map((row): EvidenceItem | null => {
      const label = normalizeHandle(row.handle);
      const image = isRenderableImage(row.image) ? row.image.trim() : null;
      if (!label && !image) return null;
      return {
        kind: 'video',
        ...(image ? { image } : {}),
        ...(label ? { label } : {}),
        ...(cleanString(row.metric) ? { metric: cleanString(row.metric) } : {}),
        ...(isRenderableImage(row.href) ? { href: row.href!.trim() } : {}),
      };
    })
    .filter((i): i is EvidenceItem => i !== null)
    .slice(0, MAX_EVIDENCE_ITEMS);

  if (items.length === 0) return null;
  return { headline: headline(items.length), items };
}

/**
 * One account as evidence — the avatar disc the rail has always supported and nothing produced.
 *
 * Returns null unless there is something real to show (a handle or a picture); an account read
 * whose scrape came back without either has nothing to prove and should render no rail at all,
 * exactly like a degraded grounded run.
 */
export function buildProfileEvidence(
  headline: string,
  row: { handle: string | null; image: string | null; metric: string | null },
): RunEvidence | null {
  const label = normalizeHandle(row.handle);
  const image = isRenderableImage(row.image) ? row.image.trim() : null;
  if (!label && !image) return null;

  const head = cleanString(headline);
  if (!head) return null;

  return {
    headline: head,
    items: [
      {
        kind: 'profile',
        ...(image ? { image } : {}),
        ...(label ? { label } : {}),
        ...(cleanString(row.metric) ? { metric: cleanString(row.metric)! } : {}),
      },
    ],
  };
}

/**
 * A set of covers from ONE account as a filmstrip.
 *
 * Chips would repeat the same @handle down the row — noise, not information — so the creator's
 * own posts get the contiguous-tile shape the Test extractor uses, where the pictures ARE the
 * content. `slots` is what the run EXPECTS to fill, so the strip is drawn at full width up front
 * and fills rather than growing (and reflowing) as covers arrive.
 *
 * Counts what SURVIVED the drawable filter, never what it was handed — the same rule
 * buildVideoEvidence follows, so the headline can never over-claim.
 */
export function buildFrameEvidence(
  headline: (count: number) => string,
  images: Array<string | null | undefined>,
  slots?: number,
): RunEvidence | null {
  const items: EvidenceItem[] = images
    .map((img, i) =>
      isRenderableImage(img) ? ({ kind: 'frame', image: img!.trim(), idx: i } as EvidenceItem) : null,
    )
    .filter((i): i is EvidenceItem => i !== null)
    .slice(0, MAX_EVIDENCE_ITEMS);

  if (items.length === 0) return null;
  // Re-index so the strip fills left-to-right: the surviving covers' ORIGINAL positions are
  // arbitrary (a mid-list post with no cover would leave a permanent hole).
  const compacted = items.map((item, i) => ({ ...item, idx: i }));
  return {
    headline: headline(compacted.length),
    items: compacted,
    slots: Math.min(slots ?? compacted.length, MAX_EVIDENCE_ITEMS),
  };
}
