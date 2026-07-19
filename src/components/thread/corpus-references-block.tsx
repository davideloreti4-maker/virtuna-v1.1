'use client';

/**
 * CorpusReferencesBlockRenderer — the chat agent's CITED SOURCES, rendered from the tool's own
 * structured output.
 *
 * Why this exists at all: when chat searches the corpus mid-answer, the retrieved rows used to
 * reach the creator only as the model's prose retelling ("@someone got 2.4M views, 44× their
 * usual") — which is a claim the model can get wrong, and the one thing a grounded product
 * cannot afford to get wrong. This block renders the same rows the RPC returned, so every
 * handle, multiplier and view count on screen is data, not generation. The model writes the
 * argument; the card carries the evidence.
 *
 * Honesty spine (docs/subsystems/grounding-tools.md §4–§5):
 *  - Only CITABLE rows are ever passed here — corpus-tool.ts computes the warrant and an
 *    ungrounded search emits no block, because a source card is itself an assertion of relevance.
 *  - The header states WHAT these rows are evidence OF. A structural batch is proven SHAPE from
 *    other subjects, and says so, so a cross-niche pattern is never read as proof about the
 *    creator's topic.
 *  - Per-row receipts reuse <ProofReceipt>, so a curated exemplar can never wear an outlier's
 *    clothes — the same component that guards the skill cards guards these.
 *  - Facet chips state the filters the search actually applied, so a narrowed answer says it was
 *    narrowed rather than presenting itself as the whole corpus.
 */

import type { CorpusReferencesBlock } from '@/lib/tools/blocks';
import { ProofReceipt } from './proof-receipt';

/** "visual-greenscreen" / "in_world_vlog" → "Visual greenscreen" / "In world vlog". */
function formatFacetValue(value: string): string {
  const words = value.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The filter key as the creator would name it (not the column name). */
const FILTER_LABEL: Record<string, string> = {
  platform: 'Platform',
  format: 'Format',
  hookArchetype: 'Hook',
  visualSetting: 'Visual',
  editingStyle: 'Editing',
  niche: 'Niche',
};

/**
 * What DISTINGUISHES this row from its siblings, in the slot where the warrant claim used to repeat.
 *
 * Two rounds of looking at this taught the rule. First the slot carried the group's claim, which
 * rendered as three identical "REAL EXAMPLE" labels stacked under a header that had just said
 * "3 real videos on this". Replacing it with the row's facets produced "GREENSCREEN" three times —
 * because the batch was FILTERED on greenscreen, so every row necessarily shares it and the group
 * chip already states it.
 *
 * Hence the rule: the GROUP states what its rows have in common; a ROW states only what its siblings
 * do not. A facet that is already a filter is guaranteed-redundant by construction and is skipped.
 * What survives is the axis that actually varies — the editing style under a setting filter, the
 * setting under a format filter — which is also the axis the archetype pill does not cover.
 *
 * Setting and editing style overlap by design (`greenscreen` / `visual-greenscreen`), so a value that
 * merely restates one already shown is dropped rather than printed twice.
 */
function facetLine(
  source: { visualSetting: string | null; editingStyle: string | null; format: string | null },
  filters: Record<string, string> | undefined,
): string | undefined {
  const filtered = (key: string) => Boolean(filters && key in filters);
  const setting = !filtered('visualSetting') ? source.visualSetting?.trim() || null : null;
  const editing = !filtered('editingStyle') ? source.editingStyle?.trim() || null : null;
  const parts: string[] = [];
  if (setting) parts.push(formatFacetValue(setting));
  if (editing) {
    const normalized = editing.replace(/[-_]+/g, ' ');
    const settingWords = setting ? setting.replace(/[-_]+/g, ' ') : '';
    if (!settingWords || !normalized.includes(settingWords)) parts.push(formatFacetValue(editing));
  }
  if (parts.length === 0 && !filtered('format') && source.format) parts.push(formatFacetValue(source.format));
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function CorpusReferencesBlockRenderer({ block }: { block: CorpusReferencesBlock }) {
  const { query, warrant, filters, sources } = block.props;
  const n = sources.length;

  // The claim the group makes, stated once, in the language the warrant actually supports.
  const heading =
    warrant === 'topical'
      ? `${n} real ${n === 1 ? 'video' : 'videos'} on this`
      : `${n} proven ${n === 1 ? 'structure' : 'structures'} — borrowed for shape`;

  const subheading =
    warrant === 'topical'
      ? query
        ? `Matched on “${query}”.`
        : null
      : // Said plainly rather than implied: these rows are about other subjects, and the only
        // thing transferring is the shape. Without this line a cross-niche row reads as topical proof.
        'From other subjects — evidence about what works structurally, not about this topic.';

  return (
    <section
      className="flex flex-col gap-2.5"
      aria-label={`${heading}${query ? ` for ${query}` : ''}`}
    >
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-foreground-muted">
          {heading}
        </h4>
        {subheading && (
          <span className="text-[12px] leading-snug text-foreground-muted">{subheading}</span>
        )}
      </header>

      {filters && Object.keys(filters).length > 0 && (
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Filters applied">
          {Object.entries(filters).map(([key, value]) => (
            <li
              key={key}
              className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[11px] text-foreground-secondary"
            >
              <span className="text-foreground-muted">{FILTER_LABEL[key] ?? key}</span>{' '}
              {formatFacetValue(value)}
            </li>
          ))}
        </ul>
      )}

      <ul className="flex flex-col gap-2">
        {sources.map((source, i) => (
          <li key={source.videoUrl ?? `${source.handle}-${i}`}>
            <ProofReceipt
              proof={source}
              // The row's own facets, NOT the group's claim — see facetLine. Falls back to the warrant
              // wording only when a row carries no facets at all, so the slot is never empty.
              eyebrow={facetLine(source, filters) ?? (warrant === 'topical' ? 'Real example' : 'Proven structure')}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
