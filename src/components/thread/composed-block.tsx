'use client';

/**
 * ComposedBlockRenderer — THE stream renderer's dispatch + light views (rev 8).
 *
 * Renders a validated `composed` block: a flat array of the 17 stream primitives
 * (src/lib/tools/stream-primitives.ts). Rev 8 (owner call 2026-07-20): structured
 * result groups — ranked results, the asset, the /test verdict — render as CARDS in
 * the make-family language (composed-cards.tsx, built on the shipped card primitives);
 * prose, receipt, stats, table, facts, plan, compare stay light between the cards.
 * The old thread already was a stream: prose flowing between framed cards.
 *
 * Laws still owned here/in-schema: prose is the backbone · five type sizes · band
 * color once (dot + word) · absence is prose · the receipt leads · one control row.
 *
 * Adding primitive #18: add its case to <StreamItemView> — the exhaustive `never`
 * breaks the build until you do (extension guarantee, step 2 of 3).
 */

import { SECTION_LABEL } from '@/components/thread/card-primitives';
import type { ComposedBlock, StreamItem } from '@/lib/tools/stream-primitives';
import { AssetCard, EvidenceView, MediaStripView, RankedView, TestVerdictView } from './composed-cards';
import { HAIRLINE, Prose, ProofLine, T_BODY, T_HERO, T_META, T_SUPPORT, VerbatimLine } from './composed-shared';

export interface ComposedBlockProps {
  block: ComposedBlock;
}

// ─── light views ─────────────────────────────────────────────────────────────

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

function CompareView({ item }: { item: Extract<StreamItem, { kind: 'compare' }> }) {
  return (
    <div className="flex flex-col">
      {item.audiences.map((aud, i) => (
        <div key={i} className={`flex flex-col gap-2.5 border-t ${HAIRLINE} py-4 last:border-b`}>
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
            <div key={ri} className={`flex items-baseline gap-2.5 border-t ${HAIRLINE} py-2 ${T_SUPPORT} first:border-t-0`}>
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
        <div key={i} className={`flex flex-wrap items-baseline gap-x-3.5 gap-y-0.5 border-t ${HAIRLINE} py-3.5 ${T_SUPPORT} last:border-b`}>
          <span className={`w-9 shrink-0 ${SECTION_LABEL}`}>{slot.when}</span>
          <span className="font-medium text-foreground">{slot.what}</span>
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
                  className={`py-2.5 ${align(ci)} ${
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
      return <AssetCard item={item} />;
    case 'stats':
      return <StatsView item={item} />;
    case 'table':
      return <TableView item={item} />;
    case 'test-verdict':
      return <TestVerdictView item={item} />;
    default: {
      // Exhaustiveness — adding primitive #18 without a case here breaks the build.
      const _exhaustive: never = item;
      return _exhaustive;
    }
  }
}

export function ComposedBlockRenderer({ block }: ComposedBlockProps) {
  return (
    <div data-stream="" className="flex flex-col gap-4">
      {block.props.items.map((item, index) => (
        <StreamItemView key={index} item={item} />
      ))}
    </div>
  );
}
