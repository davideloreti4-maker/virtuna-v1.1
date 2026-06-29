"use client";

/**
 * AddChannelPanel — Discover Feed Phase 1.2.
 *
 * The four ways into the watchlist, as tabs:
 *  - Add URL   : paste a TikTok profile URL or @handle → ingest + track
 *  - Search    : search the shared channel corpus → one-click track an existing channel
 *  - Suggested : a curated seed grouped by category (suggested-channels.ts)
 *  - Describe  : niche → suggestions (Phase 1b, stubbed honestly)
 *
 * The panel is presentational over the add flow: it calls onAdd(handle) and reflects
 * trackedHandles / pendingHandle. Flat-warm matte, no coral — Add is a quiet primary.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  MagnifyingGlass,
  Sparkle,
  PenNib,
  Check,
  LinkSimple,
  CircleNotch,
} from "@phosphor-icons/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/competitors-utils";
import { useChannelSearch } from "@/hooks/queries/use-channels";
import {
  suggestedByCategory,
  SUGGESTED_CATEGORIES,
  type SuggestedCategory,
} from "@/lib/channels/suggested-channels";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/10";

interface AddChannelPanelProps {
  trackedHandles: Set<string>;
  /** Normalized handle currently being added (matches Suggested/Search items). */
  pendingHandle: string | null;
  /** True while any add is in flight (drives the Add-URL button, whose input is raw). */
  isAdding: boolean;
  onAdd: (handle: string) => void;
}

/** Add / Adding… / Added — the per-channel affordance shared by Search + Suggested. */
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

export function AddChannelPanel({
  trackedHandles,
  pendingHandle,
  isAdding,
  onAdd,
}: AddChannelPanelProps) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-background-elevated p-5">
      <Tabs defaultValue="addUrl">
        <TabsList className="mb-1">
          <TabsTrigger value="addUrl" size="sm">
            Add URL
          </TabsTrigger>
          <TabsTrigger value="search" size="sm">
            Search
          </TabsTrigger>
          <TabsTrigger value="suggested" size="sm">
            Suggested
          </TabsTrigger>
          <TabsTrigger value="describe" size="sm">
            Describe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="addUrl">
          <AddUrlTab isAdding={isAdding} onAdd={onAdd} />
        </TabsContent>
        <TabsContent value="search">
          <SearchTab
            trackedHandles={trackedHandles}
            pendingHandle={pendingHandle}
            onAdd={onAdd}
          />
        </TabsContent>
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
      </Tabs>
    </section>
  );
}

// ── Add URL ──────────────────────────────────────────────────────────────────
function AddUrlTab({
  isAdding,
  onAdd,
}: {
  isAdding: boolean;
  onAdd: (handle: string) => void;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onAdd(v);
    setValue("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Paste a TikTok URL or @handle"
          leftIcon={<LinkSimple size={16} />}
          aria-label="TikTok URL or handle"
        />
        <Button
          variant="primary"
          onClick={submit}
          loading={isAdding}
          disabled={value.trim().length === 0}
          className="shrink-0"
        >
          Add
        </Button>
      </div>
      <p className="text-xs text-foreground-muted">
        We scrape the channel once and add it to your watchlist.
      </p>
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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useChannelSearch(debouncedQ);
  const results = data?.results ?? [];
  const hasQuery = debouncedQ.trim().length >= 2;
  const cleanedQ = debouncedQ.replace(/^@/, "").trim().toLowerCase();

  return (
    <div className="space-y-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search channels you've added before"
        leftIcon={<MagnifyingGlass size={16} />}
        loading={isFetching && hasQuery}
        aria-label="Search channels"
      />

      {hasQuery && results.length > 0 && (
        <ul className="flex flex-col">
          {results.map((r) => (
            <li key={r.handle} className="flex items-center gap-3 py-2">
              <Avatar
                src={r.avatarUrl ?? undefined}
                fallback={(r.displayName ?? r.handle).slice(0, 2).toUpperCase()}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {r.displayName ?? `@${r.handle}`}
                </p>
                <p className="truncate text-xs text-foreground-muted">
                  @{r.handle} · {formatCount(r.followerCount)} followers
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
        <p className="px-0.5 text-xs text-foreground-muted">
          Type at least 2 characters. Searches channels already in the shared corpus.
        </p>
      )}
    </div>
  );
}

// ── Suggested ────────────────────────────────────────────────────────────────
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
  const [category, setCategory] = useState<SuggestedCategory>(SUGGESTED_CATEGORIES[0]);

  return (
    <div className="space-y-3">
      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTED_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              focusRing,
              cat === category
                ? "bg-white/[0.08] text-foreground"
                : "text-foreground-secondary hover:bg-white/[0.04] hover:text-foreground",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Channels in the active category */}
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {grouped[category].map((s) => (
          <li
            key={s.handle}
            className="flex items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2.5"
          >
            <Avatar fallback={s.displayName.slice(0, 2).toUpperCase()} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {s.displayName}
              </p>
              <p className="truncate text-xs text-foreground-muted">@{s.handle}</p>
            </div>
            <AddButton
              handle={s.handle}
              tracked={trackedHandles.has(s.handle)}
              pending={pendingHandle === s.handle}
              onAdd={onAdd}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Describe (Phase 1b stub) ─────────────────────────────────────────────────
function DescribeTab() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.06] text-foreground-muted">
        <PenNib size={20} />
      </div>
      <div className="space-y-1">
        <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-foreground">
          <Sparkle size={14} className="text-accent" />
          Describe your niche
        </p>
        <p className="max-w-xs text-xs text-foreground-muted">
          Tell us what you make and we&apos;ll suggest creators to watch. Coming soon —
          use Suggested or Add URL for now.
        </p>
      </div>
    </div>
  );
}
