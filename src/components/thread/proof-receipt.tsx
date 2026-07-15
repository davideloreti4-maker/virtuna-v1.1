'use client';

/**
 * ProofReceipt — the on-card grounding receipt (§11f receipts-on-cards), SHARED by every
 * grounded skill card (hook/idea/script). Extracted from hook-card-block.tsx when grounding
 * fanned out (2026-07-12) so the receipt reads identically everywhere.
 *
 * The visible payoff of grounded generation, modeled on the Sandcastles/Stanley teardown
 * card: a prominent real video THUMBNAIL (clickable → source), the source hook as a
 * [bracketed] reusable template, the source archetype, and colored stat pills
 * (↗ multiplier · 👁 views). The written-out, ready-to-post output stays the card's hero
 * ABOVE this — this block is the reusable STRUCTURE + the receipt, not the deliverable.
 *
 * Honesty spine: rendered only when a real source was attributed; numbers we don't have are
 * omitted (never fabricated). The cover is an ephemeral TikTok-CDN image (expires) — on error
 * it collapses to a play-tile placeholder (mirrors remix-card-block) so the video anchor is
 * never an empty/broken box.
 */

import { Eye, TrendUp } from '@phosphor-icons/react';
import type { HookProof } from '@/lib/tools/blocks';
import { CoverFill } from '@/components/primitives/CoverFill';

/** §11f fit glyph + plain-language label for the proof receipt (§11c degradation ladder). */
const FIT_META: Record<'in-audience' | 'adjacent' | 'structural', { glyph: string; label: string }> = {
  'in-audience': { glyph: '●', label: 'in your audience' },
  adjacent: { glyph: '◐', label: 'adjacent audience' },
  structural: { glyph: '○', label: 'cross-niche structure' },
};

function fmtViews(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function fmtMultiplier(m: number | null): string {
  if (m === null || !Number.isFinite(m)) return '';
  return m >= 100 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`;
}

/** "secret-reveal-breakdown" → "Secret Reveal Breakdown" (source archetype pill). */
function formatArchetype(slug: string | null): string | null {
  if (!slug) return null;
  return slug
    .split('-')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Render the source hook as a reusable fill-in-the-blank: connective words stay muted while each
 * [bracketed variable] becomes a distinct chip (brightness + chip, NOT hue — matte/near-zero-accent).
 * This is the "shown with variables, not written out" Sandcastles pattern. Falls back to plain text
 * if the model emitted no brackets.
 */
function TemplatedHook({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g).filter((p) => p.length > 0);
  return (
    <p className="text-[13.5px] font-medium leading-snug text-foreground-secondary">
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p) ? (
          <span
            key={i}
            className="mx-px rounded-[4px] bg-white/[0.06] px-1 py-px text-foreground"
          >
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}

export function ProofReceipt({
  proof,
  eyebrow = 'Proven structure',
}: {
  proof: HookProof;
  /**
   * What we are claiming this source IS. Defaults to the grounded claim — "Proven structure"
   * means retrieval found an above-baseline outlier and we borrowed its shape. Remix passes
   * its own wording: the user picked that video, so calling it "proven" would assert an
   * outlier check that never ran. Same receipt, only the claim differs.
   */
  eyebrow?: string;
}) {
  // Null when nothing scored this source against the audience (a remix source). Then: no
  // glyph, no match language — the receipt states who and how many views, and stops there.
  const fit = proof.fitLabel ? FIT_META[proof.fitLabel] : null;
  const mult = fmtMultiplier(proof.multiplier);
  const views = fmtViews(proof.views);
  const archetype = formatArchetype(proof.archetype);
  const statsAria = [mult ? `${mult}${proof.baselineLabel ? ` ${proof.baselineLabel}` : ''}` : null, views ? `${views} views` : null]
    .filter(Boolean)
    .join(', ');

  const body = (
    <>
      {/* Thumbnail — real cover on top of a play-tile placeholder. A missing/expired cover hides the
          <img> and the play tile shows through, so a grounded card always anchors on a video tile. */}
      <span className="relative block aspect-[9/16] w-16 shrink-0 overflow-hidden rounded-md border border-white/[0.06]">
        <CoverFill coverUrl={proof.coverUrl} playSize={18} />
      </span>

      {/* Content column */}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-foreground-muted">
            {eyebrow}
          </span>
          {archetype && (
            <span className="shrink-0 rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[11px] text-foreground-secondary">
              {archetype}
            </span>
          )}
        </span>

        {proof.hookTemplate && <TemplatedHook text={proof.hookTemplate} />}

        <span className="flex items-center gap-1.5 text-[12px] leading-snug text-foreground-muted">
          {fit && (
            <span className="shrink-0" aria-hidden="true" title={fit.label}>{fit.glyph}</span>
          )}
          <span className="truncate text-foreground-secondary">@{proof.handle}</span>
        </span>

        {/* Stat pills — colored multiplier (a real outlier is a positive signal) + views. */}
        <span className="flex flex-wrap items-center gap-1.5">
          {mult && (
            <span className="inline-flex items-center gap-1 rounded-[6px] bg-[var(--color-positive)]/[0.14] px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-[var(--color-positive)]">
              <TrendUp size={12} weight="bold" aria-hidden="true" />
              {mult}
            </span>
          )}
          {proof.baselineLabel && (
            <span className="text-[11px] text-foreground-muted">{proof.baselineLabel}</span>
          )}
          {views && (
            <span className="inline-flex items-center gap-1 rounded-[6px] bg-white/[0.05] px-1.5 py-0.5 text-[12px] tabular-nums text-foreground-secondary">
              <Eye size={12} weight="regular" aria-hidden="true" />
              {views}
            </span>
          )}
        </span>
      </span>
    </>
  );

  const base =
    'flex items-stretch gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5';
  const aria = `${eyebrow} from @${proof.handle}${statsAria ? `, ${statsAria}` : ''}${fit ? ` — match: ${fit.label}` : ''}`;
  const hint = fit ? `${fit.label} — open the source video` : 'Open the source video';

  return proof.videoUrl ? (
    <a
      href={proof.videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} transition-colors hover:border-white/[0.10] hover:bg-white/[0.035]`}
      title={hint}
      aria-label={`${aria}. Opens in a new tab.`}
    >
      {body}
    </a>
  ) : (
    <div className={base} title={fit?.label} aria-label={aria}>
      {body}
    </div>
  );
}

/**
 * NoSourceNote — the receipt's honest counterpart (2026-07-14, owner call).
 *
 * Renders in the receipt's slot when the run HAD retrieved sources but the model attributed
 * THIS card to none of them (`grounded && !proof`). It is not a receipt and claims nothing:
 * no handle, no multiplier, no fit glyph — there is no source to describe. It states the one
 * thing we do know, which is that this output is original.
 *
 * Why it exists: a grounded Ideas run attributes some cards and not others, so the grid came
 * out with a receipt on card 1 and a receipt-shaped hole on card 2. That is honest and it read
 * as broken. Stating the absence makes it deliberate. The alternative — suppressing every
 * receipt in a partly-attributed run — would have thrown away real attribution we paid a scrape
 * for, so it was rejected.
 *
 * Deliberately NOT rendered on ungrounded runs (`grounded: false`): with retrieval off there is
 * no absence to explain, and the note would sit on 100% of cards forever as pure noise.
 *
 * Dashed border + no thumbnail: same slot, same radius token, lighter state. It must not weigh
 * as much as a real receipt — the card that HAS a source should still win the glance.
 */
export function NoSourceNote({ className }: { className?: string }) {
  return (
    <p
      className={`rounded-lg border border-dashed border-white/[0.06] bg-white/[0.01] px-2.5 py-2 text-[12px] leading-snug text-foreground-muted${className ? ` ${className}` : ''}`}
    >
      Original — not drawn from a retrieved video.
    </p>
  );
}

/**
 * ProofLine — a COMPACT, non-interactive one-liner grounding attribution for dense glance
 * surfaces (the /start daily-idea cards). Same honesty spine + formatters as ProofReceipt, but
 * span-only (no <a>/<button>) so it can nest inside a card that is ITSELF a button. The full
 * clickable receipt (thumbnail + [templated] hook + stat pills) still renders in the opened Room.
 * Shows: fit glyph · "from @handle" · the outlier multiplier (the compelling "grounded in a real
 * winner" signal). Views/template/cover are omitted here — this is the cue, not the full receipt.
 */
export function ProofLine({ proof, className }: { proof: HookProof; className?: string }) {
  // Null on an unscored source (see ProofReceipt) — the glyph is a match claim, so it goes.
  const fit = proof.fitLabel ? FIT_META[proof.fitLabel] : null;
  const mult = fmtMultiplier(proof.multiplier);
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 text-[11px] leading-none text-foreground-muted${className ? ` ${className}` : ''}`}
      title={[fit?.label, mult ? `${mult} outlier` : null].filter(Boolean).join(' — ') || undefined}
    >
      {fit && <span className="shrink-0" aria-hidden="true">{fit.glyph}</span>}
      <span className="min-w-0 truncate">
        from <span className="text-foreground-secondary">@{proof.handle}</span>
      </span>
      {mult && (
        <span className="inline-flex shrink-0 items-center gap-0.5 tabular-nums text-foreground-secondary">
          <TrendUp size={11} weight="bold" aria-hidden="true" />
          {mult}
        </span>
      )}
    </span>
  );
}
