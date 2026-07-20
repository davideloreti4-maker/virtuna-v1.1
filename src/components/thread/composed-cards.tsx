'use client';

/**
 * THE STREAM's card-language views (rev 8) — structured result groups render as CARDS
 * in the proven make-family language (docs/subsystems/ui-skill-cards.md §0.5), by
 * IMPORTING the shipped card primitives — CardEyebrow / ProofReceipt / ProofUnit /
 * CardActionBar — so a stream card is pixel-identical to the bar by construction.
 *
 * Rev 8 rationale (owner call, 2026-07-20): the one-frame law was an over-correction.
 * The audit's finding was 3 languages + 17 renderers, never "frames are bad" — at real
 * information density a result needs a container to chunk by. The old thread already WAS
 * a stream: prose flowing between framed cards. Prose/receipt/stats/table/facts/plan
 * stay light (composed-block.tsx); ranked results, the asset, and the /test verdict
 * render here as cards.
 */

import { useState } from 'react';
import { Eye } from '@phosphor-icons/react';
import { BAND_COLOR } from '@/components/thread/band-block';
import { CardEyebrow, CardPrimaryAction, CardActionBar, SECTION_LABEL } from '@/components/thread/card-primitives';
import { ProofReceipt } from '@/components/thread/proof-receipt';
import { ProofUnit } from '@/components/thread/proof-unit';
import { CaretToggle } from '@/components/thread/caret-toggle';
import { VideoTestCardRenderer } from '@/components/thread/video-test-card-block';
import { CoverFill } from '@/components/primitives/CoverFill';
import { cardScrollQuoteReactions } from '@/components/audience-lens/flat-card-reactions';
import type { VideoTestCardBlock } from '@/lib/tools/blocks';
import type { StreamItem } from '@/lib/tools/stream-primitives';
import { EngagementRow, formatFacet, T_META, T_SUPPORT, T_BODY, HAIRLINE } from './composed-shared';

type RankedItem = Extract<StreamItem, { kind: 'ranked' }>['items'][number];

/** One ranked result = one make-family card: eyebrow → hero → receipt → why → ProofUnit
 *  (band bar + lead quote + "See the room →") → details expander → action bar. */
function RankedCard({ r, index }: { r: RankedItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const bandColor = r.proof ? BAND_COLOR[r.proof.band] : undefined;
  const marker = r.marker ?? String(index + 1);
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken" aria-label={`Result #${marker}: ${r.hero.slice(0, 60)}`}>
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        <CardEyebrow
          kicker={r.kicker ?? `Ranked #${marker}`}
          dotColor={bandColor}
          meta={
            <span className="text-[12px] font-semibold tabular-nums text-foreground-muted" aria-label={`Rank ${marker}`}>
              #{marker}
            </span>
          }
        />

        <p className={`text-[17px] font-semibold leading-snug tracking-[-0.01em] text-foreground`}>{r.hero}</p>

        {/* The source receipt — THE shipped ProofReceipt, verbatim (§11f). A plain source
            string (e.g. the honest "original — not drawn from a retrieved video") stays a
            muted line: it claims nothing, so it gets no receipt chrome. */}
        {r.sourceProof ? (
          <ProofReceipt proof={r.sourceProof} />
        ) : r.source ? (
          <p className={`${T_META} text-foreground-muted`}>{r.source}</p>
        ) : null}

        {r.insight && (
          <p className={`line-clamp-2 text-[13px] leading-relaxed text-foreground-secondary`}>
            <span className="text-foreground-muted">Why it works — </span>
            {r.insight}
          </p>
        )}

        {/* The shared audience-reaction block + Lens door — same component as every card. */}
        {r.proof?.fraction && (
          <ProofUnit
            framed={false}
            band={r.proof.band}
            fraction={r.proof.fraction}
            scored
            quote={r.verbatim?.quote}
            flatPersonas={cardScrollQuoteReactions(r.proof.fraction, r.verbatim?.quote ?? '')}
            conceptText={r.hero}
            label="See how the room reacted to this result"
          />
        )}

        {r.details && r.details.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 self-start text-[12.5px] text-foreground-muted transition-colors hover:text-foreground-secondary"
            aria-expanded={expanded}
          >
            <CaretToggle open={expanded} />
            {expanded ? 'Hide details' : 'Why & details'}
          </button>
        )}
      </div>

      {expanded && r.details && (
        <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-3">
          {r.details.map((d, di) => (
            <div key={di}>
              <p className={`mb-1 ${SECTION_LABEL}`}>{d.label}</p>
              <p className="text-[13.5px] leading-relaxed text-foreground-secondary">{d.text}</p>
            </div>
          ))}
        </div>
      )}

      {r.primaryAction && (
        <CardActionBar>
          <CardPrimaryAction disabled title="Wired when this skill migrates onto the stream">
            {r.primaryAction}
          </CardPrimaryAction>
        </CardActionBar>
      )}
    </div>
  );
}

export function RankedView({ item }: { item: Extract<StreamItem, { kind: 'ranked' }> }) {
  return (
    <div className="flex flex-col gap-3">
      {item.items.map((r, i) => (
        <RankedCard key={i} r={r} index={i} />
      ))}
    </div>
  );
}

/** The take-away deliverable — the script-card treatment: framed, eyebrow + hero title,
 *  beat rows, matte. */
export function AssetCard({ item }: { item: Extract<StreamItem, { kind: 'asset' }> }) {
  return (
    <div data-stream-frame="" className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken">
      <div className="flex flex-col gap-2 px-4 pb-3 pt-4">
        <CardEyebrow kicker={item.label} meta={item.meta ? <span className={`${T_META} text-foreground-muted`}>{item.meta}</span> : undefined} />
        <p className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-foreground">{item.title}</p>
      </div>
      <div className="flex flex-col">
        {item.rows.map((row, i) => (
          <div key={i} className={`grid grid-cols-[84px_1fr] gap-3.5 border-t ${HAIRLINE} px-4 py-3 ${T_SUPPORT}`}>
            <span className={`${SECTION_LABEL} leading-relaxed`}>
              {row.label}
              {row.sub && <span className="block normal-case tracking-normal">{row.sub}</span>}
            </span>
            <div className="text-foreground">
              {row.text}
              {row.note && <div className={`mt-1 ${T_META} text-foreground-muted`}>{row.note}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The flagship: the /test verdict IS the shipped video-test card — delegated verbatim,
 *  zero drift. Bands/words only in-thread; the 0-100 lives on /analyze (honesty spine). */
export function TestVerdictView({ item }: { item: Extract<StreamItem, { kind: 'test-verdict' }> }) {
  const { kind: _kind, ...props } = item;
  return <VideoTestCardRenderer block={{ type: 'video-test-card', props } as VideoTestCardBlock} />;
}

/** Evidence rows — the video reference as a first-class object. */
export function EvidenceView({ item }: { item: Extract<StreamItem, { kind: 'evidence' }> }) {
  return (
    <div className="flex flex-col">
      {item.rows.map((row, i) => {
        const when = [row.byline, row.posted].filter(Boolean).join(' · ');
        const body = (
          <>
            <span className="relative block w-[72px] shrink-0 self-start overflow-hidden rounded-lg border border-white/[0.06] aspect-[9/16] transition-colors group-hover/ev:border-white/[0.14]">
              <CoverFill coverUrl={row.coverUrl} playSize={18} />
              {row.duration && (
                <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-px text-[11px] tabular-nums text-foreground-secondary">
                  {row.duration}
                </span>
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
              <span className={`${T_BODY} font-medium leading-snug text-foreground transition-colors group-hover/ev:text-white`}>
                {row.title}
              </span>
              {when && <span className={`${T_META} text-foreground-muted`}>{when}</span>}
              {row.facet && <span className={`${T_META} text-foreground-muted`}>{formatFacet(row.facet)}</span>}
              {row.engagement && <EngagementRow engagement={row.engagement} />}
              {row.meta && !row.views && !row.multiplier && <span className={`${T_META} text-foreground-muted`}>{row.meta}</span>}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1 self-center text-right">
              {row.multiplier && (
                <span
                  className={`${T_BODY} font-semibold tabular-nums leading-none`}
                  style={row.multiplier.direction === 'down' ? { color: 'var(--color-error)' } : undefined}
                >
                  {row.multiplier.value}
                </span>
              )}
              {row.baseline && <span className={`hidden ${T_META} text-foreground-muted sm:block`}>{row.baseline}</span>}
              {row.views && (
                <span className={`inline-flex items-center gap-1 ${T_META} tabular-nums text-foreground-secondary`}>
                  <Eye size={12} weight="regular" aria-hidden="true" />
                  {row.views}
                </span>
              )}
              {row.url && (
                <span className={`${T_META} text-foreground-muted opacity-0 transition-opacity group-hover/ev:opacity-100`}>
                  watch ↗
                </span>
              )}
            </span>
          </>
        );
        const cls = `group/ev flex items-stretch gap-4 border-t ${HAIRLINE} py-3.5 last:border-b`;
        return row.url ? (
          <a key={i} href={row.url} target="_blank" rel="noopener noreferrer" className={cls} aria-label={`${row.title} — opens the video`}>
            {body}
          </a>
        ) : (
          <div key={i} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** Media strip — browsable video tiles, the metric ON the cover. */
export function MediaStripView({ item }: { item: Extract<StreamItem, { kind: 'media-strip' }> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-3.5 overflow-x-auto py-1">
        {item.items.map((m, i) => {
          const tile = (
            <>
              <span className="relative block h-[312px] w-full overflow-hidden rounded-lg border border-white/[0.06] transition-colors group-hover/tile:border-white/[0.14]">
                <CoverFill coverUrl={m.coverUrl} playSize={18} className="transition-opacity group-hover/tile:opacity-90" />
                {m.duration && (
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1 py-px text-[11px] tabular-nums text-foreground-secondary">
                    {m.duration}
                  </span>
                )}
                {m.metric && (
                  <span className="absolute left-1.5 top-1.5 rounded-sm bg-black/60 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                    {m.metric}
                  </span>
                )}
              </span>
              <span className={`${T_SUPPORT} font-medium leading-snug text-foreground line-clamp-2`}>{m.title}</span>
              {m.facet && <span className={`${T_META} leading-tight text-foreground-muted`}>{formatFacet(m.facet)}</span>}
              {m.fit && (
                <span className={`flex items-center gap-1.5 whitespace-nowrap ${T_META} text-foreground-muted`}>
                  <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ backgroundColor: BAND_COLOR[m.fit] }} aria-hidden="true" />
                  Fit {m.fit.toLowerCase()}
                </span>
              )}
              {(m.byline || m.views) && (
                <span className={`min-w-0 truncate ${T_META} tabular-nums text-foreground-muted`}>
                  {[m.byline, m.views && `${m.views} views`].filter(Boolean).join(' · ')}
                </span>
              )}
              {m.engagement && <EngagementRow engagement={m.engagement} />}
            </>
          );
          const cls = 'group/tile flex w-[176px] shrink-0 flex-col gap-1.5';
          return m.url ? (
            <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className={cls} aria-label={`${m.title} — opens the video`}>
              {tile}
            </a>
          ) : (
            <div key={i} className={cls}>
              {tile}
            </div>
          );
        })}
      </div>
      {item.basis && <div className={`${T_META} text-foreground-muted`}>{item.basis}</div>}
    </div>
  );
}
