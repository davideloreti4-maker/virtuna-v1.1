'use client';

/**
 * RunEvidenceRail — the artifacts the engine touched, rendered INSIDE the wait.
 *
 * A spine of step names says the engine is busy. It does not say the engine is busy WITH THE
 * CREATOR'S OWN MATERIAL, and that is the whole difference between a progress bar and a product
 * that feels alive: a shimmer claims work, a cover thumbnail of the post we just went and fetched
 * PROVES it. The Reading's in-flight filmstrip established the pattern on /analyze; this brings the
 * same evidence to the thread, where every other skill's wait happens.
 *
 * TWO SHAPES, chosen by the item kind (see evidence.ts):
 *  - video/profile → SOURCE CHIPS: cover/avatar + @handle + one measured stat. Wrapping row.
 *  - frame         → FILMSTRIP: contiguous 9:16 tiles, all slots drawn up front, filled in order.
 *
 * Every string on screen comes off the payload; this component computes no numbers and infers no
 * counts. An image that fails to load (an ephemeral CDN cover routinely does) drops to a calm
 * lettered tile and KEEPS its slot — the artifact was still real, we just can't show its picture.
 */

import { useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { EvidenceItem, RunEvidence } from '@/lib/tools/evidence';
import { MAX_EVIDENCE_ITEMS } from '@/lib/tools/evidence';

export type { EvidenceItem, RunEvidence };

/** The rail's own eyebrow — matches the Reading's in-flight section label. */
const RAIL_LABEL =
  'text-caption font-medium uppercase tracking-[0.06em] text-foreground-muted';

export interface RunEvidenceRailProps {
  evidence: RunEvidence | null | undefined;
  /** Extra classes on the rail wrapper (callers control their own vertical rhythm). */
  className?: string;
}

export function RunEvidenceRail({ evidence, className }: RunEvidenceRailProps) {
  const reduced = usePrefersReducedMotion();
  if (!evidence || evidence.items.length === 0) return null;

  // The kinds never mix in one payload (an emitter sends frames OR sources), but the choice is
  // made on the data rather than asserted, so a mixed payload degrades to chips instead of
  // dropping the frames on the floor.
  const isStrip = evidence.items.every((i) => i.kind === 'frame');

  return (
    <div
      className={'flex flex-col gap-2' + (className ? ` ${className}` : '')}
      data-testid="run-evidence"
    >
      <p className={RAIL_LABEL} data-testid="run-evidence-headline">
        {evidence.headline}
      </p>
      {isStrip ? (
        <FilmStrip items={evidence.items} slots={evidence.slots} reduced={reduced} />
      ) : (
        <ul className="flex flex-wrap gap-1.5" aria-label={evidence.headline}>
          {evidence.items.map((item, i) => (
            <li key={`${item.label ?? item.image ?? 'item'}-${i}`}>
              <SourceChip item={item} index={i} reduced={reduced} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Source chip ─────────────────────────────────────────────────────────────────

/**
 * One artifact as a compact chip: picture, @handle, measured stat.
 *
 * The picture leads because the product is video — a 20×34 cover is recognisable at a glance in a
 * way a domain pill never is. `href` upgrades the chip to a link (opening the original in a new
 * tab); without one it stays inert rather than offering a dead affordance.
 */
function SourceChip({
  item,
  index,
  reduced,
}: {
  item: EvidenceItem;
  index: number;
  reduced: boolean;
}) {
  const inner = (
    <>
      <EvidenceThumb item={item} />
      <span className="flex min-w-0 flex-col">
        {item.label && (
          <span className="truncate text-label font-medium leading-tight text-foreground-secondary">
            @{item.label}
          </span>
        )}
        {item.metric && (
          <span className="truncate text-micro leading-tight text-foreground-muted">
            {item.metric}
          </span>
        )}
      </span>
    </>
  );

  const shell =
    'flex max-w-[220px] items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] py-1 pl-1 pr-2.5 transition-colors' +
    (reduced ? '' : ' reading-reveal');
  const style = reduced ? undefined : { animationDelay: `${index * 0.07}s` };

  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="run-evidence-item"
        className={`${shell} hover:border-white/[0.10] hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]`}
        style={style}
      >
        {inner}
      </a>
    );
  }

  return (
    <span data-testid="run-evidence-item" className={shell} style={style}>
      {inner}
    </span>
  );
}

/**
 * The chip's picture. A profile is a disc (that is what an avatar is); a post is a 9:16 cover.
 * On a missing or failed image the tile keeps its footprint and shows the handle's initial — the
 * row stays aligned and nothing reflows when a CDN URL expires mid-wait.
 */
function EvidenceThumb({ item }: { item: EvidenceItem }) {
  const [failed, setFailed] = useState(false);
  const isProfile = item.kind === 'profile';
  const box = isProfile
    ? 'h-7 w-7 rounded-full'
    : 'h-[34px] w-[20px] rounded-xs';
  const show = item.image && !failed;

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden border border-white/[0.06] bg-white/[0.03] ${box}`}
      aria-hidden="true"
    >
      {show ? (
        // Ephemeral CDN / signed URLs — plain <img>, decorative alt, removes itself on error
        // (next/image would demand a remotePatterns entry per CDN and buys nothing here).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-micro font-semibold uppercase leading-none text-foreground-muted">
          {item.label?.[0] ?? '·'}
        </span>
      )}
    </span>
  );
}

// ── Filmstrip ───────────────────────────────────────────────────────────────────

/**
 * The creator's own footage, appearing as the engine reads it.
 *
 * Every slot the run will fill is drawn up front (`slots`, known from the extractor's plan) and
 * filled in ascending index order, so the strip reads as progress and never reflows as frames land
 * out of order. This mirrors the flagship /analyze skeleton's strip; the in-thread Test wait is the
 * same pipeline and now shows the same proof.
 */
function FilmStrip({
  items,
  slots,
  reduced,
}: {
  items: EvidenceItem[];
  slots?: number;
  reduced: boolean;
}) {
  const total = Math.min(Math.max(slots ?? items.length, items.length), MAX_EVIDENCE_ITEMS);
  if (total === 0) return null;

  // Frames address their own slot via `idx`; a payload without indices falls back to arrival order
  // so an emitter that cannot report segment numbers still draws a strip that fills left-to-right.
  const byIdx = new Map<number, EvidenceItem>();
  items.forEach((item, i) => {
    const slot = item.idx ?? i;
    if (slot < total && !byIdx.has(slot)) byIdx.set(slot, item);
  });

  return (
    <div className="flex gap-1" data-testid="run-evidence-strip">
      {Array.from({ length: total }, (_, i) => {
        const frame = byIdx.get(i);
        return frame ? (
          <FrameTile key={i} item={frame} reduced={reduced} />
        ) : (
          <div
            key={i}
            className="aspect-[9/16] min-w-0 max-w-[44px] flex-1 rounded-xs border border-white/[0.06] bg-white/[0.02]"
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

function FrameTile({ item, reduced }: { item: EvidenceItem; reduced: boolean }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={
        'aspect-[9/16] min-w-0 max-w-[44px] flex-1 overflow-hidden rounded-xs border border-white/[0.06] bg-white/[0.02]' +
        (reduced ? '' : ' reading-reveal')
      }
      data-testid="run-evidence-frame"
    >
      {item.image && !failed && (
        // Signed, dynamic keyframe URL — plain <img>, decorative alt (never logged).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
