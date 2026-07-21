'use client';

/**
 * AccountReadBlock — "A Read on your own account" (Plan 10-05, SELF-01/02/03).
 *
 * The know-thyself companion to Discover's know-thy-competitor. A STATIC composed card
 * mapping the deterministic AccountReadResult onto a FIXED layout — NO model-generated UI.
 *
 * lane/polish refinement (docs/subsystems/ui-skill-cards.md §2): brought onto the refined
 * thread-card chrome (matte, warm-cream, eyebrow kicker) and densified to match the sketch.
 *
 * Tier C scrape-data slice: the card now opens with the REAL scrape — a profile header
 * (avatar / display name / verified / follower + post counts) and a cover-thumbnail strip
 * of the analyzed posts (top performers, with view counts) — so the Read is visibly grounded
 * in the creator's actual account, not just a handle string over a wall of text.
 *
 * Honesty spine:
 *   - Thin-history fallback (SELF-02): warning-toned `--color-warning` state, NEVER
 *     error/coral, NEVER a fabricated pattern.
 *   - Accuracy track record (SELF-03): cream-PRIMARY number (data, not a CTA); the empty
 *     copy shows when `trackRecord` is null.
 *   - Working / fix labels use the sanctioned success / warning DATA tones (not brand accent).
 *   - Cover URLs are ephemeral TikTok-CDN images → display-only: a broken/expired cover
 *     degrades to a placeholder tile (the view count still reads), never a broken-image icon.
 *
 * Back-compat: `profile` / `analyzedVideos` are optional. A pre-Tier-C saved snapshot (no
 * profile) falls back to the handle-only eyebrow and simply omits the header + cover strip.
 *
 * Forward action (§7, LIVE): "Write to my strengths →" seeds Ideas with the account's
 * "What's working" patterns as steering, so the next concepts double down on what already
 * lands. The card POSTs `ask` (built from patterns.working) to the Ideas SSE route — which
 * appends idea cards to the open thread — then navigates to /home to rehydrate them (the
 * same card-POST + navigate pattern as discover→remix). The endpoint is read from the
 * CHAIN_HANDOFFS registry (account-read→idea), never hard-coded. The CTA only renders when
 * there ARE strengths to write to (honest — never an empty seed); Save trails it.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AccountReadBlock } from '@/lib/tools/blocks';
import { handoffsFor } from '@/lib/tools/chain-handoff';
import { SaveAffordance } from './save-affordance';
import { CoverFill } from '@/components/primitives/CoverFill';
import { CaretToggle } from './caret-toggle';
import { CardEyebrow, CardPrimaryAction, CardActionBar } from './card-primitives';

type AccountReadPatterns = NonNullable<AccountReadBlock['props']['patterns']>;
type FormatMix = AccountReadPatterns['formatMix'];
type AccountReadProfile = NonNullable<AccountReadBlock['props']['profile']>;
type AnalyzedVideos = NonNullable<AccountReadBlock['props']['analyzedVideos']>;

export interface AccountReadBlockProps {
  block: AccountReadBlock;
  /** The thread this Read belongs to — passed to the save affordance for provenance. */
  threadId?: string | null;
}

// The one in-thread card surface — matches every other thread card (hook/script/remix/idea/
// video-test/text-read all use bg-surface-sunken). Was bg-transparent, which rendered the card as
// the app bg (#1f1f1e) with no lift — an "invisible box" next to its lifted siblings.
const CARD = 'overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken';

/** Compact count formatter — 142000 → "142K", 1500 → "1.5K", 2_400_000 → "2.4M". */
function formatCompact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  const fmt = (val: number, suffix: string) =>
    `${val >= 10 || Number.isInteger(val) ? Math.round(val) : val.toFixed(1)}${suffix}`;
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return fmt(n / 1000, 'K');
  return fmt(n / 1_000_000, 'M');
}

/** Eyebrow kicker — the shared CardEyebrow (§0.5.1); optional right-side @handle (back-compat/thin). */
function Eyebrow({ handle }: { handle?: string }) {
  return (
    <CardEyebrow
      kicker="A Read on your account"
      dotColor="var(--color-foreground-muted)"
      meta={handle ? <span className="text-[12px] text-foreground-muted">@{handle}</span> : undefined}
    />
  );
}

/** Subtle verified tick — cream-secondary (a data signal, not brand accent / not blue). */
function VerifiedTick() {
  return (
    <span
      className="inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full bg-white/[0.08]"
      title="Verified"
      aria-label="Verified"
    >
      <svg viewBox="0 0 10 10" className="h-[7px] w-[7px]" fill="none" aria-hidden="true">
        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="var(--color-foreground-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** Profile header — the REAL scrape identity: avatar + name + verified + follower/post counts. */
function ProfileHeader({ profile }: { profile: AccountReadProfile }) {
  const name = profile.displayName?.trim() || `@${profile.handle}`;
  const initial = (name.replace(/^@/, '')[0] ?? '?').toUpperCase();
  return (
    <div className="flex items-center gap-3" data-testid="account-read-profile">
      {/* Avatar — real scrape image over a warm placeholder; broken/empty → the initial shows. */}
      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
        <span className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold text-foreground-muted" aria-hidden="true">
          {initial}
        </span>
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- ephemeral CDN avatar, not a static asset
          <img
            src={profile.avatarUrl}
            alt=""
            loading="lazy"
            className="relative h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold text-foreground">{name}</span>
          {profile.verified ? <VerifiedTick /> : null}
        </div>
        <p className="truncate text-[12.5px] text-foreground-muted">
          @{profile.handle} · {formatCompact(profile.followerCount)} followers · {formatCompact(profile.videoCount)} posts
        </p>
      </div>
    </div>
  );
}

/** Post feed — the analyzed posts as a 9:16 thumbnail GRID with view counts (real scrape media).
 *  A feed, not a strip: the full scraped history reads as the account's own grid — the visible
 *  proof of how much the Read is grounded in. Responsive 3-up (mobile) → 5-up (sm+). */
function CoverStrip({ videos }: { videos: AnalyzedVideos }) {
  return (
    <div data-testid="account-read-covers">
      <p className="mb-2 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">Posts we read</p>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {videos.map((v, i) => {
          const Tag = v.videoUrl ? 'a' : 'div';
          return (
            <Tag
              key={`cover-${i}`}
              {...(v.videoUrl ? { href: v.videoUrl, target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="group relative aspect-[9/16] w-full overflow-hidden rounded-md border border-white/[0.06] bg-white/[0.04]"
              title={v.caption || undefined}
            >
              <CoverFill coverUrl={v.coverUrl} playSize={20} className="transition-opacity group-hover:opacity-90" />
              {/* Views overlay — over imagery (white on a dark gradient), legible even if cover fails. */}
              <span className="absolute inset-x-0 bottom-0 flex items-center gap-0.5 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-4 text-[10px] font-medium tabular-nums text-white/90">
                <svg viewBox="0 0 8 8" className="h-[7px] w-[7px]" fill="currentColor" aria-hidden="true">
                  <path d="M1.5 1L7 4L1.5 7Z" />
                </svg>
                {formatCompact(v.views)}
              </span>
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

/** A labeled bullet list — the label stays muted cream; the data tone (success/warning) rides
 *  the bullet DOT, never the label text (§0.5 — color is a data mark). Honest empty state. */
function ListBlock({
  label,
  items,
  testid,
  dotColor,
}: {
  label: string;
  items: string[];
  testid: string;
  dotColor?: string;
}) {
  return (
    <div data-testid={testid}>
      <p className="mb-1.5 text-[11px] uppercase tracking-[0.05em] text-foreground-muted">{label}</p>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-1" role="list">
          {items.map((item, i) => (
            <li key={`${testid}-${i}`} className="flex gap-2 text-[13px] leading-relaxed text-foreground-secondary">
              <span
                className="mt-[7px] h-[4px] w-[4px] shrink-0 rounded-full"
                style={{ backgroundColor: dotColor ?? 'var(--color-foreground-muted)' }}
                aria-hidden="true"
              />
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
          Maven has been{' '}
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

/** Build the Ideas steering `ask` from the account's "What's working" strengths.
 *  Bounded (≤8 bullets, hard-capped well under the route's 2000-char `ask` limit). */
function buildStrengthsAsk(strengths: string[]): string {
  const bullets = strengths
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((s) => `• ${s}`)
    .join('\n');
  return `Write to my strengths — give me new content ideas that lean into what's already working on my account:\n${bullets}`.slice(
    0,
    1800,
  );
}

/**
 * "Write to my strengths →" — the forward action (§7, LIVE). POSTs the strengths as the
 * Ideas steering `ask`, then navigates to /home to rehydrate the appended idea cards.
 * Endpoint is the CHAIN_HANDOFFS account-read→idea entry (SSOT, never hard-coded) — the
 * same card-POST + navigate shape as discover→remix. Cream-primary (forward-chain primary).
 */
function WriteToStrengthsButton({ strengths }: { strengths: string[] }) {
  const router = useRouter();
  const [writing, setWriting] = useState(false);
  const handoff = handoffsFor('account-read').find((h) => h.to === 'idea');

  async function handleWrite() {
    if (!handoff?.endpoint || writing) return;
    setWriting(true);
    try {
      // The Ideas SSE route appends idea cards to the OPEN thread server-side; we don't
      // consume the stream here — /home rehydrates the persisted cards on navigation.
      await fetch(handoff.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ask: buildStrengthsAsk(strengths), platform: 'tiktok' }),
      });
      router.push('/home');
    } catch {
      setWriting(false);
    }
  }

  return (
    <CardPrimaryAction
      onClick={handleWrite}
      disabled={writing}
      aria-label="Write to my strengths — generate ideas that lean into what's working"
      data-testid="account-read-write-strengths"
    >
      {writing ? 'Writing…' : 'Write to my strengths →'}
    </CardPrimaryAction>
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
  const { handle, fallback, patterns, trackRecord, profile, analyzedVideos } = block.props;
  const [detailOpen, setDetailOpen] = useState(false);

  // Honest thin-history fallback (SELF-02) — never renders fabricated patterns.
  if (fallback === 'thin' || !patterns) {
    return <ThinFallback handle={handle} />;
  }

  // The analytical tail folds into ONE disclosure (§0.5: promote one thing, collapse the rest).
  // The face keeps the payoff — identity, the posts we read, and the What's-working / What-to-fix
  // diagnosis; recurring hooks, format mix and drop-points are a tap away. This card used to stack
  // SEVEN equal-weight ALL-CAPS labels on the face (the spec-sheet failure mode §0.5 names).
  const hasDetail =
    patterns.recurringHooks.length > 0 ||
    patterns.formatMix.length > 0 ||
    patterns.dropPoints.length > 0;

  return (
    <div className={CARD} data-testid="account-read-block">
      <div className="flex flex-col gap-4 px-4 pb-3 pt-4">
        {/* Real scrape identity opens the card — the "A Read on your account" eyebrow was removed
            2026-07-21 (the run capsule above already labels the skill). Back-compat: a pre-Tier-C
            snapshot (no profile) falls back to the bare handle. */}
        {profile ? <ProfileHeader profile={profile} /> : <p className="text-[13px] text-foreground-muted">@{handle}</p>}

        {/* The analyzed posts — real cover thumbnails (top performers), proof the Read is grounded. */}
        {analyzedVideos && analyzedVideos.length > 0 ? <CoverStrip videos={analyzedVideos} /> : null}

        {/* The payoff — What's working vs What to fix reads as the card's focus (§0.5.2). */}
        <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-1">
          <ListBlock
            label="What's working"
            items={patterns.working}
            testid="account-read-working"
            dotColor="var(--color-success)"
          />
          <ListBlock
            label="What to fix"
            items={patterns.fix}
            testid="account-read-fix"
            dotColor="var(--color-warning)"
          />
        </div>

        {/* ONE disclosure — the analytical tail (was three stacked face labels). */}
        {hasDetail && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setDetailOpen((v) => !v)}
              className="flex items-center gap-1.5 self-start text-[12.5px] text-foreground-muted transition-colors hover:text-foreground-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
              aria-expanded={detailOpen}
              data-testid="account-read-breakdown-toggle"
            >
              <CaretToggle open={detailOpen} size={12} />
              {detailOpen ? 'Hide breakdown' : 'Recurring hooks, format mix & drop-points'}
            </button>
            {detailOpen && (
              <div className="flex flex-col gap-4">
                <ListBlock label="Recurring hooks" items={patterns.recurringHooks} testid="account-read-hooks" />
                <FormatMixBlock formatMix={patterns.formatMix} />
                <ListBlock label="Drop-points" items={patterns.dropPoints} testid="account-read-drop-points" />
              </div>
            )}
          </div>
        )}

        <Accuracy trackRecord={trackRecord ?? null} />
      </div>

      {/* Footer — "Write to my strengths →" (forward action, LIVE §7) as the cream primary; Save
          trails as the ml-auto icon (§0.5.7). The CTA only shows when there ARE strengths to seed
          from (honest — no empty run). */}
      <CardActionBar>
        {patterns.working.length > 0 ? (
          <WriteToStrengthsButton strengths={patterns.working} />
        ) : (
          <span aria-hidden="true" />
        )}
        <SaveAffordance
          className="ml-auto"
          item_type="read"
          thread_id={threadId}
          title={`Account Read — @${handle}`}
          snapshot={block.props as Record<string, unknown>}
        />
      </CardActionBar>
    </div>
  );
}

AccountReadBlockRenderer.displayName = 'AccountReadBlockRenderer';
