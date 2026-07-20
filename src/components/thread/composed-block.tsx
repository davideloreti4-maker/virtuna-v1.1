'use client';

/**
 * ComposedBlockRenderer — THE one stream renderer (THE STREAM rework, phase 1).
 *
 * Renders a validated `composed` block: a flat array of the 16 stream primitives
 * (src/lib/tools/stream-primitives.ts). Design contract:
 * docs/prototypes/stream-concept-rev7.html (frozen 2026-07-20).
 *
 * The laws this file owns visually (the schema owns them structurally):
 *  - prose is the backbone — structure separates with hairlines + left rules, no boxes
 *  - ONE frame total: the asset block is the only bordered container (data-stream-frame)
 *  - five type sizes: 11 label · 12 meta · 14 support · 15 body · 17 hero
 *  - everything flows left; right-alignment only for basis-counts and numerals
 *  - band color once per item (dot + word, via BAND_COLOR); the fraction stays cream
 *  - absence is prose — there is no empty-state primitive, and none renders here
 *
 * Adding primitive #17: add its case to <StreamItemView> — the exhaustive `never`
 * below breaks the build until you do (extension guarantee, step 2 of 3).
 */

import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { Eye, TrendUp } from '@phosphor-icons/react';
import { BAND_COLOR } from '@/components/thread/band-block';
import { SECTION_LABEL } from '@/components/thread/card-primitives';
import { CoverFill } from '@/components/primitives/CoverFill';
import type {
  ComposedBlock,
  StreamItem,
  StreamBand,
  StreamProof,
  StreamSourceProof,
  StreamVerbatim,
} from '@/lib/tools/stream-primitives';

export interface ComposedBlockProps {
  block: ComposedBlock;
}

// The five-size type ladder (rev 7 margin rail). Nothing else in this file renders.
const T_META = 'text-xs';
const T_SUPPORT = 'text-sm';
const T_BODY = 'text-[15px]';
const T_HERO = 'text-[17px]';

const HAIRLINE = 'border-white/[0.06]';

// ─── shared fragments ────────────────────────────────────────────────────────

function BandWord({ band }: { band: StreamBand }) {
  const color = BAND_COLOR[band];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 ${T_SUPPORT} font-semibold`} style={{ color }}>
      <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {band}
    </span>
  );
}

/** Proof line — band dot+word · neutral fraction · optional room door. Flows left. */
function ProofLine({ proof }: { proof: StreamProof }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${T_META}`}>
      <BandWord band={proof.band} />
      {proof.fraction && (
        <span className={`${T_SUPPORT} text-foreground-secondary tabular-nums`}>{proof.fraction}</span>
      )}
      {proof.door && <span className="text-foreground-muted">See the room →</span>}
    </div>
  );
}

/** Verbatim — one quote, one speaker. Italic, left-ruled. */
function VerbatimLine({ verbatim }: { verbatim: StreamVerbatim }) {
  return (
    <div className={`border-l-2 border-white/[0.10] pl-2.5 ${T_SUPPORT} italic text-foreground-secondary`}>
      “{verbatim.quote}” <span className={`not-italic ${T_META} text-foreground-muted`}>— {verbatim.speaker}</span>
    </div>
  );
}

function Prose({ text, quiet }: { text: string; quiet?: boolean }) {
  return (
    <div className={`md ${T_BODY} ${quiet ? 'text-foreground-secondary' : 'text-foreground'}`}>
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{text}</ReactMarkdown>
    </div>
  );
}

/** [bracketed variables] in a source template render as chips (the Sandcastles pattern —
 *  brightness + chip, never hue). Plain text when the template carries no brackets. */
function TemplateChips({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g).filter((p) => p.length > 0);
  return (
    <span className={`${T_SUPPORT} font-medium leading-snug text-foreground-secondary`}>
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p) ? (
          <span key={i} className="mx-px rounded-xs bg-white/[0.06] px-1 py-px text-foreground">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

/** §11c fit glyph + plain-language claim (the ProofReceipt ladder, verbatim). */
const FIT_META: Record<'in-audience' | 'adjacent' | 'structural', { glyph: string; label: string }> = {
  'in-audience': { glyph: '●', label: 'in your audience' },
  adjacent: { glyph: '◐', label: 'adjacent audience' },
  structural: { glyph: '○', label: 'cross-niche structure' },
};

/** The measured-outlier pill pair: ↗ multiplier (positive tint — a real winner is a positive
 *  signal, distinct from band color) + 👁 views. Numbers are tool-fed; absent = omitted. */
function StatPills({ multiplier, baseline, views }: { multiplier?: string; baseline?: string; views?: string }) {
  if (!multiplier && !views) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {multiplier && (
        <span className="inline-flex items-center gap-1 rounded-sm bg-[var(--color-positive)]/[0.14] px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--color-positive)]">
          <TrendUp size={12} weight="bold" aria-hidden="true" />
          {multiplier}
        </span>
      )}
      {baseline && <span className={`${SECTION_LABEL} normal-case tracking-normal`}>{baseline}</span>}
      {views && (
        <span className="inline-flex items-center gap-1 rounded-sm bg-white/[0.05] px-1.5 py-0.5 text-xs tabular-nums text-foreground-secondary">
          <Eye size={12} weight="regular" aria-hidden="true" />
          {views}
        </span>
      )}
    </span>
  );
}

/** "trap-mistake" → "Trap Mistake". */
const formatFacet = (slug: string) =>
  slug.includes('-') && !slug.includes(' ')
    ? slug.split('-').map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)).join(' ')
    : slug;

/** The structured source receipt under a ranked result — the ProofReceipt lineage, restated
 *  in stream language: NO box (one-frame law) — the cover tower IS the anchor, a left rule
 *  carries the attribution column. Clickable → the real source video. */
function SourceReceipt({ sp }: { sp: StreamSourceProof }) {
  const fit = sp.fit ? FIT_META[sp.fit] : null;
  const body = (
    <>
      <span className="relative block w-14 shrink-0 self-start overflow-hidden rounded-md border border-white/[0.06] aspect-[9/16]">
        <CoverFill coverUrl={sp.coverUrl} playSize={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className={SECTION_LABEL}>Proven structure</span>
          {sp.archetype && (
            <span className={`shrink-0 ${SECTION_LABEL} normal-case tracking-normal`}>{formatFacet(sp.archetype)}</span>
          )}
        </span>
        {sp.template && <TemplateChips text={sp.template} />}
        <span className={`flex items-center gap-1.5 ${T_META} text-foreground-muted`}>
          {fit && (
            <span className="shrink-0" aria-hidden="true" title={fit.label}>
              {fit.glyph}
            </span>
          )}
          <span className="truncate text-foreground-secondary">@{sp.handle}</span>
          {fit && <span className="hidden truncate sm:inline">· {fit.label}</span>}
        </span>
        <StatPills multiplier={sp.multiplier} baseline={sp.baseline} views={sp.views} />
      </span>
    </>
  );
  const cls = 'group/src mt-1 flex items-stretch gap-3 border-l-2 border-white/[0.10] pl-3 transition-colors';
  return sp.url ? (
    <a
      href={sp.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${cls} hover:border-white/[0.18]`}
      aria-label={`Proven structure from @${sp.handle} — opens the source video`}
    >
      {body}
    </a>
  ) : (
    <span className={cls}>{body}</span>
  );
}

// ─── per-kind views ──────────────────────────────────────────────────────────

function ReceiptView({ item }: { item: Extract<StreamItem, { kind: 'receipt' }> }) {
  const model = item.model === 'sim1-flash' ? 'SIM-1 Flash' : item.model === 'sim1-max' ? 'SIM-1 Max' : null;
  return (
    <div className={`flex items-center gap-2 ${T_META} text-foreground-muted`}>
      {item.running ? (
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent motion-reduce:animate-none" aria-label="running" />
      ) : (
        <span style={{ color: 'var(--color-success)' }}>✓</span>
      )}
      <span className="font-medium text-foreground-secondary">{item.skill}</span>
      <span>
        {item.summary}
        {model ? ` · ${model}` : ''}
      </span>
    </div>
  );
}

function EvidenceRow({ row }: { row: Extract<StreamItem, { kind: 'evidence' }>['rows'][number] }) {
  // when-line: byline · posted · duration, whichever exist (the meta fallback carries legacy rows)
  const when = [row.byline, row.posted, row.duration].filter(Boolean).join(' · ');
  const body = (
    <>
      {/* The video anchors the row — a real 9:16 cover, never an empty box (CoverFill). */}
      <span className="relative block w-12 shrink-0 self-start overflow-hidden rounded-md border border-white/[0.06] aspect-[9/16]">
        <CoverFill coverUrl={row.coverUrl} playSize={14} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
        <span className={`${T_SUPPORT} font-medium leading-snug text-foreground transition-colors group-hover/ev:text-white`}>
          {row.title}
        </span>
        {when && <span className={`${T_META} text-foreground-muted`}>{when}</span>}
        {row.facet && <span className={`${T_META} text-foreground-muted`}>{formatFacet(row.facet)}</span>}
        {row.meta && !row.views && !row.multiplier && <span className={`${T_META} text-foreground-muted`}>{row.meta}</span>}
      </span>
      {/* The measured column — right-aligned numerals, honest absence when unmeasured. */}
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
  const cls = `group/ev flex items-stretch gap-3.5 border-t ${HAIRLINE} py-3 last:border-b`;
  return row.url ? (
    <a href={row.url} target="_blank" rel="noopener noreferrer" className={cls} aria-label={`${row.title} — opens the video`}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function EvidenceView({ item }: { item: Extract<StreamItem, { kind: 'evidence' }> }) {
  return (
    <div className="flex flex-col">
      {item.rows.map((row, i) => (
        <EvidenceRow key={i} row={row} />
      ))}
    </div>
  );
}

function MediaStripView({ item }: { item: Extract<StreamItem, { kind: 'media-strip' }> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-3.5 overflow-x-auto py-1">
        {item.items.map((m, i) => {
          const tile = (
            <>
              <span className="relative block h-[238px] w-full overflow-hidden rounded-lg border border-white/[0.06] transition-colors group-hover/tile:border-white/[0.14]">
                <CoverFill coverUrl={m.coverUrl} playSize={18} className="transition-opacity group-hover/tile:opacity-90" />
                {m.duration && (
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1 py-px text-[11px] tabular-nums text-foreground-secondary">
                    {m.duration}
                  </span>
                )}
                {/* The tile's ONE number sits ON the cover, where the eye lands. */}
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
                  {[m.byline, m.views].filter(Boolean).join(' · ')}
                </span>
              )}
            </>
          );
          const cls = 'group/tile flex w-[148px] shrink-0 flex-col gap-1.5';
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

function RankedView({ item }: { item: Extract<StreamItem, { kind: 'ranked' }> }) {
  return (
    <div className="flex flex-col">
      {item.items.map((r, i) => (
        <div key={i} className={`grid grid-cols-[26px_1fr] gap-x-3 border-t ${HAIRLINE} py-4 last:border-b`}>
          <span className={`${T_META} font-medium leading-[2.1] text-foreground-muted tabular-nums`}>{r.marker ?? i + 1}</span>
          <div className="flex flex-col gap-2">
            <div className={`${T_HERO} font-semibold leading-snug tracking-[-0.005em]`}>{r.hero}</div>
            {r.insight && <div className={`${T_SUPPORT} leading-snug text-foreground-muted`}>{r.insight}</div>}
            {r.proof && <ProofLine proof={r.proof} />}
            {r.verbatim && <VerbatimLine verbatim={r.verbatim} />}
            {r.sourceProof ? (
              <SourceReceipt sp={r.sourceProof} />
            ) : r.source ? (
              <div className={`${T_META} text-foreground-muted`}>
                {r.sourceUrl ? (
                  <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline hover:underline-offset-3">
                    {r.source}
                  </a>
                ) : (
                  r.source
                )}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompareView({ item }: { item: Extract<StreamItem, { kind: 'compare' }> }) {
  return (
    <div className="flex flex-col">
      {item.audiences.map((aud, i) => (
        <div key={i} className={`flex flex-col gap-2 border-t ${HAIRLINE} py-3.5 last:border-b`}>
          <div className={`flex flex-wrap items-center gap-2.5 ${T_BODY} font-semibold`}>
            {aud.name}
            <ProofLine proof={aud.proof} />
          </div>
          {aud.lever && (
            <div className={`border-l-2 border-white/[0.10] pl-2.5 ${T_SUPPORT}`}>
              <span className="font-semibold">Lever</span> <span className="text-foreground-muted">→</span> {aud.lever}
            </div>
          )}
          {aud.verbatim && <VerbatimLine verbatim={aud.verbatim} />}
        </div>
      ))}
    </div>
  );
}

function FactsView({ item }: { item: Extract<StreamItem, { kind: 'facts' }> }) {
  return (
    <div className="flex flex-col">
      {item.sections.map((section, si) => (
        <div key={si} className="flex flex-col">
          {section.label && <div className={`${SECTION_LABEL} pb-1 pt-3`}>{section.label}</div>}
          {section.rows.map((row, ri) => (
            <div key={ri} className={`flex items-baseline gap-2.5 border-t ${HAIRLINE} py-1.5 ${T_SUPPORT} first:border-t-0`}>
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
  );
}

function RevisionView({ item }: { item: Extract<StreamItem, { kind: 'revision' }> }) {
  return (
    <div className="flex flex-col gap-1.5 border-l-2 border-white/[0.10] pl-3.5">
      <div className={`${T_SUPPORT} text-foreground-muted line-through`}>{item.before}</div>
      <div className={`${T_HERO} font-semibold`}>{item.after}</div>
      {item.proof && <ProofLine proof={item.proof} />}
    </div>
  );
}

function PlanView({ item }: { item: Extract<StreamItem, { kind: 'plan' }> }) {
  return (
    <div className="flex flex-col">
      {item.slots.map((slot, i) => (
        <div key={i} className={`flex flex-wrap items-baseline gap-x-3.5 gap-y-0.5 border-t ${HAIRLINE} py-3 ${T_SUPPORT} last:border-b`}>
          <span className={`w-9 shrink-0 ${SECTION_LABEL}`}>{slot.when}</span>
          <span className="font-medium text-foreground">{slot.what}</span>
          {/* Wraps to its own right-aligned line at narrow widths instead of crushing the what. */}
          {slot.why && <span className={`ml-auto text-right ${T_META} text-foreground-muted`}>{slot.why}</span>}
        </div>
      ))}
    </div>
  );
}

function InputAskView({ item }: { item: Extract<StreamItem, { kind: 'input-ask' }> }) {
  // Phase 1 renders the control row; submit wiring arrives with the ad-hoc composer
  // (the runners' input turns keep using the existing input-request block until then).
  return (
    <div className="flex max-w-[480px] flex-wrap items-center gap-2.5">
      {item.slots.map((slot, i) =>
        slot.type === 'select' ? (
          <select key={i} className={`flex-1 rounded-lg border border-white/[0.10] bg-background px-3 py-2 ${T_SUPPORT} text-foreground-secondary`} aria-label={slot.label ?? 'choose'} defaultValue="">
            <option value="" disabled>
              {slot.placeholder ?? slot.label ?? 'Choose…'}
            </option>
            {slot.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : slot.type === 'confirm' ? null : (
          <input
            key={i}
            type="text"
            placeholder={slot.placeholder ?? slot.label}
            aria-label={slot.label ?? slot.placeholder ?? 'input'}
            className={`min-w-0 flex-1 rounded-lg border border-white/[0.10] bg-background px-3 py-2 ${T_SUPPORT} text-foreground placeholder:text-foreground-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20`}
          />
        ),
      )}
      <button
        type="button"
        className={`shrink-0 rounded-lg bg-[var(--color-action)] px-3.5 py-2 ${T_SUPPORT} font-semibold text-[var(--color-action-foreground)] transition-opacity hover:opacity-90`}
      >
        {item.submitLabel}
      </button>
    </div>
  );
}

function AssetView({ item }: { item: Extract<StreamItem, { kind: 'asset' }> }) {
  return (
    <div data-stream-frame="" className="overflow-hidden rounded-xl border border-white/[0.10] bg-surface">
      <div className={`flex items-baseline gap-2.5 border-b ${HAIRLINE} px-4 py-3`}>
        <span className={SECTION_LABEL}>{item.label}</span>
        <span className={`${T_BODY} font-semibold`}>{item.title}</span>
        {item.meta && <span className={`ml-auto ${T_META} text-foreground-muted`}>{item.meta}</span>}
      </div>
      {item.rows.map((row, i) => (
        <div key={i} className={`grid grid-cols-[78px_1fr] gap-3 border-t ${HAIRLINE} px-4 py-2.5 ${T_SUPPORT} first:border-t-0`}>
          <span className={`${SECTION_LABEL} leading-relaxed`}>
            {row.label}
            {row.sub && <span className="block normal-case tracking-normal">{row.sub}</span>}
          </span>
          <div>
            {row.text}
            {row.note && <div className={`mt-0.5 ${T_META} text-foreground-muted`}>{row.note}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsView({ item }: { item: Extract<StreamItem, { kind: 'stats' }> }) {
  // Fact-row weight, inline, flows left — NEVER a KPI tile (dashboard chrome is retired).
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 ${T_SUPPORT} text-foreground-secondary`}>
      {item.items.map((stat, i) => (
        <span key={i}>
          <span
            className="font-semibold tabular-nums text-foreground"
            style={stat.tone === 'warn' ? { color: 'var(--color-warning)' } : undefined}
          >
            {stat.value}
          </span>{' '}
          {stat.label}
        </span>
      ))}
    </div>
  );
}

function TableView({ item }: { item: Extract<StreamItem, { kind: 'table' }> }) {
  const align = (i: number) => (item.columns[i]?.align === 'right' ? 'text-right' : 'text-left');
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse tabular-nums">
        <thead>
          <tr>
            {item.columns.map((col, i) => (
              <th key={i} className={`${SECTION_LABEL} pb-1 font-normal ${align(i)}`} scope="col">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {item.rows.map((row, ri) => (
            <tr key={ri} className={`border-t ${HAIRLINE} last:border-b`}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`py-2 ${align(ci)} ${
                    cell.tone === 'dim'
                      ? `${T_META} text-foreground-muted`
                      : `${T_SUPPORT} ${cell.tone === 'strong' ? 'font-semibold text-foreground' : 'text-foreground'}`
                  } ${ci > 0 ? 'pl-3.5' : 'pr-3.5'}`}
                  style={cell.tone === 'accent' ? { color: 'var(--color-error)', fontWeight: 600 } : undefined}
                >
                  {cell.text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── dispatch ────────────────────────────────────────────────────────────────

function StreamItemView({ item }: { item: StreamItem }) {
  switch (item.kind) {
    case 'prose':
      return <Prose text={item.text} quiet={item.quiet} />;
    case 'receipt':
      return <ReceiptView item={item} />;
    case 'evidence':
      return <EvidenceView item={item} />;
    case 'media-strip':
      return <MediaStripView item={item} />;
    case 'ranked':
      return <RankedView item={item} />;
    case 'proof':
      return <ProofLine proof={item} />;
    case 'verbatim':
      return <VerbatimLine verbatim={item} />;
    case 'compare':
      return <CompareView item={item} />;
    case 'facts':
      return <FactsView item={item} />;
    case 'revision':
      return <RevisionView item={item} />;
    case 'plan':
      return <PlanView item={item} />;
    case 'input-ask':
      return <InputAskView item={item} />;
    case 'persona-turn':
      return (
        <div className="flex flex-col gap-1.5">
          <div className={SECTION_LABEL}>{item.speaker} · via Maven</div>
          <Prose text={item.text} />
        </div>
      );
    case 'asset':
      return <AssetView item={item} />;
    case 'stats':
      return <StatsView item={item} />;
    case 'table':
      return <TableView item={item} />;
    default: {
      // Exhaustiveness — adding primitive #17 without a case here breaks the build.
      const _exhaustive: never = item;
      return _exhaustive;
    }
  }
}

export function ComposedBlockRenderer({ block }: ComposedBlockProps) {
  return (
    <div data-stream="" className="flex flex-col gap-3.5">
      {block.props.items.map((item, index) => (
        <StreamItemView key={index} item={item} />
      ))}
    </div>
  );
}
