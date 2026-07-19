"use client";

/**
 * SavedItemCard — one saved item on the Library shelf, rendered as a COMPACT ECHO of the
 * thread card it came from (lane/frame Library elevation; design SoT = the shared card spine
 * in docs/subsystems/ui-skill-cards.md, sketch = public/_sketch-library.html).
 *
 * Same DNA as the thread cards:
 *   eyebrow kicker (band dot) → hero line (the real hook / Lever / title) → why-teaser →
 *   condensed proof chip (band + "8/10 stopped" + lead quote) → per-type forward action.
 *
 * The snapshot IS the originating block's props (SaveAffordance snapshot={block.props}), so
 * every field is REAL — no invented data. Type-differentiated by honest data: Reads lead with
 * the Lever; Hooks show archetype + rank; SIM types carry a proof chip; outliers are measured
 * (no band — measured ≠ simulated). The full proof-unit + live Lens stay in-thread; the card
 * re-opens there via the forward action.
 *
 * Launch/remove machinery is unchanged from P10 (CHAIN_HANDOFFS handoff + AlertDialog confirm).
 */

import { useState } from "react";
import { reportCredit402 } from "@/lib/billing/credit-wall";
import { useRouter } from "next/navigation";
import {
  DotsThree,
  ArrowRight,
  BookOpen,
  Lightbulb,
  Lightning,
  FilmSlate,
  TrendUp,
  SquaresFour,
  type Icon,
} from "@phosphor-icons/react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useDeleteSavedItem } from "@/hooks/queries/use-saved-items";
import type { SavedItem, SavedItemType } from "@/lib/shelf/shelf-repo";
import { formatCount } from "@/lib/competitors-utils";
import { cn } from "@/lib/utils";

// Per-type forward action — mirrors the thread card's forward chain step exactly
// (docs/subsystems/ui-skill-cards.md §1.7 + CHAIN_HANDOFFS pinned endpoints). The Library
// re-runs that step then re-opens the thread; types without an endpoint just re-open.
const FORWARD: Partial<Record<SavedItemType, { label: string; endpoint: string | null }>> = {
  hook: { label: "Write script →", endpoint: "/api/tools/script" },
  idea: { label: "Develop into hooks →", endpoint: "/api/tools/ideas/develop" },
  script: { label: "Test full script →", endpoint: null },
};

const TYPE_LABEL: Record<SavedItemType, string> = {
  read: "Read",
  idea: "Idea",
  hook: "Hook",
  script: "Script",
  outlier: "Outlier",
  format: "Format",
};

const TYPE_ICON: Record<SavedItemType, Icon> = {
  read: BookOpen,
  idea: Lightbulb,
  hook: Lightning,
  script: FilmSlate,
  outlier: TrendUp,
  format: SquaresFour,
};

// Band → sanctioned DATA tone (success/warning/error), used once per card (the dot + word).
// NOT the brand accent (terracotta stays liveness-only). Mirrors thread BAND_COLOR.
const BAND_TONE: Record<string, string> = {
  Strong: "var(--color-success)",
  Mixed: "var(--color-warning)",
  Weak: "var(--color-error)",
};

/** Best-effort anchor extraction from a persisted snapshot's block props. */
function anchorFromSnapshot(snapshot: Record<string, unknown>): string {
  const props = (snapshot.props as Record<string, unknown> | undefined) ?? snapshot;
  const pick = (k: string) => (typeof props[k] === "string" ? (props[k] as string) : "");
  const title = pick("title");
  const angle = pick("angle");
  const hookLine = pick("hookLine");
  if (hookLine) return hookLine;
  if (title && angle) return `${title}\n\n${angle}`;
  return title || pick("text") || "";
}

// ─── snapshot field extractors (snapshot = block props, persisted loose) ──────
type Snap = Record<string, unknown>;
const sv = (o: Snap, k: string): string => (typeof o?.[k] === "string" ? (o[k] as string) : "");
const nv = (o: Snap, k: string): number | undefined =>
  typeof o?.[k] === "number" ? (o[k] as number) : undefined;

/** Clean "{n}×" display from a measured multiplier (1 decimal under 10×, integer above). */
function formatMult(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return "";
  return m >= 10 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`;
}

/** Duration in seconds → "m:ss" cover badge ("" when unknown). Mirrors discover/outlier-tile. */
function formatDuration(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Normalised view-model — the shared spine, filled per type from real snapshot fields. */
interface CardVM {
  /** Content-type eyebrow only (Hook / Idea / Script / …) — never a segment or marketing line. */
  kicker: string;
  /** Audience/segment or short content detail — secondary muted tag, not the ALL-CAPS kicker. */
  segment?: string;
  bandColor?: string;
  rank?: number;
  heroPrefix?: string; // e.g. "Lever →" (Read)
  hero: string;
  why?: string;
  proof?: { band: string; fraction: string; quote?: string; compact: boolean };
  measured?: { mult?: string; views?: string }; // outlier — measured, no band
  coverUrl?: string; // outlier — the real scrape thumbnail (clockworks videoMeta.coverUrl)
  coverDuration?: string; // outlier — m:ss badge echoing the source tile's one cover overlay
}

/** Build the per-type view-model from the saved snapshot (the originating block's props). */
function buildVM(item: SavedItem): CardVM {
  const snap = item.snapshot ?? {};
  switch (item.item_type) {
    case "hook": {
      const band = sv(snap, "band");
      const archetype = sv(snap, "audienceArchetype");
      return {
        kicker: TYPE_LABEL.hook,
        segment: archetype || undefined,
        bandColor: BAND_TONE[band],
        rank: nv(snap, "rank"),
        hero: sv(snap, "hookLine") || item.title || "Hook",
        why: sv(snap, "mechanism"),
        proof: band
          ? { band, fraction: sv(snap, "fraction"), quote: sv(snap, "scrollQuote"), compact: false }
          : undefined,
      };
    }
    case "idea": {
      const band = sv(snap, "band");
      const angle = sv(snap, "angle");
      const fits = sv(snap, "whyItFits");
      return {
        kicker: TYPE_LABEL.idea,
        bandColor: BAND_TONE[band],
        hero: sv(snap, "title") || item.title || "Idea",
        why: [angle, fits].filter(Boolean).join(" — ") || undefined,
        proof: band
          ? { band, fraction: sv(snap, "fraction"), quote: sv(snap, "scrollQuote"), compact: true }
          : undefined,
      };
    }
    case "script": {
      const band = sv(snap, "band");
      const beats = Array.isArray(snap.beats) ? (snap.beats as Snap[]) : [];
      const opener = sv(snap, "openingBeatSeed") || (beats[0] ? sv(beats[0], "content") : "");
      return {
        kicker: TYPE_LABEL.script,
        segment: "Opener only",
        bandColor: BAND_TONE[band],
        hero: opener || item.title || "Script",
        proof: band
          ? { band, fraction: sv(snap, "fraction"), quote: sv(snap, "scrollQuote"), compact: true }
          : undefined,
      };
    }
    case "read": {
      const auds = Array.isArray(snap.audiences) ? (snap.audiences as Snap[]) : [];
      const lead = auds[0] ?? {};
      const band = sv(lead, "band");
      const lever = sv(lead, "lever");
      const persona0 = Array.isArray(lead.personas) ? (lead.personas as Snap[])[0] : undefined;
      const audienceName = sv(lead, "name");
      return {
        kicker: TYPE_LABEL.read,
        segment: audienceName || undefined,
        bandColor: BAND_TONE[band],
        heroPrefix: lever ? "Lever →" : undefined,
        hero: lever || sv(lead, "interpretation") || item.title || "Read",
        why: lever ? sv(lead, "interpretation") || undefined : undefined,
        proof: band
          ? {
              band,
              fraction: sv(lead, "fraction"),
              quote: persona0 ? sv(persona0, "quote") : "",
              compact: false,
            }
          : undefined,
      };
    }
    case "outlier": {
      // Snapshot = OutlierTileData (discover/outlier-tile): multiplier/views are NUMBERS.
      const multRaw = nv(snap, "multiplier");
      const multCore = sv(snap, "multiplier") || (multRaw != null ? formatMult(multRaw) : "");
      // D-05 honesty: never a bare multiplier — pair it with its baseline label.
      const baseline = sv(snap, "baselineLabel");
      const mult = multCore ? (baseline ? `${multCore} ${baseline}` : multCore) : "";
      const viewsRaw = nv(snap, "views");
      const views = sv(snap, "views") || (viewsRaw != null ? formatCount(viewsRaw) : "");
      const durRaw = nv(snap, "durationSeconds");
      return {
        kicker: TYPE_LABEL.outlier,
        hero: sv(snap, "caption") || item.title || "Outlier",
        measured: { mult: mult || undefined, views: views || undefined },
        coverUrl: sv(snap, "coverUrl") || undefined,
        coverDuration: durRaw != null ? formatDuration(durRaw) || undefined : undefined,
      };
    }
    default: {
      // format + any unknown — title-only fallback
      return { kicker: TYPE_LABEL[item.item_type] ?? "Saved", hero: item.title || TYPE_LABEL[item.item_type] || "Saved" };
    }
  }
}

/** Stored proof fractions occasionally carry a stray trailing token (e.g. "7/10 stop"),
 *  which rendered as "7/10 stop stopped". Keep only the clean N/M so the chip reads right. */
function fracNM(f: string): string {
  return f.match(/\d+\s*\/\s*\d+/)?.[0] ?? f;
}

/** Condensed echo of the thread <ProofUnit>: band dot+word · fraction · ribbon (+ lead quote). */
function ProofChip({
  band,
  fraction,
  quote,
}: {
  band: string;
  fraction: string;
  quote?: string;
  /** @deprecated Kept for call-site compat; quote visibility is present-or-omit only. */
  compact?: boolean;
}) {
  const tone = BAND_TONE[band];
  const m = fraction.match(/(\d+)\s*\/\s*(\d+)/);
  const pct = m && Number(m[2]) > 0 ? (Number(m[1]) / Number(m[2])) * 100 : null;
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-colors group-hover:border-white/[0.10]">
      <div className="flex items-center gap-2.5 text-[12.5px]">
        <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold" style={{ color: tone }}>
          <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: tone }} aria-hidden="true" />
          {band}
        </span>
        {fraction && (
          <span className="shrink-0 text-foreground-secondary">
            <span className="font-semibold tabular-nums text-foreground">{fracNM(fraction)}</span> stopped
          </span>
        )}
        {pct != null && (
          <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/[0.10]">
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${pct}%`, backgroundColor: "var(--color-foreground)" }}
            />
          </span>
        )}
      </div>
      {/* Quote — same position always; omit the row entirely when absent. */}
      {quote ? (
        <p className="line-clamp-1 border-l-2 border-white/[0.10] pl-2.5 text-[12px] italic leading-snug text-foreground/70">
          &ldquo;{quote}&rdquo;
        </p>
      ) : null}
    </div>
  );
}

export interface SavedItemCardProps {
  item: SavedItem;
  /** Presentation density. `card` = full echo (default, masonry grid); `row` = compact list row. */
  variant?: "card" | "row";
}

export function SavedItemCard({ item, variant = "card" }: SavedItemCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const remove = useDeleteSavedItem();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [launching, setLaunching] = useState(false);

  const forward = FORWARD[item.item_type];

  const vm = buildVM(item);
  const TypeIcon = TYPE_ICON[item.item_type] ?? SquaresFour;
  const removeTitle = item.title?.trim() || vm.hero;

  // Forward = the thread card's chain step (docs/subsystems/ui-skill-cards.md §1.7): re-run the
  // step (if it has a server endpoint), then re-open the thread. Types without an endpoint
  // (Read, Script's in-thread context handoff, format) just re-open — honest re-entry, no re-gen.
  const handleForward = async () => {
    if (launching) return;
    if (forward?.endpoint) {
      setLaunching(true);
      try {
        const anchor = anchorFromSnapshot(item.snapshot);
        const res = await fetch(forward.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anchor, platform: "tiktok" }),
        });
        if (!res.ok) {
          const err: unknown = await res.json().catch(() => null);
          if (reportCredit402(res.status, err)) {
            setLaunching(false);
            return; // wall dialog is up — do not navigate
          }
          throw new Error("Launch failed");
        }
      } catch {
        toast({ variant: "error", title: "Couldn't launch this into a thread." });
        setLaunching(false);
        return;
      }
    }
    router.push("/home");
  };

  const handleRemove = () => {
    remove.mutate(item.id, {
      onSuccess: () => toast({ variant: "success", title: "Removed from Library" }),
      onError: () => toast({ variant: "error", title: "Couldn't remove this item." }),
    });
    setConfirmOpen(false);
  };

  const onForward = () => void handleForward();
  const forwardLabel = launching ? "Launching…" : forward?.label ?? "Use in thread →";

  /** Shared CTA treatment — same weight/color/icon for card + row so the action column scans. */
  const forwardCta = (
    <button
      type="button"
      onClick={onForward}
      disabled={launching}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-foreground-secondary transition-[color,gap] hover:gap-1.5 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10 disabled:opacity-60",
      )}
      aria-label={`${forwardLabel} — ${TYPE_LABEL[item.item_type]}`}
    >
      {forwardLabel}
      {!launching && <ArrowRight size={13} weight="bold" aria-hidden="true" />}
    </button>
  );

  // en-US pinned: `undefined` takes the ambient OS/browser locale, so SSR and
  // non-English machines rendered "29. Juni" while the product voice is English.
  const timestamp = new Date(item.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  // ── Remove confirmation (shared by both variants) ──────────────────────────
  const removeDialog = (
    <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialog.Trigger asChild>
        <button
          type="button"
          className="shrink-0 rounded-[6px] p-0.5 text-foreground-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
          aria-label="Item options"
        >
          <DotsThree size={20} weight="bold" />
        </button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0"
          style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
        />
        <AlertDialog.Content
          className="fixed left-[50%] top-[50%] z-[var(--z-modal)] w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-xl border border-white/[0.06] p-6 shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          style={{ backgroundColor: "rgba(17, 18, 20, 0.95)" }}
        >
          <AlertDialog.Title className="text-lg font-semibold text-foreground">
            Remove from Library?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-foreground-secondary">
            This takes &ldquo;{removeTitle}&rdquo; off your Library. It won&rsquo;t delete the original.
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Keep</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="destructive" onClick={handleRemove}>
                Remove
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );

  // ── Compact list row ───────────────────────────────────────────────────────
  if (variant === "row") {
    const meta = vm.measured
      ? `${vm.measured.mult ?? ""}${vm.measured.views ? ` · ${vm.measured.views} views` : ""}`.replace(/^ · /, "")
      : vm.proof
        ? `${vm.proof.band}${vm.proof.fraction ? ` · ${fracNM(vm.proof.fraction)} stopped` : ""}`
        : "";
    return (
      <div className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]">
        <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-surface-elevated text-foreground-muted">
          <TypeIcon size={15} />
          {vm.bandColor && (
            <span
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-surface"
              style={{ backgroundColor: vm.bandColor }}
              aria-hidden="true"
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-foreground">
            {vm.heroPrefix ? <span className="text-foreground">{vm.heroPrefix} </span> : null}
            {vm.hero}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-foreground-muted">
            <span>{TYPE_LABEL[item.item_type]}</span>
            {vm.segment ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{vm.segment}</span>
              </>
            ) : null}
            {meta && (
              <>
                <span aria-hidden="true">·</span>
                <span style={vm.proof ? { color: vm.bandColor } : undefined}>{meta}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {forwardCta}
          <span className="w-[52px] text-right text-[11.5px] tabular-nums text-foreground-muted">{timestamp}</span>
          {removeDialog}
        </div>
      </div>
    );
  }

  // ── Full echo card (default — masonry grid) ────────────────────────────────
  return (
    <div className="elev-lift group flex break-inside-avoid flex-col overflow-hidden rounded-[var(--radius-lg)] border border-white/[0.06] bg-surface hover:border-white/[0.10]">
      {/* Cover banner (outlier) — the real scrape thumbnail (clockworks videoMeta.coverUrl).
          Additive: renders ONLY when coverUrl is present, so a pre-cover save degrades to the
          text-first echo. Capped height — a full 9:16 in a masonry column would tower; object-cover
          crops to a clean banner. A broken/expired CDN URL hides the <img> (the bg shows). */}
      {vm.coverUrl && (
        <div className="relative h-44 w-full overflow-hidden border-b border-white/[0.06] bg-white/[0.04]">
          {/* eslint-disable-next-line @next/next/no-img-element -- ephemeral CDN cover, not a static asset */}
          <img
            src={vm.coverUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-90"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          {/* Duration badge — echoes the source outlier-tile's one cover overlay (m:ss), kept
              non-redundant with the views in the measured strip below. White-on-scrim is the
              house video-badge convention (matches discover/outlier-tile exactly). */}
          {vm.coverDuration && (
            <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white/90">
              {vm.coverDuration}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2.5 p-4">
        {/* Eyebrow — content-type kicker (ALL-CAPS) · optional segment tag · rank + remove */}
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <TypeIcon size={13} className="shrink-0 text-foreground-muted" aria-hidden="true" />
            {vm.bandColor && (
              <span
                className="h-[6px] w-[6px] shrink-0 rounded-full"
                style={{ backgroundColor: vm.bandColor }}
                aria-hidden="true"
              />
            )}
            <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-foreground-muted">
              {vm.kicker}
            </span>
            {vm.segment ? (
              <span className="min-w-0 truncate rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-foreground-muted">
                {vm.segment}
              </span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {vm.rank != null && (
              <span className="text-[11.5px] font-semibold tabular-nums text-foreground-muted">#{vm.rank}</span>
            )}
            {removeDialog}
          </span>
        </div>

        {/* Hero — the real content (hook / Lever / title), reads first */}
        <p className="line-clamp-2 text-[15px] font-semibold leading-[1.34] tracking-[-0.01em] text-foreground">
          {vm.heroPrefix && <span className="font-bold">{vm.heroPrefix} </span>}
          {vm.hero}
        </p>

        {/* Why-teaser */}
        {vm.why && (
          <p className="line-clamp-2 text-[12.5px] leading-relaxed text-foreground-muted">
            {item.item_type === "hook" && <span>Why — </span>}
            {vm.why}
          </p>
        )}

        {/* Proof chip (SIM types) OR measured strip (outlier) */}
        {vm.proof && <ProofChip {...vm.proof} />}
        {vm.measured && (vm.measured.mult || vm.measured.views) && (
          <div className="flex items-center gap-3 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-foreground-muted">
            {vm.measured.mult && <span className="text-[13px] font-bold text-foreground">{vm.measured.mult}</span>}
            {vm.measured.views && (
              <span>
                views <b className="font-semibold tabular-nums text-foreground-secondary">{vm.measured.views}</b>
              </span>
            )}
            <span>measured</span>
          </div>
        )}
      </div>

      {/* Footer — date + forward action */}
      <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-2.5">
        <span className="text-[11.5px] tabular-nums text-foreground-muted">{timestamp}</span>
        {forwardCta}
      </div>
    </div>
  );
}
