"use client";

/**
 * AccountReadThreadView — the dedicated surface for the Account Read skill ("A Read on
 * your own account", SELF-01/02/03). A5 (docs/subsystems/ui-loading-states.md): Account
 * Read no longer borrows the generic chat prose skeleton — it owns a PROFILE-SHAPED
 * loading skeleton (header + cover strip + pattern bars) that mirrors the real
 * account-read card, so the wait reads as "reading your account", not "thinking".
 *
 * One-tap, no input: the read resolves the creator's OWN handle server-side (T-10-12),
 * so this view owns its idle "Read my account" CTA (fired ONLY on explicit tap — D-05/D-07,
 * never on render). States: idle CTA → shaped skeleton (streaming) → result card | thin
 * fallback (SELF-02, warning-toned, never coral) | retryable error.
 */

import { ThreadShell, ThreadAssistantTurn } from "@/components/thread/thread-shell";
import { AccountReadBlockRenderer } from "@/components/thread/account-read-block";
import { FollowupRow } from "@/components/thread/followup-row";
import { followupsForKind } from "@/lib/tools/chat-followups";
import { Button, Skeleton } from "@/components/ui";
import type { AccountReadBlock } from "@/lib/tools/blocks";

export interface AccountReadThreadViewProps {
  /** Composed account-read block from useAccountReadStream (null until the done event). */
  block: AccountReadBlock | null;
  /** True while the SSE stream is active → shaped skeleton. */
  isStreaming: boolean;
  /** Hard error (scrape/network) → retryable error state. */
  error: string | null;
  /** Honest thin-history fallback (SELF-02) — a calm warning, not an error/coral. */
  fallbackMessage: string | null;
  /** Run the read (bodyless). Fired ONLY on explicit tap (D-05/D-07 — never on render). */
  onRun: () => void;
  userTurn?: string | null;
}

export function AccountReadThreadView({
  block,
  isStreaming,
  error,
  fallbackMessage,
  onRun,
  userTurn,
}: AccountReadThreadViewProps) {
  return (
    <ThreadShell userTurn={userTurn}>
      {/* Streaming — the profile-shaped skeleton (A5). */}
      {isStreaming && <AccountReadSkeleton />}

      {/* Thin-history honest fallback (SELF-02) — warning-toned, NEVER error/coral. */}
      {!isStreaming && fallbackMessage && (
        <ThreadAssistantTurn>
          <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
            <p className="text-sm leading-normal text-foreground-secondary">
              {fallbackMessage}
            </p>
          </div>
        </ThreadAssistantTurn>
      )}

      {/* Hard error — retryable (generic copy, never echoes the handle — T-10-13). */}
      {!isStreaming && error && !fallbackMessage && (
        <ThreadAssistantTurn>
          <div className="flex flex-col items-start gap-3 rounded-lg border border-border p-4">
            <p className="text-sm text-foreground-secondary">
              Couldn&apos;t read your account. Check your handle is public and try again.
            </p>
            <Button variant="secondary" size="sm" onClick={onRun}>
              Try again
            </Button>
          </div>
        </ThreadAssistantTurn>
      )}

      {/* Result — the composed account-read card + the curated "what next" pills. */}
      {!isStreaming && block && (
        <ThreadAssistantTurn>
          <AccountReadBlockRenderer block={block} />
          <FollowupRow followups={followupsForKind('account')} className="pt-1" />
        </ThreadAssistantTurn>
      )}

      {/* Idle is NOT this view's business any more — it was a CENTERED block with a
          <Button>, an idiom nothing else on the home used. The one-tap entry now comes
          from the ONE starter (home-starter.tsx — THE STARTER CONTRACT), which the
          composer renders in BOTH layout branches precisely because this skill has no
          other door: canSubmit is false for `account`, so if the starter did not follow
          the creator into thread mode, the read would become unreachable there. */}
    </ThreadShell>
  );
}

/**
 * The A5 shaped loading skeleton — mocks the real account-read card layout: a profile
 * header (avatar + name/handle bars), a cover-thumbnail strip of analyzed posts, and a
 * few pattern bars. Uses the matte `<Skeleton>` primitive (pulse, no glass/glow).
 */
function AccountReadSkeleton() {
  return (
    <ThreadAssistantTurn>
      <div
        className="rounded-lg border border-border p-4"
        aria-busy="true"
        aria-label="Reading your account"
      >
        {/* Profile header — avatar + display name / handle. */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>

        {/* Cover strip — analyzed posts (9:16 thumbnails). */}
        <div className="mt-4 flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-[54px] rounded-md" />
          ))}
        </div>

        {/* Pattern bars — what's working / falling flat. */}
        <div className="mt-4 space-y-2">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>

        <p className="mt-4 text-center text-sm text-foreground-muted">Reading your account…</p>
      </div>
    </ThreadAssistantTurn>
  );
}
