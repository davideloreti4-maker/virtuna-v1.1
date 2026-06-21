'use client';

/**
 * AccountReadBlock — "A Read on your own account" (Plan 10-05, SELF-01/02/03).
 *
 * The know-thyself companion to Discover's know-thy-competitor. A STATIC composed card
 * (multi-audience-read-block is the precedent) that maps the deterministic
 * AccountReadResult onto the FIXED `reading/` renderers — NO model-generated UI.
 *
 * Composition (10-UI-SPEC §"Account Read card"):
 *   - ReadingSection (the fixed "quiet label over a flat-warm card" unit) frames every
 *     block — hero summary + the pattern sections (What's working · What to fix ·
 *     Recurring hooks · Format mix · Drop-points).
 *
 * Honesty spine:
 *   - Thin-history fallback (SELF-02): warning-toned `--color-warning` state, NEVER
 *     error/coral, NEVER a fabricated pattern. Reuses the P7 CouldNotAnalyze honesty.
 *   - Accuracy track record (SELF-03): cream-PRIMARY number (data, not a CTA — never
 *     coral); the empty copy shows when `trackRecord` is null.
 *
 * Savable: a <SaveAffordance item_type="read" …/> mounts on the success path; the block's
 * own props are the snapshot the shelf re-renders without a re-fetch (Plan 04).
 */

import type { AccountReadBlock } from '@/lib/tools/blocks';
import { ReadingSection } from '@/components/reading/reading-section';
import { SaveAffordance } from './save-affordance';

/** Non-optional patterns payload (present on the success path). */
type AccountReadPatterns = NonNullable<AccountReadBlock['props']['patterns']>;
type FormatMix = AccountReadPatterns['formatMix'];

export interface AccountReadBlockProps {
  block: AccountReadBlock;
  /** The thread this Read belongs to — passed to the save affordance for provenance. */
  threadId?: string | null;
}

// ─── Thin-history fallback (SELF-02) ──────────────────────────────────────────
// Warning-toned, calm informational state — NEVER error, NEVER coral, NEVER fabricated.

function ThinFallback() {
  return (
    <ReadingSection label="A Read on your own account">
      <div className="flex flex-col gap-2 p-6" data-testid="account-read-thin">
        <p
          className="text-[15px] font-semibold"
          style={{ color: 'var(--color-warning)' }}
        >
          Not enough history to read yet
        </p>
        <p className="text-sm leading-relaxed text-foreground-secondary">
          We couldn&rsquo;t find enough public posts on your account to read its patterns
          honestly. Post more, or check your handle is public, and try again.
        </p>
      </div>
    </ReadingSection>
  );
}

// ─── Accuracy track record (SELF-03) ──────────────────────────────────────────
// The number is DATA — cream-primary, never coral. Empty copy below the threshold.

function TrackRecord({
  trackRecord,
}: {
  trackRecord: AccountReadBlock['props']['trackRecord'];
}) {
  return (
    <ReadingSection label="Accuracy track record">
      <div className="p-5" data-testid="account-read-track-record">
        {trackRecord ? (
          <p className="text-sm leading-relaxed text-foreground-secondary">
            Numen has been{' '}
            {/* cream-PRIMARY number — data, never a coral CTA (UI-SPEC §Color). */}
            <span className="font-semibold text-foreground">
              within {trackRecord.withinPct}%
            </span>{' '}
            on your last{' '}
            <span className="font-semibold text-foreground">{trackRecord.lastN}</span>{' '}
            posts.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-foreground-muted">
            Not enough posted outcomes yet to show a track record. Capture a few and this
            builds.
          </p>
        )}
      </div>
    </ReadingSection>
  );
}

// ─── A labeled list section (reuses the fixed ReadingSection card shell) ───────

function ListSection({
  label,
  items,
  testid,
}: {
  label: string;
  items: string[];
  testid: string;
}) {
  return (
    <ReadingSection label={label}>
      <div className="p-5" data-testid={testid}>
        {items.length > 0 ? (
          <ul className="flex flex-col gap-2" role="list">
            {items.map((item, i) => (
              <li
                key={`${testid}-${i}`}
                className="text-sm leading-relaxed text-foreground-secondary"
              >
                {item}
              </li>
            ))}
          </ul>
        ) : (
          // Honest empty — em-dash muted, never a fabricated entry (UI-SPEC §Color).
          <p className="text-sm text-foreground-muted">— none detected yet</p>
        )}
      </div>
    </ReadingSection>
  );
}

// ─── Format-mix section ───────────────────────────────────────────────────────

function FormatMixSection({ formatMix }: { formatMix: FormatMix }) {
  return (
    <ReadingSection label="Format mix">
      <div className="p-5" data-testid="account-read-format-mix">
        {formatMix.length > 0 ? (
          <ul className="flex flex-col gap-2.5" role="list">
            {formatMix.map((entry, i) => (
              <li key={`fmt-${i}`} className="flex items-center gap-3 text-sm">
                <span className="min-w-[140px] text-foreground-secondary">
                  {entry.label}
                </span>
                <span className="h-[6px] flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, entry.pct))}%`,
                      background:
                        'linear-gradient(90deg, rgba(236,231,222,0.22), rgba(236,231,222,0.38))',
                    }}
                  />
                </span>
                <span className="w-20 text-right tabular-nums text-foreground">
                  {entry.count} · {entry.pct}%
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground-muted">— none detected yet</p>
        )}
      </div>
    </ReadingSection>
  );
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

export function AccountReadBlockRenderer({ block, threadId }: AccountReadBlockProps) {
  const { handle, fallback, patterns, trackRecord } = block.props;

  // Honest thin-history fallback (SELF-02) — never renders fabricated patterns.
  if (fallback === 'thin' || !patterns) {
    return <ThinFallback />;
  }

  return (
    <div className="flex flex-col gap-5" data-testid="account-read-block">
      {/* Hero framing — "A Read on your own account" (companion to know-thy-competitor). */}
      <ReadingSection label="A Read on your own account">
        <div className="flex items-center justify-between gap-3 p-5">
          <span className="text-[15px] font-semibold text-foreground">@{handle}</span>
          {/* Savable as item_type 'read' — the block's props are the shelf snapshot. */}
          <SaveAffordance
            item_type="read"
            thread_id={threadId}
            title={`Account Read — @${handle}`}
            snapshot={block.props as Record<string, unknown>}
          />
        </div>
      </ReadingSection>

      <ListSection
        label="What's working"
        items={patterns.working}
        testid="account-read-working"
      />
      <ListSection
        label="What to fix"
        items={patterns.fix}
        testid="account-read-fix"
      />
      <ListSection
        label="Recurring hooks"
        items={patterns.recurringHooks}
        testid="account-read-hooks"
      />
      <FormatMixSection formatMix={patterns.formatMix} />
      <ListSection
        label="Drop-points"
        items={patterns.dropPoints}
        testid="account-read-drop-points"
      />

      <TrackRecord trackRecord={trackRecord ?? null} />
    </div>
  );
}

AccountReadBlockRenderer.displayName = 'AccountReadBlockRenderer';
