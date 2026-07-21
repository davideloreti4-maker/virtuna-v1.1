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
import { Eye, TrendDown, TrendUp } from '@phosphor-icons/react';
import { BAND_COLOR } from '@/components/thread/band-block';
import { CardEyebrow, CardPrimaryAction, CardActionBar, SECTION_LABEL } from '@/components/thread/card-primitives';
import { ProofReceipt } from '@/components/thread/proof-receipt';
import { ProofUnit } from '@/components/thread/proof-unit';
import { CaretToggle } from '@/components/thread/caret-toggle';
import { VideoTestCardRenderer } from '@/components/thread/video-test-card-block';
import { HookCardRenderer } from '@/components/thread/hook-card-block';
import { IdeaCardRenderer } from '@/components/thread/idea-card-block';
import { MultiAudienceReadBlockRenderer } from '@/components/thread/multi-audience-read-block';
import { AccountReadBlockRenderer } from '@/components/thread/account-read-block';
import { CoverFill } from '@/components/primitives/CoverFill';
import { cardScrollQuoteReactions } from '@/components/audience-lens/flat-card-reactions';
import type {
  VideoTestCardBlock,
  HookCardBlock,
  IdeaCardBlock,
  MultiAudienceReadBlock,
  AccountReadBlock,
} from '@/lib/tools/blocks';
import type { StreamItem } from '@/lib/tools/stream-primitives';
import { stripWrappingQuotes } from '@/lib/utils';
import { EngagementRow, formatFacet, ProofLine, VerbatimLine, T_META, T_SUPPORT, T_BODY, HAIRLINE } from './composed-shared';

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

// ─── Delegated skill cards (rev 9 hybrid) ──────────────────────────────────────
// The 1:1 skill cards render the REAL shipped component (props carried verbatim), so a
// stream hook/idea/read/account card IS the make-family card — byte-for-byte, no drift.

/** The Hooks card, in-stream — delegated to the shipped HookCardRenderer. */
export function HookCardView({ item }: { item: Extract<StreamItem, { kind: 'hook-card' }> }) {
  const { kind: _kind, ...props } = item;
  return <HookCardRenderer block={{ type: 'hook-card', props } as HookCardBlock} />;
}

/** The Ideas card, in-stream — delegated to the shipped IdeaCardRenderer. */
export function IdeaCardView({ item }: { item: Extract<StreamItem, { kind: 'idea-card' }> }) {
  const { kind: _kind, ...props } = item;
  return <IdeaCardRenderer block={{ type: 'idea-card', props } as IdeaCardBlock} />;
}

/** The Read card, in-stream — delegated to the shipped MultiAudienceReadBlockRenderer. */
export function MultiAudienceReadView({ item }: { item: Extract<StreamItem, { kind: 'multi-audience-read' }> }) {
  const { kind: _kind, ...props } = item;
  return <MultiAudienceReadBlockRenderer block={{ type: 'multi-audience-read', props } as MultiAudienceReadBlock} />;
}

/** The Account Read card, in-stream — delegated to the shipped AccountReadBlockRenderer. */
export function AccountReadView({ item }: { item: Extract<StreamItem, { kind: 'account-read' }> }) {
  const { kind: _kind, ...props } = item;
  return <AccountReadBlockRenderer block={{ type: 'account-read', props } as AccountReadBlock} />;
}

type CompareAudience = Extract<StreamItem, { kind: 'compare' }>['audiences'][number];

const VERDICT_PILL: Record<'stop' | 'scroll', string> = {
  stop: 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20',
  scroll: 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-error/10 text-error border border-error/20',
};

/** One audience's read inside the compare card — the old Read card's full anatomy:
 *  dot+name+fraction · "{band} Read." interpretation · Lever · scrolls-past · verbatim ·
 *  collapsible persona drill. */
function CompareAudienceRead({ aud }: { aud: CompareAudience }) {
  const [expanded, setExpanded] = useState(false);
  const bandColor = BAND_COLOR[aud.proof.band];
  const personas = aud.personas ?? [];
  const stopCount = personas.filter((p) => p.verdict === 'stop').length;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2 text-[13.5px] font-semibold text-foreground">
        <span className="h-[7px] w-[7px] shrink-0 self-center rounded-full" style={{ backgroundColor: bandColor }} aria-hidden="true" />
        {aud.name}
        {aud.proof.fraction && <span className="text-[12px] font-normal text-foreground-muted">{aud.proof.fraction}</span>}
      </div>

      {aud.interpretation && (
        <p className="text-[13.5px] leading-relaxed text-foreground-secondary">
          <b className="font-semibold" style={{ color: bandColor }}>
            {aud.proof.band} Read.
          </b>{' '}
          <span className="text-foreground">{aud.interpretation}</span>
        </p>
      )}

      {aud.lever && (
        <p
          className="border-l-2 py-0.5 pl-3 text-[13.5px] leading-relaxed text-foreground-secondary"
          style={{ borderColor: 'var(--color-foreground-secondary)' }}
        >
          <b className="font-semibold text-foreground">Lever →</b> {aud.lever}
        </p>
      )}

      {aud.whoNotFor && (
        <p className="text-[12px] text-foreground-muted">
          <span className="font-medium">Scrolls past:</span> {aud.whoNotFor}
        </p>
      )}

      {aud.verbatim && <VerbatimLine verbatim={aud.verbatim} />}

      {personas.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-white/[0.06]">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
            aria-expanded={expanded}
          >
            <span className="text-[13px] font-medium text-foreground">
              Audience reactions
              <span className="ml-2 font-normal text-foreground-muted">
                {stopCount}/{personas.length} stop
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] text-foreground-muted" aria-hidden="true">
              <CaretToggle open={expanded} size={12} />
              {expanded ? 'Hide' : 'Show'}
            </span>
          </button>
          {expanded && (
            <ul className="divide-y divide-white/[0.04] border-t border-white/[0.06]" role="list">
              {personas.map((persona, i) => (
                <li key={`${persona.archetype}-${i}`} className="flex flex-col gap-1 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium capitalize text-foreground">
                      {persona.archetype.replace(/_/g, ' ')}
                    </span>
                    <span className={VERDICT_PILL[persona.verdict]} aria-label={persona.verdict === 'stop' ? 'stops' : 'scrolls'}>
                      {persona.verdict === 'stop' ? 'stops' : 'scrolls'}
                    </span>
                  </div>
                  <p className="text-[12.5px] italic leading-snug text-foreground-muted">
                    &ldquo;{stripWrappingQuotes(persona.quote)}&rdquo;
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** The compare group as the old Read card: framed, eyebrow, side-by-side verdict row,
 *  then each audience's full read divided by hairlines. */
export function CompareCard({ item }: { item: Extract<StreamItem, { kind: 'compare' }> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken">
      <div className="flex flex-col gap-4 px-4 pb-4 pt-4">
        <CardEyebrow
          kicker={item.label ?? 'The Read'}
          dotColor="var(--color-foreground-muted)"
          meta={<span className={`${T_META} tabular-nums text-foreground-muted`}>{item.audiences.length} audiences</span>}
        />

        {/* Side-by-side verdict header — the at-a-glance "wins for X, bombs for Y" row. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
          {item.audiences.map((a, i) => (
            <span key={`${a.name}-${i}`} className="inline-flex basis-full flex-wrap items-center gap-2 text-[13.5px] sm:basis-auto">
              {i > 0 && (
                <span className="mr-1 hidden text-foreground-muted/40 sm:inline" aria-hidden="true">
                  ·
                </span>
              )}
              <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: BAND_COLOR[a.proof.band] }} aria-hidden="true" />
              <span className="font-semibold text-foreground">{a.name}</span>
              <span className="font-semibold" style={{ color: BAND_COLOR[a.proof.band] }}>
                {a.proof.band}
              </span>
              {a.proof.fraction && <span className="text-[12px] text-foreground-muted">{a.proof.fraction}</span>}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-5">
          {item.audiences.map((aud, i) => (
            <div key={`${aud.name}-${i}`} className={i > 0 ? 'border-t border-white/[0.06] pt-5' : undefined}>
              <CompareAudienceRead aud={aud} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Fact rows as a framed findings card — eyebrow, quiet section labels, mark-dot rows. */
export function FactsCard({ item }: { item: Extract<StreamItem, { kind: 'facts' }> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken">
      <div className="px-4 pb-1 pt-4">
        <CardEyebrow kicker={item.label ?? 'Findings'} />
      </div>
      <div className="flex flex-col px-4 pb-4">
        {item.sections.map((section, si) => (
          <div key={si} className="flex flex-col">
            {section.label && <div className={`${SECTION_LABEL} pb-1 pt-3`}>{section.label}</div>}
            {section.rows.map((row, ri) => (
              <div key={ri} className={`flex items-baseline gap-2.5 border-t ${HAIRLINE} py-2.5 ${T_SUPPORT} first:border-t-0`}>
                {row.mark !== 'none' && (
                  <span
                    className="relative top-[-2px] h-[5px] w-[5px] shrink-0 rounded-full"
                    style={{ backgroundColor: row.mark === 'good' ? 'var(--color-success)' : 'var(--color-error)' }}
                    aria-hidden="true"
                  />
                )}
                <span className="text-foreground">{row.claim}</span>
                {row.basis && <span className={`ml-auto shrink-0 text-right ${T_META} text-foreground-muted`}>{row.basis}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The revision as a small make-family card: eyebrow · struck before · hero after · re-scored proof. */
export function RevisionCard({ item }: { item: Extract<StreamItem, { kind: 'revision' }> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken">
      <div className="flex flex-col gap-2.5 px-4 pb-4 pt-4">
        <CardEyebrow kicker={item.label ?? 'Revision'} />
        <p className={`${T_SUPPORT} text-foreground-muted line-through`}>{item.before}</p>
        <p className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-foreground">{item.after}</p>
        {item.proof && <ProofLine proof={item.proof} />}
      </div>
    </div>
  );
}

/** Evidence rows — the video reference as a first-class object, in the make-family card
 *  language: framed card, eyebrow, receipt-grade rows (ProofReceipt's pill grammar). */
export function EvidenceView({ item }: { item: Extract<StreamItem, { kind: 'evidence' }> }) {
  const count = item.rows.length;
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken">
      <div className="px-4 pb-3 pt-4">
        <CardEyebrow
          kicker={item.label ?? 'Sources'}
          meta={<span className={`${T_META} tabular-nums text-foreground-muted`}>{count} {count === 1 ? 'video' : 'videos'}</span>}
        />
      </div>
      {item.rows.map((row, i) => {
        const when = [row.byline, row.posted].filter(Boolean).join(' · ');
        const body = (
          <>
            <span className="relative block w-[88px] shrink-0 self-start overflow-hidden rounded-lg border border-white/[0.06] aspect-[9/16] transition-colors group-hover/ev:border-white/[0.14]">
              <CoverFill coverUrl={row.coverUrl} playSize={20} />
              {row.duration && (
                <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-px text-[11px] tabular-nums text-foreground-secondary">
                  {row.duration}
                </span>
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
              <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className={`min-w-0 ${T_BODY} font-medium leading-snug text-foreground transition-colors group-hover/ev:text-white`}>
                  {row.title}
                </span>
                {row.facet && (
                  <span className="min-w-0 max-w-full truncate rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[11px] text-foreground-secondary">
                    {formatFacet(row.facet)}
                  </span>
                )}
              </span>
              {when && <span className={`${T_META} text-foreground-muted`}>{when}</span>}
              {(row.multiplier || row.views) && (
                <span className="flex flex-wrap items-center gap-1.5">
                  {row.multiplier && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[12px] font-semibold tabular-nums ${
                        row.multiplier.direction === 'down'
                          ? 'bg-[var(--color-error)]/[0.14] text-[var(--color-error)]'
                          : 'bg-[var(--color-positive)]/[0.14] text-[var(--color-positive)]'
                      }`}
                    >
                      {row.multiplier.direction === 'down' ? (
                        <TrendDown size={12} weight="bold" aria-hidden="true" />
                      ) : (
                        <TrendUp size={12} weight="bold" aria-hidden="true" />
                      )}
                      {row.multiplier.value}
                    </span>
                  )}
                  {row.baseline && <span className="text-[11px] text-foreground-muted">{row.baseline}</span>}
                  {row.views && (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-white/[0.05] px-1.5 py-0.5 text-[12px] tabular-nums text-foreground-secondary">
                      <Eye size={12} weight="regular" aria-hidden="true" />
                      {row.views}
                    </span>
                  )}
                </span>
              )}
              {row.engagement && <EngagementRow engagement={row.engagement} />}
              {row.meta && !row.views && !row.multiplier && <span className={`${T_META} text-foreground-muted`}>{row.meta}</span>}
            </span>
            {row.url && (
              <span className={`shrink-0 self-center ${T_META} text-foreground-muted opacity-0 transition-opacity group-hover/ev:opacity-100`}>
                watch ↗
              </span>
            )}
          </>
        );
        const cls = `group/ev flex items-stretch gap-4 border-t ${HAIRLINE} px-4 py-3.5 transition-colors hover:bg-white/[0.02]`;
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

/** Media strip — browsable video tiles in the make-family card language: framed card,
 *  eyebrow, the metric ON the cover, the shared basis stated once as the card's footer. */
export function MediaStripView({ item }: { item: Extract<StreamItem, { kind: 'media-strip' }> }) {
  const count = item.items.length;
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken">
      <div className="px-4 pb-3 pt-4">
        <CardEyebrow
          kicker={item.label ?? 'Videos'}
          meta={<span className={`${T_META} tabular-nums text-foreground-muted`}>{count} {count === 1 ? 'video' : 'videos'}</span>}
        />
      </div>
      <div className="flex gap-3.5 overflow-x-auto px-4 pb-4">
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
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-sm bg-black/70 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                    <TrendUp size={12} weight="bold" aria-hidden="true" />
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
      {item.basis && (
        <div className={`border-t ${HAIRLINE} px-4 py-2.5 ${T_META} text-foreground-muted`}>{item.basis}</div>
      )}
    </div>
  );
}
