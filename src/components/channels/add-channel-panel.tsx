"use client";

/**
 * AddChannelPanel — Discover Feed Phase 1.2 (UI-refinement toward Sandcastles).
 *
 * The four ways into the watchlist, as a full-width tab bar over a big "input card":
 *  - Suggested : creator-strategy cards (2-col) — click a card to add (Added ✓ on track)
 *  - Describe  : niche textarea + Platform / Account-size + Search ⏎ (suggest stub)
 *  - Search    : handle/name search over the shared corpus + Platform / Account-size
 *  - Add URL   : BULK textarea (newline/comma) + Parse ⏎ → ingest+track each w/ progress
 *
 * Presentational over the add flow: onAdd(handle) for single adds, addChannelAsync for
 * the Add-URL bulk runner (per-URL progress lives here). Flat-warm matte, no coral — Add
 * is a quiet affordance; the brand color only appears on the platform badge.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  MagnifyingGlass,
  Sparkle,
  Check,
  CircleNotch,
  ArrowElbowDownLeft,
  X,
} from "@phosphor-icons/react";
import { PlatformAvatar } from "./platform-avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/competitors-utils";
import { useChannelSearch } from "@/hooks/queries/use-channels";
import {
  suggestedByCategory,
  SUGGESTED_CATEGORIES,
} from "@/lib/channels/suggested-channels";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/10";

/** The big elevated input box shared by Describe / Search / Add URL. */
const INPUT_CARD =
  "rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors focus-within:border-white/[0.12]";

/** A bare textarea styled to match the Input primitive (matte, 5% surface). */
const TEXTAREA_CLASS = cn(
  "w-full resize-none rounded-lg border border-white/5 px-3 py-2.5 text-[14px]",
  "text-foreground placeholder:text-foreground-muted transition-colors",
  "hover:border-white/10 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-border-hover",
);
const TEXTAREA_STYLE = { backgroundColor: "rgba(255,255,255,0.05)" } as const;

const PLATFORM_OPTIONS = [
  { value: "all", label: "All platforms" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
];

const ACCOUNT_SIZES = [
  { value: "any", label: "Any size", min: 0, max: Infinity },
  { value: "nano", label: "Nano · <10K", min: 0, max: 10_000 },
  { value: "micro", label: "Micro · 10K–100K", min: 10_000, max: 100_000 },
  { value: "mid", label: "Mid · 100K–1M", min: 100_000, max: 1_000_000 },
  { value: "large", label: "Large · 1M+", min: 1_000_000, max: Infinity },
] as const;
const ACCOUNT_SIZE_OPTIONS = ACCOUNT_SIZES.map((s) => ({ value: s.value, label: s.label }));

/** Per-URL bulk-add result row. */
type BulkStatus = "pending" | "ok" | "error";
interface BulkRow {
  input: string;
  status: BulkStatus;
  message?: string;
}
export interface AddChannelResultLite {
  ok: boolean;
  handle: string;
  message?: string;
}

interface AddChannelPanelProps {
  trackedHandles: Set<string>;
  /** Normalized handle currently being added (matches Suggested/Search items). */
  pendingHandle: string | null;
  /** True while any single add is in flight (drives the Add-URL button, whose input is raw). */
  isAdding: boolean;
  onAdd: (handle: string) => void;
  /** Await-able single add for the Add-URL bulk runner (returns per-URL outcome). */
  addChannelAsync: (handle: string) => Promise<AddChannelResultLite>;
}

// ── The footer Platform / Account-size control row (Describe + Search) ─────────
function FilterRow({
  platform,
  onPlatform,
  size,
  onSize,
  trailing,
}: {
  platform: string;
  onPlatform: (v: string) => void;
  size: string;
  onSize: (v: string) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="w-36">
        <Select size="sm" options={PLATFORM_OPTIONS} value={platform} onChange={onPlatform} />
      </div>
      <div className="w-44">
        <Select size="sm" options={ACCOUNT_SIZE_OPTIONS} value={size} onChange={onSize} />
      </div>
      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  );
}

/** The quiet "Search ⏎" / "Parse ⏎" submit affordance. */
function SubmitHint({
  label,
  onClick,
  disabled,
  pending,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium",
        "text-foreground-secondary hover:bg-white/[0.04] hover:text-foreground transition-colors",
        "disabled:opacity-40 disabled:hover:bg-transparent",
        focusRing,
      )}
    >
      {pending ? <CircleNotch size={14} className="animate-spin" /> : null}
      {label}
      {!pending && <ArrowElbowDownLeft size={14} weight="bold" className="opacity-70" />}
    </button>
  );
}

export function AddChannelPanel({
  trackedHandles,
  pendingHandle,
  isAdding,
  onAdd,
  addChannelAsync,
}: AddChannelPanelProps) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-background-elevated p-5">
      <Tabs defaultValue="suggested">
        <TabsList className="grid w-full grid-cols-4 rounded-xl">
          <TabsTrigger value="suggested" className="w-full">
            Suggested
          </TabsTrigger>
          <TabsTrigger value="describe" className="w-full">
            Describe
          </TabsTrigger>
          <TabsTrigger value="search" className="w-full">
            Search
          </TabsTrigger>
          <TabsTrigger value="addUrl" className="w-full">
            Add URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggested">
          <SuggestedTab
            trackedHandles={trackedHandles}
            pendingHandle={pendingHandle}
            onAdd={onAdd}
          />
        </TabsContent>
        <TabsContent value="describe">
          <DescribeTab />
        </TabsContent>
        <TabsContent value="search">
          <SearchTab
            trackedHandles={trackedHandles}
            pendingHandle={pendingHandle}
            onAdd={onAdd}
          />
        </TabsContent>
        <TabsContent value="addUrl">
          <AddUrlTab isAdding={isAdding} addChannelAsync={addChannelAsync} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

// ── Suggested ────────────────────────────────────────────────────────────────
// Creator-strategy sections (uppercase header + 2-col cards). The WHOLE card is the
// add affordance (Sandcastles pattern): click to ingest+track, "Added ✓" once tracked.
function SuggestedTab({
  trackedHandles,
  pendingHandle,
  onAdd,
}: {
  trackedHandles: Set<string>;
  pendingHandle: string | null;
  onAdd: (handle: string) => void;
}) {
  const grouped = useMemo(() => suggestedByCategory(), []);

  return (
    <div className="max-h-[560px] space-y-6 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {SUGGESTED_CATEGORIES.map((cat) => (
        <div key={cat} className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
            {cat}
          </p>
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {grouped[cat].map((s) => {
              const tracked = trackedHandles.has(s.handle);
              const pending = pendingHandle === s.handle;
              return (
                <li key={s.handle}>
                  <button
                    type="button"
                    onClick={() => !tracked && !pending && onAdd(s.handle)}
                    disabled={tracked || pending}
                    aria-label={tracked ? `${s.displayName} added` : `Add ${s.displayName}`}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] p-3.5 text-left",
                      "transition-colors hover:border-white/[0.12] hover:bg-white/[0.02]",
                      "disabled:cursor-default disabled:hover:border-white/[0.06] disabled:hover:bg-transparent",
                      focusRing,
                    )}
                  >
                    <PlatformAvatar
                      fallback={s.displayName.slice(0, 2).toUpperCase()}
                      platform={s.platform}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {s.displayName}
                      </p>
                      <p className="truncate text-xs tabular-nums text-foreground-muted">
                        {formatCount(s.followers)} followers · {formatCount(s.views)} views
                      </p>
                    </div>
                    <span className="shrink-0 text-foreground-muted">
                      {tracked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground-secondary">
                          <Check size={14} weight="bold" /> Added
                        </span>
                      ) : pending ? (
                        <CircleNotch size={16} className="animate-spin" />
                      ) : (
                        <Plus
                          size={16}
                          weight="bold"
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ── Describe (suggest stub) ───────────────────────────────────────────────────
function DescribeTab() {
  const [value, setValue] = useState("");
  const [platform, setPlatform] = useState("all");
  const [size, setSize] = useState("any");
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (value.trim()) setSubmitted(true);
  };

  return (
    <div className="space-y-4">
      <div className={INPUT_CARD}>
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSubmitted(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder="Describe the content you're looking for…"
          className={TEXTAREA_CLASS}
          style={TEXTAREA_STYLE}
          aria-label="Describe the content you're looking for"
        />
        <FilterRow
          platform={platform}
          onPlatform={setPlatform}
          size={size}
          onSize={setSize}
          trailing={<SubmitHint label="Search" onClick={submit} disabled={!value.trim()} />}
        />
      </div>

      <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.06] text-foreground-muted">
          <Sparkle size={20} />
        </div>
        <p className="max-w-sm text-sm text-foreground-muted">
          {submitted
            ? "Describe-to-suggest is coming soon — use Suggested, Search, or Add URL for now."
            : "Describe the type of content you're looking for and press Enter to get results."}
        </p>
      </div>
    </div>
  );
}

// ── Search ───────────────────────────────────────────────────────────────────
function SearchTab({
  trackedHandles,
  pendingHandle,
  onAdd,
}: {
  trackedHandles: Set<string>;
  pendingHandle: string | null;
  onAdd: (handle: string) => void;
}) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [platform, setPlatform] = useState("all");
  const [size, setSize] = useState("any");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useChannelSearch(debouncedQ);
  const hasQuery = debouncedQ.trim().length >= 2;
  const cleanedQ = debouncedQ.replace(/^@/, "").trim().toLowerCase();

  // Platform is forward-looking (the corpus is TikTok today); Account-size client-filters.
  const bucket = ACCOUNT_SIZES.find((s) => s.value === size) ?? ACCOUNT_SIZES[0];
  const results = (data?.results ?? []).filter((r) => {
    if (platform !== "all" && platform !== "tiktok") return false;
    const f = r.followerCount ?? 0;
    return f >= bucket.min && f < bucket.max;
  });

  return (
    <div className="space-y-4">
      <div className={INPUT_CARD}>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by channel handle or name…"
          leftIcon={<MagnifyingGlass size={16} />}
          loading={isFetching && hasQuery}
          aria-label="Search channels"
        />
        <FilterRow platform={platform} onPlatform={setPlatform} size={size} onSize={setSize} />
      </div>

      {hasQuery && results.length > 0 && (
        <ul className="flex flex-col gap-1">
          {results.map((r) => (
            <li
              key={r.handle}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.02]"
            >
              <PlatformAvatar
                src={r.avatarUrl ?? undefined}
                fallback={(r.displayName ?? r.handle).slice(0, 2).toUpperCase()}
                platform="tiktok"
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {r.displayName ?? `@${r.handle}`}
                </p>
                <p className="truncate text-xs tabular-nums text-foreground-muted">
                  {/* followerCount can be null (corpus row without a profile snapshot)
                      — drop the segment rather than render "-- followers". */}
                  @{r.handle}
                  {r.followerCount != null && (
                    <> · {formatCount(r.followerCount)} followers</>
                  )}
                </p>
              </div>
              <AddButton
                handle={r.handle}
                tracked={trackedHandles.has(r.handle)}
                pending={pendingHandle === r.handle}
                onAdd={onAdd}
              />
            </li>
          ))}
        </ul>
      )}

      {hasQuery && !isFetching && results.length === 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] px-3 py-2.5">
          <p className="min-w-0 truncate text-xs text-foreground-muted">
            No matches in your corpus — add{" "}
            <span className="text-foreground-secondary">@{cleanedQ}</span> fresh?
          </p>
          <AddButton
            handle={cleanedQ}
            tracked={trackedHandles.has(cleanedQ)}
            pending={pendingHandle === cleanedQ}
            onAdd={onAdd}
          />
        </div>
      )}

      {!hasQuery && (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.06] text-foreground-muted">
            <MagnifyingGlass size={20} />
          </div>
          <p className="max-w-sm text-sm text-foreground-muted">
            Start typing a channel handle or name to search.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Add URL (bulk) ─────────────────────────────────────────────────────────────
function AddUrlTab({
  isAdding,
  addChannelAsync,
}: {
  isAdding: boolean;
  addChannelAsync: (handle: string) => Promise<AddChannelResultLite>;
}) {
  const [value, setValue] = useState("");
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<BulkRow[]>([]);

  const parseTokens = (raw: string): string[] => {
    const seen = new Set<string>();
    return raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !seen.has(s) && (seen.add(s), true));
  };

  const run = async () => {
    const tokens = parseTokens(value);
    if (tokens.length === 0 || running) return;
    setRunning(true);
    setRows(tokens.map((t) => ({ input: t, status: "pending" as const })));
    for (let i = 0; i < tokens.length; i++) {
      const res = await addChannelAsync(tokens[i]!);
      setRows((prev) =>
        prev.map((row, idx) =>
          idx === i
            ? { ...row, status: res.ok ? "ok" : "error", message: res.message }
            : row,
        ),
      );
    }
    setRunning(false);
  };

  const tokenCount = parseTokens(value).length;

  return (
    <div className="space-y-4">
      <div className={INPUT_CARD}>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void run();
            }
          }}
          rows={4}
          placeholder="Paste full channel URLs or @handles separated by newline or comma…"
          className={TEXTAREA_CLASS}
          style={TEXTAREA_STYLE}
          aria-label="Channel URLs to add"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-foreground-muted">
            {tokenCount > 0 ? `${tokenCount} to add` : "We scrape each channel once."}
          </span>
          <SubmitHint
            label="Parse"
            onClick={() => void run()}
            disabled={tokenCount === 0 || running || isAdding}
            pending={running}
          />
        </div>
      </div>

      {rows.length > 0 && (
        <ul className="flex flex-col gap-1">
          {rows.map((row, i) => (
            <li
              key={`${row.input}-${i}`}
              className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] px-3 py-2"
            >
              <span className="shrink-0">
                {row.status === "pending" ? (
                  <CircleNotch size={14} className="animate-spin text-foreground-muted" />
                ) : row.status === "ok" ? (
                  <Check size={14} weight="bold" className="text-success" />
                ) : (
                  <X size={14} weight="bold" className="text-error" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-foreground-secondary">
                {row.input}
              </span>
              {row.status === "error" && row.message && (
                <span className="shrink-0 truncate text-xs text-error/90" title={row.message}>
                  {row.message}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Shared add affordance (Search list rows) ───────────────────────────────────
function AddButton({
  handle,
  tracked,
  pending,
  onAdd,
}: {
  handle: string;
  tracked: boolean;
  pending: boolean;
  onAdd: (handle: string) => void;
}) {
  if (tracked) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground-muted">
        <Check size={14} weight="bold" />
        Added
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onAdd(handle)}
      disabled={pending}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium",
        "bg-white/[0.06] text-foreground hover:bg-white/[0.1] transition-colors",
        "disabled:opacity-60",
        focusRing,
      )}
    >
      {pending ? <CircleNotch size={14} className="animate-spin" /> : <Plus size={14} weight="bold" />}
      {pending ? "Adding" : "Add"}
    </button>
  );
}
