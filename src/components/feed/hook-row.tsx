"use client";

/**
 * HookRow — one full-width row in the Hooks vault (Discover Feed UI-refinement).
 *
 * Left: a neutral thumbnail (we don't carry cover art for seed hooks — a quote glyph,
 * never a broken image). Center: the hook TEMPLATE (or filled example, per the vault's
 * "Showing format" toggle) + "Inspired by @handle". Right: the signal cluster — a neutral
 * category chip (adapted from Sandcastles' purple to our restrained matte), the semantic
 * outlier pill (green ▲ / red ▼), a views pill, and a favorite heart (the surface's one
 * accent — terracotta when favorited).
 */
import { Quotes, Eye, Heart, TrendUp, TrendDown } from "@phosphor-icons/react";
import { formatCount } from "@/lib/competitors-utils";
import type { DefaultHook } from "@/lib/hooks/default-hooks";
import { cn } from "@/lib/utils";

const PILL = "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums";

function formatMultiplier(m: number): string {
  return m >= 10 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`;
}

/** The outlier pill — green ▲ above baseline, red ▼ below, neutral at parity. */
function OutlierPill({ m }: { m: number }) {
  if (!Number.isFinite(m) || m <= 0) return null;
  const label = formatMultiplier(m);
  if (m > 1.05) {
    return (
      <span className={cn(PILL, "bg-success/10 text-success")}>
        <TrendUp size={12} weight="bold" />
        {label}
      </span>
    );
  }
  if (m < 0.95) {
    return (
      <span className={cn(PILL, "bg-error/10 text-error")}>
        <TrendDown size={12} weight="bold" />
        {label}
      </span>
    );
  }
  return <span className={cn(PILL, "bg-white/[0.06] text-foreground-secondary")}>{label}</span>;
}

interface HookRowProps {
  hook: DefaultHook;
  showTemplate: boolean;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
}

export function HookRow({ hook, showTemplate, favorite, onToggleFavorite }: HookRowProps) {
  return (
    <article className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-background-elevated p-3 transition-colors hover:border-white/[0.12]">
      {/* Thumbnail (neutral — no cover art for seed hooks). */}
      <div className="flex aspect-[3/4] w-14 shrink-0 items-center justify-center rounded-lg bg-white/[0.03] text-foreground-muted">
        <Quotes size={18} weight="fill" className="opacity-50" />
      </div>

      {/* Hook template / example + inspired-by. */}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm text-foreground">
          {showTemplate ? hook.template : hook.example}
        </p>
        <p className="mt-1 truncate text-xs text-foreground-muted">
          Inspired by @{hook.inspiredBy}
        </p>
      </div>

      {/* Signal cluster. */}
      <div className="flex shrink-0 items-center gap-2">
        <span className={cn(PILL, "hidden bg-white/[0.06] text-foreground-secondary sm:inline-flex")}>
          {hook.category}
        </span>
        <OutlierPill m={hook.multiplier} />
        <span className={cn(PILL, "bg-white/[0.06] text-foreground-secondary")}>
          <Eye size={12} weight="fill" className="opacity-70" />
          {formatCount(hook.views)}
        </span>
        <button
          type="button"
          onClick={() => onToggleFavorite(hook.id)}
          aria-pressed={favorite}
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
          className={cn(
            "shrink-0 rounded-lg p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
            favorite
              ? "text-[color:var(--color-accent)] hover:bg-white/[0.04]"
              : "text-foreground-muted hover:bg-white/[0.04] hover:text-foreground",
          )}
        >
          <Heart size={16} weight={favorite ? "fill" : "regular"} />
        </button>
      </div>
    </article>
  );
}
