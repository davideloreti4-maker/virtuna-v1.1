"use client";

/**
 * AudienceIndex — Signature Cards (audience rebuild, 2026-07-22).
 *
 * The user owns two kinds of things, so the surface has two zones:
 *  - ACCOUNTS — connected social accounts, each manifesting as its synced audience
 *    (or "Analytics only" until the platform supports simulation).
 *  - SIMULATED — audiences built from a handle the user doesn't own, or a description.
 *
 * Each audience is a matte card whose FACE is its composition signature (temperature
 * encoded as brightness, never hue). The card is deliberately quiet — four tiers, one
 * fact each:
 *   • name + platform   — who this is
 *   • composition face  — the signature (temperature as brightness)
 *   • insight           — what this audience cares about, read from its signature
 *   • provenance        — how real it is, in plain words + a status dot (never a badge)
 * and a hairline footer with the persona count (or a stale-sync nudge) and one action.
 *
 * The default lives in ONE place — the top-right slot: a pill when this audience seeds
 * new threads, a quiet "Set default" otherwise. A banner above the zones names the
 * current default outright. Accent budget: the primary account's liveness dot, nothing else.
 */

import { useMemo } from "react";
import Link from "next/link";
import type { Audience, Temperature } from "@/lib/audience/audience-types";
import {
  audienceForAccount,
  getBuiltFrom,
  getCompositionSegments,
  getPersonaCount,
  getRung,
  GENERAL_SEGMENT_TEMPS,
  type CompositionSegment,
} from "./audience-display";
import { cn } from "@/lib/utils";

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
  className?: string;
}

const PLATFORM_LABEL: Record<AccountRow["platform"], string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

/**
 * Temperature as BRIGHTNESS, not hue (mirrors AudienceCompositionBar). Tinting hot
 * personas with the accent would put accent blocks on every card — the exact opposite
 * of the locked near-zero dosage rule (accent = liveness only).
 */
const TEMP_FILL: Record<Temperature, string> = {
  cold: "rgba(236,231,222,0.22)",
  warm: "rgba(236,231,222,0.46)",
  hot: "rgba(236,231,222,0.82)",
};

function isOwned(a: Audience): boolean {
  return !a.is_general && !a.is_preset;
}

/** "2h ago" — coarse on purpose; a fact line, not a log. */
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

/** True once a sync is older than a day — the row earns a quiet nudge. */
function isStale(iso: string | null): boolean {
  if (!iso) return false;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) && ms > 24 * 60 * 60_000;
}

/**
 * The insight line — what this audience actually cares about, read from its signature.
 * Concrete specifics (topics, then what-resonates), never a category label. Only shows
 * when we genuinely read them from a real account; described/empty audiences get nothing
 * rather than an invented interest.
 */
function audienceInsight(audience: Audience): string | null {
  const sig = audience.signature?.audience;
  if (!sig) return null;
  if (sig.interest_tags && sig.interest_tags.length > 0) {
    return sig.interest_tags.slice(0, 3).join(" · ");
  }
  const resonates = sig.what_resonates?.trim();
  return resonates ? resonates : null;
}

// ─── Composition face — the card's signature ─────────────────────────────────

function CompositionFace({ audience }: { audience: Audience }) {
  const segments = getCompositionSegments(audience);
  if (segments.length === 0) {
    return (
      <div
        className="h-[10px] w-full rounded-[4px] border border-dashed border-white/[0.10]"
        aria-hidden="true"
      />
    );
  }
  return (
    <div className="flex h-[10px] w-full gap-[2px]" aria-hidden="true">
      {segments.map((seg, i) => (
        <span
          key={`${seg.temperature}-${i}`}
          className="rounded-[2px]"
          style={{ flex: Math.max(seg.share, 0.01), background: TEMP_FILL[seg.temperature] }}
        />
      ))}
    </div>
  );
}

// ─── Provenance line — the honesty column, one quiet line ────────────────────

function ProvLine({ audience }: { audience: Audience }) {
  const built = getBuiltFrom(audience);
  // Status dot: sage = read from a real account, grey = described, amber = nothing yet.
  const dotClass = built.needsAction
    ? "bg-[color:var(--color-warning-raw)]"
    : getRung(audience) === "read"
      ? "bg-[color:var(--color-positive)]"
      : "bg-foreground-muted";
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-[12.5px] text-foreground-muted",
        built.needsAction && "text-[color:var(--color-warning-raw)]",
      )}
    >
      <span aria-hidden="true" className={cn("h-[5px] w-[5px] shrink-0 rounded-full", dotClass)} />
      <span className="truncate">
        {built.label}
        {built.sub && (
          <>
            <span aria-hidden="true" className="opacity-40">{" · "}</span>
            <span className="opacity-70">{built.sub}</span>
          </>
        )}
      </span>
    </p>
  );
}

// ─── Card primitives ─────────────────────────────────────────────────────────

interface CardShellProps {
  ariaLabel: string;
  onClick: () => void;
  empty?: boolean;
  children: React.ReactNode;
}

function CardShell({ ariaLabel, onClick, empty, children }: CardShellProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group relative flex min-h-[172px] cursor-pointer flex-col gap-3.5 rounded-2xl px-4 pt-4",
        "border transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
        empty
          ? "border-dashed border-white/[0.10] bg-transparent hover:border-white/[0.16]"
          : "border-border bg-surface-elevated hover:border-border-hover",
      )}
    >
      {children}
    </div>
  );
}

/** The card's name row: liveness dot, name, platform inline; default control on the right. */
function CardHead({
  name,
  platform,
  isPrimary,
  right,
}: {
  name: string;
  platform?: string;
  isPrimary?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <p className="flex min-w-0 items-center gap-2 truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
        {isPrimary && (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-accent)]"
          />
        )}
        <span className="truncate">{name}</span>
        {platform && (
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-foreground-muted">
            {platform}
          </span>
        )}
      </p>
      {right && <div className="flex shrink-0 items-center">{right}</div>}
    </div>
  );
}

function DefaultPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-hover px-2.5 py-1 text-[11px] font-semibold text-foreground-secondary">
      <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-[color:var(--color-positive)]" />
      Default
    </span>
  );
}

/** A subtle text action. `stopPropagation` so it beats the card's own click. */
function CardAction({
  label,
  onClick,
  variant = "quiet",
}: {
  label: string;
  onClick: () => void;
  variant?: "quiet" | "primary" | "cta";
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "pointer-coarse:h-9 rounded-[7px] px-2.5 py-1.5 text-[12.5px] transition-colors",
        variant === "cta"
          ? "border border-border-hover font-semibold text-foreground hover:border-white/[0.2] hover:bg-white/[0.03]"
          : variant === "primary"
            ? "font-medium text-foreground hover:bg-white/[0.03]"
            : "text-foreground-secondary hover:bg-white/[0.03] hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function CardFooter({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="-mx-4 mt-auto flex items-center justify-between gap-2 border-t border-white/[0.05] px-4 py-2.5">
      <span className="min-w-0 truncate text-[12px] text-foreground-muted">{left}</span>
      {right}
    </div>
  );
}

// ─── The zone (a labelled card grid) ─────────────────────────────────────────

function Zone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-3 px-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-muted">
        {label}
      </p>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

// ─── The default banner ──────────────────────────────────────────────────────

/**
 * The default's makeup as a small node cloud — one dot per persona (size = share,
 * brightness = temperature), scattered on a deterministic golden-angle spiral so it
 * reads as a room of people. Same visual language as the brand constellation.
 */
function NodeCloud({ segments }: { segments: CompositionSegment[] }) {
  const W = 56;
  const H = 44;
  const cx = W / 2;
  const cy = H / 2;
  const n = Math.max(segments.length, 1);
  const maxR = 15;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-11 w-14 shrink-0 rounded-[10px] border border-white/[0.06] bg-surface-elevated"
      aria-hidden="true"
    >
      {segments.map((seg, i) => {
        const ang = i * 2.399963; // golden angle
        const rr = maxR * Math.sqrt((i + 0.5) / n);
        const x = cx + Math.cos(ang) * rr * 1.15;
        const y = cy + Math.sin(ang) * rr;
        const r = 1.4 + Math.min(seg.share, 0.3) * 7;
        return (
          <circle key={`${seg.temperature}-${i}`} cx={x} cy={y} r={r} fill={TEMP_FILL[seg.temperature]} />
        );
      })}
    </svg>
  );
}

function DefaultBanner({
  defaultAudience,
  onOpen,
}: {
  defaultAudience: Audience | null;
  onOpen: (a: Audience) => void;
}) {
  const isGeneral = !defaultAudience;
  const name = isGeneral ? "General" : defaultAudience.name;
  const segments = isGeneral
    ? GENERAL_SEGMENT_TEMPS.map((temperature) => ({
        share: 1 / GENERAL_SEGMENT_TEMPS.length,
        temperature,
      }))
    : getCompositionSegments(defaultAudience);
  const sub = isGeneral
    ? "10 universal personas"
    : (() => {
        const n = getPersonaCount(defaultAudience);
        return n > 0 ? `${n} persona${n === 1 ? "" : "s"}` : getBuiltFrom(defaultAudience).label;
      })();

  const action = isGeneral ? (
    <Link
      href="/audience/general"
      className="pointer-coarse:h-9 shrink-0 rounded-lg border border-border-hover px-3.5 py-1.5 text-[13px] font-medium text-foreground-secondary transition-colors hover:border-white/[0.18] hover:bg-white/[0.02] hover:text-foreground"
    >
      View
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => onOpen(defaultAudience)}
      className="pointer-coarse:h-9 shrink-0 rounded-lg border border-border-hover px-3.5 py-1.5 text-[13px] font-medium text-foreground-secondary transition-colors hover:border-white/[0.18] hover:bg-white/[0.02] hover:text-foreground"
    >
      Open
    </button>
  );

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface-sunken px-4 py-4">
      {segments.length > 0 ? (
        <NodeCloud segments={segments} />
      ) : (
        <span
          aria-hidden="true"
          className="h-11 w-14 shrink-0 rounded-[10px] border border-dashed border-white/[0.10] bg-surface-elevated"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-muted">
          Testing new content against
        </p>
        <p className="mt-1 flex items-baseline gap-2 truncate">
          <span className="text-[16px] font-semibold tracking-[-0.01em] text-foreground">{name}</span>
          <span className="truncate text-[13px] text-foreground-muted">{sub}</span>
        </p>
      </div>
      {action}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

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

  const defaultAudience = useMemo(
    () => (defaultAudienceId ? (audiences.find((a) => a.id === defaultAudienceId) ?? null) : null),
    [audiences, defaultAudienceId],
  );

  /** The card body an owned audience renders — shared by both zones. */
  const renderAudienceCard = (
    audience: Audience,
    opts: { account?: AccountRow; platform?: string },
  ) => {
    const built = getBuiltFrom(audience);
    const insight = audienceInsight(audience);
    const count = getPersonaCount(audience);
    const isDefault = defaultAudienceId === audience.id;
    const synced = opts.account ? timeAgo(opts.account.last_synced_at) : null;
    const stale = opts.account ? isStale(opts.account.last_synced_at) : false;

    // The default slot: pill when pinned, a quiet toggle when it could be — hidden for
    // an empty audience (nothing to seed a thread with yet).
    const defaultControl = isDefault ? (
      <DefaultPill />
    ) : built.needsAction ? null : (
      <CardAction label="Set default" onClick={() => onSetDefault(audience)} />
    );

    return (
      <CardShell
        key={audience.id}
        ariaLabel={audience.name}
        empty={built.needsAction}
        onClick={() => onOpen(audience)}
      >
        <CardHead
          name={audience.name}
          platform={opts.platform}
          isPrimary={opts.account?.is_primary}
          right={defaultControl}
        />

        <CompositionFace audience={audience} />

        {insight && <p className="truncate text-[13px] text-foreground-secondary">{insight}</p>}

        <ProvLine audience={audience} />

        <CardFooter
          left={
            stale
              ? <span className="text-[color:var(--color-warning-raw)]">{`Synced ${synced} · re-read`}</span>
              : synced
                ? `Synced ${synced}`
                : count > 0
                  ? `${count} persona${count === 1 ? "" : "s"}`
                  : null
          }
          right={
            built.needsAction ? (
              <CardAction label="Read your @handle →" variant="cta" onClick={() => onOpen(audience)} />
            ) : (
              <CardAction label="Open →" variant="primary" onClick={() => onOpen(audience)} />
            )
          }
        />
      </CardShell>
    );
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-6", className)}>
      <DefaultBanner defaultAudience={defaultAudience} onOpen={onOpen} />

      {accountRows.length > 0 && (
        <Zone label="Accounts">
          {accountRows.map(({ account, audience }) => {
            const platform = PLATFORM_LABEL[account.platform];

            // Analytics-only — a connected account with no audience behind it.
            if (!audience) {
              const synced = timeAgo(account.last_synced_at);
              return (
                <CardShell
                  key={account.id}
                  ariaLabel={`@${account.handle} · ${platform}`}
                  onClick={() => onOpenAccount?.(account)}
                >
                  <CardHead name={`@${account.handle}`} platform={platform} />
                  <div
                    className="h-[10px] w-full rounded-[4px] border border-dashed border-white/[0.07] opacity-60"
                    aria-hidden="true"
                  />
                  <p className="text-[13px] text-foreground-muted">
                    Simulation isn&apos;t available for {platform} yet.
                  </p>
                  <p className="flex items-center gap-1.5 text-[12.5px] text-foreground-muted">
                    <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-foreground-muted" />
                    Analytics only
                  </p>
                  <CardFooter
                    left={synced ? `Synced ${synced}` : null}
                    right={
                      <CardAction
                        label="View analytics →"
                        variant="primary"
                        onClick={() => onOpenAccount?.(account)}
                      />
                    }
                  />
                </CardShell>
              );
            }

            return renderAudienceCard(audience, { account, platform });
          })}
        </Zone>
      )}

      {simulated.length > 0 && (
        <Zone label="Simulated">
          {simulated.map((audience) => renderAudienceCard(audience, {}))}
        </Zone>
      )}
    </div>
  );
}
