# Remix Shoot Sheet — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a remix structurally faithful to its source — the adapt call writes one line per timed beat of the original instead of three free-floating concepts — and render those beats as text on the existing remix card.

**Architecture:** `analyzeVideoWithOmni` already returns per-segment timings, `spoken_text`, `on_screen_text` and `visual_event` on every remix run; `runDecode` throws them away. Phase 1 adds a deterministic assembler (`blueprint.ts`) that merges those raw segments into ≤8 role-tagged beats, widens `AdaptInput` to carry them, rewrites the adapt prompt to fill every beat, and persists the result to a new `remix_blueprints` table that later phases read for frames, clips and revision. **No new model calls — the perception is already paid for.**

**Tech Stack:** TypeScript, Next.js 15 App Router, Zod, Vitest, Supabase (Postgres + RLS), Qwen via DashScope.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-10-remix-shoot-sheet-design.md`. Read §5.1–§5.3 and §7 before starting.
- **Beat cap is 8 (D10).** Any change that raises it must revisit `TIMEOUT_MS` in `adapt.ts` in the same commit — the cap is what keeps the adapt response inside the existing 90s budget.
- **`DecodeResult` is not modified.** It is persisted to `variants.remix.decode`, carries invariant D-06 (exactly 4 beats, fixed order), and is consumed independently by `POST /api/remix/adapt`.
- **`AdaptInput.niche` stays.** `POST /api/remix/adapt` supplies it and knows nothing about briefs. `target` is additive and nullable.
- **Back-compat is absolute.** Every field added to `AdaptConcept` and `RemixCardBlockSchema` is optional. A remix card persisted before this lane must render byte-identically.
- **Ids are url-safe `nanoid(12)`, never UUIDs.** `/api/remix/adapt` shipped a `.uuid()` validator that rejected every real id with a 400. Match `analysis_id`: `z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/u)`.
- **Migrations are applied by hand via the Supabase SQL editor.** `supabase db push` is unsafe in this project (migration-ledger drift). The plan writes the `.sql` file; a human runs it.
- **RLS must be on WITH a policy.** A table with RLS enabled and no policies reads as empty through the caller's client and writes fail silently. Verify by reading a row back.
- **Never add an NLP/POS dependency.** The echo guard is a stopword approximation by design (§7).
- **Test command:** `npm test -- <path>` (vitest). Typecheck: `npx tsc --noEmit`. **vitest does not typecheck — run both.**
- **Design system:** cream on charcoal, `--color-accent` (`#FF6363`) at near-zero dosage. The beat rows get **no accent** — the card already spends its single coral on the Borrowed chip.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/engine/remix/blueprint.ts` *(new)* | `SourceBlueprint` / `BlueprintBeat` types + `buildBlueprint()`. Pure, deterministic, no I/O, no model call. |
| `src/lib/engine/remix/__tests__/blueprint.test.ts` *(new)* | Merge, role precedence, no-speech fallback, degenerate inputs. |
| `src/lib/engine/remix/echo-guard.ts` *(new)* | `sharedContentTokens()` — stopword-approximation overlap used by the echo test and by live verification. |
| `src/lib/engine/remix/__tests__/echo-guard.test.ts` *(new)* | Proves the guard catches topical echo and passes structural echo. |
| `src/lib/engine/remix/decode-types.ts` *(modify)* | `AdaptedBeat`, `AdaptInput.blueprint`/`.target`, `AdaptConcept.script`. |
| `src/lib/engine/remix/adapt.ts` *(modify)* | Zod schema, `buildAdaptUserContent`, `ADAPT_SYSTEM_PROMPT`. |
| `supabase/migrations/20260810120000_remix_blueprints.sql` *(new)* | Table + RLS. Applied by hand. |
| `src/lib/remix/blueprint-repo.ts` *(new)* | `insertBlueprint()` / `getBlueprint()`. The only module that touches the table. |
| `src/lib/tools/runners/remix-runner.ts` *(modify)* | Assemble blueprint → pass to adapt → return it for persistence → stamp `blueprintId`. |
| `src/lib/tools/blocks.ts` *(modify)* | `RemixCardBlockSchema.props.blueprintId` (optional). |
| `src/app/api/tools/remix/run/route.ts` *(modify)* | Persist the blueprint row; pass `blueprintId` on the SSE face. |
| `src/app/api/remix/blueprint/[id]/route.ts` *(new)* | `GET` → `{ script }` for the renderer. Auth + ownership gated. |
| `src/components/thread/remix-beats.tsx` *(new)* | The beat-row list. Own file so the 360-line card doesn't grow a second responsibility. |
| `src/components/thread/remix-card-block.tsx` *(modify)* | Mount `<RemixBeats>` when `blueprintId` is present. |

### One design decision this plan locks in

**The card carries `blueprintId` only; the script is fetched.** The alternative — inlining the adapted script on the block *and* storing it in the table — was rejected: phase 5's `revise_remix` rewrites the script, and a copy inside an already-persisted thread message would drift from the row silently. One source of truth, one fetch.

---

## Task 1: Blueprint assembly

**Files:**
- Create: `src/lib/engine/remix/blueprint.ts`
- Test: `src/lib/engine/remix/__tests__/blueprint.test.ts`

**Interfaces:**
- Consumes: `OmniStructuralInput` from `./decode-types` (already carries `segments?`, `emotion_arc?`, `factors`).
- Produces: `buildBlueprint(structural: OmniStructuralInput): SourceBlueprint`, plus exported types `SourceBlueprint`, `BlueprintBeat`, `BeatRole`, and the constant `MAX_BEATS = 8`.

Background the implementer needs:

- `segments` come from `normalizeSegments` (`omni-analysis.ts:260`), which **always returns a non-empty grid** with `is_hook_zone` and `idx` set — even when the model emitted none. `segments` is `undefined` only when the whole omni call failed.
- `is_hook_zone` is **not** a model judgment. `normalize-segments.ts:272` sets it as `t_start < 3`. Treat it as "the first 3 seconds".
- `MIN_CELL_WIDTH_S = 1` and there is **no upper bound** on segment count. A 30s video can arrive as 20+ cells. Merging is what keeps the adapt call inside its budget.
- `emotion_arc` points are `{ timestamp_ms, intensity_0_1, label? }` — note **milliseconds**, while segments are in **seconds**.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/engine/remix/__tests__/blueprint.test.ts
import { describe, it, expect } from "vitest";
import { buildBlueprint, MAX_BEATS } from "../blueprint";
import type { OmniStructuralInput } from "../decode-types";

/** Minimal valid structural input; override per test. */
function structural(over: Partial<OmniStructuralInput> = {}): OmniStructuralInput {
  return {
    hook_decomposition: {
      visual_stop_power: 5, audio_hook_quality: 5, text_overlay_score: 5,
      first_words_speech_score: 5, weakest_modality: "audio_hook_quality",
      visual_audio_coherence: 5, cognitive_load: 5,
    },
    factors: [],
    video_signals: { visual_production_quality: 5, pacing_score: 5, transition_quality: 5 },
    content_summary: "", overall_impression: "",
    content_type: "talking_head", niche_primary_slug: "fitness",
    ...over,
  };
}

function seg(t_start: number, t_end: number, over: Record<string, unknown> = {}) {
  return {
    t_start, t_end,
    visual_event: `visual ${t_start}`,
    audio_event: `audio ${t_start}`,
    is_hook_zone: t_start < 3,
    spoken_text: `words at ${t_start}`,
    on_screen_text: null,
    ...over,
  };
}

describe("buildBlueprint", () => {
  it("merges more than MAX_BEATS raw segments down to at most MAX_BEATS", () => {
    const segments = Array.from({ length: 20 }, (_, i) => seg(i, i + 1));
    const bp = buildBlueprint(structural({ segments }));
    expect(bp.beats.length).toBeLessThanOrEqual(MAX_BEATS);
    expect(bp.beats.length).toBeGreaterThan(0);
  });

  it("preserves the full timeline across merged beats — no gaps, no overlap", () => {
    const segments = Array.from({ length: 20 }, (_, i) => seg(i, i + 1));
    const bp = buildBlueprint(structural({ segments }));
    expect(bp.beats[0].t_start).toBe(0);
    expect(bp.beats[bp.beats.length - 1].t_end).toBe(20);
    for (let i = 1; i < bp.beats.length; i++) {
      expect(bp.beats[i].t_start).toBe(bp.beats[i - 1].t_end);
    }
  });

  it("counts absorbed boundaries on each merged beat", () => {
    const segments = Array.from({ length: 20 }, (_, i) => seg(i, i + 1));
    const bp = buildBlueprint(structural({ segments }));
    const totalCuts = bp.beats.reduce((n, b) => n + b.cuts, 0);
    expect(totalCuts).toBe(20);
  });

  it("tags the first-3s beat as hook EVEN WHEN the emotion peak also falls inside it", () => {
    const segments = [seg(0, 2), seg(2, 6), seg(6, 10)];
    const bp = buildBlueprint(structural({
      segments,
      emotion_arc: [
        { timestamp_ms: 1000, intensity_0_1: 0.9 }, // peak inside the hook zone
        { timestamp_ms: 8000, intensity_0_1: 0.2 },
      ],
    }));
    expect(bp.beats[0].role).toBe("hook");
    // hook wins the overlap, so `turn` is not also assigned to beat 0
    expect(bp.beats.filter((b) => b.role === "turn").every((b) => b.index !== 0)).toBe(true);
  });

  it("tags the emotion-peak beat as turn when the peak is outside the hook zone", () => {
    const segments = [seg(0, 2), seg(2, 6), seg(6, 10), seg(10, 14)];
    const bp = buildBlueprint(structural({
      segments,
      emotion_arc: [
        { timestamp_ms: 500, intensity_0_1: 0.2 },
        { timestamp_ms: 7000, intensity_0_1: 0.95 },
      ],
    }));
    const turn = bp.beats.find((b) => b.role === "turn");
    expect(turn).toBeDefined();
    expect(turn!.t_start).toBeLessThanOrEqual(7);
    expect(turn!.t_end).toBeGreaterThan(7);
  });

  it("tags the final beat close, and splits the rest setup/payoff around the turn", () => {
    const segments = [seg(0, 2), seg(2, 6), seg(6, 10), seg(10, 14), seg(14, 18)];
    const bp = buildBlueprint(structural({
      segments,
      emotion_arc: [{ timestamp_ms: 7000, intensity_0_1: 0.95 }],
    }));
    expect(bp.beats[bp.beats.length - 1].role).toBe("close");
    const turnIdx = bp.beats.findIndex((b) => b.role === "turn");
    expect(bp.beats.slice(1, turnIdx).every((b) => b.role === "setup")).toBe(true);
  });

  it("reports has_speech false and null spoken on a silent source", () => {
    const segments = [seg(0, 2, { spoken_text: null }), seg(2, 6, { spoken_text: null })];
    const bp = buildBlueprint(structural({ segments }));
    expect(bp.has_speech).toBe(false);
    expect(bp.beats.every((b) => b.spoken === null)).toBe(true);
    expect(bp.words_per_second).toBe(0);
  });

  it("computes words_per_second from real speech", () => {
    // 4 words over 2s, then 4 words over 2s => 8 words / 4s = 2.0
    const segments = [
      seg(0, 2, { spoken_text: "one two three four" }),
      seg(2, 4, { spoken_text: "five six seven eight" }),
    ];
    const bp = buildBlueprint(structural({ segments }));
    expect(bp.words_per_second).toBeCloseTo(2.0, 2);
    expect(bp.has_speech).toBe(true);
  });

  it("attaches a weakness to the beat a low-scoring factor names", () => {
    const segments = [seg(0, 2), seg(2, 6)];
    const bp = buildBlueprint(structural({
      segments,
      factors: [{ name: "pacing", score: 4, rationale: "drags", improvement_tip: "cut earlier" }],
    }));
    expect(bp.beats.some((b) => b.weakness?.factor === "pacing")).toBe(true);
  });

  it("ignores factors that score well", () => {
    const segments = [seg(0, 2), seg(2, 6)];
    const bp = buildBlueprint(structural({
      segments,
      factors: [{ name: "pacing", score: 9, rationale: "tight" }],
    }));
    expect(bp.beats.every((b) => b.weakness === null)).toBe(true);
  });

  it("returns an empty-beat blueprint rather than throwing when segments are missing", () => {
    const bp = buildBlueprint(structural({ segments: undefined }));
    expect(bp.beats).toEqual([]);
    expect(bp.has_speech).toBe(false);
    expect(bp.duration_s).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test -- src/lib/engine/remix/__tests__/blueprint.test.ts`
Expected: FAIL — `Failed to resolve import "../blueprint"`.

- [ ] **Step 3: Implement `blueprint.ts`**

```ts
/**
 * blueprint.ts — the timed structural skeleton of a source video.
 *
 * Deterministic assembly from what analyzeVideoWithOmni ALREADY returns. No model call, no
 * new spend: the perception is paid for on every remix run and was previously discarded at
 * runDecode, which collapses everything below into four prose sentences.
 *
 * D10 (owner, 2026-08-10): raw segments merge to at most MAX_BEATS. normalize-segments sets
 * MIN_CELL_WIDTH_S = 1 with NO upper bound on count, so a 30s video arrives as 20+ one-second
 * cells. Handing those to adapt un-merged produces ~180 generated strings against a 90s
 * timeout — truncated JSON, failed Zod parse, graceful adapt_failed on most real videos.
 * 8 beats is also closer to how a creator thinks about a shoot than 20 one-second cells.
 */
import type { OmniStructuralInput } from "./decode-types";

/** D10 — the cap that keeps the adapt response inside its existing 90s budget. */
export const MAX_BEATS = 8;

/** Below this factor score a beat is flagged for repair rather than replication. */
const WEAK_FACTOR_SCORE = 5;

export type BeatRole = "hook" | "setup" | "turn" | "payoff" | "close";

export interface BlueprintBeat {
  index: number;
  t_start: number;
  t_end: number;
  duration_s: number;
  role: BeatRole;
  /** Verbatim source speech, joined across merged segments. null on a silent beat. */
  spoken: string | null;
  on_screen_text: string | null;
  visual_event: string;
  audio_event: string;
  /** How many raw segment boundaries this beat absorbed. */
  cuts: number;
  weakness: { factor: string; score: number; tip: string } | null;
}

export interface SourceBlueprint {
  duration_s: number;
  /** Source speech rate — the matching target for adapted lines. 0 when there is no speech. */
  words_per_second: number;
  /** false on slideshow / silent sources: the sheet goes on-screen-text-driven. */
  has_speech: boolean;
  beats: BlueprintBeat[];
}

type Segment = NonNullable<OmniStructuralInput["segments"]>[number];

function wordCount(s: string | null | undefined): number {
  if (!s) return 0;
  return s.trim().split(/\s+/u).filter(Boolean).length;
}

/**
 * Merge raw cells into at most MAX_BEATS groups of contiguous segments.
 *
 * Boundary preference: a segment that declares a `scene_boundary_reason` is a real cut and is
 * a better place to split than an arbitrary one. We keep those boundaries first, then fall back
 * to even distribution — never dropping or reordering a cell, so the timeline stays continuous.
 */
function groupSegments(segments: Segment[]): Segment[][] {
  if (segments.length <= MAX_BEATS) return segments.map((s) => [s]);

  const preferred = new Set<number>();
  segments.forEach((s, i) => {
    if (i > 0 && s.scene_boundary_reason) preferred.add(i);
  });

  // Start from the preferred cuts; if there are too many, keep the earliest MAX_BEATS-1.
  let cutPoints = [...preferred].sort((a, b) => a - b).slice(0, MAX_BEATS - 1);

  // Too few real boundaries — top up with an even spread so we still use the budget.
  if (cutPoints.length < MAX_BEATS - 1) {
    const step = segments.length / MAX_BEATS;
    for (let k = 1; k < MAX_BEATS && cutPoints.length < MAX_BEATS - 1; k++) {
      const idx = Math.round(k * step);
      if (idx > 0 && idx < segments.length && !cutPoints.includes(idx)) cutPoints.push(idx);
    }
    cutPoints = cutPoints.sort((a, b) => a - b).slice(0, MAX_BEATS - 1);
  }

  const groups: Segment[][] = [];
  let start = 0;
  for (const cut of cutPoints) {
    groups.push(segments.slice(start, cut));
    start = cut;
  }
  groups.push(segments.slice(start));
  return groups.filter((g) => g.length > 0);
}

function joinText(values: Array<string | null | undefined>): string | null {
  const parts = values.map((v) => v?.trim()).filter((v): v is string => !!v);
  return parts.length ? parts.join(" ") : null;
}

/**
 * Assign roles. Order matters and resolves a real overlap: `is_hook_zone` is mechanically
 * `t_start < 3` (normalize-segments.ts:272), NOT a model judgment, and on a short video the
 * emotion peak frequently falls inside those same 3 seconds. Hook wins.
 */
function assignRoles(beats: Omit<BlueprintBeat, "role">[], peakSeconds: number | null): BeatRole[] {
  const roles: (BeatRole | null)[] = beats.map(() => null);

  // 1. hook — the first-3s beats
  beats.forEach((b, i) => {
    if (b.t_start < 3) roles[i] = "hook";
  });

  // 2. turn — the beat containing the emotion peak, unless it is already the hook
  if (peakSeconds !== null) {
    const turnIdx = beats.findIndex((b) => peakSeconds >= b.t_start && peakSeconds < b.t_end);
    if (turnIdx >= 0 && roles[turnIdx] === null) roles[turnIdx] = "turn";
  }

  // 3. close — the final beat, unless already tagged
  if (roles.length > 0 && roles[roles.length - 1] === null) roles[roles.length - 1] = "close";

  // 4. setup before the turn, payoff after it
  const turnAt = roles.indexOf("turn");
  roles.forEach((r, i) => {
    if (r !== null) return;
    roles[i] = turnAt >= 0 && i < turnAt ? "setup" : turnAt >= 0 ? "payoff" : "setup";
  });

  return roles as BeatRole[];
}

export function buildBlueprint(structural: OmniStructuralInput): SourceBlueprint {
  const segments = structural.segments ?? [];

  if (segments.length === 0) {
    return { duration_s: 0, words_per_second: 0, has_speech: false, beats: [] };
  }

  const groups = groupSegments([...segments].sort((a, b) => a.t_start - b.t_start));

  const partial: Omit<BlueprintBeat, "role">[] = groups.map((group, index) => {
    const t_start = group[0].t_start;
    const t_end = group[group.length - 1].t_end;
    return {
      index,
      t_start,
      t_end,
      duration_s: Number((t_end - t_start).toFixed(2)),
      spoken: joinText(group.map((s) => s.spoken_text)),
      on_screen_text: joinText(group.map((s) => s.on_screen_text)),
      visual_event: group.map((s) => s.visual_event).filter(Boolean).join(" → "),
      audio_event: group[0].audio_event ?? "",
      cuts: group.length,
      weakness: null,
    };
  });

  // Emotion peak → seconds. emotion_arc is in MILLISECONDS; segments are in seconds.
  const arc = structural.emotion_arc ?? [];
  const peak = arc.length
    ? arc.reduce((best, p) => (p.intensity_0_1 > best.intensity_0_1 ? p : best), arc[0])
    : null;
  const peakSeconds = peak ? peak.timestamp_ms / 1000 : null;

  const roles = assignRoles(partial, peakSeconds);

  // A weak factor is attached to the beat whose role it most plausibly describes. We do not
  // invent a mapping we cannot support: hook-named factors land on the hook beat, everything
  // else lands on the longest beat, which is where a pacing or structure problem actually lives.
  const weak = structural.factors.filter((f) => f.score < WEAK_FACTOR_SCORE);
  const beats: BlueprintBeat[] = partial.map((b, i) => ({ ...b, role: roles[i] }));

  for (const f of weak) {
    const isHookFactor = /hook|open|first/i.test(f.name);
    const target = isHookFactor
      ? beats.find((b) => b.role === "hook")
      : [...beats].sort((a, b) => b.duration_s - a.duration_s)[0];
    if (target && target.weakness === null) {
      target.weakness = { factor: f.name, score: f.score, tip: f.improvement_tip ?? f.rationale };
    }
  }

  const totalWords = beats.reduce((n, b) => n + wordCount(b.spoken), 0);
  const duration_s = Number((beats[beats.length - 1].t_end - beats[0].t_start).toFixed(2));

  return {
    duration_s,
    words_per_second: duration_s > 0 ? Number((totalWords / duration_s).toFixed(2)) : 0,
    has_speech: totalWords > 0,
    beats,
  };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test -- src/lib/engine/remix/__tests__/blueprint.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (vitest does not typecheck — this step is not optional.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/engine/remix/blueprint.ts src/lib/engine/remix/__tests__/blueprint.test.ts
git commit -m "feat(remix): timed blueprint assembled from perception we already pay for"
```

---

## Task 2: Echo guard

**Files:**
- Create: `src/lib/engine/remix/echo-guard.ts`
- Test: `src/lib/engine/remix/__tests__/echo-guard.test.ts`

**Interfaces:**
- Produces: `sharedContentTokens(a: string, b: string, exclude?: string): string[]`.

Why this exists: handing a model the source's words invites paraphrase, and this codebase has already been bitten — a few-shot example drawn from the test video came back verbatim and read as a perfect decode. The guard is a **stopword approximation, never POS tagging**: there is no NLP dependency in `package.json` and this must not add one.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/engine/remix/__tests__/echo-guard.test.ts
import { describe, it, expect } from "vitest";
import { sharedContentTokens } from "../echo-guard";

describe("sharedContentTokens", () => {
  it("finds no overlap between two lines on different topics", () => {
    expect(sharedContentTokens(
      "Your protein shake is making you fatter",
      "Your onboarding flow is losing you signups",
    )).toEqual([]);
  });

  it("ignores stopwords entirely", () => {
    // Only stopwords are shared here.
    expect(sharedContentTokens(
      "the and of a to is",
      "the and of a to is",
    )).toEqual([]);
  });

  it("catches a topical echo", () => {
    const shared = sharedContentTokens(
      "I tested creatine on 40 lifters",
      "I tested creatine with 40 athletes",
    );
    expect(shared).toContain("creatine");
    expect(shared).toContain("tested");
  });

  it("is case and punctuation insensitive", () => {
    expect(sharedContentTokens("Creatine, actually!", "creatine")).toEqual(["creatine"]);
  });

  it("excludes terms the creator asked for via the brief", () => {
    const shared = sharedContentTokens(
      "creatine timing is wrong",
      "creatine timing changes everything",
      "creatine timing",
    );
    expect(shared).toEqual([]);
  });

  it("treats an empty or null-ish input as no overlap", () => {
    expect(sharedContentTokens("", "anything")).toEqual([]);
    expect(sharedContentTokens("anything", "")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test -- src/lib/engine/remix/__tests__/echo-guard.test.ts`
Expected: FAIL — `Failed to resolve import "../echo-guard"`.

- [ ] **Step 3: Implement `echo-guard.ts`**

```ts
/**
 * echo-guard.ts — the mechanical guard on the D-01 reversal.
 *
 * D-01 (decode-types.ts:155) prevented the adapt call from ever seeing the source's content, so
 * it could only borrow format. The owner's fidelity ruling (D2, 2026-08-10) requires adapt to see
 * `spoken_text`, which removes that guarantee. This restores the intent by a different route:
 * STRUCTURAL echo (duration, cadence, beat count) is what we want; TOPICAL echo is the failure.
 *
 * Deliberately a stopword approximation, not POS tagging — there is no NLP dependency in this
 * tree and adding one for a test would be the wrong trade.
 */

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "than", "so", "because",
  "of", "to", "in", "on", "at", "by", "for", "with", "from", "into", "about",
  "is", "are", "was", "were", "be", "been", "being", "am",
  "do", "does", "did", "doing", "have", "has", "had", "having",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "its", "our", "their", "this", "that", "these", "those",
  "not", "no", "yes", "all", "any", "every", "more", "most", "some", "such",
  "will", "would", "can", "could", "should", "may", "might", "must",
  "what", "when", "where", "who", "why", "how", "which",
  "up", "out", "down", "over", "under", "just", "only", "very", "really",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Content tokens present in BOTH strings.
 *
 * @param exclude terms the creator explicitly asked for (the brief) — shared use of those is
 *                what they requested, not an echo.
 */
export function sharedContentTokens(a: string, b: string, exclude = ""): string[] {
  if (!a || !b) return [];
  const excluded = new Set(tokenize(exclude));
  const left = new Set(tokenize(a).filter((t) => !excluded.has(t)));
  const right = new Set(tokenize(b).filter((t) => !excluded.has(t)));
  return [...left].filter((t) => right.has(t));
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test -- src/lib/engine/remix/__tests__/echo-guard.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/remix/echo-guard.ts src/lib/engine/remix/__tests__/echo-guard.test.ts
git commit -m "feat(remix): stopword echo guard for the D-01 reversal"
```

---

## Task 3: Widen the adapt contract

**Files:**
- Modify: `src/lib/engine/remix/decode-types.ts:160-217` (`AdaptInput`, `AdaptConcept`)
- Modify: `src/lib/engine/remix/adapt.ts:35-68` (system prompt), `:72-95` (Zod), `:128-160` (user content)
- Test: `src/lib/engine/remix/__tests__/adapt.test.ts` (append)

**Interfaces:**
- Consumes: `SourceBlueprint` from Task 1.
- Produces: `AdaptedBeat` (exported from `decode-types.ts`); `AdaptInput` gains `blueprint: SourceBlueprint` and `target: string | null`; `AdaptConcept` gains `script?: AdaptedBeat[]`.

Critical back-compat notes:

- `AdaptInput.niche` **stays**. `POST /api/remix/adapt` builds `AdaptInput` via `decodeResultToAdaptInput(decode, niche)` and knows nothing about blueprints or briefs.
- Therefore `decodeResultToAdaptInput` must keep its current two-arg signature and supply an **empty blueprint** and `target: null`. Otherwise that route stops compiling.
- `script` is **optional** on `AdaptConcept` and its Zod schema. A model that omits it must still validate, exactly like `production`.

- [ ] **Step 1: Write the failing tests**

```ts
// append to src/lib/engine/remix/__tests__/adapt.test.ts
import { buildAdaptUserContent, ADAPT_SYSTEM_PROMPT } from "../adapt";
import { decodeResultToAdaptInput } from "../decode-types";
import type { SourceBlueprint } from "../blueprint";

const BLUEPRINT: SourceBlueprint = {
  duration_s: 14, words_per_second: 3.2, has_speech: true,
  beats: [
    { index: 0, t_start: 0, t_end: 1.8, duration_s: 1.8, role: "hook",
      spoken: "Your protein shake is making you fatter", on_screen_text: "STOP",
      visual_event: "tight crop, hard cut in", audio_event: "voice starts",
      cuts: 1, weakness: null },
    { index: 1, t_start: 1.8, t_end: 5.4, duration_s: 3.6, role: "setup",
      spoken: "I tracked 400 clients for six months", on_screen_text: null,
      visual_event: "b-roll of shaker", audio_event: "music under",
      cuts: 2,
      weakness: { factor: "pacing", score: 4, tip: "cut 1.2s earlier" } },
  ],
};

describe("adapt input widening", () => {
  it("puts every beat, its duration and its role into the user content", () => {
    const content = buildAdaptUserContent({
      hook_pattern: "h", structure: "s", the_turn: "t", emotional_beat: "e",
      repeatable: [{ label: "cold open", why_repeatable: "" }],
      niche: "fitness", blueprint: BLUEPRINT, target: null,
    });
    expect(content).toContain("HOOK");
    expect(content).toContain("1.8s");
    expect(content).toContain("Your protein shake is making you fatter");
    expect(content).toContain("tight crop, hard cut in");
  });

  it("names the weakness so the model repairs rather than replicates it", () => {
    const content = buildAdaptUserContent({
      hook_pattern: "h", structure: "s", the_turn: "t", emotional_beat: "e",
      repeatable: [], niche: "fitness", blueprint: BLUEPRINT, target: null,
    });
    expect(content).toContain("cut 1.2s earlier");
  });

  it("uses target as the adaptation target when present, not niche", () => {
    const content = buildAdaptUserContent({
      hook_pattern: "h", structure: "s", the_turn: "t", emotional_beat: "e",
      repeatable: [], niche: "fitness", blueprint: BLUEPRINT,
      target: "SaaS onboarding",
    });
    expect(content).toContain("SaaS onboarding");
    expect(content).not.toContain("CREATOR NICHE: fitness");
  });

  it("falls back to niche when target is null", () => {
    const content = buildAdaptUserContent({
      hook_pattern: "h", structure: "s", the_turn: "t", emotional_beat: "e",
      repeatable: [], niche: "fitness", blueprint: BLUEPRINT, target: null,
    });
    expect(content).toContain("fitness");
  });

  it("tells the model to match DURATION, and never mentions matching word count", () => {
    expect(ADAPT_SYSTEM_PROMPT).toMatch(/duration/i);
    expect(ADAPT_SYSTEM_PROMPT).not.toMatch(/match.{0,20}word count/i);
  });

  it("switches to on-screen text when the source has no speech", () => {
    const silent: SourceBlueprint = {
      ...BLUEPRINT, has_speech: false, words_per_second: 0,
      beats: BLUEPRINT.beats.map((b) => ({ ...b, spoken: null })),
    };
    const content = buildAdaptUserContent({
      hook_pattern: "h", structure: "s", the_turn: "t", emotional_beat: "e",
      repeatable: [], niche: "fitness", blueprint: silent, target: null,
    });
    expect(content).toMatch(/no speech|on-screen text only/i);
  });

  it("keeps decodeResultToAdaptInput a two-arg call for /api/remix/adapt", () => {
    const input = decodeResultToAdaptInput(
      {
        beats: [
          { id: "hook_pattern", body: "h", verdict: "present" },
          { id: "structure_pacing", body: "s", verdict: "present" },
          { id: "the_turn", body: "t", verdict: "present" },
          { id: "emotional_beat", body: "e", verdict: "present" },
        ],
        repeatable: ["cold open"],
        luck: [{ category: "algorithmic_outlier", note: "n" }],
      },
      "fitness",
    );
    expect(input.niche).toBe("fitness");
    expect(input.target).toBeNull();
    expect(input.blueprint.beats).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test -- src/lib/engine/remix/__tests__/adapt.test.ts`
Expected: FAIL — `buildAdaptUserContent` rejects the extra properties / `target` is not a known property.

- [ ] **Step 3: Add the types in `decode-types.ts`**

Add above `AdaptInput`:

```ts
/** One beat of the creator's own version, written against the source beat at the same index. */
export interface AdaptedBeat {
  /** Matches SourceBlueprint.beats[].index — the beat this line replaces. */
  index: number;
  /** What the creator says. On a no-speech source this stays empty and on_screen_text carries it. */
  spoken: string;
  /** Overlay text for this beat. */
  on_screen_text: string;
  /** How to shoot this beat — framing, camera position, movement. */
  shot: string;
  /** Present only when the source beat was flagged weak and this beat repairs it. */
  repair?: string;
}
```

Extend `AdaptInput` (keep every existing field, including `niche`):

```ts
  /** The creator-profile niche slug/label (ADAPT-02). Fallback when `target` is null. */
  niche: string;
  /**
   * The source's timed structural skeleton (D2/D10, 2026-08-10). Adapt writes one line per beat.
   * D-01 REVERSAL: this carries the source's verbatim `spoken` text, which D-01 deliberately kept
   * out. The topical-echo guard (echo-guard.ts) replaces the compile-time guarantee.
   */
  blueprint: SourceBlueprint;
  /**
   * The creator's brief (D3). When non-empty this IS the adaptation target and `niche` is ignored;
   * null → fall back to `niche`. Exists so a fitness source can be remixed into SaaS onboarding.
   */
  target: string | null;
```

Add the import at the top of `decode-types.ts`:

```ts
import type { SourceBlueprint } from "./blueprint";
```

Extend `AdaptConcept` with an optional `script`:

```ts
  /**
   * The beat-by-beat version of this concept (D2). OPTIONAL for the same reason as `production`:
   * a model that omits it must not fail the 3-concept contract, and `/api/remix/adapt` never asks.
   */
  script?: AdaptedBeat[];
```

Update `decodeResultToAdaptInput` to supply the new fields without changing its signature:

```ts
export function decodeResultToAdaptInput(decode: DecodeResult, niche: string): AdaptInput {
  const beatBody = (id: BeatId): string =>
    decode.beats.find((b) => b.id === id)?.body ?? "";

  return {
    hook_pattern: beatBody("hook_pattern"),
    structure: beatBody("structure_pacing"),
    the_turn: beatBody("the_turn"),
    emotional_beat: beatBody("emotional_beat"),
    repeatable: decode.repeatable.map((label) => ({ label, why_repeatable: "" })),
    niche,
    // `/api/remix/adapt` has no video and no brief — it decodes from a stored DecodeResult.
    // An empty blueprint makes the prompt fall through to the concept-only path.
    blueprint: { duration_s: 0, words_per_second: 0, has_speech: false, beats: [] },
    target: null,
  };
}
```

- [ ] **Step 4: Add the Zod schema in `adapt.ts`**

Insert above `AdaptConceptZodSchema`:

```ts
const AdaptedBeatZodSchema = z.object({
  index:          z.number().int().min(0),
  spoken:         z.string().max(600),
  on_screen_text: z.string().max(300),
  shot:           z.string().min(1).max(600),
  repair:         z.string().max(400).optional(),
});
```

Add to `AdaptConceptZodSchema`, after `production`:

```ts
  // Beat-by-beat script (D2). OPTIONAL for the same reason as production — a model that omits
  // it must not fail the exactly-3 contract. Capped at MAX_BEATS so a runaway response cannot
  // blow the card open.
  script: z.array(AdaptedBeatZodSchema).max(MAX_BEATS).optional(),
```

Import the cap at the top of `adapt.ts`:

```ts
import { MAX_BEATS } from "./blueprint";
```

- [ ] **Step 5: Rewrite the prompt and the user content in `adapt.ts`**

Append to `ADAPT_SYSTEM_PROMPT`, after the existing OUTPUT block:

```
When a TIMED BEAT MAP is supplied, you MUST also return a "script" array with EXACTLY one entry per beat, in the same order:
  "script": [
    {
      "index": <the beat's index, copied>,
      "spoken": "<what the creator SAYS in this beat — empty string when the source has no speech>",
      "on_screen_text": "<overlay text for this beat — empty string when there is none>",
      "shot": "<how to shoot this beat: framing, camera position, movement>",
      "repair": "<only when the beat is marked WEAK: how your version fixes it>"
    }
  ]

SCRIPT RULES:
- Match each beat's DURATION, not its word count. The source's speech rate is given; write a line that takes about as long to SAY as the original beat lasted. A creator who speaks slower than the source needs fewer words, not the same number.
- Keep the same beat count and the same cut rhythm. Do not add beats, merge beats, or reorder them.
- Borrow the SHAPE of each line — its cadence, its sentence structure, where it lands its emphasis. Never borrow its subject. The adapted line must share no topic words with the source line.
- Where a beat is marked WEAK, REPAIR it rather than replicating it, and say what you changed in "repair".
- When the source has NO SPEECH, leave "spoken" as an empty string and carry the beat in "on_screen_text".
```

Replace `buildAdaptUserContent` with:

```ts
export function buildAdaptUserContent(input: AdaptInput): string {
  const repeatableList = input.repeatable
    .map((item, i) =>
      item.why_repeatable
        ? `  ${i + 1}. "${item.label}" — ${item.why_repeatable}`
        : `  ${i + 1}. "${item.label}"`,
    )
    .join("\n");

  // D3: the brief IS the target when present; niche is the fallback, never both.
  const targetLine = input.target
    ? `MAKE IT ABOUT: ${input.target}`
    : `CREATOR NICHE: ${input.niche}`;

  const bp = input.blueprint;
  let beatMap = "";
  if (bp.beats.length > 0) {
    const speechNote = bp.has_speech
      ? `Source speech rate: ${bp.words_per_second} words/second.`
      : `This source has NO SPEECH — carry every beat in on-screen text only.`;

    const rows = bp.beats
      .map((b) => {
        const parts = [
          `  [${b.index}] ${b.t_start.toFixed(1)}–${b.t_end.toFixed(1)}s (${b.duration_s}s) · ${b.role.toUpperCase()}`,
          `      they show: ${b.visual_event}`,
        ];
        if (b.spoken) parts.push(`      they say: "${b.spoken}"`);
        if (b.on_screen_text) parts.push(`      on screen: "${b.on_screen_text}"`);
        if (b.cuts > 1) parts.push(`      cuts inside this beat: ${b.cuts}`);
        if (b.weakness) {
          parts.push(`      ⚠ WEAK (${b.weakness.factor} ${b.weakness.score}/10) — ${b.weakness.tip}`);
        }
        return parts.join("\n");
      })
      .join("\n");

    beatMap = `

TIMED BEAT MAP (${bp.duration_s}s, ${bp.beats.length} beats). ${speechNote}
${rows}

Write a "script" entry for EVERY beat above, in order.`;
  }

  return `VIRAL VIDEO STRUCTURAL ANATOMY:
Hook Pattern: ${input.hook_pattern}
Structure: ${input.structure}
The Turn: ${input.the_turn}
Emotional Beat: ${input.emotional_beat}

Repeatable Format Items (adapt these, not the content):
${repeatableList}

${targetLine}${beatMap}

Generate exactly 3 distinct adapted concepts using the format patterns above.`;
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npm test -- src/lib/engine/remix/__tests__/adapt.test.ts`
Expected: PASS — the 7 new tests plus every pre-existing test in the file.

- [ ] **Step 7: Run the whole remix suite plus typecheck**

Run: `npm test -- src/lib/engine/remix && npx tsc --noEmit`
Expected: PASS, no type errors. If `/api/remix/adapt` fails to compile, `decodeResultToAdaptInput` was changed incorrectly — it must stay two-arg.

- [ ] **Step 8: Commit**

```bash
git add src/lib/engine/remix/decode-types.ts src/lib/engine/remix/adapt.ts src/lib/engine/remix/__tests__/adapt.test.ts
git commit -m "feat(remix): adapt writes one line per timed beat, duration-matched"
```

---

## Task 4: `remix_blueprints` table + repo

**Files:**
- Create: `supabase/migrations/20260810120000_remix_blueprints.sql`
- Create: `src/lib/remix/blueprint-repo.ts`
- Test: `src/lib/remix/__tests__/blueprint-repo.test.ts`

**Interfaces:**
- Produces: `insertBlueprint(service, row): Promise<void>` and `getBlueprint(service, id, userId): Promise<BlueprintRow | null>`.

⚠️ **Do not run `supabase db push`.** This project has migration-ledger drift; the file is written here and applied by hand in the SQL editor. Flag to the user when the task is done that the migration is pending.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260810120000_remix_blueprints.sql
-- Remix shoot sheet (phase 1). Holds the source's timed structural skeleton + the adapted
-- script, so revise_remix (phase 5) can rewrite without re-resolving the source video —
-- which is impossible anyway, because derive-and-drop deletes the source mp4 on every run.
--
-- id is a url-safe nanoid(12), NOT a uuid: analysis ids in this codebase are nanoids and a
-- .uuid() validator on /api/remix/adapt rejected every real id with a 400.

create table if not exists public.remix_blueprints (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  thread_id       uuid,
  -- The clip dedupe key (phase 4). /feed serves the same ~520 curated rows to every user, so
  -- clips must be keyed by SOURCE VIDEO, not by remix run, or storage grows with runs.
  source_video_id text,
  blueprint       jsonb not null,
  script          jsonb not null default '[]'::jsonb,
  clip_uris       jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists remix_blueprints_user_id_idx on public.remix_blueprints (user_id);
create index if not exists remix_blueprints_thread_id_idx on public.remix_blueprints (thread_id);
create index if not exists remix_blueprints_source_video_idx on public.remix_blueprints (source_video_id);

alter table public.remix_blueprints enable row level security;

-- RLS ON WITH NO POLICY reads as an empty table through the caller's client and writes fail
-- silently. The policy is not optional.
create policy "remix_blueprints_select_own"
  on public.remix_blueprints for select
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Write the failing repo tests**

```ts
// src/lib/remix/__tests__/blueprint-repo.test.ts
import { describe, it, expect, vi } from "vitest";
import { insertBlueprint, getBlueprint } from "../blueprint-repo";

/** Minimal supabase-js double — the I/O boundary we cannot run in a unit test. */
function clientReturning(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const eqUser = vi.fn().mockReturnValue({ single });
  const eqId = vi.fn().mockReturnValue({ eq: eqUser });
  const select = vi.fn().mockReturnValue({ eq: eqId });
  const insert = vi.fn().mockResolvedValue(result);
  return { from: vi.fn().mockReturnValue({ select, insert }), _insert: insert, _eqUser: eqUser };
}

describe("blueprint-repo", () => {
  it("throws when the insert returns an error — a swallowed write stores nothing", async () => {
    const c = clientReturning({ data: null, error: { message: "check constraint" } });
    await expect(insertBlueprint(c as never, {
      id: "abc123def456", user_id: "u1", thread_id: "t1", source_video_id: "v1",
      blueprint: { duration_s: 0, words_per_second: 0, has_speech: false, beats: [] },
      script: [],
    })).rejects.toThrow(/check constraint/);
  });

  it("scopes the read by user id as well as row id", async () => {
    const c = clientReturning({ data: { id: "abc123def456", script: [] }, error: null });
    await getBlueprint(c as never, "abc123def456", "u1");
    expect(c._eqUser).toHaveBeenCalledWith("user_id", "u1");
  });

  it("returns null rather than throwing when the row is absent", async () => {
    const c = clientReturning({ data: null, error: { code: "PGRST116", message: "no rows" } });
    expect(await getBlueprint(c as never, "missing", "u1")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npm test -- src/lib/remix/__tests__/blueprint-repo.test.ts`
Expected: FAIL — `Failed to resolve import "../blueprint-repo"`.

- [ ] **Step 4: Implement `blueprint-repo.ts`**

```ts
/**
 * blueprint-repo.ts — the only module that touches remix_blueprints.
 *
 * supabase-js RETURNS errors, it does not throw them. A caller that ignores `error` stores
 * nothing and never finds out — that failure mode has cost this codebase real debugging time,
 * so every write here checks and throws.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceBlueprint } from "@/lib/engine/remix/blueprint";
import type { AdaptedBeat } from "@/lib/engine/remix/decode-types";

export interface BlueprintRow {
  id: string;
  user_id: string;
  thread_id: string | null;
  source_video_id: string | null;
  blueprint: SourceBlueprint;
  /** One entry per ranked variant, in the same order the runner emitted its cards. */
  script: AdaptedBeat[][];
}

export async function insertBlueprint(
  service: SupabaseClient,
  row: BlueprintRow,
): Promise<void> {
  const { error } = await service.from("remix_blueprints").insert(row);
  if (error) throw new Error(`remix_blueprints insert failed: ${error.message}`);
}

export async function getBlueprint(
  service: SupabaseClient,
  id: string,
  userId: string,
): Promise<BlueprintRow | null> {
  const { data, error } = await service
    .from("remix_blueprints")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return data as BlueprintRow;
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm test -- src/lib/remix/__tests__/blueprint-repo.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Apply the migration by hand and verify RLS**

Paste the migration into the Supabase SQL editor and run it. Then verify — do not assume:

```sql
select 1 from public.remix_blueprints limit 1;
select relrowsecurity from pg_class where relname = 'remix_blueprints';  -- expect: t
select policyname from pg_policies where tablename = 'remix_blueprints'; -- expect 1 row
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260810120000_remix_blueprints.sql src/lib/remix/blueprint-repo.ts src/lib/remix/__tests__/blueprint-repo.test.ts
git commit -m "feat(remix): remix_blueprints table + repo, RLS on with a policy"
```

---

## Task 5: Runner + route integration

**Files:**
- Modify: `src/lib/tools/runners/remix-runner.ts:237-260` (assemble + pass), `:320-400` (stamp the id)
- Modify: `src/lib/tools/blocks.ts:510` (`blueprintId`)
- Modify: `src/app/api/tools/remix/run/route.ts:193-260` (persist + emit)
- Test: `src/lib/tools/runners/__tests__/remix-runner.test.ts` (append; create if absent)

**Interfaces:**
- Consumes: `buildBlueprint()` (Task 1), `insertBlueprint()` (Task 4), widened `AdaptInput` (Task 3).
- Produces: `RemixPipelineResult` gains
  `blueprint: { id: string; payload: SourceBlueprint; script: AdaptedBeat[][]; sourceVideoId: string } | null`;
  every emitted `RemixCardBlock` carries `props.blueprintId`.

The runner **generates the id itself** with `nanoid(12)` and stamps it on the blocks, then hands the payload back. The route persists it before `insertMessage`. This keeps all DB writes in the route, where the authenticated client already lives, and keeps the runner pure enough to test.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/tools/runners/__tests__/remix-runner.test.ts
import { describe, it, expect } from "vitest";
import { buildBlueprint } from "@/lib/engine/remix/blueprint";
import type { OmniStructuralInput } from "@/lib/engine/remix/decode-types";

describe("remix runner blueprint seam", () => {
  it("produces a blueprint the adapt input can carry", () => {
    const structural = {
      hook_decomposition: {
        visual_stop_power: 5, audio_hook_quality: 5, text_overlay_score: 5,
        first_words_speech_score: 5, weakest_modality: "audio_hook_quality",
        visual_audio_coherence: 5, cognitive_load: 5,
      },
      factors: [],
      video_signals: { visual_production_quality: 5, pacing_score: 5, transition_quality: 5 },
      segments: [
        { t_start: 0, t_end: 2, visual_event: "v", audio_event: "a",
          is_hook_zone: true, spoken_text: "one two", on_screen_text: null },
        { t_start: 2, t_end: 6, visual_event: "v2", audio_event: "a2",
          is_hook_zone: false, spoken_text: "three four", on_screen_text: null },
      ],
      content_summary: "", overall_impression: "",
      content_type: "talking_head", niche_primary_slug: "fitness",
    } satisfies OmniStructuralInput;

    const bp = buildBlueprint(structural);
    expect(bp.beats.length).toBe(2);
    expect(bp.beats[0].role).toBe("hook");
    expect(bp.has_speech).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and confirm it passes already**

Run: `npm test -- src/lib/tools/runners/__tests__/remix-runner.test.ts`
Expected: PASS.

**This test is a seam pin, not a TDD red step, and that is deliberate** (owner ruling, 2026-08-10). It cannot go red — Task 1 already built `buildBlueprint` and proved it with 11 tests. What it pins is that the function stays correct and importable *from the runner's path*, so a later refactor that breaks the seam fails here rather than in a live run. The wiring's own coverage is Step 6.

- [ ] **Step 3: Add `blueprintId` to the block schema**

In `src/lib/tools/blocks.ts`, inside `RemixCardBlockSchema.props`, after `formatBorrowed`:

```ts
    /**
     * The remix_blueprints row this card's beat-by-beat script lives in (phase 1, 2026-08-10).
     * OPTIONAL and additive: every card persisted before this lane has none and renders exactly
     * as it did. The script is NOT inlined here on purpose — phase 5's revise_remix rewrites the
     * row, and a copy frozen inside a thread message would drift from it silently.
     */
    blueprintId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/u).optional(),
```

- [ ] **Step 4: Wire the runner**

In `remix-runner.ts`, add imports:

```ts
import { buildBlueprint } from "@/lib/engine/remix/blueprint";
import type { SourceBlueprint } from "@/lib/engine/remix/blueprint";
import type { AdaptedBeat } from "@/lib/engine/remix/decode-types";
```

After `const decode = structural ? await runDecode(structural) : null;` and its null guard, add:

```ts
    // The timed skeleton — assembled from the SAME omni response the decode just collapsed.
    // Deterministic, no model call, no spend. Empty beats when omni returned no segments.
    const blueprint = structural
      ? buildBlueprint(structural)
      : { duration_s: 0, words_per_second: 0, has_speech: false, beats: [] };
```

Change the `adaptInput` construction to carry it:

```ts
    const adaptInput = {
      ...decodeResultToAdaptInput(decode, audienceNiche),
      blueprint,
      target: input.brief ?? null,
    };
```

Add `brief?: string | null` to the runner's input interface, beside `intent`.

Generate the id once, before the block loop:

```ts
    // Generated here so the id can ride the cards; the ROUTE writes the row (it owns the
    // authenticated client). nanoid(12), matching analysis ids — never a uuid.
    const blueprintId = nanoid(12);
```

Inside the block-building loop, add to `props` after `formatBorrowed`:

```ts
          ...(blueprint.beats.length > 0 ? { blueprintId } : {}),
```

Change the success return to carry the payload:

```ts
    return {
      blocks,
      warnings: allWarnings,
      blueprint: blueprint.beats.length > 0
        ? {
            id: blueprintId,
            payload: blueprint,
            script: rated.map((r) => (r.concept.script ?? []) as AdaptedBeat[]),
            sourceVideoId: sourcePostUrl ?? url,
          }
        : null,
    };
```

Add `blueprint` to the result type, and return `blueprint: null` from **every** early-error return in the function (`resolve_failed`, `decode_failed`, `adapt_failed`) so the shape is total.

- [ ] **Step 5: Persist in the route**

In `src/app/api/tools/remix/run/route.ts`, add the import:

```ts
import { insertBlueprint } from "@/lib/remix/blueprint-repo";
import { createServiceClient } from "@/lib/supabase/service";
```

Add `brief` to `RemixRunRequestSchema`:

```ts
  brief: z.string().max(200).optional(),
```

Pass it into `runRemixPipeline({ ... brief: parsed.data.brief ?? null, ... })`.

Immediately **before** the existing `insertMessage` call, add:

```ts
        // Persist the blueprint BEFORE the message: a card carrying a blueprintId whose row
        // does not exist would render a permanent skeleton. A failure here is non-fatal — we
        // drop the id rather than lose the cards.
        if (result.blueprint) {
          try {
            await insertBlueprint(createServiceClient(), {
              id: result.blueprint.id,
              user_id: user.id,
              thread_id: openThread.id,
              source_video_id: result.blueprint.sourceVideoId,
              blueprint: result.blueprint.payload,
              script: result.blueprint.script,
            });
          } catch (bpErr) {
            Sentry.captureException(bpErr, { tags: { route: "api.tools.remix.run" } });
            log.warn("blueprint persist failed — cards will render without beats", {
              error: bpErr instanceof Error ? bpErr.message : String(bpErr),
            });
            for (const b of result.blocks) delete (b.props as { blueprintId?: string }).blueprintId;
          }
        }
```

Add `blueprintId` to the `send("content", ...)` props map, so the beats render on the live card and not only after a reload:

```ts
              blueprintId: b.props.blueprintId,
```

⚠️ This last line matters. `proof`, `production` and `provenance` were each shipped persisted-but-absent from the SSE face, and each one produced a card that only became correct after a reload. Do not repeat it.

- [ ] **Step 6: Cover the wiring with route tests**

⚠️ The first assertion below is the one that matters most. `proof`, `production` and `provenance` were each shipped persisted-but-absent from this exact `send("content")` face, and each produced a card that only became correct after a reload. This test is what stops `blueprintId` becoming the fourth.

**Append** to the existing `src/app/api/tools/remix/run/__tests__/route.test.ts` — do not create a new file. That file already mocks `@/lib/supabase/server`, `@/lib/threads/messages`, `@/lib/threads/threads`, `@/lib/tools/runners/remix-runner`, `@/lib/kc/kc-stamp` and `nanoid`, and provides `makeRemixCard()` and `makeRemixRequest()`. Add one mock alongside the existing `vi.mock` calls at the top of the file:

```ts
vi.mock("@/lib/remix/blueprint-repo", () => ({
  insertBlueprint: vi.fn(),
}));
```

Then append this block inside the existing top-level `describe`:

```ts
  // ── Blueprint wiring (phase 1) ──────────────────────────────────────────────
  describe("blueprint persistence", () => {
    const BLUEPRINT_RESULT = {
      id: "bp1234567890",
      payload: { duration_s: 14, words_per_second: 3.2, has_speech: true, beats: [
        { index: 0, t_start: 0, t_end: 1.8, duration_s: 1.8, role: "hook" as const,
          spoken: "source line", on_screen_text: null, visual_event: "tight crop",
          audio_event: "voice", cuts: 1, weakness: null },
      ] },
      script: [[{ index: 0, spoken: "your line", on_screen_text: "", shot: "waist-up" }]],
      sourceVideoId: "https://www.tiktok.com/@creator/video/123",
    };

    /** Signs in a user, stubs the thread, and returns the mocked pipeline. */
    async function arrange(blueprint: unknown) {
      const { createClient } = await import("@/lib/supabase/server");
      const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
      const { createOpenThreadLazy } = await import("@/lib/threads/threads");

      (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }) },
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "thread-remix-abc", user_id: "user-123",
      });

      const card = makeRemixCard();
      (card.props as { blueprintId?: string }).blueprintId = "bp1234567890";
      (runRemixPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
        blocks: [card], warnings: [], blueprint,
      });
      return card;
    }

    async function drain(res: Response): Promise<string> {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let out = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        out += decoder.decode(value, { stream: true });
      }
      return out;
    }

    it("puts blueprintId on the SSE content face, not only in the persisted block", async () => {
      await arrange(BLUEPRINT_RESULT);
      const { POST } = await import("@/app/api/tools/remix/run/route");
      const res = await POST(makeRemixRequest({
        url: "https://www.tiktok.com/@creator/video/123", platform: "tiktok",
      }));
      const raw = await drain(res);

      const contentLine = raw
        .split("\n")
        .find((l) => l.startsWith("data:") && l.includes("adaptedHook"));
      expect(contentLine).toBeDefined();
      expect(contentLine).toContain("bp1234567890");
    });

    it("writes the blueprint row before the thread message", async () => {
      await arrange(BLUEPRINT_RESULT);
      const { insertBlueprint } = await import("@/lib/remix/blueprint-repo");
      const { insertMessage } = await import("@/lib/threads/messages");
      const order: string[] = [];
      (insertBlueprint as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        order.push("blueprint");
      });
      (insertMessage as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        order.push("message");
      });

      const { POST } = await import("@/app/api/tools/remix/run/route");
      const res = await POST(makeRemixRequest({
        url: "https://www.tiktok.com/@creator/video/123", platform: "tiktok",
      }));
      await drain(res);

      expect(order).toEqual(["blueprint", "message"]);
    });

    it("strips blueprintId and still delivers the cards when the insert fails", async () => {
      const card = await arrange(BLUEPRINT_RESULT);
      const { insertBlueprint } = await import("@/lib/remix/blueprint-repo");
      const { insertMessage } = await import("@/lib/threads/messages");
      (insertBlueprint as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("insert failed"));

      const { POST } = await import("@/app/api/tools/remix/run/route");
      const res = await POST(makeRemixRequest({
        url: "https://www.tiktok.com/@creator/video/123", platform: "tiktok",
      }));
      const raw = await drain(res);

      // The run must not die with the row: the cards are the product.
      expect(raw).toContain("event: done");
      expect(insertMessage).toHaveBeenCalled();
      expect((card.props as { blueprintId?: string }).blueprintId).toBeUndefined();
    });

    it("does not call insertBlueprint when the runner produced no blueprint", async () => {
      await arrange(null);
      const { insertBlueprint } = await import("@/lib/remix/blueprint-repo");
      const { POST } = await import("@/app/api/tools/remix/run/route");
      const res = await POST(makeRemixRequest({
        url: "https://www.tiktok.com/@creator/video/123", platform: "tiktok",
      }));
      await drain(res);
      expect(insertBlueprint).not.toHaveBeenCalled();
    });
  });
```

Run: `npm test -- src/app/api/tools/remix/run`
Expected: PASS — the 4 new tests plus every pre-existing test in the file.

- [ ] **Step 7: Typecheck and run the affected suites**

Run: `npx tsc --noEmit && npm test -- src/lib/tools src/app/api/tools/remix`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tools/runners/remix-runner.ts src/lib/tools/blocks.ts src/app/api/tools/remix/run/route.ts src/lib/tools/runners/__tests__/remix-runner.test.ts
git commit -m "feat(remix): assemble the blueprint in the runner, persist it in the route"
```

---

## Task 6: Read route + beat renderer

**Files:**
- Create: `src/app/api/remix/blueprint/[id]/route.ts`
- Create: `src/components/thread/remix-beats.tsx`
- Modify: `src/components/thread/remix-card-block.tsx:46-61` (destructure), `:189` (mount)
- Test: `src/components/thread/__tests__/remix-beats.test.tsx`

**Interfaces:**
- Consumes: `getBlueprint()` (Task 4), `blueprintId` on the block (Task 5).
- Produces: `GET /api/remix/blueprint/[id]` → `{ script: AdaptedBeat[][], blueprint: SourceBlueprint }`; `<RemixBeats blueprintId={string} variantIndex={number} />`.

Design-system constraints — the card already spends its one coral on the Borrowed chip, so **the beat rows get no accent**. Timecodes and roles are `text-foreground-muted`; the creator's line is `text-foreground-secondary`; the repair note is muted, never coloured.

- [ ] **Step 1: Write the failing renderer tests**

⚠️ The docblock on the first line is load-bearing. `vitest.config` sets `environment: "node"` by default; a component test without `/** @vitest-environment happy-dom */` fails with `document is not defined`. Every existing test in `src/components/thread/__tests__/` opens with it.

```tsx
/** @vitest-environment happy-dom */
// src/components/thread/__tests__/remix-beats.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RemixBeats } from "../remix-beats";

const SCRIPT = [[
  { index: 0, spoken: "Your creatine is doing nothing.", on_screen_text: "STOP",
    shot: "waist-up, phone at chest" },
  { index: 1, spoken: "I tested 40 lifters for six weeks.", on_screen_text: "",
    shot: "b-roll, tub on bench", repair: "cuts 1.2s earlier than the original" },
]];

const BLUEPRINT = {
  duration_s: 14, words_per_second: 3.2, has_speech: true,
  beats: [
    { index: 0, t_start: 0, t_end: 1.8, duration_s: 1.8, role: "hook", spoken: "x",
      on_screen_text: null, visual_event: "tight crop", audio_event: "", cuts: 1, weakness: null },
    { index: 1, t_start: 1.8, t_end: 5.4, duration_s: 3.6, role: "setup", spoken: "y",
      on_screen_text: null, visual_event: "b-roll", audio_event: "", cuts: 2,
      weakness: { factor: "pacing", score: 4, tip: "cut earlier" } },
  ],
};

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ script: SCRIPT, blueprint: BLUEPRINT }),
  }) as unknown as typeof fetch;
});

describe("RemixBeats", () => {
  it("renders one row per beat with its timecode and role", async () => {
    render(<RemixBeats blueprintId="abc123def456" variantIndex={0} />);
    await waitFor(() => expect(screen.getByText(/0\.0–1\.8s/)).toBeInTheDocument());
    expect(screen.getByText(/HOOK/i)).toBeInTheDocument();
    expect(screen.getByText(/SETUP/i)).toBeInTheDocument();
  });

  it("shows the creator's line, not the source's", async () => {
    render(<RemixBeats blueprintId="abc123def456" variantIndex={0} />);
    await waitFor(() =>
      expect(screen.getByText("Your creatine is doing nothing.")).toBeInTheDocument());
  });

  it("shows the shot instruction for each beat", async () => {
    render(<RemixBeats blueprintId="abc123def456" variantIndex={0} />);
    await waitFor(() =>
      expect(screen.getByText(/waist-up, phone at chest/)).toBeInTheDocument());
  });

  it("surfaces the repair note when the source beat was weak", async () => {
    render(<RemixBeats blueprintId="abc123def456" variantIndex={0} />);
    await waitFor(() =>
      expect(screen.getByText(/cuts 1\.2s earlier/)).toBeInTheDocument());
  });

  it("renders nothing rather than an error when the fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    const { container } = render(<RemixBeats blueprintId="abc123def456" variantIndex={0} />);
    await waitFor(() => expect(container.querySelector("[data-beats]")).toBeNull());
  });
});
```

- [ ] **Step 2: Run and confirm they fail**

Run: `npm test -- src/components/thread/__tests__/remix-beats.test.tsx`
Expected: FAIL — `Failed to resolve import "../remix-beats"`.

- [ ] **Step 3: Implement the GET route**

```ts
// src/app/api/remix/blueprint/[id]/route.ts
/**
 * GET /api/remix/blueprint/[id] — the beat script for a remix card.
 *
 * The card carries only `blueprintId`; the script is fetched. Inlining it on the block would
 * duplicate state that phase 5's revise_remix rewrites, and the copy frozen in the thread
 * message would drift from the row with nothing to detect it.
 */
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getBlueprint } from "@/lib/remix/blueprint-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{8,64}$/u.test(id)) {
    return Response.json({ error: "Bad id" }, { status: 400 });
  }

  // Ownership is enforced in the query (id AND user_id), so a valid id belonging to someone
  // else is a 404, not a leak.
  const row = await getBlueprint(createServiceClient(), id, user.id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({ script: row.script, blueprint: row.blueprint });
}
```

- [ ] **Step 4: Implement `remix-beats.tsx`**

```tsx
"use client";

/**
 * RemixBeats — the beat-by-beat shoot rows on a remix card (phase 1, text only).
 *
 * Phase 3 swaps the leading column for a frame, phase 4 for a clip. The row structure is what
 * those phases upgrade, so it is built as a list of rows from the start rather than prose.
 *
 * No accent: the card already spends its single coral on the Borrowed chip, and the accent
 * dosage rule is at most one accent element visible at a time.
 */
import { useEffect, useState } from "react";
import type { AdaptedBeat } from "@/lib/engine/remix/decode-types";
import type { SourceBlueprint } from "@/lib/engine/remix/blueprint";

interface Payload {
  script: AdaptedBeat[][];
  blueprint: SourceBlueprint;
}

export function RemixBeats({
  blueprintId,
  variantIndex,
}: {
  blueprintId: string;
  variantIndex: number;
}) {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(`/api/remix/blueprint/${blueprintId}`);
        if (!res.ok) return;                       // silent: a missing sheet is not an error state
        const json = (await res.json()) as Payload;
        if (alive) setData(json);
      } catch {
        /* a beat list that cannot load simply does not render */
      }
    })();
    return () => { alive = false; };
  }, [blueprintId]);

  const beats = data?.blueprint.beats ?? [];
  const script = data?.script?.[variantIndex] ?? [];
  if (beats.length === 0 || script.length === 0) return null;

  return (
    <div data-beats className="border-t border-white/[0.06] px-4 py-3">
      <p className="mb-2 text-label uppercase tracking-wide text-foreground-muted">
        Shoot it beat by beat
      </p>
      <ol className="flex flex-col gap-3">
        {beats.map((beat) => {
          const line = script.find((s) => s.index === beat.index);
          if (!line) return null;
          return (
            <li key={beat.index} className="flex flex-col gap-1">
              <p className="text-label text-foreground-muted">
                {beat.t_start.toFixed(1)}–{beat.t_end.toFixed(1)}s · {beat.role.toUpperCase()}
                {beat.cuts > 1 ? ` · ${beat.cuts} cuts` : ""}
              </p>
              {line.spoken ? (
                <p className="text-body leading-relaxed text-foreground-secondary">
                  “{line.spoken}”
                </p>
              ) : null}
              {line.on_screen_text ? (
                <p className="text-label text-foreground-muted">
                  On screen: {line.on_screen_text}
                </p>
              ) : null}
              <p className="text-label text-foreground-muted">Shot: {line.shot}</p>
              {line.repair ? (
                <p className="text-label text-foreground-muted">Fixed: {line.repair}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 5: Mount it on the card**

In `remix-card-block.tsx`, add `blueprintId` to the destructure at line 46-61, add the import, and insert the component immediately **after** the `{production && ( … )}` block:

```tsx
      {blueprintId && <RemixBeats blueprintId={blueprintId} variantIndex={0} />}
```

`variantIndex={0}` is correct for phase 1: each ranked concept is its own card and the runner writes one script array per card in rank order. Phase 3 replaces this with the per-card index when the three cards collapse into one ranked sheet.

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npm test -- src/components/thread && npx tsc --noEmit`
Expected: PASS, 5 new tests, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/remix/blueprint src/components/thread/remix-beats.tsx src/components/thread/remix-card-block.tsx src/components/thread/__tests__/remix-beats.test.tsx
git commit -m "feat(remix): fetch and render the beat-by-beat shoot rows"
```

---

## Task 7: Live verification

**Files:** none — this task produces evidence, not code.

A green suite proves nothing here. Blueprint assembly has only ever been exercised against handwritten fixtures, and the known failure modes of this pipeline are all shape failures from a real model response: `structure` returned as a list where an object was expected, subtitles served in two formats, a partial `production` block failing the whole parse. **The first real run is the test that counts.**

- [ ] **Step 1: Confirm every gate is green before spending money**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. A live run against a broken build wastes an Apify credit and an Omni call.

- [ ] **Step 2: Start the dev server on a free port**

```bash
lsof -ti:3000   # if occupied, pick another
npm run dev -- --port 3001
```

- [ ] **Step 3: Run a real remix and capture the evidence**

Sign in, go to `/feed`, tap **Remix** on any outlier tile. Wait for the card. Then capture:

- the runner's log line for beat count and `has_speech`
- the `remix_blueprints` row: `select id, jsonb_array_length(blueprint->'beats') as beats, jsonb_array_length(script) as variants from remix_blueprints order by created_at desc limit 1;`
- a screenshot of the card showing the beat rows

- [ ] **Step 4: Verify the four things fixtures cannot prove**

- [ ] Beat count is **≤ 8** on a real video, and the timeline has no gaps.
- [ ] `spoken` on the source beats holds **real transcribed speech**, not nulls — if every beat is null on a talking-head video, the omni response is not carrying `spoken_text` and Task 1's input assumption is wrong.
- [ ] Adapted lines are **duration-plausible**: read each aloud against its beat length.
- [ ] Run `sharedContentTokens(sourceBeat.spoken, adaptedBeat.spoken)` over each pair. **More than one shared token on any beat means the model is paraphrasing the source's topic** — the D-01 reversal has failed and the prompt needs a stronger separation instruction before this ships.

- [ ] **Step 5: Record the result honestly**

Append the measured numbers to the spec under a new "Phase 1 live run" heading — beat counts, whether speech was present, the echo-token result, and anything that failed. If a check failed, say so and stop; do not proceed to phase 2 on a failed echo check.

- [ ] **Step 6: Commit the evidence**

```bash
git add docs/superpowers/specs/2026-08-10-remix-shoot-sheet-design.md
git commit -m "test(remix): phase 1 live run — measured beat counts and echo check"
```

---

## Done when

- `npx tsc --noEmit` clean and `npm test` green.
- The migration has been applied by hand and RLS verified (Task 4, Step 6).
- A real remix produces ≤8 beats with real speech, and the echo check passes on every beat.
- A remix card persisted before this lane still renders identically — no `blueprintId`, no beat rows, no error.

## Deliberately not in this plan

Pre-brief UI, the multiplier and `res.ok` fixes (phase 2), frames (phase 3), clips and the `derive-and-drop` amendment (phase 4), `revise_remix` (phase 5). Phase 1 exists to answer one question — *does a duration-matched, beat-mapped remix actually read as a faithful copy?* — before any of those are paid for.
