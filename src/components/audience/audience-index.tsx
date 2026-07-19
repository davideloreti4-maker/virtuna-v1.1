"use client";

/**
 * AudienceIndex — grouped zones, not a table (audience rebuild 2026-07-16).
 *
 * Two kinds of rows, because the user owns two kinds of things:
 *  - ACCOUNTS — connected social accounts, each manifesting as its synced audience
 *    (or "Analytics only" until the platform supports simulation / it's calibrated).
 *  - SIMULATED — audiences the user built from a handle they don't own or from a
 *    description. Provenance stays in plain words on every row (the honesty column's
 *    contract survives the layout: "Read from @x", "A description you wrote",
 *    "Nothing yet" — never a trust badge).
 *
 * Gone from the list: preset rows (they become create-flow templates) and the General
 * row. General is the fallback, not a managed object — when nothing is pinned, one
 * quiet fact-line below the zones says so.
 *
 * A zone is a matte tone panel (no border) and the ONE frame per group; the rows
 * inside are borderless — hairline-divided, whole-row clickable, hover tint only.
 * Accent budget: the primary account's liveness dot, nothing else.
 *
 * A row does ONE thing: it opens. The checkbox/selection mode that used to live here
 * served concept-Compare, which was cut from this surface on 2026-07-20 — see the
 * `audience-manager` docblock for why. Rows are `role="button"`, never `checkbox`.
 *
 * REWORK 2026-07-20 (direction A, owner-locked). The craft pass left a 44px row of thin
 * grey text managing an object built from 12 scraped videos and 86M followers — the page's
 * strongest facts were its smallest type. Two changes carry the weight:
 *  - a row is a THREE-LINE BAND: identity → provenance/proof → who is actually inside.
 *  - `AudienceCompositionBar` is DELETED from the rows. Share×temperature encoded as
 *    segment width/brightness was a cipher nobody could read, and its empty (dashed) state
 *    was indistinguishable from a loading skeleton. The same information, in words: the
 *    top personas by name. Names are facts; the bar was a key with no legend.
 * The default-audience fact moved from a footnote under the zones to the state-line above
 * them — which audience scores your threads is the one fact that governs the whole page.
 */

import { useMemo } from "react";
import Link from "next/link";
import type { Audience } from "@/lib/audience/audience-types";
import {
  audienceForAccount,
  getBuiltFrom,
  getDisplayRoster,
  getPersonaCount,
} from "./audience-display";
import { cn } from "@/lib/utils";
import { CaretRight } from "@phosphor-icons/react";

/** Slim connected-account view the index renders (client-serializable). */
export interface AccountRow {
  id: string;
  handle: string;
  platform: "tiktok" | "instagram" | "youtube";
  is_primary: boolean;
  last_synced_at: string | null;
  /** Formatted follower count from the account's latest snapshot ("86.2M"), or null
   *  when we hold no snapshot. The row states scrape scale; it never estimates it. */
  followers?: string | null;
}

export interface AudienceIndexProps {
  audiences: Audience[];
  /** Connected accounts — each renders in the ACCOUNTS zone with its synced audience. */
  accounts?: AccountRow[];
  /** The user-level default that seeds new threads. null = General. */
  defaultAudienceId: string | null;
  onSetDefault: (audience: Audience) => void;
  onOpen: (audience: Audience) => void;
  /** Open an account that has no audience behind it (analytics only). */
  onOpenAccount?: (account: AccountRow) => void;
  className?: string;
}

const PLATFORM_LABEL: Record<AccountRow["platform"], string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

function isOwned(a: Audience): boolean {
  return !a.is_general && !a.is_preset;
}

/** "2h ago" — coarse on purpose; the row is a fact line, not a log. */
export function timeAgo(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function Zone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/[0.02] px-2 pb-2 pt-3">
      <p className="mb-1.5 px-3.5 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-muted">
        {label}
      </p>
      <div className="flex flex-col divide-y divide-white/[0.045]">{children}</div>
    </section>
  );
}

interface RowShellProps {
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}

function RowShell({ onClick, ariaLabel, children }: RowShellProps) {
  return (
    <div
      role="button"
      aria-label={ariaLabel}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        // items-start: a row is three lines now, and the identity line is the one the
        // dot and the action cluster must sit on.
        "group flex cursor-pointer items-start gap-4 rounded-[10px] px-3.5 py-3.5",
        "transition-colors duration-150 hover:bg-white/[0.03]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
      )}
    >
      {children}
    </div>
  );
}

/** Right-side cluster: default state / set-default affordance (or Build), then chevron. */
function RowActions({
  audience,
  isDefault,
  onSetDefault,
}: {
  audience: Audience;
  isDefault: boolean;
  onSetDefault: (a: Audience) => void;
}) {
  const empty = getPersonaCount(audience) === 0;
  return (
    <div className="flex shrink-0 items-center gap-3 pt-px">
      {isDefault ? (
        <span className="text-xs text-foreground-secondary">Default</span>
      ) : empty ? (
        <span
          role="button"
          tabIndex={0}
          aria-label="Build"
          className="pointer-coarse:opacity-100 text-xs text-foreground-muted opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          Build
        </span>
      ) : (
        <button
          type="button"
          aria-label={`Make ${audience.name} the default`}
          onClick={(e) => {
            e.stopPropagation();
            onSetDefault(audience);
          }}
          className="pointer-coarse:opacity-100 text-xs text-foreground-muted opacity-0 transition-opacity hover:text-foreground-secondary focus-visible:opacity-100 group-hover:opacity-100"
        >
          Set default
        </button>
      )}
      <CaretRight weight="bold" className="h-3.5 w-3.5 text-foreground-muted" />
    </div>
  );
}

/**
 * Line 3 — who is actually in this room, by name. This replaced the composition bar:
 * two real persona names carry more than ten encoded segments, and an audience with
 * nothing in it simply has no third line (we never decorate an absence).
 */
function RosterLine({ audience }: { audience: Audience }) {
  const roster = getDisplayRoster(audience);
  if (roster.length === 0) return null;
  const shown = roster.slice(0, 2).map((p) => p.name);
  const rest = roster.length - shown.length;
  return (
    <p className="mt-[3px] text-[12.5px] leading-snug text-foreground-muted">
      <span className="tabular-nums text-foreground-secondary">{roster.length}</span>
      {` persona${roster.length === 1 ? "" : "s"} — ${shown.join(", ")}`}
      {rest > 0 ? ` +${rest}` : ""}
    </p>
  );
}

export function AudienceIndex({
  audiences,
  accounts = [],
  defaultAudienceId,
  onSetDefault,
  onOpen,
  onOpenAccount,
  className,
}: AudienceIndexProps) {
  const owned = useMemo(() => audiences.filter(isOwned), [audiences]);

  const accountRows = useMemo(
    () =>
      accounts.map((account) => ({
        account,
        audience: audienceForAccount(account, owned),
      })),
    [accounts, owned],
  );

  const simulated = useMemo(() => {
    const claimed = new Set(
      accountRows.map((r) => r.audience?.id).filter((id): id is string => Boolean(id)),
    );
    return owned.filter((a) => !claimed.has(a.id));
  }, [accountRows, owned]);

  return (
    <div className={cn("flex min-w-0 flex-col gap-3.5", className)}>
      {/* The state line. Which audience scores your threads governs everything below it,
          so it leads instead of trailing as a footnote. Copy is unchanged — "New threads
          use General" is locked by the honesty test. */}
      {defaultAudienceId === null && (
        <p className="px-1.5 text-[13px] text-foreground-muted">
          New threads use General.{" "}
          <Link
            href="/audience/general"
            className="text-foreground-secondary underline decoration-white/[0.2] underline-offset-2 hover:text-foreground"
          >
            View
          </Link>
        </p>
      )}

      {accountRows.length > 0 && (
        <Zone label="Accounts">
          {accountRows.map(({ account, audience }) => {
            const synced = timeAgo(account.last_synced_at);
            const isDefault = Boolean(audience) && defaultAudienceId === audience!.id;

            // Analytics-only: an account with no audience behind it. Not selectable
            // in compare mode; opens the account's analytics.
            if (!audience) {
              return (
                <RowShell
                  key={account.id}
                  ariaLabel={`@${account.handle} · ${PLATFORM_LABEL[account.platform]}`}
                  onClick={() => onOpenAccount?.(account)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2.5 truncate">
                      <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                        @{account.handle}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-foreground-muted">
                        {PLATFORM_LABEL[account.platform]}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-foreground-muted">
                      Analytics only{synced ? ` · Synced ${synced}` : ""}
                    </p>
                  </div>
                  <CaretRight
                    weight="bold"
                    className="mt-1 h-3.5 w-3.5 shrink-0 text-foreground-muted"
                  />
                </RowShell>
              );
            }

            const built = getBuiltFrom(audience);
            // The title already IS the handle, so "Read from @zachking" would say it twice.
            // The account row states the SCALE of the read instead — videos and followers,
            // the two facts that make the room credible.
            const proof = [
              built.sub ? `Read from ${built.sub}` : "Read from your account",
              account.followers ? `${account.followers} followers` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <RowShell
                key={account.id}
                ariaLabel={`@${account.handle} · ${PLATFORM_LABEL[account.platform]}`}
                onClick={() => onOpen(audience)}
              >
                {account.is_primary && (
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-accent)]"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2.5 truncate">
                    <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                      @{account.handle}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-foreground-muted">
                      {[PLATFORM_LABEL[account.platform], synced ? `Synced ${synced}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-foreground-muted">
                    {built.needsAction ? (
                      <>
                        <span className="text-[color:var(--color-warning-raw)]">
                          {built.label}
                        </span>
                        {built.sub && (
                          <>
                            {" · "}
                            <span>{built.sub}</span>
                          </>
                        )}
                      </>
                    ) : (
                      proof
                    )}
                  </p>
                  <RosterLine audience={audience} />
                </div>
                <RowActions audience={audience} isDefault={isDefault} onSetDefault={onSetDefault} />
              </RowShell>
            );
          })}
        </Zone>
      )}

      {simulated.length > 0 && (
        <Zone label="Simulated">
          {simulated.map((audience) => {
            const built = getBuiltFrom(audience);
            const isDefault = defaultAudienceId === audience.id;
            return (
              <RowShell
                key={audience.id}
                ariaLabel={audience.name}
                onClick={() => onOpen(audience)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                    {audience.name}
                  </p>
                  {/* label and sub stay SEPARATE elements — the honesty lock asserts each
                      as its own text node ("A description you wrote" / "No account data
                      behind it"). Joining them into one string turns the test green
                      against nothing. */}
                  <p className="mt-1 text-[13px] leading-snug text-foreground-muted">
                    <span
                      className={cn(
                        built.needsAction && "text-[color:var(--color-warning-raw)]",
                      )}
                    >
                      {built.label}
                    </span>
                    {built.sub && (
                      <>
                        {" · "}
                        <span>{built.sub}</span>
                      </>
                    )}
                  </p>
                  <RosterLine audience={audience} />
                </div>
                <RowActions audience={audience} isDefault={isDefault} onSetDefault={onSetDefault} />
              </RowShell>
            );
          })}
        </Zone>
      )}

    </div>
  );
}
