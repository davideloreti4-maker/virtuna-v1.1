"use client";

/**
 * AudienceDetail — /audience/[id], who's in the room at rest (rebuild P2, sketch §3).
 *
 * Replaces AudienceWorkspace. The mix sliders are gone (the engine's dials stay
 * baked at calibration); what remains is the room itself: the population field,
 * the personas, and — for a synced audience — the SOURCE zone, proof that the
 * account's videos and figures were actually read. No brain at rest: reactions
 * only mean something while content hits the room (the ambient card in a thread).
 *
 * Variants:
 *  - synced audience  (account behind it)  → @handle header, SOURCE zone, Sync rail
 *  - simulated        (handle/description) → name header, description + notes
 *  - account-only     (analytics only)     → @handle header, SOURCE zone, no room
 *  - General/presets  → read-only facts, no rail actions
 *
 * Design rules (owner-locked): facts only, no narration; mono microcopy for zone
 * labels; tone-zones not boxes; the accent budget is the primary account's
 * liveness dot and nothing else.
 *
 * REWORK 2026-07-20 (direction A, owner-locked). The page's hierarchy was inverted:
 * the largest element was a 1,000-dot cloud that read as static, while the actual proof
 * — 86.2M followers, 1.3B likes, the real scraped captions — sat in the smallest type at
 * the very bottom. Two owner calls fixed it:
 *  - SOURCE LEADS. The scraped profile and its videos are the first thing on the page.
 *    You earn the room by showing what was read before describing what was inferred.
 *  - `PopulationField` is DELETED. Share is now carried by a proportional bar on each
 *    persona row, where it can actually be compared — the cloud rendered ten clusters
 *    that nobody could count. The 1,000-viewer claim survives as the room's stated
 *    caption (it is the simulated population size, not a decoration).
 * The six-persona fold is gone with it: a roster you can scan in one column does not
 * need to hide 40% of itself.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Audience, CalibratedPersona } from "@/lib/audience/audience-types";
import {
  ARCHETYPE_PERSONA_NAME,
  ARCHETYPE_TRAIT,
  GENERAL_ROSTER,
  resolvePersonaName,
} from "@/lib/audience/persona-names";
import { formatCount } from "@/lib/account-metrics/account-metrics";
import { PersonaEditForm } from "./persona-edit-form";
import { CalibrationFlow } from "./calibration-flow";
import { archetypeDerivedName, isPersonaGrounded } from "./audience-display";
import { timeAgo } from "./audience-index";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── Server-assembled props (all serializable) ───────────────────────────────

export interface AccountView {
  id: string;
  handle: string;
  platform: "tiktok" | "instagram" | "youtube";
  is_primary: boolean;
  last_synced_at: string | null;
  /** Re-hosted avatar; null when we hold no image → the header shows the initial. */
  avatar_url?: string | null;
  /** The creator's real name. Connect falls back to the handle, so it is only
   *  rendered when it actually differs — never as an echo of the @handle. */
  display_name?: string | null;
}

export interface SourceData {
  /** Honest per-platform figures (buildRangeMetrics) — already formatted. */
  figures: { label: string; value: string }[];
  /** The scraped posts we hold (account_posts) — captions + real views. */
  posts: { id: string; caption: string; views: number }[];
  /** Content pillars with their real share of the posting mix. */
  pillars: { name: string; share: number }[];
}

export interface AudienceDetailProps {
  /** Null for an analytics-only account (no audience behind it). */
  audience: Audience | null;
  /** The connected account this audience manifests from (null for simulated). */
  account: AccountView | null;
  /** The user-level default that seeds new threads (null = General). */
  defaultAudienceId: string | null;
  /** Threads currently pinned to this audience. */
  pinnedThreads: number;
  /** SOURCE zone data — present iff a connected account stands behind the page. */
  source: SourceData | null;
  className?: string;
}

const PLATFORM_LABEL: Record<AccountView["platform"] | "custom", string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  custom: "Custom",
};

// ─── Small shared pieces ──────────────────────────────────────────────────────

const ZONE = "rounded-2xl bg-white/[0.02]";
const ZONE_LABEL =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-muted";

/** The simulated population the shares divide — the same constant the deleted
 *  PopulationField rendered as dots, now stated instead of drawn. */
const POPULATION = 1000;

function LivenessDot() {
  return (
    <span
      aria-hidden="true"
      className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-accent)]"
      style={{ animation: "live-breathe 3.2s ease-in-out infinite" }}
    />
  );
}

function MonoMeta({ parts }: { parts: (string | null)[] }) {
  const line = parts.filter(Boolean).join(" · ");
  if (!line) return null;
  return (
    <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-foreground-muted">
      {line}
    </span>
  );
}

/** A rail group is not a box — mono label + facts, hairline-separated from the next. */
function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-white/[0.06] pt-4 first:border-t-0 first:pt-0">
      <h3 className={cn(ZONE_LABEL, "mb-2")}>{label}</h3>
      {children}
    </div>
  );
}

function Kv({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3.5px] text-[13px]">
      <span className="text-foreground-muted">{k}</span>
      <span className="text-right text-foreground-secondary">{children}</span>
    </div>
  );
}

// ─── Persona roster (display rows) ───────────────────────────────────────────

interface RosterRow {
  key: string;
  name: string;
  desc: string;
  sharePct: number;
  disposition: string | null;
  /** Engagement receipt from the frozen signature — only a real scrape has one. */
  receipt: string | null;
  /** Index into `audience.personas` when this row is editable. */
  editIndex: number | null;
}

/**
 * Biggest share first. DB order is arbitrary, and once share is drawn as a bar an
 * arbitrary order makes the column jump instead of descend — the shape of the room is
 * only readable when the bars are sorted. Also keeps the detail page's ranking identical
 * to the list's "top personas" line (`getDisplayRoster` sorts the same way).
 * Array.prototype.sort is stable, so General's ten equal shares keep their cast order.
 */
function byShareDesc(rows: RosterRow[]): RosterRow[] {
  return [...rows].sort((a, b) => b.sharePct - a.sharePct);
}

function buildRoster(audience: Audience): RosterRow[] {
  if (audience.is_general) {
    return GENERAL_ROSTER.map((archetype) => ({
      key: archetype,
      name: ARCHETYPE_PERSONA_NAME[archetype],
      desc: ARCHETYPE_TRAIT[archetype],
      sharePct: 10,
      disposition: null,
      receipt: null,
      editIndex: null,
    }));
  }

  // Receipts live ONLY on the frozen signature reactors — shown iff the scrape
  // actually produced one (the honesty asymmetry; never faked for described rooms).
  const receipts = new Map<string, string>();
  for (const r of audience.signature?.audience.personas ?? []) {
    if (isPersonaGrounded(r)) receipts.set(r.archetype, r.evidence.trim());
  }

  // The editable `personas` column is the display source when present (edits must
  // show); the signature roster is the legacy fallback.
  if (audience.personas.length > 0) {
    return byShareDesc(
      audience.personas.map((p: CalibratedPersona, i) => ({
        key: `${p.archetype}-${i}`,
        name: resolvePersonaName(p.archetype, p.label) ?? archetypeDerivedName(p.archetype),
        desc: p.repaint,
        sharePct: Math.round(p.share * 100),
        disposition: p.disposition,
        receipt: receipts.get(p.archetype) ?? null,
        // Index into the UNSORTED `personas` column — the edit target must survive
        // display sorting, so it is captured before the sort, never re-derived after.
        editIndex: i,
      })),
    );
  }

  return byShareDesc(
    (audience.signature?.audience.personas ?? []).map((p, i) => ({
      key: `${p.archetype}-${i}`,
      name: resolvePersonaName(p.archetype) ?? archetypeDerivedName(p.archetype),
      desc: p.reaction_frame,
      sharePct: Math.round(p.share * 100),
      disposition: p.disposition,
      receipt: isPersonaGrounded(p) ? p.evidence.trim() : null,
      editIndex: null,
    })),
  );
}

// ─── The component ────────────────────────────────────────────────────────────

export function AudienceDetail({
  audience: audienceProp,
  account,
  defaultAudienceId: defaultProp,
  pinnedThreads,
  source,
  className,
}: AudienceDetailProps) {
  const router = useRouter();
  const [audience, setAudience] = useState<Audience | null>(audienceProp);
  const [defaultAudienceId, setDefaultAudienceId] = useState(defaultProp);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [recalibrateOpen, setRecalibrateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = Boolean(audience && !audience.is_general && !audience.is_preset);
  const roster = useMemo(() => (audience ? buildRoster(audience) : []), [audience]);
  const synced = account ? timeAgo(account.last_synced_at) : null;
  /** How many videos the scrape actually read — a stored provenance fact, unlike the
   *  post tiles, whose count is capped by the query that fetched them. */
  const videosRead =
    audience?.signature?.provenance && audience.signature.provenance.videos_analyzed > 0
      ? audience.signature.provenance.videos_analyzed
      : null;

  const isDefault = audience
    ? audience.is_general
      ? defaultAudienceId === null
      : defaultAudienceId === audience.id
    : false;

  // ── Header facts ────────────────────────────────────────────────────────────
  const title = account ? `@${account.handle}` : audience?.name ?? "";
  /** Shown only when the scraper actually returned a name — the connect step writes
   *  `display_name: displayName ?? handle`, so an un-scraped account reads back as its
   *  own handle, and echoing "@zachking / zachking" states one fact twice. */
  const rawName = account?.display_name?.trim() ?? "";
  const realName =
    account && rawName && rawName.toLowerCase() !== account.handle.toLowerCase()
      ? rawName
      : null;
  const metaParts: (string | null)[] = [];
  if (account) {
    metaParts.push(PLATFORM_LABEL[account.platform]);
    if (!audience) metaParts.push("Analytics only");
    if (account.is_primary) metaParts.push("Primary");
    if (synced) metaParts.push(`Synced ${synced}`);
  } else if (audience) {
    if (audience.is_general) {
      metaParts.push("Maven's baseline", "Same for every user");
    } else if (audience.is_preset) {
      metaParts.push("Ready-made mix", "Authored by Maven");
    } else if (audience.mode === "general") {
      metaParts.push("Authored template");
    } else {
      const prov = audience.signature?.provenance;
      const handle = prov?.handle || audience.calibration?.handle;
      if (audience.platform !== "custom") metaParts.push(PLATFORM_LABEL[audience.platform]);
      if (audience.calibration?.source === "scrape" && handle) {
        metaParts.push(`From @${handle}`);
        if (prov && prov.videos_analyzed > 0) metaParts.push(`${prov.videos_analyzed} videos`);
      } else if (roster.length > 0) {
        metaParts.push("From description");
      }
    }
  }

  const heroProvenance = audience
    ? audience.is_general
      ? "Maven's baseline"
      : account || audience.calibration?.source === "scrape"
        ? "Generated from account data"
        : "Generated from your description"
    : "";

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleSetDefault() {
    if (!audience || audience.is_preset) return;
    const next = audience.is_general ? null : audience.id;
    const previous = defaultAudienceId;
    setDefaultAudienceId(next);
    try {
      const res = await fetch("/api/settings/last-audience", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceId: next }),
      });
      if (!res.ok) throw new Error("pin failed");
    } catch {
      setDefaultAudienceId(previous);
      setError("Couldn't set the default audience.");
    }
  }

  /** Delete audience; for a synced one this is a disconnect — the account goes too. */
  async function handleRemove() {
    setRemoving(true);
    setError(null);
    try {
      if (audience && !audience.is_general && !audience.is_preset) {
        const res = await fetch(`/api/audiences/${audience.id}`, { method: "DELETE" });
        if (!res.ok && res.status !== 204) throw new Error("delete failed");
      }
      if (account) {
        const res = await fetch(`/api/connected-accounts/${account.id}`, { method: "DELETE" });
        if (!res.ok && res.status !== 204) throw new Error("disconnect failed");
      }
      router.push("/audience");
      router.refresh();
    } catch {
      setError(account ? "Couldn't disconnect this account." : "Couldn't delete this audience.");
      setRemoving(false);
      setDangerOpen(false);
    }
  }

  const dangerLabel = account ? `Disconnect @${account.handle}` : "Delete audience";

  // ── Empty shell (uncalibrated audience, nothing modelled) ──────────────────
  const emptyRoom = Boolean(audience) && roster.length === 0;

  // Which source block leads the page. Hoisted out of the JSX because the blocks
  // below it need to know whether anything precedes them to space themselves.
  const scrapeSource = Boolean(
    source &&
      (source.posts.length > 0 || source.figures.length > 0 || source.pillars.length > 0),
  );
  const wordsSource = Boolean(
    audience &&
      !account &&
      !audience.is_general &&
      !audience.is_preset &&
      ((audience.calibration?.source === "description" && audience.goal_label) ||
        (audience.custom_context ?? []).length > 0),
  );
  const hasSource = scrapeSource || wordsSource;

  return (
    <div className={cn("flex flex-col", className)}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center gap-3.5">
        {/* The account's own face. The scrape always had it; the page never showed it.
            The liveness dot rides the avatar's corner instead of sitting in the text
            line — same single accent element, now attached to the thing it describes. */}
        {account && (
          <span className="relative shrink-0">
            <Avatar
              src={account.avatar_url ?? undefined}
              alt={`@${account.handle}`}
              fallback={account.handle.slice(0, 2).toUpperCase()}
              size="lg"
            />
            {account.is_primary && audience && (
              <span className="absolute -bottom-px -right-px rounded-full bg-[color:var(--charcoal-app)] p-[3px]">
                <LivenessDot />
              </span>
            )}
          </span>
        )}
        <div className="flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-1">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-foreground">
            {title}
          </h1>
          <MonoMeta parts={metaParts} />
          {realName && (
            <p className="w-full text-[13px] text-foreground-muted">{realName}</p>
          )}
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => router.push(`/audience/${audience!.id}?edit=1`)}
            className="ml-auto text-[12px] text-foreground-muted transition-colors hover:text-foreground-secondary"
          >
            Edit details
          </button>
        )}
      </header>

      <div className="mt-7 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_212px] lg:gap-12 lg:items-start">
        {/* ── Main column ──────────────────────────────────────────────────── */}
        <div className="min-w-0">
          {/* SOURCE LEADS — proof of scrape before any inference (owner-locked).
              Figures are the profile; the tiles are the posts we actually stored. */}
          {scrapeSource && source && (
              <section className={cn(ZONE, "px-5 pb-5 pt-[18px]")}>
                <p className={cn(ZONE_LABEL, "mb-4")}>Source</p>

                {source.figures.length > 0 && (
                  <div className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
                    {source.figures.map((f) => (
                      <div key={f.label}>
                        <div className="text-[26px] font-semibold tracking-[-0.02em] text-foreground tabular-nums">
                          {f.value}
                        </div>
                        <div className={cn(ZONE_LABEL, "mt-1 tracking-[0.12em]")}>{f.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {source.posts.length > 0 && (
                  <>
                    {/* "RECENT POSTS", never "N videos read": listAllPosts caps what we
                        hold, so a count here would understate a bigger scrape. The read
                        count is a provenance fact and is stated as one, below. */}
                    <p className={cn(ZONE_LABEL, "mb-2.5 mt-6")}>
                      Recent posts
                      {videosRead ? ` · ${videosRead} videos analyzed` : ""}
                    </p>
                    <div
                      className="flex gap-2 overflow-x-auto pb-1"
                      style={{
                        maskImage:
                          "linear-gradient(90deg, #000 0%, #000 94%, transparent 100%)",
                        WebkitMaskImage:
                          "linear-gradient(90deg, #000 0%, #000 94%, transparent 100%)",
                      }}
                    >
                      {source.posts.map((post) => (
                        <div
                          key={post.id}
                          className="flex h-[150px] w-[94px] shrink-0 flex-col justify-between overflow-hidden rounded-lg border border-white/[0.06] bg-[linear-gradient(165deg,#33322f_0%,#2a2927_60%,#262523_100%)] p-2.5"
                        >
                          <p className="line-clamp-6 text-[10px] leading-[1.45] text-foreground-muted">
                            {post.caption}
                          </p>
                          <span className="font-mono text-[10px] tabular-nums text-foreground-secondary">
                            {formatCount(post.views)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {source.pillars.length > 0 && (
                  /* NO BARS HERE — deliberately. A pillar is a share of what you POST;
                     a persona's share is a share of who WATCHES. Rendered as identical
                     tracks ~200px apart in one column, the two read as the same
                     quantity measured twice. The room owns the bar (it is the page's
                     subject); pillars are supporting evidence and state themselves as
                     a ranked figure list. */
                  <div className="mt-6">
                    <p className={cn(ZONE_LABEL, "mb-2.5")}>What you post</p>
                    {source.pillars.map((p) => (
                      <div
                        key={p.name}
                        className="flex items-baseline justify-between gap-4 border-t border-white/[0.05] py-2 first:border-t-0"
                      >
                        <span className="min-w-0 truncate text-[13px] text-foreground-secondary">
                          {p.name}
                        </span>
                        <span className="shrink-0 text-[13px] tabular-nums text-foreground-muted">
                          {Math.round(p.share * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

          {/* A simulated room's source is its words — same slot, same precedence. */}
          {wordsSource && audience && (
            <section className={cn(ZONE, "px-5 pb-5 pt-[18px]")}>
              <p className={cn(ZONE_LABEL, "mb-3")}>Source</p>
              {audience.calibration?.source === "description" && audience.goal_label && (
                <p className="text-[13.5px] leading-relaxed text-foreground-secondary">
                  {audience.goal_label}
                </p>
              )}
              {(audience.custom_context ?? []).length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                  {(audience.custom_context ?? []).map((c, i) => (
                    <li
                      key={i}
                      className="rounded-lg bg-white/[0.03] px-3 py-2 text-[12.5px] text-foreground-secondary"
                    >
                      {c.note}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* The empty shell states its one fact — the only state that earns colour. */}
          {emptyRoom && (
            <section className={cn(ZONE, "px-5 py-6", hasSource && "mt-6")}>
              <p className="text-[13.5px] text-[color:var(--color-warning-raw)]">Nothing yet</p>
              <p className="mt-1 text-[13px] text-foreground-muted">
                Read your @handle to fill it.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push("/audience/new")}
                className="mt-4"
              >
                Build this audience
              </Button>
            </section>
          )}

          {/* Analytics-only account — no room behind it. */}
          {!audience && account && (
            <section className={cn(ZONE, "px-5 py-6", hasSource && "mt-6")}>
              <p className="text-[13.5px] text-foreground">No audience behind this account</p>
              <p className="mt-1 text-[13px] text-foreground-muted">
                {account.platform === "tiktok"
                  ? "Build one from this handle."
                  : "Audience simulation reads TikTok accounts. This one syncs analytics."}
              </p>
              {account.platform === "tiktok" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push("/audience/new")}
                  className="mt-4"
                >
                  Build audience
                </Button>
              )}
            </section>
          )}

          {/* THE ROOM — who the scrape above turned into. Every persona, no fold:
              share is a proportional bar so the shape of the room is seen, not read.
              The bar is absolute (12% of the track = 12% of the room), which honestly
              shows an evenly-split room as evenly split; scaling to the max would
              manufacture a hierarchy the data doesn't have. */}
          {roster.length > 0 && (
            <div className={cn(hasSource && "mt-9")}>
              <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className={ZONE_LABEL}>
                  The room · {POPULATION.toLocaleString("en-US")} viewers ·{" "}
                  {roster.length} personas
                </p>
                <p className={cn(ZONE_LABEL, "opacity-60")}>{heroProvenance}</p>
              </div>

              {roster.map((row) => (
                <div
                  key={row.key}
                  className="group border-t border-white/[0.05] py-4 first:border-t-0"
                >
                  <div className="flex items-baseline gap-3">
                    <p className="min-w-0 flex-1 truncate text-[14px] font-semibold tracking-[-0.005em] text-foreground">
                      {row.name}
                    </p>
                    {row.disposition && (
                      <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.08em] text-foreground-muted">
                        {row.disposition}
                      </span>
                    )}
                    <span className="w-[36px] shrink-0 text-right text-[13px] tabular-nums text-foreground-secondary">
                      {row.sharePct}%
                    </span>
                    {editable && row.editIndex !== null && (
                      <button
                        type="button"
                        onClick={() => setEditingIndex(row.editIndex)}
                        aria-label={`Edit ${row.name}`}
                        className="pointer-coarse:opacity-100 shrink-0 rounded-md px-2 py-1 text-[12px] text-foreground-muted opacity-0 transition-opacity hover:bg-white/[0.06] hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10 group-hover:opacity-100"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {/* FULL-WIDTH ON PURPOSE — measured, not guessed. A 120px inline track
                      was tried and reverted: it rendered 18.0px for a 15% persona and
                      8.4px for a 7% one, 9.6px of spread across the whole roster, which
                      encodes nothing next to a number already reading "15%". Full width
                      gives ~93px vs ~43px — 50px of spread, five times the discrimination.
                      The empty remainder is not waste; it is the rest of the room, and the
                      slice is only legible against it. */}
                  <div className="mt-2 h-[4px] rounded-sm bg-white/[0.06]" aria-hidden="true">
                    <div
                      className="h-full rounded-sm bg-[color:var(--color-foreground-secondary)] opacity-[0.7]"
                      style={{ width: `${Math.max(row.sharePct, 1)}%` }}
                    />
                  </div>

                  {row.desc && (
                    <p className="mt-2.5 text-[13px] leading-[1.5] text-foreground-muted">
                      {row.desc}
                    </p>
                  )}
                  {row.receipt && (
                    <p className="mt-1.5 border-l border-white/[0.12] pl-2.5 text-[11.5px] leading-relaxed text-foreground-muted">
                      <span className="text-foreground-secondary">Evidence · </span>
                      {row.receipt}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <p className="mt-4 text-[12.5px] text-error">{error}</p>}
        </div>

        {/* ── Rail — one quiet fact column, no boxes ───────────────────────── */}
        <aside className="flex flex-col gap-4 lg:pt-1">
          {audience && (
            <RailGroup label="Usage">
              <Kv k="New threads">{isDefault ? "Default" : "—"}</Kv>
              <Kv k="Pinned">
                {pinnedThreads} thread{pinnedThreads === 1 ? "" : "s"}
              </Kv>
              {!isDefault && !audience.is_preset && (
                <Kv k="">
                  <button
                    type="button"
                    onClick={() => void handleSetDefault()}
                    className="border-b border-white/[0.10] text-foreground-secondary transition-colors hover:text-foreground"
                  >
                    Set default
                  </button>
                </Kv>
              )}
            </RailGroup>
          )}

          {account && (
            <RailGroup label="Sync">
              <Kv k="Refresh">Daily</Kv>
              <Kv k="Last">{synced ?? "—"}</Kv>
              {audience && editable && account.platform === "tiktok" && (
                <Kv k="">
                  <button
                    type="button"
                    onClick={() => setRecalibrateOpen(true)}
                    className="border-b border-white/[0.10] text-foreground-secondary transition-colors hover:text-foreground"
                  >
                    Re-calibrate
                  </button>
                </Kv>
              )}
            </RailGroup>
          )}

          {/* Destructive stays visible but unboxed and unlabeled — one quiet line. */}
          {(editable || (!audience && account)) && (
            <div className="border-t border-white/[0.06] pt-4">
              <button
                type="button"
                onClick={() => setDangerOpen(true)}
                className="text-[12.5px] text-error/80 transition-colors hover:text-error"
              >
                {dangerLabel}
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* ── Persona edit ─────────────────────────────────────────────────────── */}
      {editable && editingIndex !== null && audience!.personas[editingIndex] && (
        <Dialog open onOpenChange={(open) => !open && setEditingIndex(null)}>
          <DialogContent className="max-w-lg p-0">
            <PersonaEditForm
              audience={audience!}
              persona={audience!.personas[editingIndex]!}
              index={editingIndex}
              onClose={() => setEditingIndex(null)}
              onSaved={(updated) => {
                setAudience(updated);
                setEditingIndex(null);
              }}
              className="border-0 shadow-none"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* ── Re-calibrate (updates THIS audience row via audienceId) ─────────── */}
      {recalibrateOpen && audience && account && (
        <Dialog open onOpenChange={(open) => !open && setRecalibrateOpen(false)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Re-calibrate @{account.handle}</DialogTitle>
              <DialogDescription>
                Re-reads the account and rebuilds this audience&apos;s personas.
              </DialogDescription>
            </DialogHeader>
            <CalibrationFlow
              audience={audience}
              prefillHandle={account.handle}
              prefillPlatform={account.platform}
              onDone={(calibrated) => {
                setAudience(calibrated);
                setRecalibrateOpen(false);
                router.refresh();
              }}
              onSkip={() => setRecalibrateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* ── Danger confirm ───────────────────────────────────────────────────── */}
      <Dialog open={dangerOpen} onOpenChange={setDangerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {account ? `Disconnect @${account.handle}?` : `Delete ${audience?.name}?`}
            </DialogTitle>
            <DialogDescription>
              {account && audience
                ? "Removes this audience and the account's synced data. Threads pinned to it fall back to General. This can't be undone."
                : account
                  ? "Removes the account and its synced analytics. This can't be undone."
                  : "Threads pinned to this audience fall back to General. This can't be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" size="sm" disabled={removing}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" size="sm" onClick={handleRemove} disabled={removing}>
              {removing ? <Spinner size="sm" /> : account ? "Disconnect" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
