'use client';

/**
 * AccountReadBlock — "A Read on your own account" (Plan 10-05, SELF-01/02/03).
 *
 * The know-thyself companion to Discover's know-thy-competitor. A STATIC composed card
 * mapping the deterministic AccountReadResult onto a FIXED layout — NO model-generated UI.
 *
 * lane/polish refinement (docs/subsystems/ui-skill-cards.md §2): brought onto the refined
 * thread-card chrome (matte, warm-cream, eyebrow kicker) and densified to match the sketch —
 * a single card with a two-column What's-working / What-to-fix comparison + full-width
 * recurring-hooks / format-mix / drop-points + the accuracy line, instead of a stack of
 * separate ReadingSection cards.
 *
 * Honesty spine:
 *   - Thin-history fallback (SELF-02): warning-toned `--color-warning` state, NEVER
 *     error/coral, NEVER a fabricated pattern.
 *   - Accuracy track record (SELF-03): cream-PRIMARY number (data, not a CTA); the empty
 *     copy shows when `trackRecord` is null.
 *   - Working / fix labels use the sanctioned success / warning DATA tones (not brand accent).
 *
 * Deferred (§7 product call): the forward action "Write to my strengths →" is NOT wired yet
 * — it's net-new behavior (seed Ideas?). The footer carries Save for now.
 */

import type { AccountReadBlock } from '@/lib/tools/blocks';
import { SaveAffordance } from './save-affordance';

type AccountReadPatterns = NonNullable<AccountReadBlock['props']['patterns']>;
type FormatMix = AccountReadPatterns['formatMix'];

export interface AccountReadBlockProps {
  block: AccountReadBlock;
  /** The thread this Read belongs to — passed to the save affordance for provenance. */
  threadId?: string | null;
}

const CARD = 'overflow-hidden rounded-xl border border-white/[0.06] bg-transparent';

/** Eyebrow kicker — cream-muted dot + label, with the handle as the right-side meta. */
function Eyebrow({ handle }: { handle: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.06em] text-foreground-muted">
        <span className="h-[6px] w-[6px] rounded-full bg-[var(--color-foreground-muted)]" aria-hidden="true" />
        A Read on your account
      </span>
      <span className="shrink-0 text-[12px] text-foreground-muted">@{handle}</span>
    </div>
  );
}

/** A labeled bullet list — colored label (success/warning) or muted; honest empty state. */
function ListBlock({
  label,
  items,
  testid,
  labelColor,
}: {
  label: string;
  items: string[];
  testid: string;
  labelColor?: string;
}) {
  return (
    <div data-testid={testid}>
      <p
        className="mb-1.5 text-[11px] uppercase tracking-[0.05em]"
        style={labelColor ? { color: labelColor } : undefined}
      >
        <span className={labelColor ? undefined : 'text-foreground-muted'}>{label}</span>
      </p>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-1" role="list">
          {items.map((item, i) => (
            <li key={`${testid}-${i}`} className="flex gap-2 text-[13px] leading-relaxed text-foreground-secondary">
              <span className="mt-[7px] h-[4px] w-[4px] shrink-0 rounded-full bg-[var(--color-foreground-muted)]" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        // Honest empty — em-dash muted, never a fabricated entry.
        <p className="text-[13px] text-foreground-muted">— none detected yet</p>
      )}
    </div>
  );
}

/** Format-mix bars — cream fill over a faint track (warm-cream, full width). */
function FormatMixBlock({ formatMix }: { formatMix: FormatMix }) {
  return (
    <div data-testid="account-read-format-mix">
      <p className="mb-1.5 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">Format mix</p>
      {formatMix.length > 0 ? (
        <ul className="flex flex-col gap-2" role="list">
          {formatMix.map((entry, i) => (
            <li key={`fmt-${i}`} className="flex items-center gap-3 text-[12.5px]">
              <span className="min-w-[112px] text-foreground-secondary">{entry.label}</span>
              <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, entry.pct))}%`,
                    background: 'linear-gradient(90deg, rgba(236,231,222,0.22), rgba(236,231,222,0.40))',
                  }}
                />
              </span>
              <span className="w-12 text-right tabular-nums text-foreground-muted">{entry.pct}%</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-foreground-muted">— none detected yet</p>
      )}
    </div>
  );
}

/** Accuracy track record (SELF-03) — cream-primary number; empty copy below threshold. */
function Accuracy({ trackRecord }: { trackRecord: AccountReadBlock['props']['trackRecord'] }) {
  return (
    <p
      className="border-t border-white/[0.06] pt-3 text-[13px] leading-relaxed text-foreground-secondary"
      data-testid="account-read-track-record"
    >
      {trackRecord ? (
        <>
          Numen has been{' '}
          <span className="font-semibold text-foreground">within {trackRecord.withinPct}%</span> on your last{' '}
          <span className="font-semibold text-foreground">{trackRecord.lastN}</span> posts.
        </>
      ) : (
        <span className="text-foreground-muted">
          Not enough posted outcomes yet to show a track record. Capture a few and this builds.
        </span>
      )}
    </p>
  );
}

/** Thin-history fallback (SELF-02) — warning-toned, calm, never fabricated. */
function ThinFallback({ handle }: { handle: string }) {
  return (
    <div className={CARD} data-testid="account-read-thin">
      <div className="flex flex-col gap-3 px-4 pb-4 pt-4">
        <Eyebrow handle={handle} />
        <p className="text-[15px] font-semibold" style={{ color: 'var(--color-warning)' }}>
          Not enough history to read yet
        </p>
        <p className="text-[13.5px] leading-relaxed text-foreground-secondary">
          We couldn&rsquo;t find enough public posts on your account to read its patterns honestly.
          Post more, or check your handle is public, and try again.
        </p>
      </div>
    </div>
  );
}

export function AccountReadBlockRenderer({ block, threadId }: AccountReadBlockProps) {
  const { handle, fallback, patterns, trackRecord } = block.props;

  // Honest thin-history fallback (SELF-02) — never renders fabricated patterns.
  if (fallback === 'thin' || !patterns) {
    return <ThinFallback handle={handle} />;
  }

  return (
    <div className={CARD} data-testid="account-read-block">
      <div className="flex flex-col gap-4 px-4 pb-3 pt-4">
        <Eyebrow handle={handle} />

        {/* The hero comparison — What's working vs What to fix (sanctioned data tones). */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <ListBlock
            label="What's working"
            items={patterns.working}
            testid="account-read-working"
            labelColor="var(--color-success)"
          />
          <ListBlock
            label="What to fix"
            items={patterns.fix}
            testid="account-read-fix"
            labelColor="var(--color-warning)"
          />
        </div>

        <ListBlock label="Recurring hooks" items={patterns.recurringHooks} testid="account-read-hooks" />
        <FormatMixBlock formatMix={patterns.formatMix} />
        <ListBlock label="Drop-points" items={patterns.dropPoints} testid="account-read-drop-points" />

        <Accuracy trackRecord={trackRecord ?? null} />
      </div>

      {/* Footer — Save for now; "Write to my strengths →" (forward action) is deferred (§7). */}
      <div className="flex items-center border-t border-white/[0.06] px-4 py-3">
        <SaveAffordance
          item_type="read"
          thread_id={threadId}
          title={`Account Read — @${handle}`}
          snapshot={block.props as Record<string, unknown>}
        />
      </div>
    </div>
  );
}

AccountReadBlockRenderer.displayName = 'AccountReadBlockRenderer';
