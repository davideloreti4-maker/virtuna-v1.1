"use client";

/**
 * DiscoverFilters — the in-page filter column beside the outliers grid.
 *
 * Modelled on the owner's Sandcastles reference (2026-08-04): a panel that lives IN the
 * content area to the left of the grid, not a global sidebar and not a modal.
 *
 * Every control here was checked against the corpus before it was drawn — the surface has
 * already shipped one set of tabs over columns that were empty, and the lesson recorded from
 * that audit is to query what a field actually holds before rendering a control for it.
 * Measured over all 532 rows on 2026-08-04:
 *
 *   views          532/532 · 691 → 879,300,000        → range control, real
 *   engagement     531/532 · 0 → 0.24                 → range control, but capped at 25%,
 *                                                       NOT 0-100% (the reference's range
 *                                                       would leave three quarters dead)
 *   platform       3 real values · 63% ig / 33% tt / 4% yt → select, real
 *   posted_at      532/532 · 2020-05-05 → 2026-06-10  → age control in YEARS by default
 *   multiplier     396/532 — 136 rows carry NO baseline
 *   creator_handle 413 distinct
 *   niche 17 · format 20 · archetype 13 · editing_style 30
 *
 * Two of the reference's controls are deliberately NOT here:
 *   · "Status: Analyzed / Unanalyzed" — 524 of 532 rows are extracted, so the control is a
 *     constant wearing a checkbox.
 *   · a relative "Posted in last N days/weeks" default — the corpus is FROZEN (newest post
 *     2026-06-10, one bulk insert, the ingest crons are not scheduled). Defaulting to days
 *     or weeks would render an empty grid and read as a broken page. The unit select still
 *     offers them; it just does not open there.
 *
 * ⚠️ The outlier-score control filters to rows that HAVE a baseline. 136 rows make no claim
 * by design (hasKnownBaseline → no basis, no number), and a numeric range silently treating
 * them as 0× would be exactly the fabrication the honesty gate exists to prevent. The panel
 * says so inline rather than dropping a quarter of the library without a word.
 */

import { useId } from "react";
import { CaretDown, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type AgeUnit = "days" | "weeks" | "months" | "years";

export interface DiscoverFilterState {
  creator: string;
  platform: string;
  niche: string;
  minViews: string;
  maxViews: string;
  minMultiplier: string;
  maxMultiplier: string;
  minEngagement: string;
  maxEngagement: string;
  age: string;
  ageUnit: AgeUnit;
}

export const EMPTY_FILTERS: DiscoverFilterState = {
  creator: "",
  platform: "",
  niche: "",
  minViews: "",
  maxViews: "",
  minMultiplier: "",
  maxMultiplier: "",
  minEngagement: "",
  maxEngagement: "",
  age: "",
  ageUnit: "years",
};

const AGE_UNITS: AgeUnit[] = ["days", "weeks", "months", "years"];

const DAYS_PER_UNIT: Record<AgeUnit, number> = {
  days: 1,
  weeks: 7,
  months: 30,
  years: 365,
};

/** How many fields are actually narrowing the grid — drives the "Clear" affordance and the
 *  count badge on the toolbar's Filters button. */
export function activeFilterCount(f: DiscoverFilterState): number {
  return (Object.keys(EMPTY_FILTERS) as (keyof DiscoverFilterState)[]).filter(
    (k) => k !== "ageUnit" && f[k] !== "",
  ).length;
}

const toNum = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * The one place a filter state meets a row. Exported so the panel and its test agree on
 * semantics rather than each describing them.
 *
 * `engagement` arrives as a FRACTION (0.024) and the control is in PERCENT (2.4) — the
 * conversion lives here, once, because splitting it across the input and the predicate is
 * how a filter ends up off by 100×.
 */
export function matchesFilters(
  v: {
    handle: string | null;
    platform: string | null;
    niche: string | null;
    views: number;
    multiplier: number | null;
    engagement: number | null;
    postedAt: string | null;
  },
  f: DiscoverFilterState,
  now: number = Date.now(),
): boolean {
  if (f.creator && v.handle !== f.creator) return false;
  if (f.platform && v.platform !== f.platform) return false;
  if (f.niche && v.niche !== f.niche) return false;

  const minViews = toNum(f.minViews);
  if (minViews !== null && v.views < minViews) return false;
  const maxViews = toNum(f.maxViews);
  if (maxViews !== null && v.views > maxViews) return false;

  // A row with no baseline makes no claim. Touching either multiplier bound narrows to the
  // rows that DO carry one rather than scoring the silent ones as zero.
  const minMult = toNum(f.minMultiplier);
  const maxMult = toNum(f.maxMultiplier);
  if (minMult !== null || maxMult !== null) {
    if (v.multiplier === null) return false;
    if (minMult !== null && v.multiplier < minMult) return false;
    if (maxMult !== null && v.multiplier > maxMult) return false;
  }

  const minEng = toNum(f.minEngagement);
  const maxEng = toNum(f.maxEngagement);
  if (minEng !== null || maxEng !== null) {
    if (v.engagement === null) return false;
    const pct = v.engagement * 100;
    if (minEng !== null && pct < minEng) return false;
    if (maxEng !== null && pct > maxEng) return false;
  }

  const age = toNum(f.age);
  if (age !== null && age > 0) {
    if (!v.postedAt) return false;
    const posted = Date.parse(v.postedAt);
    if (!Number.isFinite(posted)) return false;
    if (posted < now - age * DAYS_PER_UNIT[f.ageUnit] * 86_400_000) return false;
  }

  return true;
}

export function DiscoverFilters({
  value,
  onChange,
  creators,
  platforms,
  niches,
  onClose,
}: {
  value: DiscoverFilterState;
  onChange: (next: DiscoverFilterState) => void;
  creators: string[];
  platforms: string[];
  niches: string[];
  /** Dismiss the panel. The panel is a disclosure at EVERY width now (2026-08-16), so the
   *  close affordance is too — it used to be `lg:hidden` because from `lg` up the panel was
   *  permanent and had nothing to close back to. */
  onClose?: () => void;
}) {
  const set = <K extends keyof DiscoverFilterState>(key: K, v: DiscoverFilterState[K]) =>
    onChange({ ...value, [key]: v });

  const active = activeFilterCount(value);

  return (
    <aside
      aria-label="Filter outliers"
      className="rounded-xl border border-border bg-surface-elevated p-4"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-micro font-semibold uppercase tracking-wider text-foreground-muted">
          Filters
        </h2>
        <div className="flex items-center gap-1">
          {active > 0 ? (
            <button
              type="button"
              onClick={() => onChange({ ...EMPTY_FILTERS, ageUnit: value.ageUnit })}
              className="rounded-md px-1.5 py-0.5 text-caption font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              className="rounded-md p-1 text-foreground-muted transition-colors hover:text-foreground"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3.5">
        <Field label="Creator">
          <Select
            value={value.creator}
            onChange={(v) => set("creator", v)}
            placeholder="All creators"
            options={creators.map((c) => ({ value: c, label: `@${c}` }))}
          />
        </Field>

        <Field label="Niche">
          <Select
            value={value.niche}
            onChange={(v) => set("niche", v)}
            placeholder="All niches"
            options={niches.map((n) => ({ value: n, label: titleCase(n) }))}
          />
        </Field>

        <Field label="Platform">
          <Select
            value={value.platform}
            onChange={(v) => set("platform", v)}
            placeholder="All platforms"
            options={platforms.map((p) => ({ value: p, label: titleCase(p) }))}
          />
        </Field>

        <Field label="Views">
          <Range
            min={value.minViews}
            max={value.maxViews}
            onMin={(v) => set("minViews", v)}
            onMax={(v) => set("maxViews", v)}
            minPlaceholder="0"
            maxPlaceholder="Any"
          />
        </Field>

        {/* No "only baselined videos" caveat here on purpose. The predicate DOES exclude
            rows with no baseline (see matchesFilters), but the pool this panel filters is
            already `proven` — every row in it carries one — so the note would
            warn about an exclusion that cannot occur in this tab. The rule stays enforced in
            code and covered by test for whenever this panel filters a wider pool. */}
        <Field label="Outlier score">
          <Range
            min={value.minMultiplier}
            max={value.maxMultiplier}
            onMin={(v) => set("minMultiplier", v)}
            onMax={(v) => set("maxMultiplier", v)}
            minPlaceholder="3x"
            maxPlaceholder="100x"
          />
        </Field>

        <Field label="Engagement">
          {/* Capped at the corpus maximum (24%), not 100% — a control whose track is three
              quarters unreachable teaches the wrong range on first use. */}
          <Range
            min={value.minEngagement}
            max={value.maxEngagement}
            onMin={(v) => set("minEngagement", v)}
            onMax={(v) => set("maxEngagement", v)}
            minPlaceholder="0%"
            maxPlaceholder="25%"
          />
        </Field>

        <Field label="Posted in last">
          {/* The unit select needs a fixed, generous basis: at an even split "Years" clipped
              to "Ye" behind the caret. The amount input takes the remainder. */}
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              value={value.age}
              onChange={(e) => set("age", e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Any"
              aria-label="Posted in last, amount"
              className={cn(inputClass, "min-w-0 flex-1")}
            />
            <div className="w-[104px] shrink-0">
              <Select
                value={value.ageUnit}
                onChange={(v) => set("ageUnit", (v || "years") as AgeUnit)}
                placeholder="Years"
                allowEmpty={false}
                options={AGE_UNITS.map((u) => ({ value: u, label: titleCase(u) }))}
              />
            </div>
          </div>
        </Field>
      </div>
    </aside>
  );
}

const inputClass =
  "h-9 w-full min-w-0 rounded-lg border border-border bg-surface-sunken px-2.5 text-label text-foreground outline-none transition-colors placeholder:text-foreground-muted focus:border-border-hover";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-caption font-medium text-foreground-secondary">{label}</p>
      {children}
    </div>
  );
}

function Range({
  min,
  max,
  onMin,
  onMax,
  minPlaceholder,
  maxPlaceholder,
}: {
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  minPlaceholder: string;
  maxPlaceholder: string;
}) {
  // Digits and one decimal point: the multiplier and engagement bounds are fractional
  // (3.5x, 2.4%), so a digits-only strip would silently make them integer-only.
  const clean = (v: string) => v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
  return (
    <div className="flex items-center gap-2">
      <input
        inputMode="decimal"
        value={min}
        onChange={(e) => onMin(clean(e.target.value))}
        placeholder={minPlaceholder}
        aria-label="Minimum"
        className={inputClass}
      />
      <span className="shrink-0 text-caption text-foreground-muted">–</span>
      <input
        inputMode="decimal"
        value={max}
        onChange={(e) => onMax(clean(e.target.value))}
        placeholder={maxPlaceholder}
        aria-label="Maximum"
        className={inputClass}
      />
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
  allowEmpty = true,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  allowEmpty?: boolean;
}) {
  const id = useId();
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
        className={cn(
          inputClass,
          "cursor-pointer appearance-none pr-7",
          !value && "text-foreground-muted",
        )}
      >
        {allowEmpty ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <CaretDown
        size={12}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted"
      />
    </div>
  );
}

const titleCase = (s: string) =>
  s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
