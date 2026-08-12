'use client';

/**
 * composed-card-slots.tsx — one small renderer per slot kind (spec §4.2's vocabulary of 10).
 *
 * Every label goes through SECTION_LABEL and every corner through the token radius scale, because
 * the guards (section-label-scale.test.ts / radius-scale.test.ts) walk this tree the day it lands —
 * which is the whole point of a composer: the contract is enforced once, here, not per card.
 *
 * ZERO accent. The accent dosage is LOCKED (CLAUDE.md): a slot is body content, never a place to
 * add colour.
 *
 * WHERE SECTION_LABEL APPLIES, and where it does not. The rule this file follows: SECTION_LABEL
 * names a *part of the card* — a beat, a stat, a column, a field. It is chrome. It is NOT for
 * content, and `uppercase` is the reason that distinction has to be made rather than assumed:
 * a quote's attribution is a proper noun, and shouting it renders `@corporate.bro` as
 * `@CORPORATE.BRO`. `verbatim-wall.tsx` already paid for this lesson — its "who said it" line
 * carries the note "small, muted, sentence case (the old all-caps double tag wrapped into two
 * shouting lines at card width)". So the attribution is muted caption text, not a label.
 *
 * ON THE LABEL LADDER (§0.5: "a stacked ladder of equal-weight ALL-CAPS labels is the failure
 * mode… if a card has four or five of them it has no hierarchy"). A slot's labels are a SEQUENCE
 * of peers — six beats named Open/Turn/Proof/Payoff, four stat captions — not four sections each
 * announcing itself. `script-card-block.tsx` ships exactly this shape and §0.6 marks it ✅. The
 * ladder is a CARD-level property, so it is the card renderer's job (Task 5) to keep the count of
 * distinct labelled *sections* down — by collapsing the rest into the ONE disclosure. Nothing a
 * single slot can do fixes it, and nothing a single slot does causes it.
 */
import type { Slot } from '@/lib/tools/composed-card-schema';
import type { HookProof } from '@/lib/tools/proof-schema';
import { SECTION_LABEL } from '@/components/thread/card-primitives';
import { ProofReceipt } from '@/components/thread/proof-receipt';
import { stripWrappingQuotes } from '@/lib/utils';

/** Same shapes proof-receipt.tsx prints, so one row reads identically wherever it appears. */
function fmtStatViews(n: number | null): string | null {
  if (n === null || !Number.isFinite(n)) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function fmtStatMultiplier(m: number | null): string | null {
  if (m === null || !Number.isFinite(m)) return null;
  return m >= 100 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`;
}

export function SlotRenderer({
  slot,
  receipts,
}: {
  slot: Slot;
  /** Server-materialized receipts, keyed by teardown row id (D7). */
  receipts: Map<string, HookProof>;
}) {
  switch (slot.kind) {
    case 'proof_strip': {
      // An id the corpus did not return simply has no receipt — never a placeholder tile. The
      // model only ever supplies ids (D7), so this is what makes a fabricated handle unreachable:
      // there is nothing to draw one from.
      const resolved = slot.receiptRefs.map((id) => receipts.get(id)).filter((p): p is HookProof => !!p);
      if (resolved.length === 0) return null;
      return (
        <div className="flex flex-col gap-2">
          {resolved.map((proof, i) => (
            <ProofReceipt key={`${proof.handle}-${i}`} proof={proof} />
          ))}
        </div>
      );
    }

    case 'beats':
      return (
        <div className="flex flex-col gap-2.5">
          {slot.items.map((item, i) => (
            <div key={i} className="flex flex-col gap-1">
              <span className={SECTION_LABEL}>{item.label}</span>
              <p className="text-body text-foreground-secondary">{item.text}</p>
            </div>
          ))}
        </div>
      );

    case 'stat_row': {
      // D7 for numbers (owner ruling 2026-08-12): the model chose the ROW and the METRIC; the
      // figure comes from the server-materialized receipt. A stat whose ref did not resolve is
      // dropped entirely — never a placeholder, never the model's own number (spec §5).
      const stats = slot.stats
        .map((s) => {
          const proof = receipts?.get(s.receiptRef);
          if (!proof) return null;
          const value = s.metric === 'multiplier' ? fmtStatMultiplier(proof.multiplier) : fmtStatViews(proof.views);
          return value ? { value, label: s.label } : null;
        })
        .filter((s): s is { value: string; label: string } => s !== null);

      if (stats.length === 0) return null;

      return (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {stats.map((s, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              {/* `text-subhead` (18px), NOT `text-heading` (22px): 22px is <CardHero>'s own size,
                  and a body stat set at the hero's size competes with the deliverable the creator
                  came for (§0.5 row 2 — "the thing the user came for reads FIRST"; §0.6 flags
                  "hero = a number" as a structural failure on outlier-grid). A stat_row carries up
                  to FOUR values, so none of them is "the one big number on a card" (--text-stat)
                  either. 18px reads as a stat and still loses to the hero. */}
              <span className="text-subhead font-semibold tabular-nums text-foreground">{s.value}</span>
              <span className={SECTION_LABEL}>{s.label}</span>
            </div>
          ))}
        </div>
      );
    }

    case 'bullets':
      return (
        <ul className="flex flex-col gap-1.5">
          {slot.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-body text-foreground-secondary">
              <span aria-hidden="true" className="text-foreground-muted">
                ·
              </span>
              <span className="min-w-0 flex-1">{item}</span>
            </li>
          ))}
        </ul>
      );

    case 'quote':
      return (
        <figure className="flex flex-col gap-1.5">
          {/* The house blockquote, verbatim: 2px rail at white/12%, italic (proof-unit,
              profile-read, remix, verbatim-wall). §0.5b — the COMPONENT owns the typographic
              marks and the model's own wrapping quotes are stripped, or the line renders
              ""doubled"". */}
          <blockquote className="border-l-2 border-white/[0.12] pl-3 text-body italic leading-snug text-foreground-secondary">
            &ldquo;{stripWrappingQuotes(slot.text)}&rdquo;
          </blockquote>
          {slot.attribution && (
            // NOT SECTION_LABEL — see the header. An attribution is a proper noun; uppercase
            // mangles it. Muted caption, sentence case, matching verbatim-wall's "who said it".
            <figcaption className="pl-3 text-caption text-foreground-muted">{slot.attribution}</figcaption>
          )}
        </figure>
      );

    case 'label_values':
      return (
        <dl className="flex flex-col gap-1.5">
          {slot.rows.map((r, i) => (
            <div key={i} className="flex items-baseline justify-between gap-4">
              <dt className={SECTION_LABEL}>{r.label}</dt>
              <dd className="min-w-0 text-right text-body text-foreground-secondary">{r.value}</dd>
            </div>
          ))}
        </dl>
      );

    case 'script_timeline':
      return (
        <ol className="flex flex-col gap-2">
          {slot.lines.map((l, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 text-label font-semibold tabular-nums text-foreground-muted">{l.t}</span>
              <span className="min-w-0 flex-1 text-body text-foreground-secondary">{l.text}</span>
            </li>
          ))}
        </ol>
      );

    case 'comparison':
      // The column count is data (2 or 3), so the track list is computed. Tailwind's `grid-cols-*`
      // utilities are generated from the literal class string, so a dynamic count cannot use them
      // without an is-2/is-3 branch that would drift the moment the schema's max changes.
      // `gridTemplateColumns` is not a radius, a colour or a label — it trips no guard.
      return (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${slot.columns.length}, minmax(0, 1fr))` }}>
          {slot.columns.map((col, i) => (
            <div key={i} className="flex min-w-0 flex-col gap-2 rounded-md border border-white/[0.06] p-3">
              <span className={SECTION_LABEL}>{col.title}</span>
              <ul className="flex flex-col gap-1">
                {col.points.map((p, j) => (
                  <li key={j} className="text-body text-foreground-secondary">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );

    case 'chips':
      return (
        <div className="flex flex-wrap gap-1.5">
          {slot.items.map((c, i) => (
            <span
              key={i}
              className="rounded-md border border-white/[0.06] px-2 py-1 text-label text-foreground-secondary"
            >
              {c}
            </span>
          ))}
        </div>
      );

    case 'note':
      return <p className="text-label text-foreground-muted">{slot.text}</p>;
  }
}
