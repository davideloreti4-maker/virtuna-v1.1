# The Shelf (Platform Concept Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six remix-first drop cards on the v8 `/home` arrival — real rehosted source stills + view counts, hook adapted into the user's niche, pre-run Flash meter — over the existing daily-surface cache, with Remix seeding a thread whose first turn is the 3-angle adapt output. All behind the existing `CONCEPT_V8_ENABLED` flag.

**Architecture:** A new `"drop"` kind in the existing `surface_reactions` cache. A server producer (`buildLiveDrops`) mirrors `outlier-reactions.ts`: corpus retrieval (pgvector, structural archetype round-robin via `rank.ts`) → per-row `generateAdaptConcepts` (the real `adapt.ts` call) → ONE batched Flash sim of the 6 lead adapted hooks → cached once/day/audience. The client shelf is presentational, fed by `useLazyWarm` exactly like the old `/start` sections. Remix taps a seed route that writes a real persisted thread (user markdown turn + 3 `remix-card` blocks) and the composer's existing rehydration renders it — no new thread UI.

**Tech Stack:** Next.js 15, TypeScript, Tailwind v4 (tokens from `globals.css`), Vitest (+happy-dom for components), Supabase (RLS session client for cache, service corpus client for retrieval), Qwen/DashScope (adapt + embeddings), raw Playwright for browser verification.

## Global Constraints

- **No corpus multiplier number anywhere** (owner call #1 open). A drop card and its seeded thread cards print ONLY the source view count and the sim score. `proof.multiplier` and `proof.baselineLabel` are always `null` on seeded blocks.
- **Donor domain/niche never shown.** `row.niche`/`subniche` never reach a card view-model. The creator handle + video link ARE allowed (existing remix-receipt precedent); the archetype slug is allowed (it's a structure name, not a niche).
- **Curated teardown prose never shown verbatim** — `why_it_works`, beat descriptions, `idea.*` feed prompts only, never render.
- **Drops are the ONLY pre-scored surface.** The warm route's batched Flash sim is the sanctioned proactive pipe. The seeded thread's 3 angles arrive with the adapt call's own `provenance: "projected"` estimate — exactly what the shipped remix skill emits — and NO `personas`. Nothing else fires a sim; tapping Remix runs ZERO model calls.
- **Zero accent on drop cards.** No `--color-accent`/`bg-accent`/`#FF6363` anywhere in the shelf. Meter segments are cream/dim neutrals. Primary actions neutral cream. Never `#fff`.
- **Flag-off stays byte-identical.** Every new mount, hook effect, and route is gated on `CONCEPT_V8_ENABLED` (routes return 404 when the flag is off — no new prod attack/spend surface). The full existing suite is the regression gate.
- **Drop economics is owner call #3.** No billing/quota wiring, no `usage_tracking` imports (mirrors the existing surfaces routes). The flag guard keeps the spend dev-only. Say so in the PR.
- **Rehosting:** the pipe already exists (`durableCover`/`rehostCover`; 489 of 532 corpus rows carry a durable public cover — verified 2026-08-08 by SQL + HTTP 200). NO new scraper, Apify stays off the critical path. Non-rehosted rows are excluded by `isDropReady`.
- **Type-scale guard:** no `text-[Npx]` on rendering surfaces — roles only (micro/caption/label/body/reading/title/subhead/heading/stat); fractional px banned everywhere.
- **Component test files need `/** @vitest-environment happy-dom */` on line 1** (default env is node).
- **Copy is direction-grade** — mark new copy `// v8 copy — owner reviews before launch (handoff §5)`. Never transcribe mock hooks/scores/personas (all fabricated).
- **Never stage `src/app/(app)/start/page.tsx` or `src/components/surfaces/start-page.tsx`** (uncommitted owner-call working-tree edits; `routing-cut.test.ts` fails in this worktree because of them — pre-existing, not yours). Always `git add` explicit paths; never `git add -A` / `git add .`.
- **Migrations:** `supabase db push` is UNSAFE here (ledger drift). Apply the single migration via the SQL editor path (MCP `execute_sql`), commit the file for the record. Dev and prod share ONE Supabase project — the change must be additive-only.
- Gates before any push: `node node_modules/typescript/bin/tsc --noEmit` · `npm run build` · `set -o pipefail && npx vitest run` (pipes eat exit codes otherwise).
- Dev-server reaper kills idle servers after ~10 min — restart before every browser probe.

## File Structure

| File | Responsibility |
|---|---|
| Create `supabase/migrations/20260808193000_surface_reactions_drop_kind.sql` | Extend the `kind` CHECK to `('outlier','idea','drop')`. |
| Modify `src/lib/surfaces/surface-reactions-repo.ts` | `SurfaceKind` gains `"drop"`. |
| Modify `src/lib/surfaces/live-cards.ts` | `compactViews` moves here (shared, pure); add `LiveDropCard`. |
| Modify `src/lib/surfaces/outlier-reactions.ts` | Import `compactViews` from live-cards (no behavior change). |
| Create `src/lib/surfaces/drop-adapt-input.ts` | Pure bridge: corpus `SharedMatchRow` → `AdaptInput` (honest absent lines, luck-free by construction). |
| Create `src/lib/surfaces/drop-select.ts` | Pure: `isDropReady` + `selectDailyDrops` (rank.ts round-robin + daily rotating window). |
| Create `src/lib/surfaces/drop-reactions.ts` | `buildLiveDrops` producer (DI deps; cache-first; 6 adapts + 1 batched Flash). |
| Create `src/app/api/surfaces/drops/route.ts` | POST warm route (flag 404 → auth 401 → CSRF → producer). |
| Create `src/lib/surfaces/drop-seed.ts` | Pure: `dropCardToRemixBlocks` (card → user turn text + ranked `remix-card` blocks, schema-validated). |
| Create `src/app/api/surfaces/drops/remix/route.ts` | POST seed route: cached card → `createNewThread` + `insertMessage` ×2 + title → `{threadId}`. |
| Modify `src/lib/tools/blocks.ts` | `RemixCardBlockSchema.props.sourceDecode` becomes `.optional()` (a drop has no 4-beat decode; never fabricate one). |
| Modify `src/components/thread/remix-card-block.tsx` | Renderer guards absent `sourceDecode` (skip the "Their …" cells). |
| Create `src/components/app/home/v8/drop-shelf.tsx` | Presentational `DropShelf` + `DropCard` + skeletons (zero accent). |
| Modify `src/components/app/home/v8/arrival.tsx` | `ArrivalV8` gains `shelfReady?: boolean` → "Tonight's remixes" headline + whisper. |
| Modify `src/components/app/home/composer.tsx` | Hoisted `useLazyWarm` for drops, `warmAudienceKey`, `handleRemixDrop`, shelf mounts at both v8 arrival points. |
| Tests | `src/lib/surfaces/__tests__/{drop-adapt-input,drop-select,drop-seed,drop-reactions}.test.ts`, `src/lib/surfaces/__tests__/live-cards.test.ts` (extend), `src/components/app/home/v8/__tests__/drop-shelf.test.tsx`, `arrival.test.tsx` (extend), `src/components/app/home/__tests__/composer-v8.test.tsx` (extend). |

**Interfaces produced (used across tasks):**

```ts
// live-cards.ts
export function compactViews(n: number): string;            // moved from outlier-reactions
export interface LiveDropCard {
  contentId: string;            // outlier_teardowns.id (uuid)
  hook: string;                 // lead adapted hook (rank-1 concept) — the card headline
  coverUrl: string;             // durable rehosted still (isDropReady guarantees it)
  videoUrl: string | null;      // tap-through to the original
  views: string;                // compact "8.1M" (card face)
  viewsRaw: number;             // raw count (seeded proof receipt)
  handle: string;               // creator handle (receipt only — NEVER on the card face)
  archetype: string | null;     // hook archetype slug (receipt pill)
  hookTemplate: string | null;  // the madlib (receipt proof line)
  concepts: AdaptConcept[];     // 1–3, ranked by projected stops desc (winner first)
  personas: ReactionPersona[];  // REAL pre-run Flash sim of `hook` — the card meter
}

// drop-adapt-input.ts
export function corpusRowToAdaptInput(row: SharedMatchRow, niche: string): AdaptInput | null;

// drop-select.ts
export function isDropReady(row: SharedMatchRow): boolean;
export function selectDailyDrops(rows: SharedMatchRow[], count: number, dayIndex: number): SharedMatchRow[];
export function utcDayIndex(now?: Date): number;

// drop-reactions.ts
export const DROP_TARGET = 6;
export interface BuildDropsDeps { embed?; match?; adapt?; flashBatch?; corpusClient? }
export async function buildLiveDrops(supabase: SupabaseClient, userId: string, deps?: BuildDropsDeps): Promise<LiveDropCard[]>;

// drop-seed.ts
export function dropUserTurnText(card: LiveDropCard): string;
export function dropCardToRemixBlocks(card: LiveDropCard, audienceName?: string | null): RemixCardBlock[];

// drop-shelf.tsx
export function DropShelf({ cards, status, onRemix }: {
  cards: LiveDropCard[]; status: "warming" | "ready"; onRemix: (card: LiveDropCard) => void;
}): JSX.Element | null;

// arrival.tsx
export function ArrivalV8({ shelfReady }: { shelfReady?: boolean }): JSX.Element;
```

---

### Task 1: `"drop"` cache kind (migration + repo type)

**Files:**
- Create: `supabase/migrations/20260808193000_surface_reactions_drop_kind.sql`
- Modify: `src/lib/surfaces/surface-reactions-repo.ts:17`

**Interfaces:**
- Consumes: existing `surface_reactions` table (CHECK `kind IN ('outlier','idea')`).
- Produces: DB accepts `kind='drop'`; `type SurfaceKind = "outlier" | "idea" | "drop"`.

- [ ] **Step 1: Confirm the live constraint name** (never drop blind — shared dev/prod project). Via MCP `execute_sql` on project `qyxvxleheckijapurisj`:

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.surface_reactions'::regclass and contype = 'c';
```

Expected: one row named `surface_reactions_kind_check` with `CHECK (kind IN ('outlier','idea'))` (adjust the migration below to the REAL name if it differs).

- [ ] **Step 2: Write the migration file**

```sql
-- =========================================================================
-- v8 Phase 2 (the shelf): the daily-surface cache learns a third section.
-- surface_reactions.kind gains 'drop' — the six pre-scored remix-first drop
-- cards on the v8 /home arrival (one cached batch per user × audience × day,
-- same TTL + upsert machinery as 'outlier'/'idea'). Additive-only: existing
-- rows and both existing kinds are untouched.
-- Applied via the SQL editor path (ledger drift — db push is unsafe here).
-- =========================================================================
ALTER TABLE public.surface_reactions
  DROP CONSTRAINT surface_reactions_kind_check;
ALTER TABLE public.surface_reactions
  ADD CONSTRAINT surface_reactions_kind_check
  CHECK (kind IN ('outlier', 'idea', 'drop'));
```

- [ ] **Step 3: Apply it** via MCP `execute_sql` (the two ALTERs in one call), then verify:

```sql
select pg_get_constraintdef(oid) from pg_constraint
where conname = 'surface_reactions_kind_check';
```

Expected: `CHECK (kind = ANY (ARRAY['outlier'::text, 'idea'::text, 'drop'::text]))`.

- [ ] **Step 4: Extend the repo type** — in `surface-reactions-repo.ts` change:

```ts
export type SurfaceKind = "outlier" | "idea" | "drop";
```

- [ ] **Step 5: Typecheck** — `node node_modules/typescript/bin/tsc --noEmit`. Expected: clean.
- [ ] **Step 6: Commit** — `git add supabase/migrations/20260808193000_surface_reactions_drop_kind.sql src/lib/surfaces/surface-reactions-repo.ts && git commit -m "feat(shelf): surface_reactions learns kind 'drop'"`

### Task 2: `LiveDropCard` + shared `compactViews`

**Files:**
- Modify: `src/lib/surfaces/live-cards.ts`
- Modify: `src/lib/surfaces/outlier-reactions.ts:34-40` (delete local `compactViews`, import it)
- Test: `src/lib/surfaces/__tests__/live-cards.test.ts` (extend)

**Interfaces:**
- Consumes: `AdaptConcept` (`@/lib/engine/remix/decode-types`), `ReactionPersona` (`@/lib/tools/blocks`).
- Produces: `LiveDropCard` (shape above), `compactViews(n: number): string` exported from live-cards.

- [ ] **Step 1: Write the failing test** (append to `live-cards.test.ts`):

```ts
import { compactViews } from "../live-cards";

describe("compactViews (moved from outlier-reactions — shared with drops)", () => {
  it("compacts honestly", () => {
    expect(compactViews(118_000)).toBe("118K");
    expect(compactViews(1_200_000)).toBe("1.2M");
    expect(compactViews(8_100_000)).toBe("8.1M");
    expect(compactViews(890)).toBe("890");
    expect(compactViews(0)).toBe("0");
    expect(compactViews(Number.NaN)).toBe("0");
  });
});
```

- [ ] **Step 2: Run it to make sure it fails** — `set -o pipefail && npx vitest run src/lib/surfaces/__tests__/live-cards.test.ts`. Expected: FAIL (`compactViews` not exported).
- [ ] **Step 3: Implement** — move the `compactViews` function body VERBATIM from `outlier-reactions.ts` into `live-cards.ts` (exported, same doc comment); in `outlier-reactions.ts` delete the local copy and add `compactViews` to the existing `./live-cards` import. Then append to `live-cards.ts`:

```ts
/**
 * A v8 drop card (Phase 2 — the shelf): ONE proven corpus outlier, its hook already
 * adapted into the user's niche (the real adapt.ts 3-concept output, rank-1 leading)
 * and pre-scored by the user's audience (real Flash personas — the drops are the ONLY
 * pre-scored surface). Video fields are real outlier_teardowns data with a DURABLE
 * rehosted cover (isDropReady gates the rest out). `handle`/`hookTemplate`/`archetype`
 * feed the seeded thread's receipt ONLY — the card face shows thumb + views + hook +
 * meter and nothing else (no donor niche, no multiplier — locked).
 */
export interface LiveDropCard {
  contentId: string;
  hook: string;
  coverUrl: string;
  videoUrl: string | null;
  views: string;
  viewsRaw: number;
  handle: string;
  archetype: string | null;
  hookTemplate: string | null;
  concepts: AdaptConcept[];
  personas: ReactionPersona[];
}
```

with `import type { AdaptConcept } from "@/lib/engine/remix/decode-types";` added at the top.

- [ ] **Step 4: Run the surfaces tests** — `set -o pipefail && npx vitest run src/lib/surfaces/__tests__/`. Expected: PASS (including untouched outlier tests).
- [ ] **Step 5: Typecheck + commit** — tsc clean, then `git add src/lib/surfaces/live-cards.ts src/lib/surfaces/outlier-reactions.ts src/lib/surfaces/__tests__/live-cards.test.ts && git commit -m "feat(shelf): LiveDropCard type; compactViews shared via live-cards"`

### Task 3: Corpus row → AdaptInput bridge

**Files:**
- Create: `src/lib/surfaces/drop-adapt-input.ts`
- Test: `src/lib/surfaces/__tests__/drop-adapt-input.test.ts`

**Interfaces:**
- Consumes: `SharedMatchRow` (`@/lib/grounding/corpus`), `parseTeardownTemplate`/`parseIdeaFacet` (`@/lib/grounding/types`), `AdaptInput` (`@/lib/engine/remix/decode-types`).
- Produces: `corpusRowToAdaptInput(row, niche): AdaptInput | null` — null when the row carries no hook structure.

- [ ] **Step 1: Write the failing tests**

```ts
import { corpusRowToAdaptInput } from "../drop-adapt-input";
import type { SharedMatchRow } from "@/lib/grounding/corpus";

const base: SharedMatchRow = {
  id: "t1", similarity: 0.5, platform: "tiktok", platform_video_id: "v1",
  video_url: "https://t.example/v", cover_url: "https://s.example/c.jpg",
  creator_handle: "someone", source_pool: "curated", trust_weight: 1.5,
  views: 100, follower_count: null, outlier_multiplier: null, baseline_label: null,
  engagement_rate: null, posted_at: null, proof_captured_at: null, niche: "fitness",
  hook_archetype: "trap-mistake", format: "problem-solution", visual_hook: null,
  editing_style: null, spoken_hook: "If you have X, don't do Y.",
  hook_template: "If you have [problem], don't just [fix].", hook_source: "caption_fallback",
  idea: { seed: "s", angle: "a", belief: "forcing posture works", reality: "it compensates", evidence: "e" },
  template: { name: "n", slots: [], skeleton: ["The Trap", "The Turn", "The Fix"], guidance: "use when…",
    beats: [{ name: "The Turn", description: "reject the intuitive fix" }] },
  why_it_works: "prose that must never render", hook_techniques: null,
};

describe("corpusRowToAdaptInput", () => {
  it("maps the madlib, skeleton, tension and beats into honest structural fields", () => {
    const input = corpusRowToAdaptInput(base, "personal finance");
    expect(input).not.toBeNull();
    expect(input!.niche).toBe("personal finance");
    expect(input!.hook_pattern).toBe("If you have [problem], don't just [fix].");
    expect(input!.structure).toContain("The Trap → The Turn → The Fix");
    expect(input!.the_turn).toContain("reject the intuitive fix");
    expect(input!.emotional_beat).toContain("forcing posture works");
    expect(input!.repeatable.length).toBeGreaterThan(0);
    // D-01: no luck lane exists on this path at all (compile-time by AdaptInput shape).
  });

  it("falls back to the spoken hook when no madlib exists", () => {
    const input = corpusRowToAdaptInput({ ...base, hook_template: null }, "n");
    expect(input!.hook_pattern).toBe("If you have X, don't do Y.");
  });

  it("states absence honestly instead of fabricating beats", () => {
    const input = corpusRowToAdaptInput({ ...base, template: null, idea: null }, "n");
    expect(input!.structure).toMatch(/not (isolate|record|name)/i);
    expect(input!.the_turn).toMatch(/not (isolate|record|name)/i);
    expect(input!.emotional_beat).toMatch(/not (isolate|record|name)/i);
    expect(input!.repeatable.length).toBeGreaterThan(0); // madlib backstop
  });

  it("returns null when the row has no hook structure to adapt", () => {
    expect(corpusRowToAdaptInput({ ...base, hook_template: null, spoken_hook: null }, "n")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — module not found.
- [ ] **Step 3: Implement**

```ts
/**
 * drop-adapt-input.ts — corpus teardown → AdaptInput (the drops pipe's adapt bridge).
 *
 * The corpus rows are pre-torn (madlib, skeleton, timed beats, belief↔reality tension),
 * NOT pre-decoded into the remix engine's 4-beat DecodeResult — so the drops pipe maps
 * the anatomy it honestly has onto AdaptInput's structural fields and states absence
 * plainly where a field has no source (mirrors decode's D-02 honest-absent rule).
 * Prompt inputs only: none of these strings ever render on a card.
 * Luck-free by construction: AdaptInput has no luck lane (D-01 stays compile-time).
 */
import type { SharedMatchRow } from "@/lib/grounding/corpus";
import { parseIdeaFacet, parseTeardownTemplate } from "@/lib/grounding/types";
import { hasHookStructure } from "@/lib/grounding/rank";
import type { AdaptInput, RepeatableItem } from "@/lib/engine/remix/decode-types";

/** Honest absent line (D-02 mirror) — never an empty string, never invented content. */
const ABSENT = (what: string) => `The source teardown does not ${what}.`;

export function corpusRowToAdaptInput(row: SharedMatchRow, niche: string): AdaptInput | null {
  if (!hasHookStructure(row)) return null;
  const template = parseTeardownTemplate(row.template);
  const idea = parseIdeaFacet(row.idea);

  const hookPattern = row.hook_template?.trim() || row.spoken_hook?.trim() || "";

  const skeleton = template?.skeleton?.length ? template.skeleton.join(" → ") : null;
  const structure = skeleton
    ? template?.guidance?.trim()
      ? `${skeleton}. When this structure works: ${template.guidance.trim()}`
      : skeleton
    : ABSENT("record the beat order");

  const turnBeat = template?.beats?.find((b) => /turn|twist|reveal|payoff|reject/i.test(b.name));
  const theTurn = turnBeat
    ? `${turnBeat.name}: ${turnBeat.description}`
    : ABSENT("isolate a single turn moment");

  const emotionalBeat =
    idea?.belief && idea?.reality
      ? `Tension: the audience believes "${idea.belief}" — the reality is "${idea.reality}".`
      : ABSENT("name the emotional arc");

  const repeatable: RepeatableItem[] = (template?.beats ?? [])
    .slice(0, 5)
    .map((b) => ({ label: b.name, why_repeatable: b.description }));
  if (repeatable.length === 0) {
    // Backstop: the madlib itself is the one structural move every admissible row carries.
    repeatable.push({ label: hookPattern, why_repeatable: "the hook's reusable fill-in-the-blank skeleton" });
  }

  return { hook_pattern: hookPattern, structure, the_turn: theTurn, emotional_beat: emotionalBeat, repeatable, niche };
}
```

- [ ] **Step 4: Run to verify PASS**, adjust absent-line regexes if wording drifted.
- [ ] **Step 5: Commit** — `git add src/lib/surfaces/drop-adapt-input.ts src/lib/surfaces/__tests__/drop-adapt-input.test.ts && git commit -m "feat(shelf): honest corpus→AdaptInput bridge"`

### Task 4: Daily drop selection (round-robin + rotation)

**Files:**
- Create: `src/lib/surfaces/drop-select.ts`
- Test: `src/lib/surfaces/__tests__/drop-select.test.ts`

**Interfaces:**
- Consumes: `selectStructuralExamples`, `hasHookStructure` (`@/lib/grounding/rank`), `SharedMatchRow`.
- Produces: `isDropReady(row)`, `selectDailyDrops(rows, count, dayIndex)`, `utcDayIndex(now?)`.

- [ ] **Step 1: Write the failing tests**

```ts
import { isDropReady, selectDailyDrops, utcDayIndex } from "../drop-select";
import type { SharedMatchRow } from "@/lib/grounding/corpus";

const DURABLE = "https://x.supabase.co/storage/v1/object/public/covers/corpus/tiktok/1.jpg";
function row(over: Partial<SharedMatchRow>): SharedMatchRow {
  return {
    id: Math.random().toString(36).slice(2), similarity: 0.5, platform: "tiktok",
    platform_video_id: "v", video_url: "https://t/v", cover_url: DURABLE,
    creator_handle: "h", source_pool: "curated", trust_weight: 1.5, views: 1000,
    follower_count: null, outlier_multiplier: 5, baseline_label: null, engagement_rate: null,
    posted_at: null, proof_captured_at: null, niche: null, hook_archetype: "question",
    format: null, visual_hook: null, editing_style: null, spoken_hook: "line",
    hook_template: "madlib [x]", hook_source: null, idea: null, template: null,
    why_it_works: null, hook_techniques: null, ...over,
  } as SharedMatchRow;
}

describe("isDropReady", () => {
  it("requires a durable rehosted cover, real views, a handle, and hook structure", () => {
    expect(isDropReady(row({}))).toBe(true);
    expect(isDropReady(row({ cover_url: "https://tiktokcdn.example/x?x-expires=1" }))).toBe(false);
    expect(isDropReady(row({ cover_url: null }))).toBe(false);
    expect(isDropReady(row({ views: 0 }))).toBe(false);
    expect(isDropReady(row({ views: null }))).toBe(false);
    expect(isDropReady(row({ creator_handle: null }))).toBe(false);
    expect(isDropReady(row({ hook_template: null, spoken_hook: null }))).toBe(false);
  });
});

describe("selectDailyDrops", () => {
  const archetypes = ["question", "authority", "contrarian", "list", "problem", "tutorial", "case-study"];
  // 7 archetypes × 3 exemplars — enough for spread + rotation.
  const pool = archetypes.flatMap((a, i) =>
    [0, 1, 2].map((d) => row({ hook_archetype: a, similarity: 0.9 - i * 0.05 - d * 0.01 })),
  );

  it("returns `count` rows spanning distinct archetypes on day 0", () => {
    const picks = selectDailyDrops(pool, 6, 0);
    expect(picks).toHaveLength(6);
    expect(new Set(picks.map((p) => p.hook_archetype)).size).toBe(6);
  });

  it("rotates: consecutive days share no rows until the sequence wraps", () => {
    const d0 = new Set(selectDailyDrops(pool, 6, 0).map((p) => p.id));
    const d1 = selectDailyDrops(pool, 6, 1);
    expect(d1.some((p) => d0.has(p.id))).toBe(false);
  });

  it("is deterministic for a given day", () => {
    expect(selectDailyDrops(pool, 6, 3).map((p) => p.id)).toEqual(
      selectDailyDrops(pool, 6, 3).map((p) => p.id),
    );
  });

  it("wraps instead of returning short, and never duplicates within a day", () => {
    const tiny = pool.slice(0, 4);
    const picks = selectDailyDrops(tiny, 6, 5);
    expect(picks).toHaveLength(4); // fewer ready rows than count → all of them, no dupes
    expect(new Set(picks.map((p) => p.id)).size).toBe(4);
  });

  it("returns [] on an empty/unready pool", () => {
    expect(selectDailyDrops([], 6, 0)).toEqual([]);
    expect(selectDailyDrops([row({ cover_url: null })], 6, 0)).toEqual([]);
  });
});

describe("utcDayIndex", () => {
  it("is the UTC day number", () => {
    expect(utcDayIndex(new Date("2026-08-08T23:59:00Z"))).toBe(
      utcDayIndex(new Date("2026-08-08T00:01:00Z")),
    );
    expect(utcDayIndex(new Date("2026-08-09T00:01:00Z"))).toBe(
      utcDayIndex(new Date("2026-08-08T23:59:00Z")) + 1,
    );
  });
});
```

- [ ] **Step 2: Run to verify FAIL.**
- [ ] **Step 3: Implement**

```ts
/**
 * drop-select.ts — which six corpus rows are today's drops.
 *
 * Selection = rank.ts's structural round-robin ("six examples, six ways to open"),
 * over only the rows a drop card can honestly render (isDropReady), with a DAILY
 * rotating window over the full deterministic sequence — "rotates daily; 489 ready
 * rows ≈ ~80 daily sixes before repeat" (spec §1 freshness). Deep in the sequence
 * (small archetypes exhausted) a window may repeat a shape — a corpus constraint,
 * not a bug; cadence/saturation is owner call #5.
 */
import type { SharedMatchRow } from "@/lib/grounding/corpus";
import { hasHookStructure, selectStructuralExamples } from "@/lib/grounding/rank";

/** rehostCover writes public storage objects — the durable-cover marker. */
const DURABLE_COVER = "/storage/v1/object/public/";

/** Can a drop card honestly render this row? (Face: still + views. Receipt: handle.) */
export function isDropReady(row: SharedMatchRow): boolean {
  return (
    typeof row.cover_url === "string" &&
    row.cover_url.includes(DURABLE_COVER) &&
    typeof row.views === "number" &&
    row.views > 0 &&
    Boolean(row.creator_handle?.trim()) &&
    hasHookStructure(row)
  );
}

/** Days since the Unix epoch, UTC — the daily rotation key (server-side only). */
export function utcDayIndex(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 86_400_000);
}

/**
 * Deterministic daily pick: full structural round-robin sequence, then the day's
 * rotating window of `count` (wrapping, deduped by construction via Math.min).
 */
export function selectDailyDrops(
  rows: SharedMatchRow[],
  count: number,
  dayIndex: number,
): SharedMatchRow[] {
  const ready = rows.filter(isDropReady);
  const seq = selectStructuralExamples(ready, ready.length);
  if (seq.length === 0) return [];
  const take = Math.min(count, seq.length);
  const start = ((dayIndex * count) % seq.length + seq.length) % seq.length;
  return Array.from({ length: take }, (_, i) => seq[(start + i) % seq.length]!);
}
```

- [ ] **Step 4: Run to verify PASS.**
- [ ] **Step 5: Commit** — `git add src/lib/surfaces/drop-select.ts src/lib/surfaces/__tests__/drop-select.test.ts && git commit -m "feat(shelf): drop-ready gate + daily rotating round-robin selection"`

### Task 5: The drops producer

**Files:**
- Create: `src/lib/surfaces/drop-reactions.ts`
- Test: `src/lib/surfaces/__tests__/drop-reactions.test.ts`

**Interfaces:**
- Consumes: `resolveUserAudience`, `buildReactionPanel`, `runFlashTextModeBatch`, `goalIntentToLens`, `embedQueryText` (`@/lib/grounding/embedder`), `matchSharedTeardowns`/`getCorpusClient` (`@/lib/grounding/corpus`), `generateAdaptConcepts` (`@/lib/engine/remix/adapt`), Tasks 2–4 modules, cache repo.
- Produces: `buildLiveDrops(supabase, userId, deps?)` → `LiveDropCard[]` (cache-first, ≤6, honest `[]` on any total failure). `DROP_TARGET = 6`.

Structure mirrors `outlier-reactions.ts` stage-for-stage; deps are injectable (the `gather-for-run.ts` pattern) so tests exercise the real orchestration with fakes ONLY at the network/DB boundaries.

- [ ] **Step 1: Write the failing tests** — inject fakes for `{embed, match, adapt, flashBatch, corpusClient}` plus a minimal fake `supabase` (`from().select()…maybeSingle()` for profile + cache; the cache read path goes through `getFreshSurfaceCards`, which tolerates a throwing fake → treat as miss; the upsert fake records its args):

```ts
import { buildLiveDrops, DROP_TARGET } from "../drop-reactions";
// Fakes: embed → [0.1]; match → a 20-row drop-ready pool (reuse the row() helper shape
// from drop-select.test.ts, imported or duplicated locally); adapt → per-row 3 concepts
// with personaStops [8, 5, 2] and stopQuote strings; flashBatch → a Map of
// id → { personas: [{ archetype: "a", verdict: "stop", quote: "q" }] }.

describe("buildLiveDrops", () => {
  it("builds ≤6 cards: rank-1 concept leads, real personas attached, cache upserted under kind 'drop'", async () => { /* assert card.hook === highest-personaStops concept.hook; card.personas.length === 1; upsert called with ("drop", cards) */ });
  it("returns the cached batch untouched on a fresh cache hit (no adapt/sim calls)", async () => { /* cache fake returns rows; adapt/flash fakes assert not called */ });
  it("drops a row whose adapt returned null and ships the survivors", async () => {});
  it("drops a row missing from the flash result map (per-candidate salvage)", async () => {});
  it("returns [] when the batched sim throws (honest empty — never a fabricated meter)", async () => {});
  it("returns [] when embedding fails", async () => {});
  it("never leaks donor niche into a card", async () => { /* JSON.stringify(cards) contains no row.niche value */ });
});
```

Write each spec fully — the fakes are ~40 lines total; assert call counts via captured arrays, not spy frameworks.

- [ ] **Step 2: Run to verify FAIL.**
- [ ] **Step 3: Implement**

```ts
/**
 * drop-reactions.ts — the DROPS producer (v8 Phase 2, the shelf).
 *
 * The proactive pipe: six proven corpus outliers (structural round-robin, daily
 * rotation) → each adapted into the user's niche by the REAL adapt.ts call (3
 * concepts, rank-1 leads the card) → ONE batched Flash sim of the six lead hooks
 * (the drops are the ONLY pre-scored surface). Cached in surface_reactions
 * (kind 'drop') once/day/audience — same TTL + lazy re-warm as /start's sections.
 *
 * Cost per warm: 1 embedding + ≤6 adapt calls + 1 batched Flash call.
 * ⚠️ Drop economics is OWNER CALL #3 — no billing/quota wiring here; the route
 * above this is 404 unless CONCEPT_V8_ENABLED. Do not ship past the flag.
 *
 * Security (CR-01): userId is the server-resolved session user; the audience is
 * resolved server-side. Corpus reads use the service corpus client (shared table);
 * cache reads/writes use the RLS-scoped session client.
 */
```

Body (follow `outlier-reactions.ts`'s numbered-stage style):

```ts
export const DROP_TARGET = 6;

export interface BuildDropsDeps {
  embed?: typeof embedQueryText;
  match?: typeof matchSharedTeardowns;
  adapt?: typeof generateAdaptConcepts;
  flashBatch?: typeof runFlashTextModeBatch;
  corpusClient?: () => SupabaseClient;
}

export async function buildLiveDrops(
  supabase: SupabaseClient,
  userId: string,
  deps: BuildDropsDeps = {},
): Promise<LiveDropCard[]> {
  const embed = deps.embed ?? embedQueryText;
  const match = deps.match ?? matchSharedTeardowns;
  const adapt = deps.adapt ?? generateAdaptConcepts;
  const flashBatch = deps.flashBatch ?? runFlashTextModeBatch;
  const corpusClient = deps.corpusClient ?? getCorpusClient;

  // (1) Audience + cache-first (mirrors outlier-reactions 1/1a).
  const audience = await resolveUserAudience(supabase, userId);
  const cached = await getFreshSurfaceCards<LiveDropCard>(supabase, userId, audienceKeyOf(audience), "drop");
  if (cached) return cached;

  // (2) Profile → niche (remix-runner's exact steer recipe, REMIX-01).
  const { data: rawProfile } = await supabase
    .from("creator_profiles").select("*").eq("user_id", userId).maybeSingle();
  const profileRow = rawProfile as unknown as ProfileRow | null;
  const profileNiche = profileRow?.niche_primary ?? "general";
  const isCalibrated = Boolean(audience && !audience.is_general);
  const audienceNiche = isCalibrated && audience
    ? `${profileNiche} · ${audience.name}${audience.goal_label ? ` (${audience.goal_label})` : ""}`
    : profileNiche;

  // (3) Retrieval: whole-corpus structural pool, topic as tiebreak (rank.ts contract).
  let rows: SharedMatchRow[];
  try {
    const embedding = await embed(profileNiche);
    rows = await match(corpusClient(), { embedding, count: 2000 });
  } catch { return []; }

  // (4) Today's six (drop-ready gate + daily rotation).
  const picks = selectDailyDrops(rows, DROP_TARGET, utcDayIndex());
  if (picks.length === 0) return [];

  // (5) Adapt each pick (parallel; a null adapt drops its row — per-row salvage).
  const adapted = (await Promise.all(
    picks.map(async (row) => {
      const input = corpusRowToAdaptInput(row, audienceNiche);
      if (!input) return null;
      const concepts = await adapt(input).catch(() => null);
      if (!concepts || concepts.length === 0) return null;
      const ranked = [...concepts].sort(
        (a, b) => clampStops(b.personaStops) - clampStops(a.personaStops),
      );
      return { row, ranked };
    }),
  )).filter((x): x is { row: SharedMatchRow; ranked: AdaptConcept[] } => x !== null);
  if (adapted.length === 0) return [];

  // (6) ONE batched Flash sim of the lead adapted hooks — the pre-score (sanctioned pipe).
  const { panel, audienceRepaint } = buildReactionPanel(profileRow, audience);
  const intent = isCalibrated && audience ? goalIntentToLens(audience.goal_intent) : undefined;
  let results: Awaited<ReturnType<typeof runFlashTextModeBatch>>["results"];
  try {
    ({ results } = await flashBatch(
      adapted.map(({ row, ranked }) => ({ id: row.id, text: ranked[0]!.hook })),
      "hook", panel, audienceRepaint, intent,
    ));
  } catch { return []; }

  // (7) Assemble — a row without a sim result drops itself (no meter, no card).
  const cards: LiveDropCard[] = [];
  for (const { row, ranked } of adapted) {
    const sim = results.get(row.id);
    if (!sim) continue;
    cards.push({
      contentId: row.id,
      hook: ranked[0]!.hook,
      coverUrl: row.cover_url!,
      videoUrl: row.video_url,
      views: compactViews(row.views ?? 0),
      viewsRaw: row.views ?? 0,
      handle: row.creator_handle!.trim(),
      archetype: row.hook_archetype,
      hookTemplate: row.hook_template,
      concepts: ranked,
      personas: sim.personas,
    });
    if (cards.length >= DROP_TARGET) break;
  }

  // (8) Persist (best-effort, mirrors outlier-reactions 7).
  try { await upsertSurfaceCards(supabase, userId, audienceKeyOf(audience), "drop", cards); } catch {}
  return cards;
}

function clampStops(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.min(10, Math.max(0, n));
}
```

- [ ] **Step 4: Run to verify PASS** — `set -o pipefail && npx vitest run src/lib/surfaces/__tests__/drop-reactions.test.ts`.
- [ ] **Step 5: Typecheck + commit** — `git add src/lib/surfaces/drop-reactions.ts src/lib/surfaces/__tests__/drop-reactions.test.ts && git commit -m "feat(shelf): buildLiveDrops producer — adapt + one batched pre-score, cached daily"`

### Task 6: Warm route `POST /api/surfaces/drops`

**Files:**
- Create: `src/app/api/surfaces/drops/route.ts`

**Interfaces:**
- Consumes: `CONCEPT_V8_ENABLED`, `createClient`, `csrfGuard`, `buildLiveDrops`.
- Produces: `{ drops: LiveDropCard[] }` — the `useLazyWarm` endpoint/responseKey pair is `("/api/surfaces/drops", "drops")`.

- [ ] **Step 1: Write the route** (mirror `outliers/route.ts` byte-for-byte in structure, plus the flag guard and the remix-route runtime caps):

```ts
/**
 * POST /api/surfaces/drops — the v8 shelf warm (Phase 2).
 *
 * On a cache miss (first /home visit of the day), the client fires this route:
 * it builds today's six drops for the server-resolved audience (buildLiveDrops —
 * ≤6 adapt calls + ONE batched Flash sim), persists to surface_reactions
 * (kind 'drop'), and returns the real cards. No request body (CR-01).
 *
 * ⚠️ 404 unless CONCEPT_V8_ENABLED: flag-off must stay byte-identical INCLUDING
 * no new spend surface (drop economics = owner call #3 — this route must not be
 * reachable in an environment that hasn't opted into v8).
 */
import { createClient } from "@/lib/supabase/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { CONCEPT_V8_ENABLED } from "@/lib/flags/concept-v8";
import { buildLiveDrops } from "@/lib/surfaces/drop-reactions";

export const runtime = "nodejs";
// ≤6 adapt calls (90s cap each, parallel) + one batched Flash — mirrors remix's cap.
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  if (!CONCEPT_V8_ENABLED) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const guard = csrfGuard(request);
  if (guard) return guard;
  try {
    const drops = await buildLiveDrops(supabase, user.id);
    return Response.json({ drops });
  } catch {
    return Response.json({ error: "drops_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Typecheck** — tsc clean.
- [ ] **Step 3: Guard check by hand** (dev server NOT running the flag): `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/surfaces/drops` → expect `404` with the flag off; with `NEXT_PUBLIC_CONCEPT_V8=true` and signed out → `401`. (Full signed-in behavior is Task 12's browser pass.)
- [ ] **Step 4: Commit** — `git add src/app/api/surfaces/drops/route.ts && git commit -m "feat(shelf): drops warm route, flag-gated 404"`

### Task 7: `sourceDecode` optional (schema + renderer)

**Files:**
- Modify: `src/lib/tools/blocks.ts:538-543`
- Modify: `src/components/thread/remix-card-block.tsx`
- Test: extend the existing blocks/remix-card tests (locate with `grep -rln "RemixCardBlockSchema" src/**/__tests__ src/lib/tools/__tests__`)

A seeded drop card has NO 4-beat decode (the corpus row was never run through the decode engine) and fabricating one is forbidden. Making `sourceDecode` optional never invalidates existing data (loosening only); every existing producer still emits it.

- [ ] **Step 1: Write the failing test** — a `remix-card` block WITHOUT `sourceDecode` currently fails `RemixCardBlockSchema.safeParse`; assert it passes, and that a legacy block WITH `sourceDecode` still passes:

```ts
const seeded = { type: "remix-card", props: { adaptedHook: "h", angle: "a", whoItsFor: "w",
  formatBorrowed: "f", band: "Strong", fraction: "8/10 stop", scrollQuote: "q",
  model: "sim1-flash", provenance: "projected" } };
expect(RemixCardBlockSchema.safeParse(seeded).success).toBe(true);
```

- [ ] **Step 2: Run to verify FAIL.**
- [ ] **Step 3: Schema change** — in `blocks.ts`, append `.optional()` to the `sourceDecode: z.object({...})` and extend its comment:

```ts
    // OPTIONAL (v8 Phase 2): a drop-seeded remix card adapts a pre-torn CORPUS row that
    // never ran the decode engine — it omits sourceDecode rather than fabricating beats
    // (honesty spine). Every runner-produced card still carries the real 4-beat decode.
```

- [ ] **Step 4: Renderer guard** — in `remix-card-block.tsx`, `sourceDecode` is now possibly `undefined`. Wrap the three consumers:
  - Row 1 (`Their hook`, line ~128): render only when `sourceDecode` — a seeded card's hook pattern already shows on the receipt's madlib line.
  - Row 2 (`Their turn` / `Your angle`, line ~134): when `sourceDecode` absent, render the row with the RIGHT cell only (`rightLabel="Your angle"`); check `MapRow`'s props — it already supports a left-only row (Row 1), mirror for right-only or pass `leftLabel` undefined.
  - Expanded section (structure/emotionalBeat, lines ~201-205): render only when `sourceDecode`.
  Keep every existing-card render path byte-identical (all existing cards carry `sourceDecode`).
- [ ] **Step 5: Run the FULL suite** — `set -o pipefail && npx vitest run`. Expected: green (this file is shared with the flag-off world; the suite is the byte-identity gate). Known pre-existing failure in this worktree: `routing-cut.test.ts` (uncommitted `/start` restore, handoff §7.2) — unchanged count, not yours.
- [ ] **Step 6: Commit** — `git add src/lib/tools/blocks.ts src/components/thread/remix-card-block.tsx <test files> && git commit -m "feat(shelf): remix-card sourceDecode optional — seeded drops never fabricate a decode"`

### Task 8: Seed mapper `dropCardToRemixBlocks`

**Files:**
- Create: `src/lib/surfaces/drop-seed.ts`
- Test: `src/lib/surfaces/__tests__/drop-seed.test.ts`

**Interfaces:**
- Consumes: `LiveDropCard`, `bandFromStops` (`@/lib/engine/flash/flash-aggregate`), `RemixCardBlockSchema`/`RemixCardBlock`/`HookProof` (`@/lib/tools/blocks`).
- Produces: `dropUserTurnText(card): string`; `dropCardToRemixBlocks(card, audienceName?): RemixCardBlock[]` — ranked, schema-validated, invalid concepts dropped (mirrors the runner's safeParse gate).

- [ ] **Step 1: Write the failing tests**

```ts
import { dropCardToRemixBlocks, dropUserTurnText } from "../drop-seed";
import { RemixCardBlockSchema } from "@/lib/tools/blocks";

const card = { /* LiveDropCard literal: 3 concepts with personaStops 8/5/2, stopQuote set;
  handle "conor_harris_" (no @), viewsRaw 5_300_000, hookTemplate "madlib [x]",
  archetype "trap-mistake", videoUrl/coverUrl set */ };

describe("dropCardToRemixBlocks", () => {
  it("emits one validated remix-card per concept, winner leading, provenance projected", () => {
    const blocks = dropCardToRemixBlocks(card, null);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]!.props.adaptedHook).toBe(/* rank-1 hook */);
    for (const b of blocks) {
      expect(RemixCardBlockSchema.safeParse(b).success).toBe(true);
      expect(b.props.provenance).toBe("projected");
      expect(b.props.sourceDecode).toBeUndefined();
      expect(b.props.personas).toBeUndefined(); // angles arrive UNSCORED (v8 rule)
    }
  });
  it("receipt: @handle, real views, madlib, archetype — multiplier/baseline/fit ALWAYS null", () => {
    const p = dropCardToRemixBlocks(card, null)[0]!.props.proof!;
    expect(p.handle).toBe("@conor_harris_");
    expect(p.views).toBe(5_300_000);
    expect(p.hookTemplate).toBe("madlib [x]");
    expect(p.multiplier).toBeNull();
    expect(p.baselineLabel).toBeNull();
    expect(p.fitLabel).toBeNull();
  });
  it("band/fraction derive from the concept's own projection", () => {
    const b = dropCardToRemixBlocks(card, null)[0]!;
    expect(b.props.fraction).toBe("8/10 stop");
    expect(b.props.band).toBe("Strong");
  });
  it("drops a concept whose stopQuote is empty (schema min(1) — mirror the runner, never pad)", () => {
    /* concept 3 with stopQuote: "" → 2 blocks */
  });
  it("stamps audienceName only when calibrated", () => {});
  it("user turn text carries the adapted hook, not the donor's caption", () => {
    expect(dropUserTurnText(card)).toContain(card.hook);
  });
});
```

- [ ] **Step 2: Run to verify FAIL.**
- [ ] **Step 3: Implement** — build each block exactly like `remix-runner.ts:359-412` (same key order, same conditional spreads) with these differences: no `sourceDecode`, no top-level `coverUrl`, `proof` always present:

```ts
const proof: HookProof = {
  handle: card.handle.startsWith("@") ? card.handle : `@${card.handle}`,
  videoUrl: card.videoUrl,
  coverUrl: card.coverUrl,
  hookTemplate: card.hookTemplate,
  archetype: card.archetype,
  multiplier: null,        // LOCKED: no corpus multiplier anywhere (owner call #1)
  views: card.viewsRaw > 0 ? card.viewsRaw : null,
  baselineLabel: null,
  fitLabel: null,          // nothing scored this SOURCE against the audience
};
```

Per concept: `stops = clampStops(concept.personaStops)` (same helper shape as Task 5 — local copy, it's 3 lines), `band: bandFromStops(stops)`, `fraction: \`${stops}/10 stop\``, `scrollQuote: concept.stopQuote?.trim() ?? ""`, then `RemixCardBlockSchema.safeParse` and keep only successes. Concepts arrive pre-ranked on the card. `dropUserTurnText(card)` returns `` `Remix this for me: "${card.hook}"` `` with the `// v8 copy — owner reviews before launch (handoff §5)` marker.

- [ ] **Step 4: Run to verify PASS.**
- [ ] **Step 5: Commit** — `git add src/lib/surfaces/drop-seed.ts src/lib/surfaces/__tests__/drop-seed.test.ts && git commit -m "feat(shelf): drop→remix-card seed mapper, projection-honest"`

### Task 9: Seed route `POST /api/surfaces/drops/remix`

**Files:**
- Create: `src/app/api/surfaces/drops/remix/route.ts`

**Interfaces:**
- Consumes: flag/auth/CSRF (as Task 6), `getFreshSurfaceCards`, `resolveUserAudience`+`audienceKeyOf`, `createNewThread`/`setThreadTitleIfEmpty` (`@/lib/threads/threads`), `insertMessage` (`@/lib/threads/messages`), Task 8.
- Produces: `{ threadId: string }`. Errors: 404 flag/`drop_not_found`, 401, 415/403 (CSRF), 502 `seed_failed`.

- [ ] **Step 1: Write the route**

```ts
/**
 * POST /api/surfaces/drops/remix { contentId } — Remix a drop (v8 Phase 2).
 *
 * Seeds a REAL persisted thread from the CACHED drop: a user turn + the card's
 * 3 ranked adapt concepts as remix-card blocks (provenance "projected"). ZERO
 * model calls — the adapt output was computed by the daily warm; the sim stays
 * fire-on-demand (v8 rule: the angles arrive unscored; the shelf meter was the
 * only pre-score). The composer's normal open-thread rehydration renders it.
 *
 * contentId is looked up ONLY inside the caller's own cached batch for the
 * server-resolved audience (CR-01 — no cross-user reads possible by construction).
 * A stale/absent cache → 404 drop_not_found (the shelf re-warms tomorrow's cards).
 */
import { createClient } from "@/lib/supabase/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { CONCEPT_V8_ENABLED } from "@/lib/flags/concept-v8";
import { resolveUserAudience } from "@/lib/audience/resolve-user-audience";
import { audienceKeyOf, getFreshSurfaceCards } from "@/lib/surfaces/surface-reactions-repo";
import type { LiveDropCard } from "@/lib/surfaces/live-cards";
import { dropCardToRemixBlocks, dropUserTurnText } from "@/lib/surfaces/drop-seed";
import { createNewThread, setThreadTitleIfEmpty } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!CONCEPT_V8_ENABLED) return Response.json({ error: "not_found" }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const guard = csrfGuard(request);
  if (guard) return guard;

  let contentId: unknown;
  try { ({ contentId } = await request.json()); } catch { /* falls through to 400 */ }
  if (typeof contentId !== "string" || !contentId) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const audience = await resolveUserAudience(supabase, user.id);
    const cached = await getFreshSurfaceCards<LiveDropCard>(
      supabase, user.id, audienceKeyOf(audience), "drop",
    );
    const card = cached?.find((c) => c.contentId === contentId);
    if (!card) return Response.json({ error: "drop_not_found" }, { status: 404 });

    const audienceName = audience && !audience.is_general ? audience.name : null;
    const blocks = dropCardToRemixBlocks(card, audienceName);
    if (blocks.length === 0) return Response.json({ error: "seed_failed" }, { status: 502 });

    const thread = await createNewThread(user.id);
    await insertMessage(thread.id, "user", [
      { type: "markdown", props: { text: dropUserTurnText(card) } },
    ]);
    await insertMessage(thread.id, "assistant", blocks);
    await setThreadTitleIfEmpty(user.id, thread.id, card.hook);
    return Response.json({ threadId: thread.id });
  } catch {
    return Response.json({ error: "seed_failed" }, { status: 502 });
  }
}
```

(Verify the markdown block type name against `src/lib/tools/block-registry.ts` before writing — the rehydrator reads `type === 'markdown'` with `props.text`; if `validateBlock` expects a different registered shape for user turns, copy EXACTLY what an existing run route inserts for the user turn — see `chat/route.ts`'s user-turn insert.)

- [ ] **Step 2: Typecheck** — tsc clean.
- [ ] **Step 3: Commit** — `git add src/app/api/surfaces/drops/remix/route.ts && git commit -m "feat(shelf): remix seed route — cached drop → persisted 3-angle thread"`

### Task 10: `DropShelf` component

**Files:**
- Create: `src/components/app/home/v8/drop-shelf.tsx`
- Test: `src/components/app/home/v8/__tests__/drop-shelf.test.tsx`

**Interfaces:**
- Consumes: `LiveDropCard`, `personasToCardFace` (`@/lib/surfaces/live-cards`), `CoverFill` (`@/components/primitives/CoverFill`).
- Produces: `DropShelf({ cards, status, onRemix })` — presentational only (the warm hook lives in the composer, Task 11).

Anatomy per mock §2 (content there is FABRICATED — structure only): horizontal card, thumb left (9:16, ~104px wide) with a view-count badge, body right: serif adapted hook · meter (10 segments + `N/10`) · Remix button. Card radius 12 (`rounded-xl`), borders `white/[0.06]`, fill = the thread-card tone (measure `globals.css` for the token that compiles to `#252524` — use the token class, never hex). Meter segments: lit `bg-foreground-secondary`, unlit `bg-white/[0.08]` — cream/dim, ZERO accent. Hook: serif via `font-serif` + an existing text ROLE (measure `globals.css`; pick the role nearest 16–17px — `text-reading` or `text-title`; NO `text-[Npx]`, the type-scale guard bans it).

- [ ] **Step 1: Write the failing tests** (line 1: `/** @vitest-environment happy-dom */`):

```tsx
/** @vitest-environment happy-dom */
import { render, screen, fireEvent } from "@testing-library/react";
import { DropShelf } from "../drop-shelf";

const card = (over = {}) => ({
  contentId: "t1", hook: "An adapted hook line", coverUrl: "https://x/c.jpg",
  videoUrl: "https://t/v", views: "8.1M", viewsRaw: 8_100_000, handle: "h",
  archetype: null, hookTemplate: null, concepts: [], 
  personas: Array.from({ length: 10 }, (_, i) => ({
    archetype: `a${i}`, verdict: i < 8 ? "stop" : "scroll", quote: "",
  })),
  ...over,
});

describe("DropShelf", () => {
  it("renders six skeletons while warming", () => {
    render(<DropShelf cards={[]} status="warming" onRemix={() => {}} />);
    expect(screen.getAllByTestId("drop-skeleton")).toHaveLength(6);
  });
  it("renders nothing at all when ready and empty (honest empty — greeting-only arrival)", () => {
    const { container } = render(<DropShelf cards={[]} status="ready" onRemix={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
  it("renders hook, views, and the meter derived from real personas", () => {
    render(<DropShelf cards={[card()]} status="ready" onRemix={() => {}} />);
    expect(screen.getByText("An adapted hook line")).toBeInTheDocument();
    expect(screen.getByText("8.1M")).toBeInTheDocument();
    expect(screen.getByTestId("drop-meter-t1")).toHaveTextContent("8/10");
  });
  it("Remix fires onRemix with the card; the thumb links to the original", () => {
    const onRemix = vi.fn();
    render(<DropShelf cards={[card()]} status="ready" onRemix={onRemix} />);
    fireEvent.click(screen.getByRole("button", { name: /remix/i }));
    expect(onRemix).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: /watch the original/i })).toHaveAttribute("href", "https://t/v");
  });
  it("never renders accent, donor handle, or a multiplier", () => {
    const { container } = render(<DropShelf cards={[card()]} status="ready" onRemix={() => {}} />);
    expect(container.innerHTML).not.toMatch(/accent|#FF6363|ff6363/);
    expect(container.textContent).not.toContain("h"); // handle stays off the face — assert precisely: not /@h/
    expect(container.textContent).not.toMatch(/[0-9.]+x/i);
  });
});
```

(Tighten the handle assertion to `not.toMatch(/@?\bh\b/)` scoped sensibly — a bare "h" appears in words; assert on a realistic handle string like `conor_harris_` instead.)

- [ ] **Step 2: Run to verify FAIL.**
- [ ] **Step 3: Implement** — structure:

```tsx
"use client";
/**
 * The v8 shelf (Phase 2) — six remix-first drop cards between the greeting and the
 * composer (spec §1). Presentational: the composer owns the warm (useLazyWarm) and
 * the Remix handoff. Face = real still + real views + adapted hook + the REAL
 * pre-run meter (personasToCardFace). ZERO accent (locked); donor niche/handle and
 * multipliers never render here. Meter is display-only until Phase 3 (the report).
 */
```

- Root: `null` when `status === "ready" && cards.length === 0`; else `<section data-testid="drop-shelf" className="w-full pb-3">` containing a `grid grid-cols-1 gap-2.5 md:grid-cols-2`.
- Skeletons: 6 × `<div data-testid="drop-skeleton" className="h-[132px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03]" />`.
- `DropCard` (local): `<article>` flex row; thumb = `<a aria-label="Watch the original" href={videoUrl} target="_blank" rel="noopener noreferrer">` (render a plain `<span>` when `videoUrl` null) wrapping `CoverFill` in a `relative w-[104px] shrink-0 overflow-hidden rounded-lg` box with the views badge (`text-micro`, play glyph, dark scrim) bottom-left; body = hook (`font-serif <role> text-foreground`), meter (`data-testid={drop-meter-${contentId}}`: 10 `h-[3px] w-2.5 rounded-full` spans + `<b>{stop}<span className="text-foreground-muted">/10</span></b>` in `text-label`), Remix `<button type="button">` styled like the ChipsRow chip (neutral cream, hover 10%).
- `const face = personasToCardFace(card.personas)` — `face.stop` drives lit segments.
- [ ] **Step 4: Run to verify PASS.**
- [ ] **Step 5: Commit** — `git add src/components/app/home/v8/drop-shelf.tsx src/components/app/home/v8/__tests__/drop-shelf.test.tsx && git commit -m "feat(shelf): DropShelf — six drop cards, zero accent, real meter"`

### Task 11: Composer integration + arrival headline

**Files:**
- Modify: `src/components/app/home/v8/arrival.tsx`
- Modify: `src/components/app/home/composer.tsx` (both v8 arrival mounts: ~3673 and ~3755; state near the other v8 state)
- Test: extend `src/components/app/home/v8/__tests__/arrival.test.tsx` + `src/components/app/home/__tests__/composer-v8.test.tsx`

- [ ] **Step 1: Failing arrival test** — `<ArrivalV8 shelfReady />` renders the "Tonight's remixes" headline + the whisper; default renders the time greeting exactly as today.
- [ ] **Step 2: Implement `ArrivalV8`**

```tsx
export function ArrivalV8({ shelfReady = false }: { shelfReady?: boolean }) {
  // …existing greeting state unchanged…
  // v8 copy — owner reviews before launch (handoff §5). The shelf headline only
  // ever shows over REAL cards (shelfReady) — never a promise over an empty page.
  const headline = shelfReady ? "Tonight's remixes" : greeting;
  return (
    <div data-testid="arrival-v8" className="w-full px-1 pb-3">
      <h1 className="font-serif text-[26px] font-normal leading-tight tracking-[-0.01em] text-foreground">
        {headline}
        {name ? `, ${name}` : ""}.
      </h1>
      {shelfReady ? (
        <p className="mt-1.5 text-caption text-foreground-muted">
          Proven videos · rebuilt for your niche
        </p>
      ) : null}
    </div>
  );
}
```

(The existing `text-[26px]` greeting size carries the documented type-scale allowlist entry — reuse the same h1 classes verbatim, do not add a new arbitrary size.)

- [ ] **Step 3: Run arrival tests** — PASS.
- [ ] **Step 4: Failing composer test** (extend `composer-v8.test.tsx`, same harness/mocks as its existing cases): flag-on empty home renders `drop-shelf` (mock `useLazyWarm` module → 6 cards ready; assert testid present in BOTH layout branches if the harness reaches them, else the branch it renders); flag-on + `warming` → skeletons; assert the fetch/store wiring of `handleRemixDrop` by clicking a card's Remix and asserting the POST to `/api/surfaces/drops/remix` and `switchThread` (mock fetch; import the board store and spy `switchThread`/`setActiveThreadId` the way the existing tests spy store actions).
- [ ] **Step 5: Integrate in `composer.tsx`** (all additions inside the existing v8/flag context — flag-off renders byte-identical):

1. Imports: `DropShelf`, `LiveDropCard`, `useLazyWarm`, `setActiveThreadCookie` (already imported? check — `active-thread-cookie` is used by the sidebar; import here if absent).
2. State (near other v8 state): 

```ts
// v8 shelf warm key — advances only AFTER the last-audience persist settles
// (use-lazy-warm contract: the server resolves the audience; the key only drives
// the re-warm, so it must not lead the persist).
const [warmAudienceKey, setWarmAudienceKey] = useState<string>("general");
```

3. In `handleSelectAudience` (line ~1159): capture the last-audience PUT promise and chain the key advance (flag-gated so flag-off timing is untouched):

```ts
if (newId === null || UUID_PATTERN.test(newId)) {
  const put = fetch("/api/settings/last-audience", { /* …unchanged… */ }).catch(() => {});
  if (CONCEPT_V8_ENABLED) void put.then(() => setWarmAudienceKey(newId ?? "general"));
  else void put;
}
```

4. Warm hook (top level, unconditional call — `enabled` gates all effects):

```ts
// v8 shelf (Phase 2): today's drops over the daily-surface cache. First visit of
// the day warms via POST (skeletons); the platform lens deliberately does NOT key
// this cache (spec: the lens changes generation prompts only).
const dropsEnabled =
  CONCEPT_V8_ENABLED && AMBIENT_V2_ENABLED && !hasConversationContent && !startEngaged && !rehydrating;
const { items: dropCards, status: dropsStatus } = useLazyWarm<LiveDropCard>(
  null, "/api/surfaces/drops", "drops", dropsEnabled, warmAudienceKey,
);
```

(Place AFTER `hasConversationContent`/`startEngaged`/`rehydrating` are declared — check TDZ like the Phase-1 comments warn.)

5. Handler:

```ts
// Remix a drop: seed the persisted thread from the CACHED card (zero model calls)
// and switch to it — the normal rehydration renders the 3-angle stack.
const [remixingDropId, setRemixingDropId] = useState<string | null>(null);
const handleRemixDrop = useCallback(async (card: LiveDropCard) => {
  if (remixingDropId) return; // one seed in flight
  setRemixingDropId(card.contentId);
  try {
    const res = await fetch("/api/surfaces/drops/remix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: card.contentId }),
    });
    if (!res.ok) return; // honest no-op — the card stays; nothing fabricated
    const { threadId } = (await res.json()) as { threadId: string };
    setActiveThreadCookie(threadId);
    setActiveThreadId(threadId);
    switchThread();
  } catch {
    // network failure → no-op (card stays tappable)
  } finally {
    setRemixingDropId(null);
  }
}, [remixingDropId, setActiveThreadId, switchThread]);
```

(`switchThread` — use the exact board-store action name the Sidebar uses; verify at `src/components/sidebar/Sidebar.tsx` imports.)

6. Both v8 arrival mounts become:

```tsx
{CONCEPT_V8_ENABLED ? (
  // v8 arrival: greeting + the shelf (Phase 2) — spec §0b: greeting · drops · composer.
  <>
    <ArrivalV8 shelfReady={dropCards.length > 0} />
    <DropShelf cards={dropCards} status={dropsStatus} onRemix={(c) => void handleRemixDrop(c)} />
  </>
) : (
  <AmbientStartHome … unchanged … />
)}
```

- [ ] **Step 6: Run the composer v8 tests** — PASS.
- [ ] **Step 7: Run the FULL suite** — `set -o pipefail && npx vitest run`. Expected: green except the pre-existing `routing-cut.test.ts` worktree failure (same count as before this plan — verify by comparing against a `git stash`-free baseline run from Task 7).
- [ ] **Step 8: Commit** — `git add src/components/app/home/v8/arrival.tsx src/components/app/home/v8/drop-shelf.tsx src/components/app/home/composer.tsx src/components/app/home/v8/__tests__/arrival.test.tsx src/components/app/home/__tests__/composer-v8.test.tsx && git commit -m "feat(shelf): shelf mounted on the v8 arrival — warm, remix handoff, tonight's-remixes headline"`

### Task 12: Gates + signed-in browser verification

- [ ] **Step 1: Gates** —

```bash
node node_modules/typescript/bin/tsc --noEmit
npm run build
set -o pipefail && npx vitest run
```

All three must pass (vitest: only the pre-existing `routing-cut.test.ts` failure, unchanged). `npm run build` also proves no `src/lib/surfaces/*` → API-route import break (standing trap).

- [ ] **Step 2: Start the flag-on dev server** (reaper: restart if idle >10 min):

```bash
lsof -ti:3000 || true   # pick a free port
NEXT_PUBLIC_CONCEPT_V8=true NEXT_PUBLIC_AMBIENT_V2=true npm run dev -- --port 3002
```

- [ ] **Step 3: Mint the signed-in session** — memory `signed-in-verification-recipe`: POST the Supabase auth REST endpoint with the e2e credentials (memory `e2e-auth-state-is-dead`), write the chunked cookie into the browser context. The previous session's `mint-auth.mjs`/`shoot-v8.mjs` may still exist in its scratchpad; rewrite (~5 min) if gone. ⚠️ REAL PROD ACCOUNT: render/open only. The one drops warm this triggers is the surface's own render path (≤6 adapt + 1 Flash, then cached for the day) — fire it ONCE; never tap send, never fire a sim, never touch quota-gated skills.
- [ ] **Step 4: Verify at 393×852 AND 1440×900** — one raw-Playwright context PER viewport, opened at size (never resized), `animations: 'disabled'`, `caret: 'hide'`, tight `clip`, never `networkidle`:
  - Warming skeletons appear on first load, settle to ≤6 cards.
  - Cards: REAL cover images (natural size > 0 — assert via `getComputedStyle`/img complete, not just DOM presence — standing trap: believe the screenshot), real view counts, serif adapted hooks, meter `N/10`.
  - Layout: single column at 393, 2-col at 1440; no horizontal overflow (`document.documentElement.scrollWidth === clientWidth` AND visual check — an ancestor can clip).
  - Accent sweep: no element inside `[data-testid="drop-shelf"]` computes `color`/`background-color`/`border-color` to `rgb(255, 99, 99)`.
  - Tap a thumb → new tab to the original (assert the `<a href>`, don't navigate the prod page away).
  - Tap Remix → thread renders the user turn + a 3-card remix stack, fraction text reads "N/10 stop" with the PROJECTED (conditional) language, no decode map "Their hook/turn" cells, receipt shows @handle + views and NO multiplier.
  - Screenshots of both viewports (arrival + seeded thread) into the scratchpad; look at them.
- [ ] **Step 5: Flag-off byte-identity probe** — restart the dev server WITHOUT `NEXT_PUBLIC_CONCEPT_V8`; assert `/home` renders the AmbientStartHome arrival exactly as before (no `drop-shelf` testid, no drops fetch in the network log) and `curl -X POST /api/surfaces/drops` → 404.
- [ ] **Step 6: Commit any fixes; final gates re-run if anything changed.**

### Task 13: Push + PR note

- [ ] **Step 1:** `git fetch origin && git rev-list --count HEAD..origin/main` — re-measure before pushing (main moves; co-sessions move refs).
- [ ] **Step 2:** Push `lane/platform-concept`. Vercel note: git is DISCONNECTED (memory) — merging does not deploy; a green Vercel check is not a build (the gates already ran).
- [ ] **Step 3:** PR body additions (update the open lane PR or note for the owner):
  - Phase 2 shipped behind `CONCEPT_V8_ENABLED` (flag-off byte-identical; both new routes 404 without the flag).
  - **Owner calls surfaced:** #3 drop economics — warm cost is 1 embed + ≤6 adapt + 1 batched Flash per user×audience×day, currently unreachable in prod (flag) and unbilled (no quota wiring; needs a ruling before any launch). Rehosting: NOT new build — 489/532 corpus rows already carry durable public covers; the 43 others are excluded by `isDropReady` (backfill exists: `scripts/backfill-corpus-covers.ts`). Copy ("Tonight's remixes", whisper, user-turn text) is direction-grade, marked for review. `sourceDecode` made optional on `remix-card` (schema loosening only; every runner card still carries it).
  - Phase-3 seams left: the meter is display-only (report opens it in Phase 3); Simulate card action lands with the report.

## Self-Review Notes (spec coverage)

- Spec §1 arrival: six cards ✅ (T5/T10/T11) · round-robin archetype spread ✅ (T4) · adapted serif hook ✅ (T10) · real thumb + view count, tap → original ✅ (T10) · verdict stamp from calibrated audience ✅ (T5 real Flash personas → T10 meter) · no donor niche / no multiplier ✅ (locked in T5/T8/T10 tests) · one action Remix ✅ · daily rotation ✅ (T4) · warming skeletons ✅ (T10) · single col mobile / 2-col desktop ✅ · composer below, nothing else ✅ (mount placement T11).
- Handoff §4.2 Remix→thread with 3-angle adapt turn ✅ (T8/T9), render treatment = existing ranked remix-card stack, winner leading, unscored/projected ✅.
- Fire-on-demand rule ✅: only the warm pre-scores; Remix tap = zero model calls; no `personas` on seeded blocks.
- Grounding preview read before building ✅ (session log 2026-08-08: structural slice verified against the live corpus).
- Open owner calls NOT built past ✅: no billing, no scraper, flag-gated routes.
- In-progress row (spec §1 "not designed yet") — deliberately out of scope, unchanged.
- Type consistency: `LiveDropCard` field names identical across T2/T5/T8/T10; `selectDailyDrops(rows, count, dayIndex)` signature identical T4/T5; endpoint/responseKey pair `("/api/surfaces/drops", "drops")` identical T6/T11.
