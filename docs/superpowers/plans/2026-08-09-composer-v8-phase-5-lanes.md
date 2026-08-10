# Phase 5 — Day 0: "It finds your lane" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A creator with no niche answers one question, and the product proposes 2–3 candidate lanes — each with a proven format already adapted into it and pre-scored — so picking a card is simultaneously "I like this" and "this is who I am."

**Architecture:** Two new pure-ish producers behind the existing flag, then three UI pieces bolted onto the *existing* `/welcome` describe door as an opt-in branch. `synthesizeLanes` is one Qwen JSON call (structurally a clone of `adapt.ts`). `buildLaneDrops` reuses the Phase-2 drops pipeline verbatim — corpus round-robin → `generateAdaptConcepts` per lane → ONE batched Flash — but keys the adapt niche off each lane instead of the user's audience. The reveal hands the picked lane's `who` line back into `ConnectStep` as the description, so the lane path **never bypasses calibration**: onboarding still ends in a calibrated audience, which is its whole doctrine.

**Tech Stack:** Next.js 15 App Router · TypeScript · Zod · Qwen (DashScope, `getQwenClient`) · Supabase · Vitest + Testing Library (happy-dom for components).

## Global Constraints

Every task's requirements implicitly include this section.

- **Flag:** everything ships behind `CONCEPT_V8_ENABLED` (`src/lib/flags/concept-v8.ts`, `process.env.NEXT_PUBLIC_CONCEPT_V8 === "true"`). Flag-off must be **byte-identical** — `/welcome` renders exactly as today, and the new route 404s.
- **Fire-on-demand:** navigation never fires a producer. The lanes pipe runs **only** on an explicit submit of the lane question. One run in flight.
- **Type scale:** type comes from the roles — `text-micro|caption|label|body|reading|title|subhead|heading|stat`. Never `text-[13px]`. **No fractional px anywhere under `src/`** (`text-[13.5px]` is banned repo-wide). Guard: `src/components/__tests__/type-scale.test.ts` — `GUARDED_DIRS = ['app/home','app/settings','audience','sidebar','thread']`. `components/onboarding/**` is *not* currently guarded, but write to the roles anyway.
- **Accent dosage (LOCKED):** zero accent on these surfaces beyond the single live-presence dot. Primary actions are neutral cream (`--color-action`). Never `#fff`. Matte — no glass, no glow.
- **No corpus multiplier numbers** anywhere. **Donor niche/handle never rendered** on a card face. View count + sim score are the only numbers.
- **The Flash SIM is platform-blind** — never imply the verdict moved with a platform lens.
- **Serif (Newsreader) for voice moments only** — the lane question and the adapted hook lines. Chrome stays Inter.
- **Drop economics (#3) stays an open owner call** — no billing/quota wiring. The route 404s flag-off precisely so no new spend surface exists in an environment that hasn't opted in.
- **Gates before any push** (pipefail): `node node_modules/typescript/bin/tsc --noEmit` · `npm run build` · `npx vitest run`. Baseline = **exactly one** pre-existing failure, `routing-cut.test.ts` (this worktree only). Same count before/after = green.
- **Never commit** `src/app/(app)/start/page.tsx` or `src/components/surfaces/start-page.tsx` — they are the standing uncommitted owner call. **Explicit `git add` paths only**; never `git add -A` or `git add .`.
- Vitest suppresses `console.log` — to see a value, assert it into a failing `expect`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/engine/lanes/lane-types.ts` | The `Lane` domain shape. Zero imports — safe for client + server. |
| `src/lib/engine/lanes/synthesize-lanes.ts` | The producer: system prompt, user-content builder, Zod schema, one Qwen call with a repair retry. Returns `Lane[] \| null`. |
| `src/lib/surfaces/lane-drops.ts` | `buildLaneDrops` — corpus pick → per-lane adapt → one batched Flash → `LaneShelf[]`. Injectable deps, mirroring `BuildDropsDeps`. |
| `src/app/api/surfaces/lanes/route.ts` | `POST` — flag 404, auth, CSRF, `{answer}` → `{shelves}`. |
| `src/components/onboarding/lane-question.tsx` | The one question, serif. Submits the answer. |
| `src/components/onboarding/lane-reveal.tsx` | "Three ways you could show up" — grouped lanes, one card each, pick handler. |
| `src/app/(onboarding)/welcome/page.tsx` | **Modify** — a third stage `lanes`, reachable only from the describe door, only flag-on. |
| `src/components/onboarding/connect-step.tsx` | **Modify** — a quiet "Not sure yet?" door on the describe side, only flag-on. |

Tests live beside their subject in `__tests__/`, matching the repo convention.

---

### Task 1: The `Lane` shape + the synthesis producer

**Files:**
- Create: `src/lib/engine/lanes/lane-types.ts`
- Create: `src/lib/engine/lanes/synthesize-lanes.ts`
- Test: `src/lib/engine/lanes/__tests__/synthesize-lanes.test.ts`

**Interfaces:**
- Consumes: `getQwenClient`, `QWEN_REASONING_MODEL`, `QWEN_SEED` from `@/lib/engine/qwen/client`; `stripModelOutput` from `@/lib/engine/utils/strip`; `KNOWLEDGE_CORE` from `@/lib/engine/apollo-core`.
- Produces:
  - `interface Lane { name: string; who: string; niche: string }`
  - `LANE_MIN = 2`, `LANE_MAX = 3`
  - `buildLaneUserContent(answer: string): string`
  - `synthesizeLanes(answer: string, deps?: { client?: () => OpenAIish }): Promise<Lane[] | null>`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/engine/lanes/__tests__/synthesize-lanes.test.ts
import { describe, it, expect, vi } from "vitest";
import { buildLaneUserContent, synthesizeLanes, LANE_MIN, LANE_MAX } from "../synthesize-lanes";

/** A stand-in for the DashScope client — the ONE I/O boundary we cannot run in a unit test. */
function fakeClient(payloads: string[]) {
  const create = vi.fn();
  for (const content of payloads) {
    create.mockResolvedValueOnce({ choices: [{ message: { content } }] });
  }
  return { fn: create, client: () => ({ chat: { completions: { create } } }) };
}

const THREE = JSON.stringify({
  lanes: [
    { name: "The numbers person", who: "receipts, not vibes", niche: "personal finance for renters" },
    { name: "The reformed overspender", who: "story-first", niche: "debt payoff storytelling" },
    { name: "The skeptic", who: "calls out the industry", niche: "fintech app criticism" },
  ],
});

describe("buildLaneUserContent", () => {
  it("carries the creator's answer verbatim and asks for the lane range", () => {
    const content = buildLaneUserContent("I could talk about budgeting on a tight income forever");
    expect(content).toContain("budgeting on a tight income");
    expect(content).toContain(`${LANE_MIN}`);
    expect(content).toContain(`${LANE_MAX}`);
  });
});

describe("synthesizeLanes", () => {
  it("returns the parsed lanes on a clean first response", async () => {
    const { client } = fakeClient([THREE]);
    const lanes = await synthesizeLanes("budgeting", { client });
    expect(lanes).toHaveLength(3);
    expect(lanes![0]).toEqual({
      name: "The numbers person",
      who: "receipts, not vibes",
      niche: "personal finance for renters",
    });
  });

  it("strips <think> blocks and code fences before parsing", async () => {
    const { client } = fakeClient([`<think>weighing lanes</think>\n\`\`\`json\n${THREE}\n\`\`\``]);
    const lanes = await synthesizeLanes("budgeting", { client });
    expect(lanes).toHaveLength(3);
  });

  it("repairs once when the first response is not valid JSON", async () => {
    const { fn, client } = fakeClient(["not json at all", THREE]);
    const lanes = await synthesizeLanes("budgeting", { client });
    expect(lanes).toHaveLength(3);
    expect(fn).toHaveBeenCalledTimes(2);
    // The repair nudge rides the USER message so the cached system prefix stays byte-stable.
    const second = fn.mock.calls[1]![0] as { messages: { role: string; content: string }[] };
    expect(second.messages[0]!.content).toBe(
      (fn.mock.calls[0]![0] as typeof second).messages[0]!.content,
    );
    expect(second.messages[1]!.content).toContain("ONLY the raw JSON");
  });

  it("rejects a response with fewer than LANE_MIN lanes", async () => {
    const one = JSON.stringify({ lanes: [{ name: "A", who: "b", niche: "c" }] });
    const { client } = fakeClient([one, one]);
    expect(await synthesizeLanes("budgeting", { client })).toBeNull();
  });

  it("rejects a response with more than LANE_MAX lanes", async () => {
    const lane = { name: "A", who: "b", niche: "c" };
    const four = JSON.stringify({ lanes: [lane, lane, lane, lane] });
    const { client } = fakeClient([four, four]);
    expect(await synthesizeLanes("budgeting", { client })).toBeNull();
  });

  it("returns null (never throws) when the call itself fails", async () => {
    const create = vi.fn().mockRejectedValue(new Error("DashScope down"));
    const client = () => ({ chat: { completions: { create } } });
    await expect(synthesizeLanes("budgeting", { client })).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/engine/lanes/__tests__/synthesize-lanes.test.ts`
Expected: FAIL — `Failed to resolve import "../synthesize-lanes"`.

- [ ] **Step 3: Write the type module**

```ts
// src/lib/engine/lanes/lane-types.ts
/**
 * Lane — one candidate way a creator with no niche could show up (spec §4, mock §9 right).
 *
 * Produced by synthesizeLanes from the creator's own 20-minute answer; consumed by
 * buildLaneDrops as the `niche` steer handed to the real adapt.ts call. Zero imports so
 * both the server producer and the client reveal can hold the shape.
 */
export interface Lane {
  /** Short lane name shown as the group head — "The numbers person". */
  name: string;
  /** The one-line who, beside the name — "receipts, not vibes". */
  who: string;
  /** The niche string this lane feeds to adapt.ts (never rendered). */
  niche: string;
}
```

- [ ] **Step 4: Write the producer**

```ts
// src/lib/engine/lanes/synthesize-lanes.ts
/**
 * Lane synthesis — Phase 5 (day-0 "it finds your lane", spec §4.2).
 *
 * ONE Qwen JSON-mode call: the creator's answer to "what could you talk about for 20
 * minutes without notes?" → 2–3 DISTINCT candidate lanes. Structurally a clone of
 * adapt.ts (same client, same JSON mode, same repair-on-the-user-message retry so the
 * DashScope cache prefix stays byte-stable).
 *
 * Returns null on graceful failure — never throws. The reveal shows nothing rather than
 * a fabricated lane; a creator's identity is not a slot to fill with invention.
 */

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "@/lib/engine/qwen/client";
import { stripModelOutput } from "@/lib/engine/utils/strip";
import { KNOWLEDGE_CORE } from "@/lib/engine/apollo-core";
import type { Lane } from "./lane-types";

export type { Lane } from "./lane-types";

const log = createLogger({ module: "engine.lanes.synthesize" });

const TIMEOUT_MS = 60_000; // lighter than adapt — three short objects
const MAX_RETRIES = 1;     // 2 total attempts (attempt 0 + 1 repair)

/** Spec §4.2: "2–3 candidate lanes (distinct angles)". */
export const LANE_MIN = 2;
export const LANE_MAX = 3;

export const LANE_SYSTEM_PROMPT = `${KNOWLEDGE_CORE}

---

A creator has told you the one subject they could talk about for twenty minutes without notes. Propose ${LANE_MIN}–${LANE_MAX} DISTINCT lanes they could credibly occupy inside that subject.

RULES:
- A lane is a POSTURE, not a sub-topic: the same subject seen through a different person.
- Every lane must be credible for someone who genuinely knows this subject.
- Lanes must be meaningfully different from each other — never three shades of one voice.
- Never invent biography, credentials, or a backstory the creator did not give you.

OUTPUT: Return strict JSON with this exact shape and nothing else:
{
  "lanes": [
    {
      "name": "string — the lane as a person, 2-4 words, with a leading article (e.g. \\"The numbers person\\")",
      "who": "string — what they lead with, <= 6 words, lowercase (e.g. \\"receipts, not vibes\\")",
      "niche": "string — the creator niche this lane writes for, <= 12 words, used to steer format adaptation"
    }
  ]
}
The "lanes" array MUST contain between ${LANE_MIN} and ${LANE_MAX} items.`;

const LaneZodSchema = z.object({
  name:  z.string().min(1).max(60),
  who:   z.string().min(1).max(80),
  niche: z.string().min(1).max(120),
});

const LanesZodSchema = z.object({
  lanes: z.array(LaneZodSchema).min(LANE_MIN).max(LANE_MAX),
});

/** Build the user turn. The answer is the creator's own words — carried verbatim. */
export function buildLaneUserContent(answer: string): string {
  return `WHAT THEY COULD TALK ABOUT FOR TWENTY MINUTES WITHOUT NOTES:
${answer.trim()}

Propose between ${LANE_MIN} and ${LANE_MAX} distinct lanes they could occupy.`;
}

/** The narrow slice of the OpenAI-shaped client this module actually calls. */
type LaneClient = {
  chat: {
    completions: {
      create: (
        body: Record<string, unknown>,
        opts?: { signal?: AbortSignal },
      ) => Promise<{ choices?: { message?: { content?: string | null } }[] }>;
    };
  };
};

export interface SynthesizeLanesDeps {
  /** Injectable I/O boundary — tests swap the DashScope client; prod uses the real one. */
  client?: () => LaneClient;
}

/**
 * Synthesize 2–3 candidate lanes from the creator's answer.
 * Returns null on graceful failure (never throws).
 */
export async function synthesizeLanes(
  answer: string,
  deps: SynthesizeLanesDeps = {},
): Promise<Lane[] | null> {
  if (!answer.trim()) return null;

  const getClient = deps.client ?? (getQwenClient as unknown as () => LaneClient);
  const ai = getClient();
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      // The repair nudge goes on the USER message, never the system one — that is what
      // preserves the byte-stable LANE_SYSTEM_PROMPT prefix for DashScope cache hits
      // across retries (same reason as adapt.ts:153).
      const extraInstruction =
        attempt > 0
          ? "\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the raw JSON object, no explanation."
          : "";

      const completion = await ai.chat.completions.create(
        {
          model: QWEN_REASONING_MODEL,
          messages: [
            { role: "system", content: LANE_SYSTEM_PROMPT },
            { role: "user", content: buildLaneUserContent(answer) + extraInstruction },
          ],
          response_format: { type: "json_object" },
          temperature: 0,
          seed: QWEN_SEED,
          max_tokens: 700,
          enable_thinking: false,
        },
        { signal: controller.signal },
      );

      const raw = completion.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(stripModelOutput(raw)) as unknown;
      const result = LanesZodSchema.safeParse(parsed);

      if (!result.success) {
        log.warn("lane Zod validation failed", { attempt, error: result.error.message });
        lastError = result.error;
        continue; // → repair attempt
      }

      log.info("lanes synthesized", { attempt, count: result.data.lanes.length });
      return result.data.lanes;
    } catch (err: unknown) {
      lastError = err;
      log.warn("lane attempt failed", { attempt, error: String(err) });
      if (attempt >= MAX_RETRIES) break;
    } finally {
      // Clear on EVERY exit path, including the Zod-fail `continue` (adapt.ts:206 trap).
      clearTimeout(timer);
    }
  }

  Sentry.captureException(lastError, { tags: { stage: "lane_synthesis" } });
  log.error("lane synthesis failed after all retries", { error: String(lastError) });
  return null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/engine/lanes/__tests__/synthesize-lanes.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/engine/lanes/lane-types.ts src/lib/engine/lanes/synthesize-lanes.ts src/lib/engine/lanes/__tests__/synthesize-lanes.test.ts
git commit -m "feat(lanes): synthesize 2-3 candidate lanes from the 20-minute answer"
```

---

### Task 2: `buildLaneDrops` — one pre-scored card per lane

**Files:**
- Create: `src/lib/surfaces/lane-drops.ts`
- Test: `src/lib/surfaces/__tests__/lane-drops.test.ts`

**Interfaces:**
- Consumes: `Lane` (Task 1); `selectDailyDrops`/`utcDayIndex` from `./drop-select`; `corpusRowToAdaptInput` from `./drop-adapt-input`; `compactViews`/`LiveDropCard` from `./live-cards`; `generateAdaptConcepts` from `@/lib/engine/remix/adapt`; `buildReactionPanel` from `@/lib/engine/flash/build-reaction-panel`; `runFlashTextModeBatch` from `@/lib/engine/flash/run-flash-text-mode`; `matchSharedTeardowns`/`getCorpusClient` from `@/lib/grounding/corpus`; `embedQueryText` from `@/lib/grounding/embedder`; `GENERAL_AUDIENCE` from `@/lib/audience/audience-repo`.
- Produces:
  - `interface LaneShelf { lane: Lane; cards: LiveDropCard[] }`
  - `CARDS_PER_LANE = 1`
  - `interface BuildLaneDropsDeps { embed?; match?; adapt?; flashBatch?; corpusClient? }`
  - `buildLaneDrops(supabase, userId, lanes, deps?): Promise<LaneShelf[]>`

**Why one card per lane:** mock §9's right frame shows exactly one card under each lane head, and the mock is the layout contract. It also holds the cost to ≤3 adapt calls + 1 batched Flash for the whole reveal — cheaper than a single shelf warm.

**Why `GENERAL_AUDIENCE`:** at this point in onboarding the user has no calibrated audience — that is the entire premise. Spec §4.2 says the lanes are "simmed against a preset audience per lane". `GENERAL_AUDIENCE` is the virtual baseline constant and never touches the DB.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/surfaces/__tests__/lane-drops.test.ts
import { describe, it, expect, vi } from "vitest";
import { buildLaneDrops, CARDS_PER_LANE, type BuildLaneDropsDeps } from "../lane-drops";
import type { Lane } from "@/lib/engine/lanes/lane-types";
import type { SharedMatchRow } from "@/lib/grounding/corpus";
import type { AdaptConcept } from "@/lib/engine/remix/decode-types";
import type { ReactionPersona } from "@/lib/tools/blocks";

const DURABLE =
  "https://x.supabase.co/storage/v1/object/public/covers/corpus/tiktok/1.jpg";

let seq = 0;
function corpusRow(over: Partial<SharedMatchRow> = {}): SharedMatchRow {
  return {
    id: `row-${seq++}`,
    similarity: 0.5,
    platform: "tiktok",
    platform_video_id: "v",
    video_url: "https://t/v",
    cover_url: DURABLE,
    creator_handle: "creatorhandle",
    source_pool: "curated",
    trust_weight: 1.5,
    views: 5_300_000,
    follower_count: null,
    outlier_multiplier: 5,
    baseline_label: null,
    engagement_rate: null,
    posted_at: null,
    proof_captured_at: null,
    niche: "donorfitnessniche",
    hook_archetype: `arch-${seq}`,
    format: null,
    visual_hook: null,
    editing_style: null,
    spoken_hook: "spoken line",
    hook_template: "madlib [x]",
    hook_source: null,
    idea: null,
    template: null,
    why_it_works: null,
    hook_techniques: null,
  } as SharedMatchRow;
}

function concept(hook: string, stops = 7): AdaptConcept {
  return {
    hook,
    angle: "an angle",
    who_its_for: "someone",
    format_borrowed: "a format",
    personaStops: stops,
  } as AdaptConcept;
}

const PERSONAS: ReactionPersona[] = Array.from({ length: 10 }, (_, i) => ({
  archetype: `a${i}`,
  verdict: i < 7 ? "stop" : "scroll",
  quote: i === 0 ? "that's me" : "",
})) as ReactionPersona[];

const LANES: Lane[] = [
  { name: "The numbers person", who: "receipts, not vibes", niche: "budget receipts" },
  { name: "The skeptic", who: "calls out the industry", niche: "fintech criticism" },
];

/** Supabase is only read for creator_profiles here — a thin stub is the honest boundary. */
const supabase = {
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
  }),
} as never;

function deps(over: BuildLaneDropsDeps = {}): BuildLaneDropsDeps {
  return {
    embed: vi.fn().mockResolvedValue([0.1, 0.2]),
    match: vi.fn().mockResolvedValue([corpusRow(), corpusRow(), corpusRow()]),
    adapt: vi.fn().mockResolvedValue([concept("adapted hook", 7)]),
    flashBatch: vi.fn().mockImplementation(
      async (candidates: { id: string; text: string }[]) => ({
        results: new Map(candidates.map((c) => [c.id, { personas: PERSONAS }])),
        warnings: [],
      }),
    ),
    corpusClient: () => ({}) as never,
    ...over,
  };
}

describe("buildLaneDrops", () => {
  it("returns one shelf per lane, each carrying CARDS_PER_LANE cards", async () => {
    const shelves = await buildLaneDrops(supabase, "u1", LANES, deps());
    expect(shelves).toHaveLength(2);
    expect(shelves[0]!.lane.name).toBe("The numbers person");
    expect(shelves[0]!.cards).toHaveLength(CARDS_PER_LANE);
    expect(shelves[0]!.cards[0]!.hook).toBe("adapted hook");
    expect(shelves[0]!.cards[0]!.personas).toHaveLength(10);
  });

  it("steers each lane's adapt call with THAT lane's niche", async () => {
    const adapt = vi.fn().mockResolvedValue([concept("h")]);
    await buildLaneDrops(supabase, "u1", LANES, deps({ adapt }));
    const niches = adapt.mock.calls.map((c) => (c[0] as { niche: string }).niche);
    expect(niches).toContain("budget receipts");
    expect(niches).toContain("fintech criticism");
  });

  it("never gives two lanes the same corpus row", async () => {
    const adapt = vi.fn().mockResolvedValue([concept("h")]);
    const shelves = await buildLaneDrops(supabase, "u1", LANES, deps({ adapt }));
    const ids = shelves.flatMap((s) => s.cards.map((c) => c.contentId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fires exactly ONE batched Flash call for the whole reveal", async () => {
    const flashBatch = vi.fn().mockImplementation(
      async (candidates: { id: string; text: string }[]) => ({
        results: new Map(candidates.map((c) => [c.id, { personas: PERSONAS }])),
        warnings: [],
      }),
    );
    await buildLaneDrops(supabase, "u1", LANES, deps({ flashBatch }));
    expect(flashBatch).toHaveBeenCalledTimes(1);
  });

  it("drops a lane whose adapt returned nothing, keeping the others", async () => {
    let call = 0;
    const adapt = vi.fn().mockImplementation(async () => (call++ === 0 ? null : [concept("h")]));
    const shelves = await buildLaneDrops(supabase, "u1", LANES, deps({ adapt }));
    expect(shelves).toHaveLength(1);
  });

  it("returns [] when the corpus read fails — never a fabricated lane", async () => {
    const match = vi.fn().mockRejectedValue(new Error("corpus down"));
    expect(await buildLaneDrops(supabase, "u1", LANES, deps({ match }))).toEqual([]);
  });

  it("returns [] when the sim fails — a lane card without a real meter never renders", async () => {
    const flashBatch = vi.fn().mockRejectedValue(new Error("flash down"));
    expect(await buildLaneDrops(supabase, "u1", LANES, deps({ flashBatch }))).toEqual([]);
  });

  it("returns [] for an empty lane list", async () => {
    expect(await buildLaneDrops(supabase, "u1", [], deps())).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/surfaces/__tests__/lane-drops.test.ts`
Expected: FAIL — `Failed to resolve import "../lane-drops"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/surfaces/lane-drops.ts
/**
 * lane-drops.ts — the day-0 LANE producer (v8 Phase 5, spec §4.2 / mock §9 right).
 *
 * The same proactive pipe as the shelf (drop-reactions.ts), pointed at candidate
 * lanes instead of a calibrated audience: one proven corpus outlier per lane →
 * adapted into THAT lane's niche by the real adapt.ts call → ONE batched Flash sim
 * of the lead hooks. The reveal is the shelf, grouped (spec §4.3).
 *
 * NO CACHE, by design. The drops shelf caches once/day/audience because it re-warms
 * every day; a lane reveal happens once, for a user who does not have an audience to
 * key a cache on. It runs on an explicit submit and never on navigation.
 *
 * ⚠️ Simmed against GENERAL_AUDIENCE — the virtual baseline constant. At this point in
 * onboarding there IS no calibrated audience; that is the premise of the whole flow.
 * The Flash SIM is platform-blind; nothing here may imply otherwise.
 *
 * Cost per reveal: 1 embedding + <= LANE_MAX adapt calls + 1 batched Flash.
 * ⚠️ Drop economics is OWNER CALL #3 — no billing/quota wiring here; the route above
 * this is 404 unless CONCEPT_V8_ENABLED.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { buildReactionPanel } from "@/lib/engine/flash/build-reaction-panel";
import { runFlashTextModeBatch } from "@/lib/engine/flash/run-flash-text-mode";
import { embedQueryText } from "@/lib/grounding/embedder";
import {
  getCorpusClient,
  matchSharedTeardowns,
  type SharedMatchRow,
} from "@/lib/grounding/corpus";
import { generateAdaptConcepts } from "@/lib/engine/remix/adapt";
import type { AdaptConcept } from "@/lib/engine/remix/decode-types";
import type { ProfileRow } from "@/lib/kc/profile-role-map";
import type { Lane } from "@/lib/engine/lanes/lane-types";
import { compactViews, type LiveDropCard } from "./live-cards";
import { corpusRowToAdaptInput } from "./drop-adapt-input";
import { selectDailyDrops, utcDayIndex } from "./drop-select";

/** Mock §9 shows exactly one card under each lane head. */
export const CARDS_PER_LANE = 1;

/** One lane and the pre-scored card that argues for it. */
export interface LaneShelf {
  lane: Lane;
  cards: LiveDropCard[];
}

/** Injectable I/O boundaries (tests swap these; prod uses the real modules). */
export interface BuildLaneDropsDeps {
  embed?: typeof embedQueryText;
  match?: typeof matchSharedTeardowns;
  adapt?: typeof generateAdaptConcepts;
  flashBatch?: typeof runFlashTextModeBatch;
  corpusClient?: () => SupabaseClient;
}

function clampStops(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.min(10, Math.max(0, n));
}

/**
 * Build one pre-scored card per lane. Total: any full failure (no corpus, embed error,
 * sim error) yields [] → the reveal shows its honest empty state, never a fabricated lane.
 */
export async function buildLaneDrops(
  supabase: SupabaseClient,
  userId: string,
  lanes: Lane[],
  deps: BuildLaneDropsDeps = {},
): Promise<LaneShelf[]> {
  if (lanes.length === 0) return [];

  const embed = deps.embed ?? embedQueryText;
  const match = deps.match ?? matchSharedTeardowns;
  const adapt = deps.adapt ?? generateAdaptConcepts;
  const flashBatch = deps.flashBatch ?? runFlashTextModeBatch;
  const corpusClient = deps.corpusClient ?? getCorpusClient;

  // (1) Profile — the Flash panel's niche steer. Absent for a day-0 user; that is fine,
  //     buildReactionPanel resolves a generic panel from null.
  const { data: rawProfile } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const profileRow = rawProfile as unknown as ProfileRow | null;

  // (2) Retrieval, steered by the lanes themselves — the creator has no niche yet, so the
  //     lane niches ARE the query. Topic orders the pool, never gates it (rank.ts contract).
  let rows: SharedMatchRow[];
  try {
    const embedding = await embed(lanes.map((l) => l.niche).join(" · "));
    rows = await match(corpusClient(), { embedding, count: 2000 });
  } catch {
    return [];
  }

  // (3) One distinct drop-ready row per lane (structural round-robin — different SHAPES,
  //     so no two lanes argue with the same format).
  const picks = selectDailyDrops(rows, lanes.length * CARDS_PER_LANE, utcDayIndex());
  if (picks.length === 0) return [];

  // (4) Adapt each lane's row into THAT lane's niche (parallel; a null adapt drops its lane).
  const adapted = (
    await Promise.all(
      lanes.map(async (lane, i) => {
        const row = picks[i % picks.length];
        if (!row) return null;
        const input = corpusRowToAdaptInput(row, lane.niche);
        if (!input) return null;
        const concepts = await adapt(input).catch(() => null);
        if (!concepts || concepts.length === 0) return null;
        const ranked = [...concepts].sort(
          (a, b) => clampStops(b.personaStops) - clampStops(a.personaStops),
        );
        return { lane, row, ranked };
      }),
    )
  ).filter((x): x is { lane: Lane; row: SharedMatchRow; ranked: AdaptConcept[] } => x !== null);
  if (adapted.length === 0) return [];

  // (5) ONE batched Flash across every lane's lead hook — the sanctioned proactive pipe.
  const { panel, audienceRepaint } = buildReactionPanel(profileRow, GENERAL_AUDIENCE);
  let results: Awaited<ReturnType<typeof runFlashTextModeBatch>>["results"];
  try {
    ({ results } = await flashBatch(
      adapted.map(({ row, ranked }) => ({ id: row.id, text: ranked[0]!.hook })),
      "hook",
      panel,
      audienceRepaint,
    ));
  } catch {
    return [];
  }

  // (6) Assemble — a lane whose row got no sim result drops itself (no meter, no card).
  //     Donor niche/prose stay behind: only the receipt-safe fields cross over.
  const shelves: LaneShelf[] = [];
  for (const { lane, row, ranked } of adapted) {
    const sim = results.get(row.id);
    if (!sim) continue;
    shelves.push({
      lane,
      cards: [
        {
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
        },
      ],
    });
  }

  return shelves;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/surfaces/__tests__/lane-drops.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/surfaces/lane-drops.ts src/lib/surfaces/__tests__/lane-drops.test.ts
git commit -m "feat(lanes): one pre-scored drop card per candidate lane"
```

---

### Task 3: `POST /api/surfaces/lanes`

**Files:**
- Create: `src/app/api/surfaces/lanes/route.ts`
- Test: `src/app/api/surfaces/lanes/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `synthesizeLanes` (Task 1), `buildLaneDrops` (Task 2), `CONCEPT_V8_ENABLED`, `csrfGuard`, `createClient`.
- Produces: `POST` handler. Request body `{ answer: string }`. Response `{ shelves: LaneShelf[] }`.

Mirrors `src/app/api/surfaces/drops/route.ts` exactly — flag 404 first, auth second, CSRF third.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/surfaces/lanes/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const flag = vi.hoisted(() => ({ on: true }));
const stubs = vi.hoisted(() => ({
  getUser: vi.fn(),
  synthesizeLanes: vi.fn(),
  buildLaneDrops: vi.fn(),
}));

vi.mock("@/lib/flags/concept-v8", () => ({
  get CONCEPT_V8_ENABLED() {
    return flag.on;
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: stubs.getUser } }),
}));
vi.mock("@/lib/engine/lanes/synthesize-lanes", () => ({
  synthesizeLanes: stubs.synthesizeLanes,
}));
vi.mock("@/lib/surfaces/lane-drops", () => ({ buildLaneDrops: stubs.buildLaneDrops }));

const { POST } = await import("../route");

function req(body: unknown): Request {
  return new Request("http://localhost/api/surfaces/lanes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  flag.on = true;
  stubs.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  stubs.synthesizeLanes.mockResolvedValue([
    { name: "The skeptic", who: "calls it out", niche: "fintech criticism" },
  ]);
  stubs.buildLaneDrops.mockResolvedValue([{ lane: { name: "The skeptic", who: "x", niche: "y" }, cards: [] }]);
});

describe("POST /api/surfaces/lanes", () => {
  it("404s when the flag is off — no new spend surface exists flag-off", async () => {
    flag.on = false;
    const res = await POST(req({ answer: "budgeting" }));
    expect(res.status).toBe(404);
    expect(stubs.synthesizeLanes).not.toHaveBeenCalled();
  });

  it("401s an unauthenticated caller before any producer runs", async () => {
    stubs.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ answer: "budgeting" }));
    expect(res.status).toBe(401);
    expect(stubs.synthesizeLanes).not.toHaveBeenCalled();
  });

  it("400s a blank answer without spending a model call", async () => {
    const res = await POST(req({ answer: "   " }));
    expect(res.status).toBe(400);
    expect(stubs.synthesizeLanes).not.toHaveBeenCalled();
  });

  it("returns the shelves on the happy path", async () => {
    const res = await POST(req({ answer: "budgeting on a tight income" }));
    expect(res.status).toBe(200);
    expect((await res.json()).shelves).toHaveLength(1);
  });

  it("502s when synthesis returns null, and never calls the drops builder", async () => {
    stubs.synthesizeLanes.mockResolvedValue(null);
    const res = await POST(req({ answer: "budgeting" }));
    expect(res.status).toBe(502);
    expect(stubs.buildLaneDrops).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/surfaces/lanes/__tests__/route.test.ts`
Expected: FAIL — cannot resolve `../route`.

- [ ] **Step 3: Write the route**

```ts
// src/app/api/surfaces/lanes/route.ts
/**
 * POST /api/surfaces/lanes — the day-0 lane reveal (v8 Phase 5).
 *
 * The creator's 20-minute answer → 2-3 candidate lanes (synthesizeLanes) → one proven
 * format adapted into each and pre-scored (buildLaneDrops). Fires ONLY on an explicit
 * submit — never on navigation (fire-on-demand law, SSOT §1).
 *
 * ⚠️ 404 unless CONCEPT_V8_ENABLED: flag-off must stay byte-identical INCLUDING no new
 * spend surface (drop economics = owner call #3).
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { CONCEPT_V8_ENABLED } from "@/lib/flags/concept-v8";
import { synthesizeLanes } from "@/lib/engine/lanes/synthesize-lanes";
import { buildLaneDrops } from "@/lib/surfaces/lane-drops";

export const runtime = "nodejs";
// One synthesis call + <= 3 adapt calls (90s cap each, parallel) + one batched Flash.
export const maxDuration = 300;

const BodySchema = z.object({ answer: z.string().trim().min(1).max(500) });

export async function POST(request: Request): Promise<Response> {
  if (!CONCEPT_V8_ENABLED) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const supabase = await createClient();

  // Auth gate (CR-01) — before any DB read and before any billable call.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const guard = csrfGuard(request);
  if (guard) return guard;

  let answer: string;
  try {
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }
    answer = parsed.data.answer;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const lanes = await synthesizeLanes(answer);
  if (!lanes) {
    // Synthesis failed — do NOT spend adapt/Flash on nothing.
    return Response.json({ error: "lanes_failed" }, { status: 502 });
  }

  try {
    const shelves = await buildLaneDrops(supabase, user.id, lanes);
    return Response.json({ shelves });
  } catch {
    return Response.json({ error: "lanes_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/surfaces/lanes/__tests__/route.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/surfaces/lanes/route.ts src/app/api/surfaces/lanes/__tests__/route.test.ts
git commit -m "feat(lanes): POST /api/surfaces/lanes, 404 flag-off"
```

---

### Task 4: The lane question

**Files:**
- Create: `src/components/onboarding/lane-question.tsx`
- Test: `src/components/onboarding/__tests__/lane-question.test.tsx`

**Interfaces:**
- Produces: `LaneQuestion({ onSubmit, submitting, error }: { onSubmit: (answer: string) => void; submitting: boolean; error?: string | null })`

Copy is direction-grade (SSOT §5 — owner reviews before launch). The question is a **voice moment** → serif. Zero accent.

- [ ] **Step 1: Write the failing test**

```tsx
/** @vitest-environment happy-dom */
// src/components/onboarding/__tests__/lane-question.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LaneQuestion } from "../lane-question";

describe("LaneQuestion", () => {
  it("asks the one question", () => {
    render(<LaneQuestion onSubmit={() => {}} submitting={false} />);
    expect(
      screen.getByText(/what could you talk about for 20 minutes without notes/i),
    ).toBeTruthy();
  });

  it("cannot submit an empty answer", () => {
    const onSubmit = vi.fn();
    render(<LaneQuestion onSubmit={onSubmit} submitting={false} />);
    fireEvent.click(screen.getByRole("button", { name: /find my lanes/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the trimmed answer", () => {
    const onSubmit = vi.fn();
    render(<LaneQuestion onSubmit={onSubmit} submitting={false} />);
    fireEvent.change(screen.getByLabelText(/20 minutes/i), {
      target: { value: "  budgeting on a tight income  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /find my lanes/i }));
    expect(onSubmit).toHaveBeenCalledWith("budgeting on a tight income");
  });

  it("disables the action while a run is in flight (one run at a time)", () => {
    render(<LaneQuestion onSubmit={() => {}} submitting />);
    expect(screen.getByRole("button", { name: /finding/i }).hasAttribute("disabled")).toBe(true);
  });

  it("shows an error when one is given", () => {
    render(<LaneQuestion onSubmit={() => {}} submitting={false} error="Couldn't read that." />);
    expect(screen.getByText("Couldn't read that.")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/onboarding/__tests__/lane-question.test.tsx`
Expected: FAIL — cannot resolve `../lane-question`.

- [ ] **Step 3: Write the component**

```tsx
"use client";

/**
 * LaneQuestion — the one conversational question on the day-0 describe path (spec §4.1).
 *
 * "A niche is chosen by reacting to concrete content, never by filling out a form." This is
 * the single exception the spec allows, and it is deliberately ONE open question, not a form.
 * The question is a VOICE MOMENT → Newsreader serif (spec §8); everything else is chrome.
 * Zero accent (locked). Type comes from the roles.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LaneQuestion({
  onSubmit,
  submitting,
  error,
}: {
  onSubmit: (answer: string) => void;
  submitting: boolean;
  error?: string | null;
}) {
  const [answer, setAnswer] = useState("");
  const trimmed = answer.trim();

  return (
    <div className="w-full space-y-6">
      <label
        htmlFor="lane-answer"
        className="block font-serif text-subhead leading-snug text-foreground"
      >
        What could you talk about for 20 minutes without notes?
      </label>

      <div className="space-y-4">
        <textarea
          id="lane-answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="e.g. how to actually stick to a budget when your income moves every month"
          rows={4}
          maxLength={500}
          className={cn(
            "w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-body text-foreground",
            "placeholder:text-foreground-muted",
            "focus:border-white/[0.10] focus:outline-none focus:ring-2 focus:ring-white/10",
          )}
        />

        {error && <p className="text-label text-error">{error}</p>}

        <Button
          variant="primary"
          className="w-full"
          disabled={trimmed.length === 0 || submitting}
          onClick={() => onSubmit(trimmed)}
        >
          {submitting ? "Finding your lanes…" : "Find my lanes"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/onboarding/__tests__/lane-question.test.tsx`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/lane-question.tsx src/components/onboarding/__tests__/lane-question.test.tsx
git commit -m "feat(lanes): the one day-0 question, serif voice moment"
```

---

### Task 5: The lane reveal

**Files:**
- Create: `src/components/onboarding/lane-reveal.tsx`
- Test: `src/components/onboarding/__tests__/lane-reveal.test.tsx`

**Interfaces:**
- Consumes: `LaneShelf` (Task 2), `personasToCardFace` + `LiveDropCard` from `@/lib/surfaces/live-cards`, `CoverFill` from `@/components/primitives/CoverFill`.
- Produces: `LaneReveal({ shelves, onPick }: { shelves: LaneShelf[]; onPick: (shelf: LaneShelf) => void })`

Card anatomy mirrors `v8/drop-shelf.tsx` — thumb + views badge + serif hook + ten-segment meter — but the **whole card is the pick button** (spec §4.3: tapping a card is simultaneously "I like this one" and "this is who I am"). No Remix action here; the card is a choice, not a job.

- [ ] **Step 1: Write the failing test**

```tsx
/** @vitest-environment happy-dom */
// src/components/onboarding/__tests__/lane-reveal.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LaneReveal } from "../lane-reveal";
import type { LaneShelf } from "@/lib/surfaces/lane-drops";
import type { ReactionPersona } from "@/lib/tools/blocks";

const PERSONAS: ReactionPersona[] = Array.from({ length: 10 }, (_, i) => ({
  archetype: `a${i}`,
  verdict: i < 8 ? "stop" : "scroll",
  quote: "",
})) as ReactionPersona[];

function shelf(name: string, hook: string, id: string): LaneShelf {
  return {
    lane: { name, who: "receipts, not vibes", niche: "donor-niche-must-never-render" },
    cards: [
      {
        contentId: id,
        hook,
        coverUrl: "https://x/cover.jpg",
        videoUrl: "https://t/v",
        views: "8.1M",
        viewsRaw: 8_100_000,
        handle: "donorhandle",
        archetype: "arch",
        hookTemplate: "tpl",
        concepts: [],
        personas: PERSONAS,
      },
    ],
  };
}

const SHELVES = [
  shelf("The numbers person", "Why is your grocery bill 40% feelings?", "c1"),
  shelf("The skeptic", "Your budgeting app wants you to fail.", "c2"),
];

describe("LaneReveal", () => {
  it("heads the reveal and names every lane", () => {
    render(<LaneReveal shelves={SHELVES} onPick={() => {}} />);
    expect(screen.getByText(/ways you could show up/i)).toBeTruthy();
    expect(screen.getByText("The numbers person")).toBeTruthy();
    expect(screen.getByText("The skeptic")).toBeTruthy();
  });

  it("prints the real view count and the real meter", () => {
    render(<LaneReveal shelves={SHELVES} onPick={() => {}} />);
    expect(screen.getAllByText("8.1M").length).toBe(2);
    expect(screen.getByTestId("lane-card-c1").getAttribute("aria-label")).toContain("8 of 10");
  });

  it("picks the lane when its card is tapped", () => {
    const onPick = vi.fn();
    render(<LaneReveal shelves={SHELVES} onPick={onPick} />);
    fireEvent.click(screen.getByTestId("lane-card-c2"));
    expect(onPick).toHaveBeenCalledWith(SHELVES[1]);
  });

  it("never renders the donor niche or the donor handle", () => {
    const { container } = render(<LaneReveal shelves={SHELVES} onPick={() => {}} />);
    expect(container.textContent).not.toContain("donor-niche-must-never-render");
    expect(container.textContent).not.toContain("donorhandle");
  });

  it("renders nothing when there are no shelves — no fabricated lane", () => {
    const { container } = render(<LaneReveal shelves={[]} onPick={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/onboarding/__tests__/lane-reveal.test.tsx`
Expected: FAIL — cannot resolve `../lane-reveal`.

- [ ] **Step 3: Write the component**

```tsx
"use client";

/**
 * LaneReveal — "Three ways you could show up" (spec §4.3, mock §9 right frame).
 *
 * The reveal IS the shelf, grouped by lane. Card anatomy matches v8/drop-shelf.tsx —
 * thumb + real view count + serif adapted hook + the REAL ten-segment meter — with one
 * difference: the WHOLE CARD is the pick. Tapping it is simultaneously "I like this one"
 * and "this is who I am", so there is no separate action to compete with it.
 *
 * Locked: zero accent · donor niche and donor handle never render · no multiplier number ·
 * view count + sim score are the only numbers · type from the roles.
 */

import { CoverFill } from "@/components/primitives/CoverFill";
import { personasToCardFace } from "@/lib/surfaces/live-cards";
import type { LaneShelf } from "@/lib/surfaces/lane-drops";

export function LaneReveal({
  shelves,
  onPick,
}: {
  shelves: LaneShelf[];
  onPick: (shelf: LaneShelf) => void;
}) {
  // Honest empty: no lanes and no promise of any (the caller shows its own error copy).
  if (shelves.length === 0) return null;

  return (
    <section data-testid="lane-reveal" className="w-full">
      <h2 className="font-serif text-subhead leading-snug text-foreground">
        {shelves.length === 3 ? "Three" : shelves.length === 2 ? "Two" : "Some"} ways you
        could show up.
      </h2>
      <p className="mt-1 font-mono text-micro uppercase tracking-[0.12em] text-foreground-muted">
        pre-tested · pick the one that sounds like you
      </p>

      <div className="mt-5 flex flex-col gap-5">
        {shelves.map((shelf) => (
          <div key={shelf.lane.name}>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-body font-semibold text-foreground">{shelf.lane.name}</span>
              <span className="text-label text-foreground-muted">{shelf.lane.who}</span>
            </div>
            {shelf.cards.map((card) => {
              const face = personasToCardFace(card.personas);
              return (
                <button
                  key={card.contentId}
                  type="button"
                  data-testid={`lane-card-${card.contentId}`}
                  aria-label={`${shelf.lane.name}: ${card.hook} — ${face.stop} of 10 stopped`}
                  onClick={() => onPick(shelf)}
                  className="flex w-full gap-3 rounded-xl border border-white/[0.06] bg-surface-sunken p-2.5 text-left transition-colors hover:border-white/[0.10] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]"
                >
                  <span className="relative block aspect-[9/16] w-[62px] shrink-0 self-stretch overflow-hidden rounded-lg border border-white/[0.06]">
                    <CoverFill coverUrl={card.coverUrl} playSize={12} />
                    {/* The receipt's number: the source's REAL reach. No multiplier — locked. */}
                    <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-sm bg-black/55 px-1.5 py-0.5 text-micro font-medium text-foreground-secondary">
                      <span aria-hidden="true">▶</span>
                      {card.views}
                    </span>
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-1">
                    {/* The adapted hook — serif because it is content, not chrome. */}
                    <span className="font-serif text-body leading-snug text-foreground">
                      {card.hook}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
                        {Array.from({ length: 10 }, (_, i) => (
                          <i
                            key={i}
                            className={`h-[3px] w-2 rounded-full ${
                              i < face.stop ? "bg-foreground-secondary" : "bg-white/[0.08]"
                            }`}
                          />
                        ))}
                      </span>
                      <b className="text-label font-semibold text-foreground-secondary">
                        {face.stop}
                        <span className="font-normal text-foreground-muted">/10</span>
                      </b>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/onboarding/__tests__/lane-reveal.test.tsx`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/lane-reveal.tsx src/components/onboarding/__tests__/lane-reveal.test.tsx
git commit -m "feat(lanes): the grouped lane reveal, whole card is the pick"
```

---

### Task 6: Wire the branch into `/welcome`, flag-gated

**Files:**
- Modify: `src/components/onboarding/connect-step.tsx` (add an opt-in door on the describe side)
- Modify: `src/app/(onboarding)/welcome/page.tsx` (add the `lanes` stage)
- Test: `src/app/(onboarding)/welcome/__tests__/lanes-branch.test.tsx`

**Interfaces:**
- Consumes: `LaneQuestion` (Task 4), `LaneReveal` (Task 5), `LaneShelf` (Task 2), `CONCEPT_V8_ENABLED`.
- `ConnectStep` gains one optional prop: `onNotSure?: () => void`. When **absent**, `ConnectStep` renders byte-identically to today — that is what keeps flag-off safe.

**The flow this wires:**

```
describe door ──"Not sure yet?"──▶ LaneQuestion
                                       │ POST /api/surfaces/lanes
                                       ▼
                                   LaneReveal
                                       │ pick
                                       ▼
                       lane.who becomes the description
                                       │
                                       ▼
                    the EXISTING draft-create → CalibrationFlow
```

The pick re-enters the flow that already exists rather than forking it. Onboarding's contract — it ends in a calibrated audience — is preserved. Nothing bypasses calibration.

- [ ] **Step 1: Write the failing test**

```tsx
/** @vitest-environment happy-dom */
// src/app/(onboarding)/welcome/__tests__/lanes-branch.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectStep } from "@/components/onboarding/connect-step";

vi.mock("@/stores/onboarding-store", () => ({
  useOnboardingStore: () => ({ tiktokHandle: "", setTiktokHandle: vi.fn() }),
}));

describe("ConnectStep — the lanes door", () => {
  it("shows no lanes door when onNotSure is absent (flag-off is byte-identical)", () => {
    render(<ConnectStep initialDoor="target" onDraftReady={() => {}} />);
    expect(screen.queryByRole("button", { name: /not sure yet/i })).toBeNull();
  });

  it("shows the lanes door on the describe side when onNotSure is given", () => {
    render(<ConnectStep initialDoor="target" onDraftReady={() => {}} onNotSure={() => {}} />);
    expect(screen.getByRole("button", { name: /not sure yet/i })).toBeTruthy();
  });

  it("never shows the lanes door on the handle side — a handle IS the answer", () => {
    render(<ConnectStep initialDoor="personal" onDraftReady={() => {}} onNotSure={() => {}} />);
    expect(screen.queryByRole("button", { name: /not sure yet/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/(onboarding)/welcome/__tests__/lanes-branch.test.tsx"`
Expected: FAIL — the second test fails; `onNotSure` is not a prop yet.

- [ ] **Step 3: Add the opt-in door to `ConnectStep`**

Add to `ConnectStepProps` (after `existingDraft`):

```tsx
  /**
   * The day-0 lanes door (v8 Phase 5). Present ONLY when CONCEPT_V8_ENABLED — its absence
   * is what makes flag-off byte-identical, so never default it to a no-op function.
   * Rendered on the describe side only: a creator who typed a handle has already answered
   * "who am I".
   */
  onNotSure?: () => void;
```

Destructure it: `export function ConnectStep({ onDraftReady, initialDoor, existingDraft, onNotSure }: ConnectStepProps) {`

Then, immediately after the existing door-swap button (the `{door === "personal" ? "Describe who you're making for instead" : "Use my TikTok handle instead"}` button) and still inside its parent `div`, add:

```tsx
        {onNotSure && door === "target" && (
          <button
            type="button"
            disabled={submitting}
            onClick={onNotSure}
            className="block w-full text-center text-label text-foreground-muted transition-colors hover:text-foreground-secondary disabled:opacity-50"
          >
            Not sure yet? Let&apos;s find your lane
          </button>
        )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/(onboarding)/welcome/__tests__/lanes-branch.test.tsx"`
Expected: PASS — 3 tests.

- [ ] **Step 5: Add the `lanes` stage to the welcome page**

In `src/app/(onboarding)/welcome/page.tsx`:

Add imports:

```tsx
import { CONCEPT_V8_ENABLED } from "@/lib/flags/concept-v8";
import { LaneQuestion } from "@/components/onboarding/lane-question";
import { LaneReveal } from "@/components/onboarding/lane-reveal";
import type { LaneShelf } from "@/lib/surfaces/lane-drops";
```

Add state beside the existing `useState` block:

```tsx
  // ── The day-0 lanes branch (v8 Phase 5) — flag-gated, describe-door only ──────
  // Local, like `stage`: a reload must NOT restore into a producer that costs money.
  const [lanesOpen, setLanesOpen] = useState(false);
  const [shelves, setShelves] = useState<LaneShelf[] | null>(null);
  const [lanesBusy, setLanesBusy] = useState(false);
  const [lanesError, setLanesError] = useState<string | null>(null);
```

Add the two handlers beside `switchDoor`:

```tsx
  /**
   * Fire the lanes pipe. ONE run at a time — the busy guard IS the debounce (fire-on-demand
   * law). Never fired by navigation: only this submit reaches it.
   */
  async function findLanes(answer: string) {
    if (lanesBusy) return;
    setLanesBusy(true);
    setLanesError(null);
    try {
      const res = await fetch("/api/surfaces/lanes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      if (!res.ok) throw new Error("lanes failed");
      const { shelves: got } = (await res.json()) as { shelves: LaneShelf[] };
      if (got.length === 0) throw new Error("no lanes");
      setShelves(got);
    } catch {
      setLanesError("Couldn't find your lanes. Describe your audience instead.");
    } finally {
      setLanesBusy(false);
    }
  }

  /**
   * Picking a lane re-enters the EXISTING describe flow with the lane's own line as the
   * description — onboarding still ends in a calibrated audience. The lane never bypasses
   * calibration, and no second onboarding contract is created.
   */
  function pickLane(shelf: LaneShelf) {
    setLanesOpen(false);
    setShelves(null);
    setPrefill({ description: shelf.lane.who });
    setDoor("target");
  }
```

Replace the render branch (the `isCalibrating ? … : <ConnectStep … />` ternary) with:

```tsx
        {isCalibrating && draft ? (
          <CalibrationFlow
            audience={draft}
            autoStart
            prefillHandle={prefill.handle}
            prefillDescription={prefill.description}
            prefillPlatform={draft.platform}
            onDone={(calibrated) => void finishOnboarding(calibrated)}
            onSkip={() => void finishOnboarding()}
            secondaryAction={recoveryAction}
          />
        ) : lanesOpen && shelves ? (
          <LaneReveal shelves={shelves} onPick={pickLane} />
        ) : lanesOpen ? (
          <LaneQuestion
            onSubmit={(answer) => void findLanes(answer)}
            submitting={lanesBusy}
            error={lanesError}
          />
        ) : (
          <ConnectStep
            initialDoor={door}
            existingDraft={draft}
            {...(CONCEPT_V8_ENABLED ? { onNotSure: () => setLanesOpen(true) } : {})}
            onDraftReady={(created, p) => {
              setDraft(created);
              setPrefill(p);
              setStage("calibrate");
            }}
          />
        )}
```

- [ ] **Step 6: Run the full onboarding suite**

Run: `npx vitest run "src/app/(onboarding)" src/components/onboarding`
Expected: PASS — the pre-existing welcome tests stay green (the flag is off in the test env, so `onNotSure` is never passed).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(onboarding)/welcome/page.tsx" src/components/onboarding/connect-step.tsx "src/app/(onboarding)/welcome/__tests__/lanes-branch.test.tsx"
git commit -m "feat(lanes): wire the day-0 lanes branch into /welcome behind the flag"
```

---

### Task 7: Gates + signed-in browser verification

**Files:** none created — this is the proof step.

- [ ] **Step 1: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: clean. (`npx` output is wrapped and swallowed here — run the binary directly.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean. A green Vercel check is NOT a build — this command is the gate.

- [ ] **Step 3: Full suite**

Run: `set -o pipefail; npx vitest run 2>&1 | tail -30`
Expected: exactly ONE failure — `routing-cut.test.ts` (the pre-existing baseline, this worktree only). Any second failure is yours.

- [ ] **Step 4: Verify signed-in, flag ON, at both sizes**

Start the dev server with the flag on (one server per port — check `lsof -ti:3000` first; two servers cannot share `.next/dev/lock`):

```bash
NEXT_PUBLIC_CONCEPT_V8=true NEXT_PUBLIC_AMBIENT_V2=true npm run dev -- --port 3001
```

Then, in a **native-size** browser context per viewport (resizing a loaded page does NOT give you the mobile UI), at **393×852** and **1440×900**, signed in:

1. Go to `/welcome` on an account that has not completed onboarding.
2. Switch to the describe door → confirm **"Not sure yet? Let's find your lane"** is present.
3. Tap it → the serif question renders.
4. **Do not submit.** The e2e user is a REAL PROD account and a submit spends ≤3 adapt calls + 1 Flash on a metered budget. Render-only.
5. Assert via `getComputedStyle` that no element on the question screen uses `--color-accent`.
6. Confirm 0 page errors.

To see the reveal without spending: stub the route in the browser before tapping, so the pipe never runs.

```js
// paste in the devtools console on /welcome before opening the lane door
const real = window.fetch;
window.fetch = (u, o) =>
  String(u).includes("/api/surfaces/lanes")
    ? Promise.resolve(new Response(JSON.stringify({ shelves: [
        { lane: { name: "The numbers person", who: "receipts, not vibes", niche: "x" },
          cards: [{ contentId: "c1", hook: "Why is your grocery bill 40% feelings?",
                    coverUrl: "", videoUrl: null, views: "8.1M", viewsRaw: 8100000,
                    handle: "h", archetype: null, hookTemplate: null, concepts: [],
                    personas: Array.from({length:10},(_,i)=>({archetype:`a${i}`,verdict:i<8?"stop":"scroll",quote:""})) }] },
      ] }), { headers: { "Content-Type": "application/json" } }))
    : real(u, o);
```

- [ ] **Step 5: Verify flag OFF is byte-identical**

Kill the flag-on server first (`lsof -ti:3001 | xargs kill`) — two dev servers cannot share the lock.

```bash
npm run dev -- --port 3002
```

At 1440×900, signed in, on `/welcome`: the describe door shows **no** lanes door, `/api/surfaces/lanes` returns 404, and there are 0 page errors.

- [ ] **Step 6: Commit nothing; report**

No commit. Report the three gate results verbatim (including the one baseline failure) and both browser walks. Never say "should work" — if a step was skipped, say so.

---

## Self-Review

**1. Spec coverage.** Spec §4.1's one question → Task 4. §4.2's "answer → 2–3 candidate lanes → proven formats adapted into each → simmed against a preset audience per lane" → Tasks 1–3 (`GENERAL_AUDIENCE` is the preset; `LANE_MIN/MAX` is the 2–3). §4.3's "the reveal is the shelf, grouped … tapping a card is simultaneously 'I like this one' and 'this is who I am'" → Task 5 (whole card is the pick) + Task 6 (`pickLane` carries the lane into the audience). §4.4's "the lane hardens through use" is **out of scope** — it describes tomorrow's drops reacting to picks, which is the shelf's concern, not day 0's.

**Deliberately not built, and why:** the **role toggle** (Creator·Brand·Ads) — its only consumer is workspace flavor, which is Phase 6, and the owner skipped Phase 6; a toggle that flavors nothing is dead UI. **Connect Instagram** — `ConnectStep` is TikTok-only because the calibrate pipeline is (`audience-detail.tsx:369`); adding IG is a pipeline change, not a day-0 change. Both are noted here rather than silently dropped.

**2. Placeholder scan.** No TBD/TODO. Every code step carries the actual code. Every test step carries the actual assertions.

**3. Type consistency.** `Lane {name, who, niche}` is defined once in `lane-types.ts` and re-exported from `synthesize-lanes.ts`; Tasks 2, 5, 6 all import the same shape. `LaneShelf {lane, cards}` is defined in `lane-drops.ts` and imported by Tasks 5 and 6. `buildLaneDrops(supabase, userId, lanes, deps?)` — the arg order in Task 3's call matches Task 2's signature. `LiveDropCard` fields used in Task 5 match `live-cards.ts:71-83` exactly.

**4. Known risk, stated not hidden.** `synthesizeLanes` is a **new prompt with no eval** — SSOT open owner call #8 says day-0 lane synthesis "needs a real producer (prompt + eval)". This plan builds the producer and its unit tests; it does **not** build an eval. Read real output against 5–10 varied answers in a sandbox before this leaves the flag.
