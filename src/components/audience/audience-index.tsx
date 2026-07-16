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
 * A zone is a matte tone panel (no border); the cards inside carry the 6% border +
 * matte depth and are whole-row clickable. Accent budget: the primary account's
 * liveness dot, nothing else.
 */

import { useMemo } from "react";
import Link from "next/link";
import type { Audience } from "@/lib/audience/audience-types";
import { AudienceCompositionBar } from "./audience-composition-bar";
import { getBuiltFrom, getPersonaCount } from "./audience-display";
import { cn } from "@/lib/utils";
import { CaretRight, Check } from "@phosphor-icons/react";

/** Slim connected-account view the index renders (client-serializable). */
export interface AccountRow {
  id: string;
  handle: string;
  platform: "tiktok" | "instagram" | "youtube";
  is_primary: boolean;
  last_synced_at: string | null;
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
  /** Compare mode turns rows into checkboxes. */
  selectionMode?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
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

/**
 * The audience a connected account manifests as. Matches by `source_account_id` OR by
 * scrape handle+platform (audiences calibrated before connected_accounts existed carry
 * no FK). Among candidates the CALIBRATED one wins — the connect deep-link can leave an
 * empty shell with the FK set, and it must not shadow the audience that actually
 * carries the account's reading (live-caught 2026-07-16).
 */
function audienceForAccount(account: AccountRow, owned: Audience[]): Audience | undefined {
  const candidates = owned.filter(
    (a) =>
      a.source_account_id === account.id ||
      (a.platform === account.platform &&
        a.calibration?.source === "scrape" &&
        a.calibration.handle?.toLowerCase() === account.handle.toLowerCase()),
  );
  if (candidates.length <= 1) return candidates[0];
  return [...candidates].sort((x, y) => getPersonaCount(y) - getPersonaCount(x))[0];
}

function Zone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/[0.02] p-3.5">
      <p className="mb-2.5 px-1 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-muted">
        {label}
      </p>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

interface RowShellProps {
  onClick: () => void;
  ariaLabel: string;
  selectionMode: boolean;
  selected: boolean;
  children: React.ReactNode;
}

function RowShell({ onClick, ariaLabel, selectionMode, selected, children }: RowShellProps) {
  return (
    <div
      role={selectionMode ? "checkbox" : "button"}
      aria-checked={selectionMode ? selected : undefined}
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
        "group flex cursor-pointer items-center gap-4 rounded-xl border border-white/[0.06] bg-surface px-4 py-3.5",
        "elev-lift hover:border-white/[0.10] hover:bg-white/[0.03]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
        selectionMode && selected && "border-white/[0.14] bg-white/[0.04]",
      )}
    >
      {children}
    </div>
  );
}

function SelectMark({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors",
        selected ? "border-white/[0.14] bg-white/[0.07]" : "border-white/[0.12]",
      )}
    >
      {selected && <Check weight="bold" className="h-3 w-3 text-cream-secondary" />}
    </span>
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
    <div className="flex shrink-0 items-center gap-3">
      {isDefault ? (
        <span className="text-xs text-foreground-secondary">Default</span>
      ) : empty ? (
        <span
          role="button"
          tabIndex={0}
          aria-label="Build"
          className="text-xs text-foreground-muted opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
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
          className="text-xs text-foreground-muted opacity-0 transition-opacity hover:text-foreground-secondary focus-visible:opacity-100 group-hover:opacity-100"
        >
          Set default
        </button>
      )}
      <CaretRight weight="bold" className="h-3.5 w-3.5 text-foreground-muted" />
    </div>
  );
}

export function AudienceIndex({
  audiences,
  accounts = [],
  defaultAudienceId,
  onSetDefault,
  onOpen,
  onOpenAccount,
  selectionMode = false,
  selectedIds = [],
  onToggleSelect,
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

  const rowClick = (audience: Audience) =>
    selectionMode ? () => onToggleSelect?.(audience.id) : () => onOpen(audience);

  return (
    <div className={cn("flex min-w-0 flex-col gap-3.5", className)}>
      {accountRows.length > 0 && (
        <Zone label="Accounts">
          {accountRows.map(({ account, audience }) => {
            const synced = timeAgo(account.last_synced_at);
            const isDefault = Boolean(audience) && defaultAudienceId === audience!.id;
            const selected = Boolean(audience) && selectedIds.includes(audience!.id);

            // Analytics-only: an account with no audience behind it. Not selectable
            // in compare mode; opens the account's analytics.
            if (!audience) {
              return (
                <RowShell
                  key={account.id}
                  ariaLabel={`@${account.handle} · ${PLATFORM_LABEL[account.platform]}`}
                  selectionMode={false}
                  selected={false}
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
                  <CaretRight weight="bold" className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
                </RowShell>
              );
            }

            const built = getBuiltFrom(audience);
            return (
              <RowShell
                key={account.id}
                ariaLabel={`@${account.handle} · ${PLATFORM_LABEL[account.platform]}`}
                selectionMode={selectionMode}
                selected={selected}
                onClick={rowClick(audience)}
              >
                {selectionMode ? (
                  <SelectMark selected={selected} />
                ) : (
                  account.is_primary && (
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-accent)]"
                    />
                  )
                )}
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
                    {[built.needsAction ? built.label : null, synced ? `Synced ${synced}` : null, built.sub && !built.needsAction ? built.sub : null]
                      .filter(Boolean)
                      .join(" · ") || built.label}
                  </p>
                </div>
                <div className="hidden w-[132px] shrink-0 sm:block">
                  <AudienceCompositionBar audience={audience} />
                </div>
                {!selectionMode && (
                  <RowActions audience={audience} isDefault={isDefault} onSetDefault={onSetDefault} />
                )}
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
            const selected = selectedIds.includes(audience.id);
            return (
              <RowShell
                key={audience.id}
                ariaLabel={audience.name}
                selectionMode={selectionMode}
                selected={selected}
                onClick={rowClick(audience)}
              >
                {selectionMode && <SelectMark selected={selected} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                    {audience.name}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 truncate text-[13px]",
                      built.needsAction
                        ? "text-[color:var(--color-warning-raw)]"
                        : "text-foreground-muted",
                    )}
                  >
                    <span>{built.label}</span>
                    {built.sub && (
                      <>
                        {" · "}
                        <span>{built.sub}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="hidden w-[132px] shrink-0 sm:block">
                  <AudienceCompositionBar audience={audience} />
                </div>
                {!selectionMode && (
                  <RowActions audience={audience} isDefault={isDefault} onSetDefault={onSetDefault} />
                )}
              </RowShell>
            );
          })}
        </Zone>
      )}

      {/* The fallback, stated as a fact — General is not a managed row. */}
      {defaultAudienceId === null && !selectionMode && (
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
    </div>
  );
}
