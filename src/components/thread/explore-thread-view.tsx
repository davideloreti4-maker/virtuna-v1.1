'use client';

/**
 * ExploreThreadView — the Explore surface for the user's open thread
 * (Phase 11, Plan 06, Task 1 — EXPLORE-01/02/04/05).
 *
 * Clones the HooksThreadView column (the `max-w-[760px] mx-auto gap-6 px-4 py-6`
 * thread column, ProgressChecklist while streaming, the grid via the streaming +
 * persisted block bodies, the SkillRunError block + onRetry) AND adds the
 * ChatThreadView-style idle ownership: Explore OWNS its idle/empty state and shows
 * three audience-derived quick-action cards (D-06/D-07 / EXPLORE-04) so a blank
 * thread is never intimidating. Unlike HooksThreadView (which returns null when
 * idle), this view renders idle content like ChatThreadView (STATE 05-03 precedent).
 *
 * Three sources of content:
 *  1. IDLE: no content + not streaming + no error → heading + body + 3 quick-action
 *     cards. The cards run a preset pull ONLY on tap (never auto-fire on render).
 *  2. STREAMING: ProgressChecklist + the loading lead line + the in-flight grid block.
 *  3. PERSISTED: the grid block(s) rehydrated from the open thread on reload.
 *
 * The grid is rendered via OutlierGridBlockRenderer DIRECTLY (not through
 * MessageBlocks) because MessageBlocks does not forward the onRemix / onTrack
 * handlers — and this view OWNS those handlers. The renderer maps the validated
 * OutlierGridBlock props onto the same DiscoverGrid / OutlierTile (fixed renderer,
 * THREAD-04 — no model-generated UI).
 *
 * Handlers this view owns:
 *  - handleRemix(tile): the VERBATIM discover→remix chain handoff (D-04/D-05) —
 *    `handoffsFor("discover").find(h => h.to === "remix")` → POST { url, platform }.
 *    On success it surfaces the persisted remix-card by reloading the open thread
 *    IN PLACE via onThreadReload (RESEARCH Q2 — Explore renders in /home, so reload,
 *    NOT router.push). The on-tap REAL persona reaction comes free from the reused
 *    remix-card's LensTrigger downstream — this view adds NO reaction UI to the grid (D-02).
 *  - handleTrack(tile): POST /api/tracked-accounts (EXPLORE-05 / D-08), marks the
 *    tile tracked.
 *
 * Honesty spine (D-02): no fabricated competitor feed (card 2 degrades to a quiet
 * "Track an account first" disabled sub-state when no tracked accounts exist), and
 * NO fabricated reaction / persona quote on the grid (the real reaction is lazy).
 *
 * Column width + THEME-06 flat-warm, coral only on the tile CTA (per CLAUDE.md
 * Raycast rules + UI-SPEC §Color). The quick-action active state uses terracotta
 * border+tint (UI-SPEC §Surface 3); the cards themselves are non-accent.
 */

import { useCallback, useState } from 'react';
import { Compass, UsersThree, Sparkle } from '@phosphor-icons/react';
import { OutlierGridBlockRenderer } from '@/components/thread/outlier-grid-block';
import { ProgressChecklist } from '@/components/thread/progress-checklist';
import type { StageState } from '@/components/thread/progress-checklist';
import { handoffsFor } from '@/lib/tools/chain-handoff';
import type { OutlierGridBlock } from '@/lib/tools/blocks';
import type { OutlierTileData } from '@/components/discover/outlier-tile';
import type { Audience } from '@/lib/audience/audience-types';

// ── Quick-action params ─────────────────────────────────────────────────────────

/**
 * Params a quick-action card passes up to onQuickAction (forwarded to
 * useExploreStream.start by the composer). Mirrors ExploreStartParams' shape — kept
 * structural so the composer can pass it straight through.
 */
export interface ExploreQuickActionParams {
  niche?: string;
  accounts?: string;
  timeWindow?: string;
  serendipity?: number;
  /**
   * CR-02 — the competitors card sets this so the route pulls from the session user's
   * tracked accounts (resolved server-side; the client never sends handles).
   */
  tracked?: boolean;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ExploreThreadViewProps {
  /** Validated outlier-grid blocks from the persisted open thread (rehydration). */
  persistedBlocks: OutlierGridBlock[];
  /** In-flight grid block(s) from useExploreStream().toBlocks() (pass [] when idle). */
  streamingBlocks: OutlierGridBlock[];
  /** Pipeline stage states from SSE stage events (ProgressChecklist while streaming). */
  stages: StageState[];
  /** True while the SSE stream is active. */
  isStreaming: boolean;
  /** Error string from the stream (truthy = pull failed → render SkillRunError). */
  error: string | null;
  /** Current platform selection (the remix handoff + track write carry this). */
  platform: string;
  /**
   * The active audience — drives quick-action copy + the card-2 degrade. null =
   * General / no calibrated audience (the niche derivation falls back to "").
   */
  audience: Audience | null;
  /**
   * Whether the creator has any tracked accounts. Gates card 2: false → the quiet
   * "Track an account first" disabled sub-state (honesty — never a fabricated feed).
   */
  hasTrackedAccounts: boolean;
  /**
   * Run a preset Explore pull. Wired by the composer to useExploreStream.start.
   * CRITICAL: fired ONLY on an explicit quick-action tap — never on render (D-07).
   */
  onQuickAction: (params: ExploreQuickActionParams) => void;
  /**
   * Retry callback — re-invokes the last pull (SkillRunError tap-to-retry).
   * Called ONLY on explicit tap. Never fires on render.
   */
  onRetry?: () => void;
  /**
   * Reload the open thread in place to surface the persisted remix-card after a tap
   * (RESEARCH Q2 — Explore renders in /home, so the composer re-fetches the thread
   * rather than navigating). Called by handleRemix on a successful remix launch.
   */
  onThreadReload?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExploreThreadView({
  persistedBlocks,
  streamingBlocks,
  stages,
  isStreaming,
  error,
  platform,
  audience,
  hasTrackedAccounts,
  onQuickAction,
  onRetry,
  onThreadReload,
}: ExploreThreadViewProps) {
  // Per-tile transient state (mirrors DiscoverClient — local to this view).
  const [remixPendingId, setRemixPendingId] = useState<string | null>(null);
  const [trackPendingId, setTrackPendingId] = useState<string | null>(null);
  const [trackedIds, setTrackedIds] = useState<Set<string>>(() => new Set());

  const hasStreamingContent = streamingBlocks.length > 0;
  const hasPersistedContent = persistedBlocks.length > 0;
  const isIdle =
    !isStreaming && !hasStreamingContent && !hasPersistedContent && !error;

  // Niche derived from the active audience for the quick-action presets (honest
  // fallback "" when no audience — the route then runs an un-niched pull).
  const audienceNiche = (audience?.goal_label || audience?.name || '').trim();

  // ── handleRemix (D-04/D-05, RESEARCH Q2) ──────────────────────────────────────
  // VERBATIM discover→remix chain launch (the DiscoverClient pattern), EXCEPT it
  // reloads the open thread in place (onThreadReload) instead of router.push("/home")
  // — Explore already renders in /home, so the persisted remix-card surfaces via a
  // thread re-fetch (the on-tap real reaction rides the reused remix-card's LensTrigger).
  const handleRemix = useCallback(
    async (tile: OutlierTileData) => {
      const handoff = handoffsFor('discover').find((h) => h.to === 'remix');
      if (!handoff?.endpoint) return;

      setRemixPendingId(tile.platformVideoId);
      try {
        // The tile's videoUrl IS the rehost anchor (anchorFrom: "card").
        const res = await fetch(handoff.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: tile.videoUrl, platform }),
        });
        if (!res.ok) {
          setRemixPendingId(null);
          return;
        }
        // Surface the persisted remix-card by reloading the open thread in place
        // (RESEARCH Q2 — NOT router.push; Explore is an in-thread skill in /home).
        onThreadReload?.();
      } catch {
        setRemixPendingId(null);
      }
    },
    [platform, onThreadReload],
  );

  // ── handleTrack (EXPLORE-05 / D-08) ───────────────────────────────────────────
  // Writes the watchlist row for the tile's account; marks the tile tracked.
  // Renders the real persona reaction NOWHERE here — Track is an additive write only.
  const handleTrack = useCallback(
    async (tile: OutlierTileData) => {
      if (!tile.trackable || !tile.trackHandle) return;

      const handle = tile.trackHandle;
      setTrackPendingId(tile.platformVideoId);
      try {
        const res = await fetch('/api/tracked-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform,
            handle,
            source_video_id: tile.platformVideoId,
          }),
        });
        if (res.ok) {
          setTrackedIds((prev) => {
            const next = new Set(prev);
            next.add(handle);
            return next;
          });
        }
      } catch {
        // Network error — leave the tile untracked so the creator can retry.
      } finally {
        setTrackPendingId(null);
      }
    },
    [platform],
  );

  return (
    <div className="w-full max-w-[760px] mx-auto flex flex-col gap-6 px-4 py-6">

      {/* ── IDLE STATE (D-07 / EXPLORE-04) ────────────────────────────────────── */}
      {/* Heading + body + 3 audience-derived quick-action cards. The cards run a
          preset pull ONLY on tap — they NEVER auto-fire on render. */}
      {isIdle && (
        <div className="flex flex-col gap-6 pt-2">
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-foreground leading-snug">
              Find what your audience would actually bite on.
            </h2>
            <p className="text-sm text-foreground-secondary leading-normal">
              Numen pulls outliers from your niche and competitors, then scores each
              for <em>your</em> people — not borrowed view counts. Pick a starting
              point, or set your own search.
            </p>
          </div>

          {/* Cards stack 1-up ≤640px, 2–3-up wider via the auto-fill minmax pattern. */}
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
            {/* Card 1 — always enabled. */}
            <QuickActionCard
              icon={<Compass size={20} weight="regular" aria-hidden="true" />}
              title="Top performers in my niche today"
              sub="Fresh outliers, scored for your audience"
              onClick={() =>
                onQuickAction({ niche: audienceNiche, timeWindow: 'today' })
              }
            />

            {/* Card 2 — degrades to a disabled "Track an account first" sub-state when
                no tracked accounts exist (honesty — never a fabricated competitor feed). */}
            <QuickActionCard
              icon={<UsersThree size={20} weight="regular" aria-hidden="true" />}
              title="What competitors shipped"
              sub={
                hasTrackedAccounts
                  ? 'Recent posts from accounts you track'
                  : 'Track an account first'
              }
              disabled={!hasTrackedAccounts}
              onClick={
                hasTrackedAccounts
                  ? // CR-02: signal the route to resolve the session user's tracked accounts
                    // server-side (no handles sent from the client — CR-01 invariant).
                    () => onQuickAction({ tracked: true, timeWindow: 'week' })
                  : undefined
              }
            />

            {/* Card 3 — always enabled (serendipity widen). */}
            <QuickActionCard
              icon={<Sparkle size={20} weight="regular" aria-hidden="true" />}
              title="Surprise me"
              sub="Widen beyond your niche — something unexpected"
              onClick={() =>
                onQuickAction({ niche: audienceNiche, serendipity: 1 })
              }
            />
          </div>
        </div>
      )}

      {/* ── STREAMING PROGRESS ────────────────────────────────────────────────── */}
      {/* ProgressChecklist while stages stream; the loading lead line names the
          scoring step. NO fake % — the apidojo pull is genuinely minutes (UI-SPEC §5). */}
      {isStreaming && (
        <div className="flex flex-col gap-3">
          {stages.length > 0 && <ProgressChecklist stages={stages} />}
          <p
            className="text-sm text-foreground-muted/70"
            aria-live="polite"
            aria-atomic="true"
          >
            Pulling outliers and scoring them for your audience… this can take a few
            minutes.
          </p>
        </div>
      )}

      {/* ── SKILL-RUN ERROR (tap-to-retry) ────────────────────────────────────── */}
      {error && !isStreaming && <SkillRunError onRetry={onRetry} />}

      {/* ── STREAMING GRID ────────────────────────────────────────────────────── */}
      {/* Rendered via OutlierGridBlockRenderer DIRECTLY so the onRemix / onTrack +
          per-tile pending / tracked state reach the tiles (MessageBlocks does not
          forward handlers). One grid block per run. */}
      {hasStreamingContent && (
        <div className="flex flex-col gap-4">
          {streamingBlocks.map((block, index) => (
            <OutlierGridBlockRenderer
              key={`stream-${index}`}
              block={block}
              onRemix={handleRemix}
              onTrack={handleTrack}
              remixPendingId={remixPendingId}
              trackPendingId={trackPendingId}
              trackedIds={trackedIds}
            />
          ))}
        </div>
      )}

      {/* ── PERSISTED GRID ────────────────────────────────────────────────────── */}
      {/* Rehydrated from the open thread on reload. Same live handlers. */}
      {hasPersistedContent && (
        <div className="flex flex-col gap-4">
          {hasStreamingContent && (
            <div className="border-t border-white/[0.06] pt-4">
              <p className="text-xs text-foreground-muted/50 uppercase tracking-wide mb-4">
                Earlier
              </p>
            </div>
          )}
          {persistedBlocks.map((block, index) => (
            <OutlierGridBlockRenderer
              key={`persisted-${index}`}
              block={block}
              onRemix={handleRemix}
              onTrack={handleTrack}
              remixPendingId={remixPendingId}
              trackPendingId={trackPendingId}
              trackedIds={trackedIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── QuickActionCard ─────────────────────────────────────────────────────────────

/**
 * One audience-derived quick-action card (UI-SPEC §Surface 3).
 *  - transparent bg, 6% border, 12px radius, 20px padding (p-5)
 *  - phosphor line-icon + title (16px/600) + muted sub (14px/400)
 *  - hover bg-white/[0.02] only (no lift)
 *  - active/pressed = terracotta border+tint (the active-state accent, UI-SPEC §Color)
 *  - disabled = the quiet degrade sub-state (no pull fired)
 *
 * CRITICAL: onClick fires ONLY on user tap (D-07) — the card NEVER auto-fires.
 */
interface QuickActionCardProps {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick?: () => void;
  disabled?: boolean;
}

function QuickActionCard({ icon, title, sub, onClick, disabled = false }: QuickActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-label={title}
      className={[
        'group flex flex-col items-start gap-2 text-left',
        'rounded-xl border p-5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        disabled
          ? 'border-white/[0.06] opacity-60 cursor-default'
          : [
              'border-white/[0.06] cursor-pointer',
              'hover:bg-white/[0.02]',
              'active:border-[rgba(217,119,87,0.34)] active:bg-[rgba(217,119,87,0.14)]',
            ].join(' '),
      ].join(' ')}
    >
      <span className="text-foreground-muted" aria-hidden="true">
        {icon}
      </span>
      <span className="text-base font-semibold text-foreground leading-snug">
        {title}
      </span>
      <span className="text-sm text-foreground-muted leading-normal">{sub}</span>
    </button>
  );
}

// ── SkillRunError ─────────────────────────────────────────────────────────────

/**
 * Skill-run error block with tap-to-retry (reuses the HooksThreadView shape —
 * UI-SPEC §Copywriting "nothing was charged"). Renders ONLY when error is truthy and
 * the stream has ended. The retry button calls onRetry ONLY on explicit tap.
 */
interface SkillRunErrorProps {
  onRetry?: () => void;
}

function SkillRunError({ onRetry }: SkillRunErrorProps) {
  return (
    <div
      className="rounded-xl border border-white/[0.06] px-4 py-3 flex flex-col gap-1"
      role="alert"
      aria-live="assertive"
    >
      <p className="text-sm font-semibold" style={{ color: 'var(--color-cream-secondary)' }}>
        Couldn&rsquo;t reach that source.
      </p>
      <p className="text-sm" style={{ color: 'var(--color-cream-muted)' }}>
        Check the handle or niche and try again — nothing was charged.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 text-sm font-medium self-start transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          style={{ color: 'var(--color-cream-secondary)' }}
          aria-label="Retry the Explore pull"
        >
          Retry →
        </button>
      )}
    </div>
  );
}
