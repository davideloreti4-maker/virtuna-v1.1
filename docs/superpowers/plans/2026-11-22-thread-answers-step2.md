# The Details Sheet and the Text Result Page (thread answers, step 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Under `NEXT_PUBLIC_NEW_LOOK`, a tap on a hook or idea row opens its details sheet (phone bottom sheet, 560 dialog from 768 up); a simulated text has its own result page `/simulation/hook/[threadId]/[key]` (number, ring of 1,000, ten groups) served by an owner-checked endpoint; "Script this one" works from the sheet and from the page.

**Architecture:** One pure async key (`sealHashOf`, Web Crypto SHA-256 → base64url → 10 characters of the trimmed text) is shared by every link and by `GET /api/threads/[id]/seals/[key]`, which finds the seal in `threads.sim_seals` by hashing each text seal. The page is a pure view (`TextResultView`, props in) fed by a fetching screen (`TextResultScreen` + `useTextSeal`). The sheet is a presentational shell (`AnswerSheet`) and bodies (`HookSheetBody`, `IdeaSheetBody`) with Copy/Save as new-look buttons over the existing saved-items hooks; a connected `PackSheet` wires them to the thread's one text-sim queue, the row's own `BlockOrigin` and `ThreadIdContext`. From the page, "Script this one" points the active-thread cookie at the page's thread and pushes `/home?scriptFrom=<text>`; the composer runs `handleWriteScript` once that thread has loaded. Flag off: nothing changes.

**Tech Stack:** Next.js 16 app router (repo says 15; `package.json` has 16.1.5), React 19, TypeScript, Tailwind v4 tokens (`data-look="next"`), TanStack Query, Radix (`radix-ui`), Vitest + happy-dom, Playwright for looking at it.

Spec (source of truth, read all of it): `docs/superpowers/specs/2026-11-22-thread-answers-step2-design.md`. Step 1's plan and its "Result" (what exists now): `docs/superpowers/plans/2026-11-21-thread-answers-step1.md`. Seams: `.scratch/next-look/part3/slice2/seam-map.md` §3.4 (endpoint), §4 (Copy/Save), §5 (page frame, gauge, ring, names, key). Drawing: `.scratch/next-look/part3/answers/renders/ax-p6.png` (hook sheet), `ax-p7.png` (page), `ax-p7b.png` (page scrolled: the group rows), overview `answer-system.png`; **source with exact sizes `.scratch/next-look/part3/answers/answers.html`**: `axHookSheet` + `.ax-sh`, `.ax-shg`, `.ax-shl`, `.ax-qi`, `.ax-sec`, `.ax-src`, `.ax-shb`, `.sheet`, `.grab` (P6); `axResult` + `.ax-page`, `.ax-hero`, `.ax-hg`, `axBig`, `axRing`, `.ax-rc`, `.ax-stage`, `.ax-cap`, `.ax-grp`, `.ax-gr`, `AXGR` (P7).

## Global Constraints

- Work only in `~/virtuna-next-look` on branch `design/next-look`. Never edit another worktree.
- **Do not commit, push or stash.** The controller snapshots the tree for review; the owner commits. The repository is public: no ids, links, tokens, handles of real accounts or account data in code, tests, fixtures, docs or the Result section. Fixtures use invented handles (`@nia.tests`, `@dij.arc`, `@lacapture`) and relative paths.
- Flag `NEW_LOOK_ENABLED` (`src/lib/flags/new-look.ts`): **flag off must render and behave exactly as today.** Every edit to a shared file is inert with the flag off (a constant flag branch, an optional prop no legacy caller passes, or a code move inside new-look-only files). Every existing flag-off test stays green unchanged. With the flag off the new route and the new endpoint answer not found.
- **No request logic moves.** No change to the text-sim queue (`TextSimProvider`), the prices, "Simulate all", Best, the sentence or the chips (spec §5). Prices come from `creditCost("react")` (1) and `creditCost("script")` (2). The sheet's Simulate is `useTextSim().fire(text, kind)`; "Script this one" is `useOnWriteScriptHook()` → the composer's `handleWriteScript` (`src/components/app/home/composer.tsx:1498-1525`), unchanged.
- **Numbers:** a text's number is `Math.round(population.stopPct)` only (`stopNumberOf`, `src/lib/thread-next/stop-number.ts`). Never the seal's `pct`, `fraction` or `band`. A seal without a population (or whose `stopPct` is not a number in 0..100) has no number: shown as not simulated, no page (the endpoint 404s it).
- **Address and key:** `/simulation/hook/[threadId]/[key]` for a hook or a remix hook, `?as=idea` for an idea, `?as=opening` for a script's opening line. `key` = the first 10 characters of the base64url SHA-256 of the trimmed text, from ONE function (`sealHashOf`) used by every link and by the endpoint.
- **Endpoint:** `GET /api/threads/[id]/seals/[key]`: signed in (401); the thread is the caller's (any status, open or archived); the key matches a text seal (not a video seal) whose population has a number; returns `{ text, at, population, open }` (`open` = the thread's `type` is "open"); anything else 404 (foreign thread, unknown key, seal without population, anonymous funnel visitor, malformed id or key, flag off). Read-only; **no `csrfGuard`** (it 415s a plain GET).
- **Copy, exactly as the spec words it** (visible strings): "would stop to watch" (+ a chevron when it links), "Simulate", "1 credit", "Simulating", "Couldn't simulate", "Why it works", "Visual", "Proven", "More", "The take", "Why it fits", "Format", "Script this one", "2 credits", "Hook", "Idea", "Opening line", "1,000", "viewers", "Each dot is a viewer. Dark ones would stop.", "Would stop, by group", "{share}% of your audience", "This simulation isn't here.", "Back"; announced: "Copied", "Saved". Accessible names (not visible copy): a row "Open: <text>", an empty gauge "Simulate: <text>", a result link "Open the result: <text>", the icon buttons "Copy" and "Save" — each text cut to 60 characters with "…" (`clipName`).
- **Never shown in the sheet:** fraction, band, scroll quote, target ("Made for …"), rank, seed line, channel (spec §3). **Not in step 2:** re-simulating a simulated text, Share, the Brain on a text, comparing texts, sheets outside a thread, Home (spec §6).
- **Words:** "Simulate", never "Test"; sentence case; no "usual" (the proof basis is "their followers" / "their average", step 1's `basisOf`).
- **Colour:** ink and greys only. No accent anywhere in step 2: Save's saved state is the filled bookmark in ink (not `SaveAffordance`'s accent).
- **Type:** the sheet's and the page's text: the drawing's `.q` 19 / 26 at 620, built as `text-subhead font-[620] leading-[26px] tracking-[-0.018em]` (18 / 26: 19 is off the scale; step 1's remix hook uses the same mapping). Owner-call resolution 2026-11-22: the drawing wins over the spec's first 22 / 28. Otherwise type roles only (`text-meta` 13/18, `text-ui` 15, `text-reading` 14, `text-title` 16, `text-heading` 22); no `text-[Npx]` in `src/components/thread-next/` or `src/components/result/` (guards); sizes off the roles only as SVG `fontSize`. Radii from the scale (`rounded-xl` 16, `rounded-3xl` 24, `rounded-4xl` 32, `rounded-full`); shadows as `shadow-[var(--shadow-…)]`, never `shadow-float`.
- Files in `src/components/thread-next/` stay FLAT (guard `thread-next-guard.test.ts`): no hex, `rgb()`, Tailwind palette colours or blur classes; no `backdropFilter` (only `thread-field.tsx` has it). `src/components/result/*`: `result-guard.test.ts` (no colour literal, no glass, no `text-[Npx]`). Also `src/components/__tests__/type-scale.test.ts` and `src/components/thread/__tests__/radius-scale.test.ts`.
- Every control ≥ 44 px to tap (`.tap-44` where drawn smaller); focus always visible (the app's `:focus-visible` outline); every control named.
- No new dependencies. Tests: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run <path>`; types `npx tsc --noEmit`; lint `npx eslint <paths>` (`react-hooks/set-state-in-effect` and `react-hooks/refs` are on).
- Tests exercise real behaviour; stand-ins only at I/O boundaries: `fetch`, the Supabase server client, `navigator.clipboard`, Next's router (`next/navigation`), `matchMedia`/`ResizeObserver`, the build-time flag (`vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }))`, or `vi.doMock` + `vi.resetModules()` for flag-off/on pairs). Never a stand-in for our own modules. Write the test first and watch it fail.
- Never read `.env*` files.
- A part with visible UI is not done until it was rendered and compared with the drawing at full window size (never a cropped box). Say plainly what you did not check.
- Dev server (run by the controller): `http://localhost:3021`, flag on. Send POSTs from `localhost`, not `127.0.0.1` (and Web Crypto needs a secure context: `localhost` is one). Cookies: `.scratch/next-look/cookie.json` (mint from the trunk: step-1 seam map `.scratch/next-look/part3/answers/seam-map-step1.md` §0.5).

## File Structure

```
src/lib/thread-next/                       pure, no React                                         (Task 1)
  seal-hash.ts          sealHashOf(text): Promise<string>; isSealHash(key); SEAL_HASH_LENGTH
  script-from.ts        SCRIPT_FROM_PARAM; scriptFromHref(text); scriptFromOf(search); withoutScriptFrom(href)
src/lib/result/
  text-result.ts        TextResultAs, TEXT_RESULT_TITLE, textResultAsOf, textResultHref, TEXT_RING,
                        TextGroup, TextResultModel, textResultOf, textRingLooks, sweepOrdered    (Task 1)

src/app/api/threads/[id]/seals/[key]/route.ts      GET, owner-checked                            (Task 2)

src/hooks/queries/use-text-seal.ts                 useTextSeal(threadId, key)                     (Task 3)
src/components/result/
  text-result.tsx       TextResultView (pure: state in) + TextResultState                         (Task 3)
  text-result-screen.tsx TextResultScreen (fetches; Task 4 wires "Script this one")               (Tasks 3, 4)
  use-pushed-title.ts   usePushedTitle, MOVED out of result-page.tsx (no behaviour change)        (Task 3)
  stage.ts              STAGE, MOVED out of audience-panel.tsx (no behaviour change)              (Task 3)
src/app/(app)/simulation/hook/[threadId]/[key]/page.tsx   flag-gated server page                 (Task 3)

src/components/thread-next/                new-look only, flat
  answer-sheet.tsx      AnswerSheet (phone Sheet / wide Radix dialog, focus back to the row)       (Task 5)
  sheet-body.tsx        SheetGauge, SheetGaugeRow, HookSheetBody, IdeaSheetBody                    (Task 5)
  sheet-actions.tsx     CopyButton, SaveButton, useCopyText, useSaveToggle                         (Task 5)
  pack-sheet.tsx        PackSheet (connected: queue, thread id, key, row origin)                   (Task 6)
  use-seal-keys.ts      useSealKeys(texts), resultLinkOf(state, threadId, key, as)                 (Task 6)
  answer-icons.tsx      + CopyIcon, BookmarkIcon, ExternalIcon                                     (Task 5)
  answer-gauge.tsx      export clipName (was clip) and EmptyArt (5); GaugeSlot `href` (6)
  remix-answer.tsx      export ProofCover (was Cover) and proofStats (was statsOf) (5); hookOf href (6)
  pack-answer.tsx       onOpen: the row is one button + chevron                                    (Task 6)
  script-answer.tsx     opener.href                                                                 (Task 6)
  thread-turn-next.tsx  PackPart opens PackSheet, per-row origins; script/remix links              (Task 6)
  __tests__/fixtures/answers.ts  + segmentsPopulation, HOOK_1_POPULATION (1); IDEA_SHEET, hook 1's
                                 proof gets videoUrl "/clips/dij-arc" (5)

src/app/(app)/dev/answers/  page.tsx + dev-answers.tsx: + p7, p7l, p7n (Task 3); p6, p6b, p6i (Task 5);
                            chevrons on the pack states (Task 6)

Shared files touched (inert with the flag off):
  src/components/ui/sheet.tsx            optional `onHandleDismiss` (only the flag-on bottom handle uses it)  (Task 5)
  src/hooks/useOpenThread.ts             optional `to` (default "/home"; Library callers pass one argument)   (Task 4)
  src/components/app/home/composer.tsx   one effect, first line `if (!NEW_LOOK_ENABLED) return`               (Task 4)
  src/components/result/result-page.tsx, audience-panel.tsx   import the moved helpers (new-look-only files) (Task 3)
```

---

### Task 1: The key, the `?scriptFrom` address, and the page model (pure)

**Files:**
- Create: `src/lib/thread-next/seal-hash.ts`, `src/lib/thread-next/script-from.ts`, `src/lib/result/text-result.ts`
- Modify: `src/components/thread-next/__tests__/fixtures/answers.ts` (after `population()`, `:398-402`): add `segmentsPopulation` and `HOOK_1_POPULATION`
- Test: `src/lib/thread-next/__tests__/seal-hash.test.ts`, `src/lib/thread-next/__tests__/script-from.test.ts`, `src/lib/result/__tests__/text-result.test.ts`

**Interfaces:**
- Consumes: `stopNumberOf(seal: unknown): number | null` (`src/lib/thread-next/stop-number.ts`); `groupName(group: Archetype): string` (`src/lib/result/format.ts`); `ARCHETYPES`, `Archetype` (`src/lib/engine/wave3/persona-registry.ts`); `ringDots`, `RING_DOTS`, `RingLayout`, `RingDot`, `WedgeInput`, `WedgeLook` (`src/lib/result/ring-layout.ts`); `PopulationAggregate` (`src/lib/audience/population.ts`).
- Produces:
```ts
// seal-hash.ts
export const SEAL_HASH_LENGTH = 10;
export function sealHashOf(text: string): Promise<string>;     // base64url SHA-256 of text.trim(), first 10 chars
export function isSealHash(key: string): boolean;              // /^[A-Za-z0-9_-]{10}$/
// script-from.ts
export const SCRIPT_FROM_PARAM = "scriptFrom";
export function scriptFromHref(text: string): string;          // "/home?scriptFrom=<encoded trimmed text>"
export function scriptFromOf(search: string): string | null;   // trimmed value, null when missing or blank
export function withoutScriptFrom(href: string): string;       // path + rest of query + hash, parameter dropped
// text-result.ts
export type TextResultAs = "hook" | "idea" | "opening";
export const TEXT_RESULT_TITLE: Record<TextResultAs, string>;  // Hook / Idea / Opening line
export function textResultAsOf(value: string | null | undefined): TextResultAs;
export function textResultHref(threadId: string, key: string, as?: TextResultAs): string;
export const TEXT_RING: { readonly r1: 62; readonly R: 138 };  // the drawing's axRing(62, 138)
export interface TextGroup { group: Archetype; name: string; share: number; percent: number; stopPct: number }
export interface TextResultModel { value: number; groups: TextGroup[]; wedges: WedgeInput[] }
export function textResultOf(population: unknown): TextResultModel | null;
export function textRingLooks(model: TextResultModel, layout: RingLayout): WedgeLook[];
export function sweepOrdered(layout: RingLayout): RingLayout;
// fixtures/answers.ts
export function segmentsPopulation(rows: readonly (readonly [string, number, number])[], displayNames?: Partial<Record<string, string>>): PopulationAggregate;
export const HOOK_1_POPULATION: PopulationAggregate;           // AXGR: ten groups, weighted 30
```

Rules (spec §2, §4; drawing `axRing`, `AXGR`):
- `textResultOf`: the number is `stopNumberOf({ population })`; null → no model. Segments whose `archetype` is not one of `ARCHETYPES` are dropped (an unknown slug cannot be a wedge's group); a second segment for the same group is ignored. `share` = `Math.round(segment.share * 100)`, `percent` = `Math.round(segment.stopPct)` (clamped 0..100), `name` = `groupName(group)` (never the stored `displayName`). Groups sorted by `percent` desc, then `share` desc, then `ARCHETYPES` order (the drawing's `b[2] - a[2] || b[1] - a[1]`). Wedges: one per `ARCHETYPES` entry in that order (the video ring's order, spec §4.3), `weight = share * 100`, `present: false` for a group with no segment.
- `textRingLooks`: a present wedge lights `Math.round(stopPct / 100 * dots)` dots, never coral; an absent one is outlines.
- `sweepOrdered`: each wedge's dots ordered clockwise from its leading edge, then by row (the drawing's `cells.sort((A, B) => A.a - B.a || A.j - B.j)`: "lit = a slice from the wedge's leading edge across all rows"). `ringDots` orders dots inner-row-first/middle-out for the video ring; this re-orders a copy for the text page only.

- [ ] **Step 1: Add the fixture population** (it is data, not code under test). In `fixtures/answers.ts`, after `population()`:

```ts
/**
 * A population with the given segments, `[archetype, share (0..1), stopPct]`, weightiest share first as
 * stored. The whole's `stopPct` is their share-weighted mean to one decimal. `displayNames` sets a stored
 * display name (the page must never print it).
 */
export function segmentsPopulation(
  rows: readonly (readonly [string, number, number])[],
  displayNames: Partial<Record<string, string>> = {},
): PopulationAggregate {
  const total = 1000;
  const segments = rows.map(([archetype, share, stopPct]) => {
    const n = Math.round(share * total);
    return { archetype, displayName: displayNames[archetype] ?? archetype, share, total: n, stop: Math.round((stopPct / 100) * n), stopPct };
  });
  const stopPct = Math.round(rows.reduce((sum, [, share, pct]) => sum + share * pct, 0) * 10) / 10;
  const stop = Math.round((stopPct / 100) * total);
  return { total, stop, scroll: total - stop, stopPct, segments, reasons: [] };
}

/** Hook 1's real run as drawn (`AXGR`: share of the audience, % that would stop; weighted 30). "Quiet
 *  Watchers" is an old era's stored display name: the page shows "Quiet watchers" (`groupName`). */
export const HOOK_1_POPULATION: PopulationAggregate = segmentsPopulation(
  [
    ["loyalist", 0.18, 1],
    ["lurker", 0.14, 52],
    ["high_engager", 0.12, 6],
    ["sharer", 0.12, 36],
    ["tough_crowd", 0.09, 27],
    ["saver", 0.09, 100],
    ["cross_niche_curiosity", 0.08, 38],
    ["purposeful_viewer", 0.06, 5],
    ["niche_deep_buyer", 0.06, 3],
    ["niche_deep_scout", 0.06, 42],
  ],
  { lurker: "Quiet Watchers" },
);
```

- [ ] **Step 2: Write the failing tests.**

```ts
// src/lib/thread-next/__tests__/seal-hash.test.ts
import { describe, expect, it } from "vitest";
import { isSealHash, sealHashOf } from "@/lib/thread-next/seal-hash";
import { MEAL_PREP_HOOKS } from "@/components/thread-next/__tests__/fixtures/answers";

describe("sealHashOf", () => {
  it("is the first 10 characters of the base64url SHA-256 of the trimmed text", async () => {
    // SHA-256("abc") = ba7816bf…; base64 "ungWv48Bz+pB…": url-safe, so "+" is "-".
    expect(await sealHashOf("abc")).toBe("ungWv48Bz-");
    expect(await sealHashOf("  abc \n")).toBe("ungWv48Bz-");
  });

  it("hashes the drawing's hook 1 to its key", async () => {
    expect(await sealHashOf(MEAL_PREP_HOOKS[0]!.props.hookLine)).toBe("VvK87Bp1dO");
  });

  it("three hooks, three keys, each 10 url-safe characters", async () => {
    const keys = await Promise.all(MEAL_PREP_HOOKS.map((b) => sealHashOf(b.props.hookLine)));
    expect(new Set(keys).size).toBe(3);
    for (const key of keys) expect(isSealHash(key)).toBe(true);
  });
});

describe("isSealHash", () => {
  it.each([
    ["ungWv48Bz-", true],
    ["VvK87Bp1dO", true],
    ["0u-rb9rUfX", true],
    ["short", false],
    ["ungWv48Bz-x", false],
    ["ungWv48Bz+", false],
    ["ungWv48Bz/", false],
    ["", false],
  ])("%s → %s", (key, ok) => {
    expect(isSealHash(key)).toBe(ok);
  });
});
```

```ts
// src/lib/thread-next/__tests__/script-from.test.ts
import { describe, expect, it } from "vitest";
import { SCRIPT_FROM_PARAM, scriptFromHref, scriptFromOf, withoutScriptFrom } from "@/lib/thread-next/script-from";

const HOOK = "I spent $40 on meal prep & it tasted like regret. 100% #real, y’all + more";

describe("the ?scriptFrom address", () => {
  it("carries the trimmed text there and back, whatever it holds", () => {
    const href = scriptFromHref(`  ${HOOK} `);
    expect(href.startsWith(`/home?${SCRIPT_FROM_PARAM}=`)).toBe(true);
    expect(scriptFromOf(href.slice("/home".length))).toBe(HOOK);
  });

  it("missing or blank is nothing", () => {
    expect(scriptFromOf("")).toBeNull();
    expect(scriptFromOf("?v=hooks&seed=x")).toBeNull();
    expect(scriptFromOf("?scriptFrom=")).toBeNull();
    expect(scriptFromOf("?scriptFrom=%20%20")).toBeNull();
  });

  it("withoutScriptFrom drops the parameter and keeps the rest", () => {
    expect(withoutScriptFrom("http://localhost:3021/home?scriptFrom=abc")).toBe("/home");
    expect(withoutScriptFrom("http://localhost:3021/home?claimed=1&scriptFrom=abc#end")).toBe("/home?claimed=1#end");
  });
});
```

```ts
// src/lib/result/__tests__/text-result.test.ts
import { describe, expect, it } from "vitest";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";
import { HOOK_1_POPULATION, population, segmentsPopulation } from "@/components/thread-next/__tests__/fixtures/answers";
import { RING_DOTS, ringDots, type RingDot } from "../ring-layout";
import {
  TEXT_RESULT_TITLE,
  TEXT_RING,
  sweepOrdered,
  textResultAsOf,
  textResultHref,
  textResultOf,
  textRingLooks,
} from "../text-result";

const model = () => textResultOf(HOOK_1_POPULATION)!;

describe("textResultOf", () => {
  it("the number is the population's stopPct, rounded", () => {
    expect(model().value).toBe(30);
    expect(textResultOf(population(25.8))?.value).toBe(26);
  });

  it("ten groups by their display names, highest percent first, as the drawing lists them", () => {
    expect(model().groups.map((g) => [g.name, g.share, g.percent])).toEqual([
      ["Savers", 9, 100],
      ["Quiet watchers", 14, 52],
      ["Scouts", 6, 42],
      ["Passers-by", 8, 38],
      ["Sharers", 12, 36],
      ["Tough crowd", 9, 27],
      ["Commenters", 12, 6],
      ["Purposeful viewers", 6, 5],
      ["Deep fans", 6, 3],
      ["Regulars", 18, 1],
    ]);
    expect(model().groups.map((g) => g.name)).not.toContain("Quiet Watchers");
  });

  it("a tie in percent: the larger share first, then the video ring's order", () => {
    const m = textResultOf(segmentsPopulation([["sharer", 0.2, 40], ["saver", 0.3, 40], ["lurker", 0.3, 40]]))!;
    expect(m.groups.map((g) => g.group)).toEqual(["saver", "lurker", "sharer"]);
  });

  it("wedges in the video ring's order (ARCHETYPES), each as wide as its share", () => {
    const { wedges } = model();
    expect(wedges.map((w) => w.group)).toEqual([...ARCHETYPES]);
    const loyalist = wedges.find((w) => w.group === "loyalist")!;
    expect(loyalist.present).toBe(true);
    expect(loyalist.weight).toBeCloseTo(18);
  });

  it("an unknown slug is dropped; a group with no segment is an absent wedge", () => {
    const m = textResultOf(segmentsPopulation([["saver", 0.6, 50], ["the_tech_trend_hunter", 0.4, 90]]))!;
    expect(m.groups.map((g) => g.group)).toEqual(["saver"]);
    expect(m.wedges.filter((w) => w.present).map((w) => w.group)).toEqual(["saver"]);
    expect(m.wedges.find((w) => w.group === "lurker")).toEqual({ group: "lurker", weight: 0, present: false });
  });

  it("no number, no model", () => {
    expect(textResultOf(null)).toBeNull();
    expect(textResultOf({ total: 1000, segments: [], reasons: [] })).toBeNull();
    expect(textResultOf({ ...population(30), stopPct: 130 })).toBeNull();
  });
});

describe("textRingLooks", () => {
  it("each wedge lit to its group's percent, ink only; 1,000 dots in all", () => {
    const m = model();
    const layout = ringDots(m.wedges, TEXT_RING);
    const looks = textRingLooks(m, layout);
    expect(layout.wedges.reduce((n, w) => n + w.dots.length, 0)).toBe(RING_DOTS);
    const at = (group: string) => layout.wedges.findIndex((w) => w.group === group);
    expect(looks[at("saver")]).toEqual({ on: layout.wedges[at("saver")]!.dots.length, coral: false, outline: false });
    expect(looks[at("loyalist")]!.on).toBe(Math.round(0.01 * layout.wedges[at("loyalist")]!.dots.length));
    expect(looks.every((l) => !l.coral && !l.outline)).toBe(true);
  });

  it("a group with no segment is outlines", () => {
    const m = textResultOf(segmentsPopulation([["saver", 1, 50]]))!;
    const layout = ringDots(m.wedges, TEXT_RING);
    const looks = textRingLooks(m, layout);
    expect(looks[layout.wedges.findIndex((w) => w.group === "lurker")]).toEqual({ on: 0, coral: false, outline: true });
  });
});

describe("sweepOrdered", () => {
  it("orders each wedge clockwise from its leading edge, so a lit part is a slice across every row", () => {
    const base = ringDots(model().wedges, TEXT_RING);
    const swept = sweepOrdered(base);
    const c = swept.size / 2;
    const angle = (d: RingDot) => (Math.atan2(d.y - c, d.x - c) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
    swept.wedges.forEach((wedge, i) => {
      const before = base.wedges[i]!.dots;
      expect(new Set(wedge.dots.map((d) => `${d.x},${d.y}`))).toEqual(new Set(before.map((d) => `${d.x},${d.y}`)));
      for (let k = 1; k < wedge.dots.length; k++) expect(angle(wedge.dots[k]!)).toBeGreaterThanOrEqual(angle(wedge.dots[k - 1]!));
    });
    const lurker = swept.wedges.find((w) => w.group === "lurker")!;
    const lit = lurker.dots.slice(0, Math.round(0.52 * lurker.dots.length));
    expect(new Set(lit.map((d) => d.row))).toEqual(new Set(lurker.dots.map((d) => d.row)));
  });
});

describe("the address", () => {
  it("titles and the as parameter", () => {
    expect(TEXT_RESULT_TITLE).toEqual({ hook: "Hook", idea: "Idea", opening: "Opening line" });
    expect(textResultAsOf("idea")).toBe("idea");
    expect(textResultAsOf("opening")).toBe("opening");
    expect(textResultAsOf(undefined)).toBe("hook");
    expect(textResultAsOf("video")).toBe("hook");
  });

  it("hook has no parameter; idea and opening say what they are", () => {
    expect(textResultHref("t-1", "ungWv48Bz-")).toBe("/simulation/hook/t-1/ungWv48Bz-");
    expect(textResultHref("t-1", "ungWv48Bz-", "idea")).toBe("/simulation/hook/t-1/ungWv48Bz-?as=idea");
    expect(textResultHref("t-1", "ungWv48Bz-", "opening")).toBe("/simulation/hook/t-1/ungWv48Bz-?as=opening");
  });
});
```

- [ ] **Step 3: Run, watch them fail.** `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/lib/thread-next/__tests__/seal-hash.test.ts src/lib/thread-next/__tests__/script-from.test.ts src/lib/result/__tests__/text-result.test.ts` → FAIL: `Failed to resolve import "@/lib/thread-next/seal-hash"` (and the other two modules).

- [ ] **Step 4: Implement.**

```ts
// src/lib/thread-next/seal-hash.ts
/**
 * seal-hash.ts — the key of a text simulation's result page (thread answers step 2, spec §4): the first
 * 10 characters of the base64url SHA-256 of the trimmed text. ONE function for every link a card draws
 * and for the endpoint that finds the seal, so the two agree by construction.
 *
 * Async because Web Crypto is the only SHA-256 both runtimes have (no hash library ships to the client).
 * A browser exposes `crypto.subtle` in secure contexts only (https, localhost).
 *
 * Pure: no React.
 */

export const SEAL_HASH_LENGTH = 10;
const SEAL_HASH = /^[A-Za-z0-9_-]{10}$/;

export async function sealHashOf(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text.trim()));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, SEAL_HASH_LENGTH);
}

export function isSealHash(key: string): boolean {
  return SEAL_HASH.test(key);
}
```

```ts
// src/lib/thread-next/script-from.ts
/**
 * script-from.ts — "Script this one" from a result page (spec §4): the page goes to
 * `/home?scriptFrom=<the text>`; the composer reads the text once its thread has loaded, runs today's
 * write-script turn with it, and takes the parameter out of the address.
 *
 * Pure: no React.
 */

export const SCRIPT_FROM_PARAM = "scriptFrom";

export function scriptFromHref(text: string): string {
  return `/home?${SCRIPT_FROM_PARAM}=${encodeURIComponent(text.trim())}`;
}

/** The text to script from, or null when the parameter is missing or blank. */
export function scriptFromOf(search: string): string | null {
  const value = new URLSearchParams(search).get(SCRIPT_FROM_PARAM)?.trim() ?? "";
  return value.length > 0 ? value : null;
}

/** The same address without the parameter: path, the rest of the query, the hash. */
export function withoutScriptFrom(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(SCRIPT_FROM_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}
```

```ts
// src/lib/result/text-result.ts
import { ARCHETYPES, type Archetype } from "@/lib/engine/wave3/persona-registry";
import { stopNumberOf } from "@/lib/thread-next/stop-number";
import { groupName } from "./format";
import type { RingDot, RingLayout, WedgeInput, WedgeLook } from "./ring-layout";

/**
 * The result page of a text simulation (thread answers step 2, spec §4; drawing P7, `axResult`): the
 * number, the ring of 1,000 lit by group, the ten groups. Pure: no React.
 *
 * - The number is `Math.round(population.stopPct)` (`stopNumberOf`) and nothing else.
 * - Groups by their display names (`groupName`), never the stored `displayName`; highest percent first.
 * - Wedges in the video ring's order (`ARCHETYPES`), each as wide as its share; each lit to its
 *   group's percent from its leading edge (`sweepOrdered`, the drawing's "slice across all rows").
 */

export type TextResultAs = "hook" | "idea" | "opening";

export const TEXT_RESULT_TITLE: Record<TextResultAs, string> = { hook: "Hook", idea: "Idea", opening: "Opening line" };

export function textResultAsOf(value: string | null | undefined): TextResultAs {
  return value === "idea" || value === "opening" ? value : "hook";
}

/** `/simulation/hook/[threadId]/[key]`, with `?as=` for an idea or an opening line. */
export function textResultHref(threadId: string, key: string, as: TextResultAs = "hook"): string {
  const base = `/simulation/hook/${encodeURIComponent(threadId)}/${encodeURIComponent(key)}`;
  return as === "hook" ? base : `${base}?as=${as}`;
}

/** The drawing's ring (`axRing(62, 138)`): 286 square with the default padding. */
export const TEXT_RING = { r1: 62, R: 138 } as const;

export interface TextGroup {
  group: Archetype;
  name: string;
  /** Whole percent of the audience. */
  share: number;
  /** Whole percent that would stop. */
  percent: number;
  /** The stored rate, 0..100, for the ring. */
  stopPct: number;
}

export interface TextResultModel {
  value: number;
  groups: TextGroup[];
  wedges: WedgeInput[];
}

const KNOWN: ReadonlySet<string> = new Set(ARCHETYPES);
const ORDER = new Map<Archetype, number>(ARCHETYPES.map((g, i) => [g, i]));

export function textResultOf(population: unknown): TextResultModel | null {
  const value = stopNumberOf({ population });
  if (value === null) return null;
  const raw = (population as { segments?: unknown }).segments;
  const byGroup = new Map<Archetype, { share: number; stopPct: number }>();
  for (const s of Array.isArray(raw) ? raw : []) {
    if (!s || typeof s !== "object") continue;
    const { archetype, share, stopPct } = s as { archetype?: unknown; share?: unknown; stopPct?: unknown };
    if (typeof archetype !== "string" || !KNOWN.has(archetype) || byGroup.has(archetype as Archetype)) continue;
    if (typeof share !== "number" || !Number.isFinite(share) || share < 0) continue;
    if (typeof stopPct !== "number" || !Number.isFinite(stopPct)) continue;
    byGroup.set(archetype as Archetype, { share, stopPct: Math.max(0, Math.min(100, stopPct)) });
  }
  const groups: TextGroup[] = [...byGroup]
    .map(([group, s]) => ({
      group,
      name: groupName(group),
      share: Math.round(s.share * 100),
      percent: Math.round(s.stopPct),
      stopPct: s.stopPct,
    }))
    .sort((a, b) => b.percent - a.percent || b.share - a.share || ORDER.get(a.group)! - ORDER.get(b.group)!);
  const wedges: WedgeInput[] = ARCHETYPES.map((group) => {
    const s = byGroup.get(group);
    return { group, weight: s ? s.share * 100 : 0, present: !!s };
  });
  return { value, groups, wedges };
}

/** Each wedge lit to its group's percent, ink only; a group with no segment is outlines. */
export function textRingLooks(model: TextResultModel, layout: RingLayout): WedgeLook[] {
  const lit = new Map(model.groups.map((g) => [g.group, g.stopPct / 100] as const));
  return layout.wedges.map((wedge) => {
    const share = lit.get(wedge.group);
    if (!wedge.present || share === undefined) return { on: 0, coral: false, outline: true };
    return { on: Math.round(share * wedge.dots.length), coral: false, outline: false };
  });
}

/** A copy of the layout with each wedge's dots clockwise from its leading edge, then by row. */
export function sweepOrdered(layout: RingLayout): RingLayout {
  const c = layout.size / 2;
  const clockwise = (d: RingDot) => (Math.atan2(d.y - c, d.x - c) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
  return {
    ...layout,
    wedges: layout.wedges.map((w) => ({ ...w, dots: [...w.dots].sort((a, b) => clockwise(a) - clockwise(b) || a.row - b.row) })),
  };
}
```

- [ ] **Step 5: Run the same command → PASS.** Then `npx tsc --noEmit` and `npx eslint src/lib/thread-next src/lib/result/text-result.ts src/components/thread-next/__tests__/fixtures/answers.ts`: clean. Also run `src/components/thread-next/__tests__` (the fixtures test must still validate every block). Do not commit.

Flag off: nothing consumes these modules yet.

---

### Task 2: The endpoint `GET /api/threads/[id]/seals/[key]`

**Files:**
- Create: `src/app/api/threads/[id]/seals/[key]/route.ts`
- Test: `src/app/api/threads/[id]/seals/[key]/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `sealHashOf`, `isSealHash` (Task 1); `stopNumberOf`; `readSimSeals(thread: Pick<ThreadRow, "sim_seals">): SimSealMap` (`src/lib/threads/sim-seals.ts:126`); `isSealedVisitor(user)` (`src/lib/onboarding/verdict-seal.ts:33`); `createClient()` (`@/lib/supabase/server`); `NEW_LOOK_ENABLED`.
- Produces: `export async function GET(request: Request, ctx: { params: Promise<{ id: string; key: string }> }): Promise<Response>` → 200 `{ text: string; at: string; population: PopulationAggregate }` | 401 `{ error: "Unauthorized" }` | 404 `{ error: "Not found" }` | 500 `{ error: string }` (a database error: not one of the spec's 404 cases, and a failure must say something, as the DELETE route's F-021 note asks).

Pattern (seam map §3.4): the session client and an explicit `.eq("user_id", user.id)` (RLS `threads_select_own` backs it); `maybeSingle()` so a foreign or missing thread is `null`, not a throw; no filter on `type` (an archived thread's result stays its creator's).

- [ ] **Step 1: Write the failing test.**

```ts
/**
 * GET /api/threads/[id]/seals/[key] — one text simulation's result, for its page (thread answers
 * step 2, spec §4). Real: the route, `readSimSeals`, the key (`sealHashOf`), `stopNumberOf`, the funnel
 * wall. Stood in for: the Supabase server client (the I/O boundary) and the build-time flag.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HOOK_1_POPULATION, MEAL_PREP_HOOKS, population } from "@/components/thread-next/__tests__/fixtures/answers";
import { sealHashOf } from "@/lib/thread-next/seal-hash";

vi.setConfig({ testTimeout: 30_000 });

const db = vi.hoisted(() => ({
  user: null as null | { id: string; is_anonymous?: boolean },
  row: null as unknown,
  error: null as null | { message: string },
  from: [] as string[],
  eqs: [] as [string, unknown][],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: db.user }, error: null }) },
    from: (table: string) => {
      db.from.push(table);
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          db.eqs.push([column, value]);
          return query;
        },
        maybeSingle: async () => ({ data: db.row, error: db.error }),
      };
      return query;
    },
  }),
}));

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  return (await import("../route")).GET;
}

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD = "00000000-0000-4000-8000-0000000000bb";
const HOOK_1 = MEAL_PREP_HOOKS[0]!.props.hookLine;
const HOOK_2 = MEAL_PREP_HOOKS[1]!.props.hookLine;
const AT = "2026-11-21T00:00:00.000Z";
let KEY_1 = "";
let KEY_2 = "";

beforeAll(async () => {
  KEY_1 = await sealHashOf(HOOK_1);
  KEY_2 = await sealHashOf(HOOK_2);
});

beforeEach(() => {
  db.user = { id: USER };
  db.row = null;
  db.error = null;
  db.from = [];
  db.eqs = [];
});

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.resetModules();
});

type Get = Awaited<ReturnType<typeof load>>;
const call = (GET: Get, id = THREAD, key = KEY_1) =>
  GET(new Request(`http://localhost/api/threads/${id}/seals/${key}`), { params: Promise.resolve({ id, key }) });

const sealed = (seals: Record<string, unknown>) => ({ id: THREAD, type: "open", sim_seals: seals });
const textSeal = (pop: unknown) => ({ pct: 70, band: null, at: AT, population: pop });

describe("GET /api/threads/[id]/seals/[key]", () => {
  it("flag off: not found, and nothing is read", async () => {
    const GET = await load(false);
    expect((await call(GET)).status).toBe(404);
    expect(db.from).toEqual([]);
  });

  it("signed out: 401", async () => {
    const GET = await load(true);
    db.user = null;
    expect((await call(GET)).status).toBe(401);
  });

  it("a funnel visitor (anonymous): not found, nothing read", async () => {
    const GET = await load(true);
    db.user = { id: USER, is_anonymous: true };
    expect((await call(GET)).status).toBe(404);
    expect(db.from).toEqual([]);
  });

  it.each([
    ["a malformed id", "not-a-uuid", "VvK87Bp1dO"],
    ["a short key", THREAD, "short"],
    ["a key with a slash", THREAD, "VvK87Bp1d/"],
  ])("%s: not found, nothing read", async (_case, id, key) => {
    const GET = await load(true);
    expect((await call(GET, id, key)).status).toBe(404);
    expect(db.from).toEqual([]);
  });

  it("a thread that is not the caller's (or not there): not found; owner-checked, any status", async () => {
    const GET = await load(true);
    db.row = null;
    expect((await call(GET)).status).toBe(404);
    expect(db.from).toEqual(["threads"]);
    expect(db.eqs).toEqual([["id", THREAD], ["user_id", USER]]);
  });

  it("the key of a text seal with a population: its text, time and population", async () => {
    const GET = await load(true);
    db.row = sealed({ [HOOK_1]: textSeal(HOOK_1_POPULATION), [HOOK_2]: textSeal(population(22)) });
    const res = await call(GET);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: HOOK_1, at: AT, population: HOOK_1_POPULATION, open: true });
    const second = await call(GET, THREAD, KEY_2);
    expect((await second.json()).population.stopPct).toBe(22);
  });

  it("an archived thread's seal is still its creator's", async () => {
    const GET = await load(true);
    db.row = { ...sealed({ [HOOK_1]: textSeal(HOOK_1_POPULATION) }), type: "archived" };
    const res = await call(GET);
    expect(res.status).toBe(200);
    // …but it cannot take a new turn: the page shows no "Script this one".
    expect((await res.json()).open).toBe(false);
  });

  it("an unknown key: not found", async () => {
    const GET = await load(true);
    db.row = sealed({ [HOOK_1]: textSeal(HOOK_1_POPULATION) });
    expect((await call(GET, THREAD, await sealHashOf("a text this thread never simulated"))).status).toBe(404);
  });

  it("a seal without a population, or without a number: not found", async () => {
    const GET = await load(true);
    db.row = sealed({ [HOOK_1]: { pct: 60, band: null, at: AT } });
    expect((await call(GET)).status).toBe(404);
    db.row = sealed({ [HOOK_1]: textSeal({ total: 1000, segments: [], reasons: [] }) });
    expect((await call(GET)).status).toBe(404);
  });

  it("a video seal never matches, even with a population", async () => {
    const GET = await load(true);
    db.row = sealed({
      [HOOK_1]: { ...textSeal(HOOK_1_POPULATION), video: { analysisId: "a1", stopPct: 46, heatmap: { weighted_curve: [1, 0.5] } } },
    });
    expect((await call(GET)).status).toBe(404);
  });

  it("a database error: 500 that says so", async () => {
    const GET = await load(true);
    db.error = { message: "connection reset" };
    const res = await call(GET);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/connection reset/);
  });
});
```

- [ ] **Step 2: Run, watch it fail.** `NODE_OPTIONS=--no-experimental-webstorage npx vitest run "src/app/api/threads/[id]/seals/[key]/__tests__/route.test.ts"` → FAIL: `Failed to resolve import "../route"`.

- [ ] **Step 3: Implement.**

```ts
// src/app/api/threads/[id]/seals/[key]/route.ts
/**
 * GET /api/threads/[id]/seals/[key] — one text simulation's result, for its page
 * `/simulation/hook/[threadId]/[key]` (thread answers step 2, spec §4).
 *
 * The key is `sealHashOf(text)` (the same function every link uses); the seal is found by hashing each
 * text seal of the thread. Answers `{ text, at, population, open }`; 401 signed out; 404 for everything else
 * the page must not show (flag off, a funnel visitor, a malformed id or key, a thread that is not the
 * caller's, an unknown key, a video seal, a seal with no population number). Any status: an archived
 * thread's result stays its creator's.
 *
 * Read-only and a GET: no csrfGuard (it 415s every request without a JSON body).
 */

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { isSealedVisitor } from "@/lib/onboarding/verdict-seal";
import { createClient } from "@/lib/supabase/server";
import { isSealHash, sealHashOf } from "@/lib/thread-next/seal-hash";
import { stopNumberOf } from "@/lib/thread-next/stop-number";
import { readSimSeals } from "@/lib/threads/sim-seals";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; key: string }> },
): Promise<Response> {
  if (!NEW_LOOK_ENABLED) return notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  // Text seals never cross the wire to a /go visitor (verdict-seal.ts).
  if (isSealedVisitor(user)) return notFound();

  const { id, key } = await params;
  // A non-uuid id would be a 22P02 from Postgres, not a 404.
  if (!UUID.test(id) || !isSealHash(key)) return notFound();

  const { data: row, error } = await supabase
    .from("threads")
    .select("id, type, sim_seals")
    .eq("id", id)
    .eq("user_id", user.id) // ownership, belt and braces with RLS
    .maybeSingle();
  if (error) return Response.json({ error: "Server error" }, { status: 500 }); // no database text on the wire
  if (!row) return notFound();

  for (const [text, seal] of Object.entries(readSimSeals(row))) {
    if (seal.video || stopNumberOf(seal) === null) continue;
    if ((await sealHashOf(text)) === key) {
      // `open`: "Script this one" runs in the open thread only (the active-thread cookie steers to open threads).
      return Response.json({ text, at: seal.at, population: seal.population, open: row.type === "open" });
    }
  }
  return notFound();
}
```

- [ ] **Step 4: Run → PASS.** Then the neighbours unchanged: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run "src/app/api/threads" src/lib/threads`. `npx tsc --noEmit`, `npx eslint "src/app/api/threads/[id]/seals"`. Do not commit.

Flag off: the route's first line answers 404 (tested). Nothing else changed.

---

### Task 3: The result page (route, pure view, fetching screen, dev states)

**Files:**
- Create: `src/components/result/use-pushed-title.ts` (the body of `usePushedTitle` moved from `result-page.tsx:33-38`); `src/components/result/stage.ts` (`STAGE` moved from `audience-panel.tsx:33-36`); `src/hooks/queries/use-text-seal.ts`; `src/components/result/text-result.tsx`; `src/components/result/text-result-screen.tsx`; `src/app/(app)/simulation/hook/[threadId]/[key]/page.tsx`
- Modify: `src/components/result/result-page.tsx` (delete the local `usePushedTitle` `:33-38` and the now-unused `useShellStore` import `:8`; `import { usePushedTitle } from "./use-pushed-title";`); `src/components/result/audience-panel.tsx` (delete the local `STAGE` `:33-36`; `import { STAGE } from "./stage";`); `src/app/(app)/dev/answers/page.tsx` (`STATES` `:41` + the doc comment); `src/app/(app)/dev/answers/dev-answers.tsx` (state union `:47-61`, the p7 branch in `DevAnswers` `:194-221`)
- Test: `src/components/result/__tests__/text-result.test.tsx`, `src/components/result/__tests__/text-result-screen.test.tsx`, `src/app/(app)/simulation/__tests__/text-result-route.test.ts`; extend `src/app/(app)/dev/answers/__tests__/page.test.ts` and `dev-answers.test.tsx`

Why move rather than export: `result-page.tsx` and `audience-panel.tsx` import the video result (player, playhead, brain); importing a helper from them would pull that bundle into the hook page.

**Interfaces:**
- Consumes: Task 1's `textResultOf`, `textRingLooks`, `sweepOrdered`, `TEXT_RING`, `TEXT_RESULT_TITLE`, `textResultAsOf`, `TextResultAs`, `TextResultModel`; `Gauge({ headline: { value, label }, size, lines })` (`src/components/result/gauge.tsx:33`); `AudienceRing({ layout, looks })` (`audience-ring.tsx:66`); `ringDots`; `ResultHeader({ title })` (`result-header.tsx:15`); `Card` (`@/components/ui/card`); `Button` (`@/components/ui/button`, `variant="secondary"`); `AnswerPrimary`, `PROSE`, `keepHyphens` (`src/components/thread-next/answer-card.tsx`); `DocIcon` (`src/components/thread-next/field-icons.tsx`); `creditCost`.
- Produces:
```ts
// use-pushed-title.ts
export function usePushedTitle(title: string): void;
// stage.ts
export const STAGE: string;
// use-text-seal.ts
export interface TextSeal { text: string; at: string; population: PopulationAggregate; open: boolean }
export function useTextSeal(threadId: string, key: string): { seal: TextSeal | undefined; notFound: boolean };
// text-result.tsx
export type TextResultState =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "result"; text: string; model: TextResultModel };
export function TextResultView(p: { state: TextResultState; as: TextResultAs; onScript?: () => void }): JSX.Element;
// text-result-screen.tsx
export function TextResultScreen(p: { threadId: string; sealKey: string; as: TextResultAs }): JSX.Element;
// page.tsx (default export)
export default async function TextResultPage(p: {
  params: Promise<{ threadId: string; key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element>;
```
(`key` is reserved by React, so the screen's prop is `sealKey`.)

Geometry (drawing P7, `axResult`): column 16 gutters, 9 under the header band on a phone (the video page's `PHONE_TOP`); desktop `px-8 pt-8`, one column `max-w-[640px]` centred under `ResultHeader`; cards 12 apart (`.ax-page gap 12`). Hero card padding 20 / 20 / 14; the text; a hairline 16 under it then 18 to the gauge (`.ax-hg`); `Gauge` size 148 with `lines={["would stop", "to watch"]}`; the primary 6 under it. Ring card: the stage fill, the card shadow, padding 14 / 0 / 16, the ring then the caption 6 apart, caption 13 / 18 centred. Groups card padding 4 / 18 / 6; header as step 1's `CardHeader` (10 / 2 / 8, 13 / 540, 21 line); rows 9 / 0 with a hairline above, 12 gap, name 15 / 20 at 560, under it 13 / 18 secondary, the percent 16 at 680 (drawn 17: no role at 17) with "%" 13 at 560 muted. Loading blocks at the drawn card heights 359, 340, 619.

- [ ] **Step 1: Move the two helpers** (pure moves, no test change): create

```ts
// src/components/result/use-pushed-title.ts
"use client";

import { useEffect } from "react";
import { useShellStore } from "@/stores/shell-store";

/** Names the screen in the phone's pushed header (NextShell) and clears the name on the way out. */
export function usePushedTitle(title: string) {
  const setPushedTitle = useShellStore((s) => s.setPushedTitle);
  useEffect(() => setPushedTitle(title), [title, setPushedTitle]);
  useEffect(() => () => setPushedTitle(""), [setPushedTitle]);
}
```

```ts
// src/components/result/stage.ts
/** The mock's `--stage`: a soft light in the middle of a card, from the theme's surfaces. */
export const STAGE =
  "bg-[radial-gradient(90%_80%_at_50%_40%,var(--color-surface)_0%,color-mix(in_srgb,var(--color-surface-elevated)_50%,var(--color-surface))_100%)] " +
  "dark:bg-[radial-gradient(80%_70%_at_50%_42%,color-mix(in_srgb,var(--color-surface-elevated)_55%,var(--color-surface))_0%,var(--color-surface)_100%)]";
```
then edit `result-page.tsx` and `audience-panel.tsx` as listed. Run `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/result`: all green (the moves change nothing).

- [ ] **Step 2: Write the failing tests.**

```tsx
// src/components/result/__tests__/text-result.test.tsx
/** @vitest-environment happy-dom */
/**
 * TextResultView — the result page of a text simulation (spec §4), from props. Real parts: the gauge,
 * the ring, the model. Stood in for: the router (Back) and the build-time flag.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/simulation/hook/t/k" }));

import { HOOK_1_POPULATION, MEAL_PREP_HOOKS } from "@/components/thread-next/__tests__/fixtures/answers";
import { textResultOf } from "@/lib/result/text-result";
import { useShellStore } from "@/stores/shell-store";
import { TextResultView } from "../text-result";

const HOOK = MEAL_PREP_HOOKS[0]!.props.hookLine;
const model = textResultOf(HOOK_1_POPULATION)!;
const result = { kind: "result" as const, text: HOOK, model };

afterEach(() => {
  cleanup();
  router.push.mockReset();
  router.back.mockReset();
});

describe("TextResultView", () => {
  it("the text, the number, the primary, the ring and the ten groups; no Share", () => {
    const onScript = vi.fn();
    render(<TextResultView state={result} as="hook" onScript={onScript} />);
    expect(screen.getByRole("heading", { level: 1, name: "Hook" })).toBeInTheDocument();
    expect(useShellStore.getState().pushedTitle).toBe("Hook");
    expect(screen.getByText(HOOK)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "30% would stop to watch" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Script this one, 2 credits" }));
    expect(onScript).toHaveBeenCalledTimes(1);
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("viewers")).toBeInTheDocument();
    expect(screen.getByText("Each dot is a viewer. Dark ones would stop.")).toBeInTheDocument();
    const list = screen.getByRole("heading", { level: 2, name: "Would stop, by group" }).parentElement!;
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Savers9% of your audience100%",
      "Quiet watchers14% of your audience52%",
      "Scouts6% of your audience42%",
      "Passers-by8% of your audience38%",
      "Sharers12% of your audience36%",
      "Tough crowd9% of your audience27%",
      "Commenters12% of your audience6%",
      "Purposeful viewers6% of your audience5%",
      "Deep fans6% of your audience3%",
      "Regulars18% of your audience1%",
    ]);
    expect(screen.queryByText("Quiet Watchers")).toBeNull();
    expect(screen.queryByRole("button", { name: /share/i })).toBeNull();
  });

  it("the ring: ten wedges, 1,000 dots, each lit to its group's percent, never coral", () => {
    render(<TextResultView state={result} as="hook" />);
    const wedges = [...document.querySelectorAll<SVGGElement>("[data-text-result='ring'] [data-wedge]")];
    expect(wedges).toHaveLength(10);
    expect(wedges.reduce((n, w) => n + Number(w.dataset.dots), 0)).toBe(1000);
    const look = (group: string) => wedges.find((w) => w.dataset.wedge === group)!.dataset.look;
    expect(look("saver")).toBe("full");
    expect(look("loyalist")).toBe("part");
    expect(wedges.some((w) => w.dataset.look === "coral")).toBe(false);
  });

  it("an opening line: titled so, and no primary (it is already a script)", () => {
    render(<TextResultView state={result} as="opening" onScript={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Opening line" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Script this one/ })).toBeNull();
  });

  it("an idea: titled Idea, with the primary", () => {
    render(<TextResultView state={result} as="idea" onScript={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Idea" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Script this one, 2 credits" })).toBeInTheDocument();
  });

  it("loading: three quiet blocks and no number", () => {
    render(<TextResultView state={{ kind: "loading" }} as="hook" />);
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("not found: the line and Back", () => {
    Object.defineProperty(window.history, "length", { value: 3, configurable: true });
    render(<TextResultView state={{ kind: "not-found" }} as="hook" />);
    expect(screen.getByText("This simulation isn't here.")).toBeInTheDocument();
    const back = screen.getAllByRole("button", { name: "Back" }).find((b) => b.textContent === "Back")!;
    fireEvent.click(back);
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
```

```tsx
// src/components/result/__tests__/text-result-screen.test.tsx
/** @vitest-environment happy-dom */
/**
 * TextResultScreen — `/simulation/hook/[threadId]/[key]` asks the endpoint for the seal and draws the
 * page (spec §4). Real: the screen, useTextSeal, TanStack Query, the model, the view. Stood in for: the
 * network (`fetch`), the router, the build-time flag.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/simulation/hook/t/k" }));

import { HOOK_1_POPULATION, MEAL_PREP_HOOKS } from "@/components/thread-next/__tests__/fixtures/answers";
import type { TextResultAs } from "@/lib/result/text-result";
import { sealHashOf } from "@/lib/thread-next/seal-hash";
import { TextResultScreen } from "../text-result-screen";

const THREAD = "00000000-0000-4000-8000-0000000000bb";
const HOOK = MEAL_PREP_HOOKS[0]!.props.hookLine;
let KEY = "";
beforeAll(async () => {
  KEY = await sealHashOf(HOOK);
});

function answer(status: number, body: unknown) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderScreen(as: TextResultAs = "hook") {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <TextResultScreen threadId={THREAD} sealKey={KEY} as={as} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  router.push.mockReset();
});

describe("TextResultScreen", () => {
  it("asks for the seal once, shows the quiet blocks, then the result", async () => {
    const fetchMock = answer(200, { text: HOOK, at: "2026-11-21T00:00:00.000Z", population: HOOK_1_POPULATION, open: true });
    renderScreen();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(await screen.findByRole("img", { name: "30% would stop to watch" })).toBeInTheDocument();
    expect(screen.getByText(HOOK)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(`/api/threads/${THREAD}/seals/${KEY}`);
  });

  it("404: This simulation isn't here. (asked once, not retried)", async () => {
    const fetchMock = answer(404, { error: "Not found" });
    renderScreen();
    expect(await screen.findByText("This simulation isn't here.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a seal whose population has no number: not here either", async () => {
    answer(200, { text: HOOK, at: "2026-11-21T00:00:00.000Z", population: { total: 1000, segments: [], reasons: [] }, open: true });
    renderScreen();
    expect(await screen.findByText("This simulation isn't here.")).toBeInTheDocument();
  });

  it("?as=opening: Opening line, no primary", async () => {
    answer(200, { text: HOOK, at: "2026-11-21T00:00:00.000Z", population: HOOK_1_POPULATION, open: true });
    renderScreen("opening");
    await screen.findByRole("img", { name: "30% would stop to watch" });
    expect(screen.getByRole("heading", { level: 1, name: "Opening line" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Script this one/ })).toBeNull();
  });
});
```

```ts
// src/app/(app)/simulation/__tests__/text-result-route.test.ts
/**
 * The text result page's address with the flag off and on (spec §4). The flag is a build-time
 * constant, so each case loads the route module fresh with the flag set as that build would have it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement } from "react";

vi.setConfig({ testTimeout: 30_000 });

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  return (await import("../hook/[threadId]/[key]/page")).default;
}

const args = (search: Record<string, string | string[]> = {}) => ({
  params: Promise.resolve({ threadId: "t-1", key: "VvK87Bp1dO" }),
  searchParams: Promise.resolve(search),
});

async function thrown(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? error);
  }
  return "nothing thrown";
}

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.resetModules();
});

type Props = { threadId: string; sealKey: string; as: string };
const propsOf = (element: unknown) => (element as { props: Props }).props;

describe("/simulation/hook/[threadId]/[key]", () => {
  it("flag off: not found", async () => {
    const Page = await load(false);
    expect(await thrown(() => Page(args()))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("flag on: the screen for that thread and key, a hook by default", async () => {
    const Page = await load(true);
    const element = await Page(args());
    expect(isValidElement(element)).toBe(true);
    expect(propsOf(element)).toEqual({ threadId: "t-1", sealKey: "VvK87Bp1dO", as: "hook" });
  });

  it.each([
    [{ as: "idea" }, "idea"],
    [{ as: "opening" }, "opening"],
    [{ as: ["opening", "idea"] }, "opening"],
    [{ as: "nope" }, "hook"],
  ] as const)("?as=%j → %s", async (search, as) => {
    const Page = await load(true);
    expect(propsOf(await Page(args(search as Record<string, string | string[]>))).as).toBe(as);
  });
});
```

In `src/app/(app)/dev/answers/__tests__/page.test.ts`, add `"p7", "p7l", "p7n"` to the `it.each([...])` state list. In `dev-answers.test.tsx`, add after the flag mock:

```tsx
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dev/answers",
  useSearchParams: () => new URLSearchParams(),
}));
```
and these cases:

```tsx
  it("p7: the hook's result page from the drawing's numbers", () => {
    render(<DevAnswers state="p7" skin="light" frames={null} />);
    expect(screen.getByRole("heading", { level: 1, name: "Hook" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "30% would stop to watch" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Would stop, by group" })).toBeInTheDocument();
    expect(screen.getByText("Quiet watchers")).toBeInTheDocument();
  });

  it("p7l: loading; p7n: not here", () => {
    const { unmount } = render(<DevAnswers state="p7l" skin="light" frames={null} />);
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    unmount();
    render(<DevAnswers state="p7n" skin="light" frames={null} />);
    expect(screen.getByText("This simulation isn't here.")).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run, watch them fail.** `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/result/__tests__/text-result.test.tsx src/components/result/__tests__/text-result-screen.test.tsx "src/app/(app)/simulation/__tests__/text-result-route.test.ts" "src/app/(app)/dev/answers"` → FAIL: `Failed to resolve import "../text-result"` (and the screen, the page); the dev page answers not found for `p7`.

- [ ] **Step 4: Implement.**

```ts
// src/hooks/queries/use-text-seal.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { PopulationAggregate } from "@/lib/audience/population";

/** The endpoint's body (`GET /api/threads/[id]/seals/[key]`). */
export interface TextSeal {
  text: string;
  at: string;
  population: PopulationAggregate;
  /** The thread is open: only then can "Script this one" run in it (archived → no button). */
  open: boolean;
}

/** Not there (404) or not the viewer's (401): asked once, never again. */
class SealMissing extends Error {}

/**
 * One text simulation's stored result, for `/simulation/hook/[threadId]/[key]`. A seal never changes once
 * written (`staleTime: Infinity`). A missing one says so at once; any other failure is asked once more,
 * then shown as not here (the page has no other state for it).
 */
export function useTextSeal(threadId: string, key: string): { seal: TextSeal | undefined; notFound: boolean } {
  const query = useQuery({
    queryKey: ["text-seal", threadId, key] as const,
    queryFn: async (): Promise<TextSeal> => {
      const res = await fetch(`/api/threads/${encodeURIComponent(threadId)}/seals/${encodeURIComponent(key)}`);
      if (res.status === 404 || res.status === 401) throw new SealMissing(String(res.status));
      if (!res.ok) throw new Error(`text seal: ${res.status}`);
      return (await res.json()) as TextSeal;
    },
    retry: (failures, error) => !(error instanceof SealMissing) && failures < 1,
    staleTime: Infinity,
  });
  return { seal: query.data, notFound: query.isError && query.data === undefined };
}
```

```tsx
// src/components/result/text-result.tsx
"use client";

import { memo, useMemo } from "react";
import { useRouter } from "next/navigation";

import { AnswerPrimary, PROSE, keepHyphens } from "@/components/thread-next/answer-card";
import { DocIcon } from "@/components/thread-next/field-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { creditCost } from "@/lib/pricing";
import { ringDots } from "@/lib/result/ring-layout";
import {
  TEXT_RESULT_TITLE,
  TEXT_RING,
  sweepOrdered,
  textRingLooks,
  type TextResultAs,
  type TextResultModel,
} from "@/lib/result/text-result";
import { cn } from "@/lib/utils";

import { AudienceRing } from "./audience-ring";
import { Gauge } from "./gauge";
import { ResultHeader } from "./result-header";
import { STAGE } from "./stage";
import { usePushedTitle } from "./use-pushed-title";

/**
 * The result page of a text simulation (thread answers step 2, spec §4; drawing P7, `axResult`), from
 * props: the text, the number ("would stop to watch"), "Script this one" (not on an opening line), the
 * ring of 1,000 lit by group, the ten groups. No Share (nothing can be shared yet). Loading: the three
 * cards as quiet blocks; not found: one line and Back.
 */

export type TextResultState =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "result"; text: string; model: TextResultModel };

function Loading() {
  return (
    <div aria-busy="true" data-text-result="loading" className="flex flex-col gap-3">
      <Card className="h-[359px]" />
      <Card className="h-[340px]" />
      <Card className="h-[619px]" />
    </div>
  );
}

function Missing() {
  const router = useRouter();
  // Back returns to where the creator came from; opened directly, Home (the shell's rule).
  const back = () => (window.history.length > 1 ? router.back() : router.push("/home"));
  return (
    <div data-text-result="missing" className="flex flex-col items-center gap-4 pt-24 text-center">
      <p className="text-title font-[640] text-foreground">This simulation isn&apos;t here.</p>
      <Button variant="secondary" onClick={back}>
        Back
      </Button>
    </div>
  );
}

/**
 * The ring's centre (`.ax-rc`): "1,000" 30 / 32 at 700 and "viewers" 13 in the secondary ink 2 under it,
 * one centred block. In SVG (sizes off the type roles live there); the baselines are where that HTML
 * block puts them (Inter: ascent 0.96875, content 1.2109 per em): 1.9 and 21.7 from the centre.
 */
function RingCount() {
  return (
    <svg
      aria-hidden
      width={120}
      height={60}
      viewBox="-60 -30 120 60"
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible"
    >
      <text y={1.9} textAnchor="middle" fontSize={30} fontWeight={700} letterSpacing="-0.045em" className="fill-foreground tabular-nums">
        1,000
      </text>
      <text y={21.7} textAnchor="middle" fontSize={13} className="fill-foreground-secondary">
        viewers
      </text>
    </svg>
  );
}

const TextRing = memo(function TextRing({ model }: { model: TextResultModel }) {
  const layout = useMemo(() => sweepOrdered(ringDots(model.wedges, TEXT_RING)), [model]);
  const looks = textRingLooks(model, layout);
  return (
    <div className="relative shrink-0" style={{ width: layout.size, height: layout.size }}>
      <AudienceRing layout={layout} looks={looks} />
      <RingCount />
    </div>
  );
});

function Result({ text, model, scriptable, onScript }: { text: string; model: TextResultModel; scriptable: boolean; onScript?: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Card data-text-result="hero" className="px-5 pb-3.5 pt-5">
        <p className={cn("text-pretty text-subhead font-[620] leading-[26px] tracking-[-0.018em] text-foreground", PROSE)}>{keepHyphens(text)}</p>
        <div className="mt-4 flex justify-center border-t border-border pt-[18px]">
          <Gauge headline={{ value: model.value, label: "would stop to watch" }} size={148} lines={["would stop", "to watch"]} />
        </div>
        {scriptable && (
          <div className="mt-1.5">
            <AnswerPrimary
              icon={<DocIcon size={20} aria-hidden className="shrink-0" />}
              label="Script this one"
              price={creditCost("script")}
              onClick={onScript}
            />
          </div>
        )}
      </Card>
      <figure
        data-text-result="ring"
        className={cn("m-0 flex flex-col items-center gap-1.5 overflow-hidden rounded-3xl pb-4 pt-3.5 shadow-[var(--shadow-rest)]", STAGE)}
      >
        <TextRing model={model} />
        <figcaption className="px-4 text-center text-meta text-foreground-secondary">Each dot is a viewer. Dark ones would stop.</figcaption>
      </figure>
      <Card data-text-result="groups" className="px-[18px] pb-1.5 pt-1">
        <div>
          <h2 className="px-0.5 pb-2 pt-2.5 text-meta font-[540] leading-[21px] text-foreground-secondary">Would stop, by group</h2>
          <ul className="m-0 list-none p-0">
            {model.groups.map((g) => (
              <li key={g.group} data-group={g.group} className="flex items-center gap-3 border-t border-border py-[9px]">
                <div className="min-w-0 flex-1">
                  <p className="text-ui font-[560] leading-5 text-foreground">{g.name}</p>
                  <p className="text-meta text-foreground-secondary tabular-nums">{g.share}% of your audience</p>
                </div>
                <p className="shrink-0 text-title font-[680] tracking-[-0.02em] text-foreground tabular-nums">
                  {g.percent}
                  <span className="ml-px text-meta font-[560] tracking-normal text-foreground-muted">%</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}

export function TextResultView({ state, as, onScript }: { state: TextResultState; as: TextResultAs; onScript?: () => void }) {
  const title = TEXT_RESULT_TITLE[as];
  usePushedTitle(title);
  const body =
    state.kind === "loading" ? (
      <Loading />
    ) : state.kind === "not-found" ? (
      <Missing />
    ) : (
      <Result text={state.text} model={state.model} scriptable={as !== "opening" && onScript !== undefined} onScript={onScript} />
    );
  return (
    <div className="flex min-h-full flex-col">
      <ResultHeader title={title} />
      <div data-result-body="" className="flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+40px)] pt-[9px] md:px-8 md:pb-12 md:pt-8">
        <div className="mx-auto w-full max-w-[640px]">{body}</div>
      </div>
    </div>
  );
}
```

(The groups heading's `parentElement` is the wrapping `<div>`, which holds the `<ul>`: the test's `within(list)` relies on it.)

```tsx
// src/components/result/text-result-screen.tsx
"use client";

import { useMemo } from "react";
import { useTextSeal } from "@/hooks/queries/use-text-seal";
import { textResultOf, type TextResultAs } from "@/lib/result/text-result";
import { TextResultView, type TextResultState } from "./text-result";

/** `/simulation/hook/[threadId]/[key]`: reads the seal and picks the state (spec §4). */
export function TextResultScreen({ threadId, sealKey, as }: { threadId: string; sealKey: string; as: TextResultAs }) {
  const { seal, notFound } = useTextSeal(threadId, sealKey);
  const model = useMemo(() => (seal ? textResultOf(seal.population) : null), [seal]);
  const state: TextResultState =
    notFound || (seal && !model)
      ? { kind: "not-found" }
      : seal && model
        ? { kind: "result", text: seal.text, model }
        : { kind: "loading" };
  return <TextResultView state={state} as={as} />;
}
```

```tsx
// src/app/(app)/simulation/hook/[threadId]/[key]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TextResultScreen } from "@/components/result/text-result-screen";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { textResultAsOf } from "@/lib/result/text-result";

interface PageProps {
  params: Promise<{ threadId: string; key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = { title: "Simulation | Maven" };

/**
 * `/simulation/hook/[threadId]/[key]` (`?as=idea|opening`): the result page of a text simulation
 * (thread answers step 2, spec §4). New look only: with the flag off this address does not exist.
 */
export default async function TextResultPage({ params, searchParams }: PageProps) {
  if (!NEW_LOOK_ENABLED) notFound();
  const { threadId, key } = await params;
  const { as } = await searchParams;
  return <TextResultScreen threadId={threadId} sealKey={key} as={textResultAsOf(Array.isArray(as) ? as[0] : as)} />;
}
```

Dev page: in `page.tsx` add `"p7", "p7l", "p7n"` to `STATES` and to the doc comment ("p7: the hook's result page, from `HOOK_1_POPULATION` · p7l: loading · p7n: not found"). In `dev-answers.tsx` extend `DevAnswersState` with `| "p7" | "p7l" | "p7n"`, import `TextResultView`, `type TextResultState` from `@/components/result/text-result`, `textResultOf` from `@/lib/result/text-result`, and `HOOK_1_POPULATION` from the fixtures; `turnOf`'s return type becomes `DevTurn | null` and its switch gains `case "p7": case "p7l": case "p7n": return null;` (the page is not a turn); in `DevAnswers` after the two hooks:

```tsx
  if (state === "p7" || state === "p7l" || state === "p7n") {
    const view: TextResultState =
      state === "p7"
        ? { kind: "result", text: MEAL_PREP_HOOKS[0]!.props.hookLine, model: textResultOf(HOOK_1_POPULATION)! }
        : state === "p7l"
          ? { kind: "loading" }
          : { kind: "not-found" };
    return (
      <div className="min-h-full bg-background">
        <TextResultView state={view} as="hook" onScript={noop} />
      </div>
    );
  }
  const s = turnOf(state, { frames, startedAt })!;
```

- [ ] **Step 5: Run → PASS** (the command of Step 3), then the neighbours: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/result "src/app/(app)/simulation" "src/app/(app)/dev"`. `npx tsc --noEmit`; `npx eslint src/components/result src/hooks/queries/use-text-seal.ts "src/app/(app)/simulation" "src/app/(app)/dev/answers"`.
- [ ] **Step 6: Look at it** (controller's server on 3021): `/dev/answers?state=p7` at 393×852 and 1440×900, light and dark (`&skin=dark`), full window, beside `ax-p7.png`; scroll `<main>` to its end beside `ax-p7b.png`. Planned differences: no Share (spec), the hero text 22 / 28 (spec; drawn 19 / 26), wedges in the video ring's order (spec; drawn by share), the percent 16 (drawn 17). Fix anything else; say what you did not check. Do not commit.

Flag off: the page calls `notFound()` first (tested); the dev page already 404s; the moved helpers live in new-look-only files (`ResultPage`, `AudiencePanel` render only under the flag) and their suites stay green.

---

### Task 4: "Script this one" from the page (page → cookie + `/home?scriptFrom=`; the composer runs it once)

> **Superseded where it hands the text over (2026-11-23).** This task as written passes the text in the
> address (`/home?scriptFrom=…`). It was not built that way: an address must never start a paid turn. The
> hand-off is a `sessionStorage` entry that names its thread and expires after 60 seconds
> (`src/lib/thread-next/script-from.ts`: `leaveScriptFrom`, `takeScriptFrom`); the page goes to plain
> `/home`; `useOpenThread` is unchanged. See the spec's §8 and this plan's "Result". The text below is kept
> as the record of what was planned.

**Files:**
- Modify: `src/hooks/useOpenThread.ts:33-46` (optional `to`); `src/components/result/text-result-screen.tsx` (wire `onScript`); `src/components/app/home/composer.tsx` (import `:116`; one effect right after `handleWriteScript`, `:1525`)
- Test: extend `src/components/result/__tests__/text-result-screen.test.tsx`; `src/components/app/home/__tests__/composer-next-field.flag-on.test.tsx` (new describe at the end); `src/components/app/home/__tests__/composer-v8.test.tsx` (flag off: one new case)

**Interfaces:**
- Consumes: Task 1's `scriptFromHref`, `scriptFromOf`, `withoutScriptFrom`; `handleWriteScript(hookLine: string, _audienceArchetype: string)` (composer, unchanged); `openThreadId` (composer `:644`), `rehydrating` (`:707`).
- Produces: `export function useOpenThread(): (threadId: string, to?: string) => void` (default `to = "/home"`).

**The readiness signal:** `openThreadId !== null && !rehydrating`. Why: `openThreadId` is `null` on every composer mount and is set by `loadPersistedBlocks` (`C:1251`) inside the same async callback, in the same batched update, as `setPersistedChatTurns(orderedTurns(messages))` (`C:1304`) and the seal map: when it first turns non-null the thread's history is in state, so the write-script turn appends AFTER it. The page always arrives by a client push, which remounts the composer (the first load, `isFirstThreadLoadRef`, never sets `rehydrating`); `!rehydrating` keeps a later in-page thread switch (`C:1174`) from counting as ready with the old id. The load resolves the thread from the `maven_active_thread` cookie the page just set, and by then the router has already written the new address, so `window.location.search` holds the parameter.

- [ ] **Step 1: Write the failing tests.**

In `text-result-screen.test.tsx` add (imports: `fireEvent` from `@testing-library/react`, `useBoardStore` from `@/stores/board-store`):

```tsx
  it("Script this one: points the thread at this page's thread and goes home with the text", async () => {
    document.cookie = "maven_active_thread=; path=/; max-age=0";
    answer(200, { text: HOOK, at: "2026-11-21T00:00:00.000Z", population: HOOK_1_POPULATION, open: true });
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "Script this one, 2 credits" }));
    expect(document.cookie).toContain(`maven_active_thread=${THREAD}`);
    expect(useBoardStore.getState().activeThreadId).toBe(THREAD);
    expect(router.push).toHaveBeenCalledWith(`/home?scriptFrom=${encodeURIComponent(HOOK)}`);
  });

  it("an archived thread's result has no \"Script this one\" (a new turn would land in another thread)", async () => {
    answer(200, { text: HOOK, at: "2026-11-21T00:00:00.000Z", population: HOOK_1_POPULATION, open: false });
    renderScreen();
    expect(await screen.findByText("Would stop, by group")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Script this one/ })).toBeNull();
  });
```

In `composer-next-field.flag-on.test.tsx`, at the end:

```tsx
describe("step 2: 'Script this one' from a result page lands in its thread", () => {
  const hook = MEAL_PREP_HOOKS[0]!.props.hookLine;
  afterEach(() => window.history.replaceState({}, "", "/home"));

  /** /api/threads/open waits until the test lets it answer; the chat stream stays open (the live turn,
   *  with its question, stays drawn). */
  function holdLoadAndChat(): () => void {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const base = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/threads/open")) {
        calls.push({ url, init });
        await held;
        return json(threadFixture);
      }
      if (url.includes("/api/tools/chat")) {
        calls.push({ url, init });
        return sse(init?.signal, true);
      }
      return base(input, init);
    }) as typeof fetch;
    return release;
  }

  it("runs one write-script turn with the text once the thread has loaded, then takes the parameter out", async () => {
    window.history.replaceState({}, "", `/home?scriptFrom=${encodeURIComponent(hook)}`);
    threadFixture = mealPrepThread();
    const release = holdLoadAndChat();
    await renderComposer();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    // Not before the thread is in: the turn must land after its history.
    expect(requests("/api/tools/chat")).toHaveLength(0);
    expect(window.location.search).toContain("scriptFrom=");
    await act(async () => release());
    await waitFor(() => expect(requests("/api/tools/chat")).toHaveLength(1));
    expect(bodyOf(requests("/api/tools/chat")[0]!)).toMatchObject({
      ask: "Write the script from this hook.",
      skill: "script",
      anchor: hook,
    });
    expect(window.location.search).not.toContain("scriptFrom");
    // The script's turn sits after the thread's history.
    const historyRow = screen.getByText(hook);
    const ask = await screen.findByText("Write the script from this hook.");
    expect(historyRow.compareDocumentPosition(ask) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Once: nothing more fires.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(requests("/api/tools/chat")).toHaveLength(1);
  });

  it("an empty parameter does nothing", async () => {
    window.history.replaceState({}, "", "/home?scriptFrom=%20%20");
    threadFixture = mealPrepThread();
    await renderComposer();
    await screen.findAllByRole("button", { name: /^Simulate: / });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(requests("/api/tools/chat")).toHaveLength(0);
  });
});
```

In `composer-v8.test.tsx` (flag off: this file does not mock `@/lib/flags/new-look`), at the end:

```tsx
describe("thread answers step 2: ?scriptFrom= is new-look only", () => {
  it("with the flag off, /home?scriptFrom= runs nothing and leaves the address alone", async () => {
    window.history.replaceState({}, "", "/home?scriptFrom=Write%20me%20a%20script");
    try {
      threadFixture = seededThread();
      renderWithClient(<Composer />);
      await screen.findByText(/simulate with your audience/i); // the thread has loaded
      await new Promise((r) => setTimeout(r, 30));
      const urls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes("/api/tools/chat"))).toBe(false);
      expect(window.location.search).toBe("?scriptFrom=Write%20me%20a%20script");
    } finally {
      window.history.replaceState({}, "", "/home");
    }
  });
});
```

- [ ] **Step 2: Run, watch them fail.** `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/result/__tests__/text-result-screen.test.tsx src/components/app/home/__tests__/composer-next-field.flag-on.test.tsx src/components/app/home/__tests__/composer-v8.test.tsx` → the screen case fails (`Script this one, 2 credits` is absent: no `onScript` yet), the first composer case times out waiting for one chat request; the flag-off case and "an empty parameter" already pass (they guard).

- [ ] **Step 3: Implement.**

`src/hooks/useOpenThread.ts` (the doc comment gains: "`to` (default `/home`): where to land, e.g. `/home?scriptFrom=…` from a text's result page"):

```ts
export function useOpenThread(): (threadId: string, to?: string) => void {
  const router = useRouter();
  const setActiveThreadId = useBoardStore((s) => s.setActiveThreadId);
  const switchThread = useBoardStore((s) => s.switchThread);

  return useCallback(
    (threadId: string, to: string = "/home") => {
      setActiveThreadCookie(threadId);
      setActiveThreadId(threadId);
      switchThread();
      router.push(to);
    },
    [router, setActiveThreadId, switchThread],
  );
}
```

`text-result-screen.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { useTextSeal } from "@/hooks/queries/use-text-seal";
import { useOpenThread } from "@/hooks/useOpenThread";
import { textResultOf, type TextResultAs } from "@/lib/result/text-result";
import { scriptFromHref } from "@/lib/thread-next/script-from";
import { TextResultView, type TextResultState } from "./text-result";

/**
 * `/simulation/hook/[threadId]/[key]`: reads the seal and picks the state (spec §4). "Script this one"
 * points the active thread at this page's thread and returns to it as `/home?scriptFrom=<the text>`;
 * the composer runs the write-script turn once that thread has loaded.
 */
export function TextResultScreen({ threadId, sealKey, as }: { threadId: string; sealKey: string; as: TextResultAs }) {
  const { seal, notFound } = useTextSeal(threadId, sealKey);
  const openThread = useOpenThread();
  const model = useMemo(() => (seal ? textResultOf(seal.population) : null), [seal]);
  const state: TextResultState =
    notFound || (seal && !model)
      ? { kind: "not-found" }
      : seal && model
        ? { kind: "result", text: seal.text, model }
        : { kind: "loading" };
  // An archived thread cannot take a new turn (the cookie steers to open threads): no button there.
  const onScript = state.kind === "result" && seal?.open ? () => openThread(threadId, scriptFromHref(state.text)) : undefined;
  return <TextResultView state={state} as={as} onScript={onScript} />;
}
```

`composer.tsx`: next to `:116` add `import { scriptFromOf, withoutScriptFrom } from "@/lib/thread-next/script-from";`; right after `handleWriteScript`'s `useCallback` (`:1525`):

```tsx
  // ── New look: "Script this one" from a text's result page (thread answers step 2) ──────────────
  // The page (/simulation/hook/…) pointed the active-thread cookie at its thread and came back as
  // /home?scriptFrom=<the text>. Once THAT thread has loaded — `openThreadId` is null on every mount
  // and is set in the same batch as the thread's turns; `!rehydrating` keeps a switch in progress
  // from counting — run today's write-script turn with the text, once, and take the parameter out
  // of the address (Next keeps its router state in `history.state`). A missing or blank parameter
  // does nothing. Flag off: nothing.
  const scriptFromReadRef = useRef(false);
  useEffect(() => {
    if (!NEW_LOOK_ENABLED || scriptFromReadRef.current) return;
    if (openThreadId === null || rehydrating) return;
    scriptFromReadRef.current = true;
    const text = scriptFromOf(window.location.search);
    if (text === null) return;
    window.history.replaceState(window.history.state, "", withoutScriptFrom(window.location.href));
    handleWriteScript(text, "");
  }, [openThreadId, rehydrating, handleWriteScript]);
```
If `npx eslint` reports `react-hooks/set-state-in-effect` on the `handleWriteScript` call, add above it `// eslint-disable-next-line react-hooks/set-state-in-effect -- a one-shot hand-off read once (ref-guarded), as the launch-seed inlet (Seam 4) does`, the same exception the launch-seed inlet takes.

- [ ] **Step 4: Run → PASS** (Step 2's command). Then every composer suite, flag on and off, one file at a time where the full run times out (known: three composer files hit 5 s under load and pass alone): `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/app/home src/components/saved src/components/result`. `npx tsc --noEmit`; `npx eslint src/components/app/home/composer.tsx src/hooks/useOpenThread.ts src/components/result`. Do not commit.

Flag off: the effect's first line returns (guarded by the new `composer-v8.test.tsx` case, plus `composer.test.tsx`, `composer-v8.test.tsx`, `composer-funnel-return.test.tsx` unchanged); `useOpenThread`'s two Library callers pass one argument and land on `/home` as before.

---

### Task 5: The details sheet (shell, bodies, Copy and Save, dev states)

**Files:**
- Create: `src/components/thread-next/answer-sheet.tsx`, `sheet-body.tsx`, `sheet-actions.tsx`
- Modify: `src/components/ui/sheet.tsx:51-101` (optional `onHandleDismiss` + `SheetHandleZone`); `src/components/thread-next/answer-icons.tsx` (+ `CopyIcon`, `BookmarkIcon`, `ExternalIcon`); `answer-gauge.tsx:45-48` (rename `clip` → exported `clipName`, update its two uses) and `:250` (export `EmptyArt`); `remix-answer.tsx:55-82` (export `proofStats` (was `statsOf`) and `ProofCover` (was `Cover`), update their two uses); fixtures `answers.ts` (hook 1's proof `videoUrl: "/clips/dij-arc"` at `:416`; add `IDEA_SHEET`); `src/app/(app)/dev/answers/page.tsx`, `dev-answers.tsx` (states p6, p6b, p6i)
- Test: `src/components/thread-next/__tests__/answer-sheet.test.tsx`, `sheet-body.test.tsx`, `sheet-actions.test.tsx`; extend `src/components/ui/__tests__/next-look-parts.flag-on.test.tsx`, `src/app/(app)/dev/answers/__tests__/page.test.ts` and `dev-answers.test.tsx`

**Interfaces:**
- Consumes: `Sheet`, `SheetContent`, `SheetTitle` (`@/components/ui/sheet`); `Dialog as DialogPrimitive` from `"radix-ui"` (the legacy `ui/dialog.tsx` paints a dark glass panel inline: not used); `useMediaQuery` (`@/hooks/useMediaQuery`); `IconButton` (`@/components/ui/icon-button`, `surface="card"`); `useSaveItem`, `useDeleteSavedItem`, `useSavedItemByRef` (`@/hooks/queries/use-saved-items`); `useSaveProvenance()` (`@/lib/save-provenance-context`); `SavedItemType` (`@/lib/shelf/shelf-repo`); `SmallGauge`, `GaugeState`; `AnswerPrimary`, `PROSE`, `keepHyphens`, `creditsLabel`; `firstSentence` (`@/lib/thread-next/first-sentence`); `HookCardBlock`, `IdeaCardBlock`, `HookProof` (`@/lib/tools/blocks`).
- Produces:
```ts
// ui/sheet.tsx: SheetContent gains
onHandleDismiss?: () => void;   // new look, bottom sheet: a tap on the grab handle, or a pull down of 24+ from it, dismisses
// answer-gauge.tsx
export function clipName(text: string): string;            // 60 characters with "…" (was the local `clip`)
export function EmptyArt(p: { size: number }): JSX.Element;
// remix-answer.tsx
export function proofStats(proof: HookProof): string | null;
export function ProofCover(p: { src: string | null }): JSX.Element;
// answer-icons.tsx
export const CopyIcon: ShellIcon;
export function BookmarkIcon(p: ShellIconProps & { filled?: boolean }): JSX.Element;
export const ExternalIcon: ShellIcon;
// answer-sheet.tsx
export function AnswerSheet(p: { open: boolean; onOpenChange: (open: boolean) => void; title: string; returnFocus?: HTMLElement | null; children: React.ReactNode }): JSX.Element;
// sheet-body.tsx
export interface SheetGauge { state: GaugeState; failed: boolean; text: string; href: string | null; onSimulate?: () => void }
export function SheetGaugeRow(p: { gauge: SheetGauge; actions: React.ReactNode }): JSX.Element;
export function HookSheetBody(p: { hook: HookCardBlock["props"]; gauge: SheetGauge; actions: React.ReactNode; onScript?: () => void }): JSX.Element;
export function IdeaSheetBody(p: { idea: IdeaCardBlock["props"]; gauge: SheetGauge; actions: React.ReactNode; onScript?: () => void }): JSX.Element;
// sheet-actions.tsx
export function CopyButton(p: { copied: boolean; onCopy?: () => void }): JSX.Element;
export function SaveButton(p: { saved: boolean; onToggle?: () => void }): JSX.Element;
export function useCopyText(text: string): { copied: boolean; copy: () => void };
export function useSaveToggle(p: { itemType: SavedItemType; title: string; snapshot: Record<string, unknown> }): { saved: boolean; busy: boolean; toggle: () => void };
// fixtures
export const IDEA_SHEET: IdeaCardBlock;
```

Geometry (drawing P6, `axHookSheet`, `.ax-sh`, `.sheet`, `.grab`): the phone sheet padding 10 top (the handle zone below: 28 tall, the handle 10 down it), 20 sides, `max(34px, safe area)` bottom; radius 32 on top and the sheet shadow (the `Sheet` part's new-look classes); the title 14 under the handle (`mt-px` after the 28 zone), 22 / 28 at 640. The gauge row (`.ax-shg`): 12 under the title, padding 2 / 2 / 14, 8 apart; its control is the 52 gauge + 12 + the label 14 (drawn 14.5) in the secondary ink, then a 14 chevron in the muted ink pulled 4 left (`.ax-shl`); Copy and Save at the right, round, 44 (spec; drawn 40) on the sunken tint. Sections (`.ax-sec`): 12 / 2 padding, a hairline above, the label 13 / 18 at 620 secondary, the text 3 under it, 15 / 21 (drawn 15.5); "More" at 650 in ink. Proof row (`.ax-src`): 8 under its label, radius 16 (drawn 18), 5% of the ink, padding 8 / 14 / 8 / 8, cover 40 × 56, the handle 14 / 620, the stats 13 (drawn 12.5) secondary, the external mark 16 muted. The primary 8 under the last section (`.ax-shb`). Desktop: a centred dialog 560 wide, radius 32, the float shadow, padding 24, no handle, the same content.

- [ ] **Step 1: Fixture changes.** In `answers.ts`, hook 1's proof becomes `proof({ handle: "dij.arc", coverUrl: "/covers/c8.jpg", videoUrl: "/clips/dij-arc", multiplier: 50.2, baselineLabel: "their followers", views: 21000 })`. After `IDEAS_4` add:

```ts
/** An idea opened (P12's second idea, with a take, a why and a format to show; invented). */
export const IDEA_SHEET: IdeaCardBlock = idea("The Two-Hour Study Lie", "Short sessions stick better.", {
  take: "Long study blocks feel productive, but most of the second hour is gone by the next morning. Three short sessions beat one long one.",
  whyItFits: "Your audience saves study advice that admits a habit was wrong. They comment when a routine they keep gets questioned.",
  format: "Talking head with an on-screen timer",
  seedHook: "I studied two hours a day for a month. Here is how much I remembered.",
});
```

- [ ] **Step 2: Write the failing tests.**

`next-look-parts.flag-on.test.tsx` (add `fireEvent` to the `@testing-library/react` import), inside `describe('flag on: Sheet', …)`:

```tsx
  it('with onHandleDismiss the handle sits in a zone that dismisses on a tap or a pull down', () => {
    const onHandleDismiss = vi.fn();
    render(
      <Sheet open>
        <SheetContent side="bottom" onHandleDismiss={onHandleDismiss}>
          <SheetTitle>Sheet</SheetTitle>
          <SheetDescription>Details.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    const zone = document.querySelector('[data-slot="sheet-handle-zone"]') as HTMLElement;
    expect(zone.querySelector('[data-slot="sheet-handle"]')).not.toBeNull();
    fireEvent.click(zone);
    expect(onHandleDismiss).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(zone, { clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(zone, { clientY: 140, pointerId: 1 });
    expect(onHandleDismiss).toHaveBeenCalledTimes(2);
  });

  it('without it the handle is the plain drawn bar (no zone)', () => {
    render(
      <Sheet open>
        <SheetContent side="bottom">
          <SheetTitle>Sheet</SheetTitle>
          <SheetDescription>Details.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(document.querySelector('[data-slot="sheet-handle"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="sheet-handle-zone"]')).toBeNull();
  });
```

```tsx
// src/components/thread-next/__tests__/answer-sheet.test.tsx
/** @vitest-environment happy-dom */
/**
 * AnswerSheet — the details sheet's shell (spec §3 "Where"): a bottom sheet on a phone, a centred 560
 * dialog from 768 up. Escape and the grab handle close it; focus goes back to the row that opened it.
 * Real Radix layers; the one stand-in is matchMedia (phone or desk).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { AnswerSheet } from "../answer-sheet";

function viewport(wide: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: wide && /min-width:\s*768px/.test(query),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

const TITLE = "Stop eating sad desk lunch: my 3-step fix for brain fog during exams.";

function Harness() {
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={setRow} type="button" onClick={() => setOpen(true)}>
        Open row
      </button>
      <AnswerSheet open={open} onOpenChange={setOpen} title={TITLE} returnFocus={row}>
        <button type="button">Inside</button>
      </AnswerSheet>
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AnswerSheet", () => {
  it.each([
    ["phone", false],
    ["desktop", true],
  ] as const)("on the %s: named by its text, which is its heading; Escape closes it and focus goes back to the row", async (_view, wide) => {
    viewport(wide);
    render(<Harness />);
    const row = screen.getByRole("button", { name: "Open row" });
    fireEvent.click(row);
    const dialog = await screen.findByRole("dialog", { name: TITLE });
    expect(within(dialog).getByRole("heading", { level: 2, name: TITLE })).toBeInTheDocument();
    expect(dialog).toHaveAttribute("data-sheet", wide ? "dialog" : "sheet");
    expect(document.querySelector('[data-slot="sheet-handle"]') !== null).toBe(!wide);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(row);
  });

  it("phone: a tap on the grab handle closes it", async () => {
    viewport(false);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open row" }));
    await screen.findByRole("dialog");
    fireEvent.click(document.querySelector('[data-slot="sheet-handle-zone"]')!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("desktop: 560 wide on the card surface", async () => {
    viewport(true);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open row" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).toContain("w-[560px]");
    expect(dialog.className).toContain("bg-surface");
  });
});
```

```tsx
// src/components/thread-next/__tests__/sheet-body.test.tsx
/** @vitest-environment happy-dom */
/**
 * The sheet's bodies (spec §3): a hook's and an idea's, from the drawing's fixtures, and the gauge row
 * in every state. Real parts throughout; nothing is stood in for.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { HookSheetBody, IdeaSheetBody, type SheetGauge } from "../sheet-body";
import { IDEA_SHEET, MEAL_PREP_HOOKS, hook, proof } from "./fixtures/answers";

afterEach(cleanup);

const HOOK = MEAL_PREP_HOOKS[0]!.props;
const gauge = (over: Partial<SheetGauge> = {}): SheetGauge => ({
  state: { kind: "empty" },
  failed: false,
  text: HOOK.hookLine,
  href: null,
  onSimulate: vi.fn(),
  ...over,
});
const actions = <span data-testid="actions" />;
const h3s = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("HookSheetBody", () => {
  it("why it works, visual, proven, then the one primary", () => {
    const onScript = vi.fn();
    render(<HookSheetBody hook={HOOK} gauge={gauge()} actions={actions} onScript={onScript} />);
    expect(h3s()).toEqual(["Why it works", "Visual", "Proven"]);
    expect(screen.getByText("It breaks the idea that meal prep means expensive wellness culture.")).toBeInTheDocument();
    expect(screen.getByText("Sad grey food next to textbooks")).toBeInTheDocument();
    const proofLink = screen.getByRole("link", { name: /^Proven: @dij\.arc, 50\.2× their followers · 21K views/ });
    expect(proofLink).toHaveAttribute("href", "/clips/dij-arc");
    expect(proofLink).toHaveAttribute("target", "_blank");
    expect(proofLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByTestId("actions")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Script this one, 2 credits" }));
    expect(onScript).toHaveBeenCalledTimes(1);
  });

  it("shows none of the old card's extras", () => {
    const loud = hook("A hook with every extra on its card", {
      fraction: "7/10 stop",
      band: "Strong",
      scrollQuote: "too slow, scrolled",
      rank: 2,
      seedHook: "A different seed line",
      channel: "spoken",
    }).props;
    render(<HookSheetBody hook={loud} gauge={gauge({ text: loud.hookLine })} actions={actions} />);
    for (const gone of ["7/10 stop", "Strong", "too slow, scrolled", "A different seed line", "spoken", "#2"]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
    expect(screen.queryByText(/Made for/)).toBeNull();
  });

  it("'More' opens the rest of why it works in place", () => {
    const long = hook("A hook", { mechanism: "It names a cost. Then it pays it back in the first second." }).props;
    render(<HookSheetBody hook={long} gauge={gauge({ text: "A hook" })} actions={actions} />);
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/Then it pays it back/)).toBeNull();
    fireEvent.click(more);
    expect(screen.getByText("It names a cost. Then it pays it back in the first second.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  it("no visual and no proof: those sections are not drawn; one sentence has no More", () => {
    const bare = hook("A bare hook").props;
    render(<HookSheetBody hook={bare} gauge={gauge({ text: "A bare hook" })} actions={actions} />);
    expect(h3s()).toEqual(["Why it works"]);
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  it("a proof without a video: the row, no link and no mark", () => {
    const quiet = hook("A hook with a quiet proof", { proof: proof({ handle: "nia.tests", views: 1200 }) }).props;
    render(<HookSheetBody hook={quiet} gauge={gauge({ text: quiet.hookLine })} actions={actions} />);
    expect(screen.getByText("@nia.tests")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Proven:/ })).toBeNull();
  });
});

describe("the gauge row", () => {
  it("simulated, with its page: one link 'would stop to watch' to the result page", () => {
    render(<HookSheetBody hook={HOOK} gauge={gauge({ state: { kind: "done", value: 30 }, href: "/simulation/hook/t/k" })} actions={actions} />);
    const link = screen.getByRole("link", { name: /^Open the result: I spent \$40/ });
    expect(link).toHaveAttribute("href", "/simulation/hook/t/k");
    expect(link).toHaveTextContent("would stop to watch");
    expect(screen.getByRole("img", { name: "30% would stop to watch" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Simulate: / })).toBeNull();
  });

  it("simulated, its key not known yet: the words, no link", () => {
    render(<HookSheetBody hook={HOOK} gauge={gauge({ state: { kind: "done", value: 30 } })} actions={actions} />);
    expect(screen.getByText("would stop to watch")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Open the result/ })).toBeNull();
  });

  it("not simulated: Simulate · 1 credit fires the queue", () => {
    const onSimulate = vi.fn();
    render(<HookSheetBody hook={HOOK} gauge={gauge({ onSimulate })} actions={actions} />);
    const button = screen.getByRole("button", { name: /^Simulate: I spent \$40/ });
    expect(button).toHaveTextContent("Simulate");
    expect(button).toHaveTextContent("1 credit");
    fireEvent.click(button);
    expect(onSimulate).toHaveBeenCalledTimes(1);
  });

  it("failed: Couldn't simulate, and Simulate again", () => {
    render(<HookSheetBody hook={HOOK} gauge={gauge({ failed: true })} actions={actions} />);
    expect(screen.getByText("Couldn't simulate")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Simulate: / })).toBeEnabled();
  });

  it.each([{ kind: "running" }, { kind: "waiting" }] as const)("%o: Simulating, no control, no link", (state) => {
    render(<HookSheetBody hook={HOOK} gauge={gauge({ state })} actions={actions} />);
    expect(screen.getByText("Simulating")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Simulate: / })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Open the result/ })).toBeNull();
  });

  it("without a queue the Simulate button is there and disabled", () => {
    render(<HookSheetBody hook={HOOK} gauge={gauge({ onSimulate: undefined })} actions={actions} />);
    expect(screen.getByRole("button", { name: /^Simulate: / })).toBeDisabled();
  });
});

describe("IdeaSheetBody", () => {
  it("the take whole, why it fits folded, the format, then the primary", () => {
    const onScript = vi.fn();
    const idea = IDEA_SHEET.props;
    render(<IdeaSheetBody idea={idea} gauge={gauge({ text: idea.title })} actions={actions} onScript={onScript} />);
    expect(h3s()).toEqual(["The take", "Why it fits", "Format"]);
    expect(screen.getByText(idea.take)).toBeInTheDocument();
    expect(screen.getByText(/^Your audience saves study advice that admits a habit was wrong\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
    expect(screen.getByText("Talking head with an on-screen timer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Script this one, 2 credits" }));
    expect(onScript).toHaveBeenCalledTimes(1);
  });

  it("no take, no format: those sections are not drawn", () => {
    const idea = { ...IDEA_SHEET.props, take: "", format: null };
    render(<IdeaSheetBody idea={idea} gauge={gauge({ text: idea.title })} actions={actions} />);
    expect(h3s()).toEqual(["Why it fits"]);
  });
});
```

```tsx
// src/components/thread-next/__tests__/sheet-actions.test.tsx
/** @vitest-environment happy-dom */
/**
 * Copy and Save in the sheet (spec §3): new-look buttons over today's hooks. Real: the hooks, TanStack
 * Query, the provenance contexts. Stood in for: the clipboard and the network (`fetch`).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { BlockOrigin } from "@/components/app/home/rehydrate-thread";
import { BlockOriginContext, ThreadIdContext } from "@/lib/save-provenance-context";
import { CopyButton, SaveButton, useCopyText, useSaveToggle } from "../sheet-actions";
import { MEAL_PREP_HOOKS } from "./fixtures/answers";

const HOOK = MEAL_PREP_HOOKS[0]!.props.hookLine;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
});

function CopyHarness() {
  const c = useCopyText(HOOK);
  return <CopyButton copied={c.copied} onCopy={c.copy} />;
}

function SaveHarness() {
  const s = useSaveToggle({ itemType: "hook", title: HOOK, snapshot: { hookLine: HOOK } });
  return <SaveButton saved={s.saved} onToggle={s.toggle} />;
}

describe("Copy", () => {
  it("copies the text and says 'Copied' for a moment", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CopyHarness />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    });
    expect(writeText).toHaveBeenCalledWith(HOOK);
    expect(screen.getByText("Copied")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Copied")).toBeNull(), { timeout: 2500 });
  });

  it("no clipboard (an insecure page): nothing happens, nothing throws", () => {
    render(<CopyHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(screen.queryByText("Copied")).toBeNull();
  });
});

describe("Save", () => {
  function stubSaved(items: unknown[]) {
    const calls: { url: string; method: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        calls.push({ url: String(url), method, body: init?.body ? JSON.parse(String(init.body)) : null });
        const body = method === "GET" ? { items } : method === "POST" ? { item: { id: "row-new" } } : { id: "row-1" };
        return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );
    return calls;
  }

  function renderSave(origin: BlockOrigin | null) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <ThreadIdContext.Provider value="t1">
          <BlockOriginContext.Provider value={origin}>
            <SaveHarness />
          </BlockOriginContext.Provider>
        </ThreadIdContext.Provider>
      </QueryClientProvider>,
    );
  }

  it("not saved: saves with the block's own ref and the thread, then reads Saved", async () => {
    const calls = stubSaved([]);
    renderSave({ messageId: "m1", index: 2 });
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    await waitFor(() => expect(calls.find((c) => c.method === "POST")).toBeTruthy());
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({
      item_type: "hook",
      ref_id: "m1:2",
      thread_id: "t1",
      title: HOOK,
      snapshot: { hookLine: HOOK },
    });
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("already on the shelf: pressed; a tap removes that row", async () => {
    const calls = stubSaved([
      { id: "row-1", user_id: "u1", item_type: "hook", ref_id: "m1:2", thread_id: "t1", project_id: null, title: HOOK, snapshot: {}, created_at: "2026-11-22T00:00:00Z" },
    ]);
    renderSave({ messageId: "m1", index: 2 });
    const button = screen.getByRole("button", { name: "Save" });
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(button);
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/saved?id=row-1")).toBe(true));
  });

  it("a block not stored yet (no ref): saves once with a null ref; a second tap writes nothing", async () => {
    const calls = stubSaved([]);
    renderSave(null);
    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(button);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
    expect(calls.find((c) => c.method === "POST")!.body).toMatchObject({ ref_id: null });
  });
});
```

`page.test.ts`: add `"p6", "p6b", "p6i"` to the state list. `dev-answers.test.tsx` (import `within`):

```tsx
  it("p6: hook 1 opened, simulated: the sheet over the pack, linking to the page", () => {
    render(<DevAnswers state="p6" skin="light" frames={null} />);
    const hook1 = "I spent $40 on meal prep and it tasted like regret. Here is the $5 version that actually keeps me alive during finals.";
    const dialog = screen.getByRole("dialog", { name: hook1 });
    expect(within(dialog).getByRole("link", { name: /^Open the result: / })).toHaveAttribute("href", "/dev/answers?state=p7");
    expect(within(dialog).getByRole("img", { name: "30% would stop to watch" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "false");
    expect(within(dialog).getByRole("button", { name: "Script this one, 2 credits" })).toBeInTheDocument();
  });

  it("p6b: the same hook not simulated: Simulate · 1 credit", () => {
    render(<DevAnswers state="p6b" skin="light" frames={null} />);
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: /^Simulate: I spent \$40/ })).toHaveTextContent("1 credit");
  });

  it("p6i: an idea opened", () => {
    render(<DevAnswers state="p6i" skin="light" frames={null} />);
    const dialog = screen.getByRole("dialog", { name: "The Two-Hour Study Lie" });
    expect(within(dialog).getByText("The take")).toBeInTheDocument();
    expect(within(dialog).getByText("Format")).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run, watch them fail.** `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/ui/__tests__/next-look-parts.flag-on.test.tsx src/components/thread-next/__tests__/answer-sheet.test.tsx src/components/thread-next/__tests__/sheet-body.test.tsx src/components/thread-next/__tests__/sheet-actions.test.tsx "src/app/(app)/dev/answers"` → FAIL: no `sheet-handle-zone`; `Failed to resolve import "../answer-sheet"` (and `../sheet-body`, `../sheet-actions`); the dev page 404s `p6`.

- [ ] **Step 4: Implement.**

`ui/sheet.tsx`: `SheetContent` destructures `onHandleDismiss` and types it in the intersection (`& { side?: …; showCloseButton?: boolean; /** New look, bottom sheet: a tap on the grab handle, or a pull down from it, dismisses. */ onHandleDismiss?: () => void }`); the handle line becomes

```tsx
        {NEW_LOOK_ENABLED && side === "bottom" &&
          (onHandleDismiss ? (
            <SheetHandleZone onDismiss={onHandleDismiss} />
          ) : (
            <div
              data-slot="sheet-handle"
              aria-hidden
              className="mx-auto mt-2 h-[5px] w-[38px] shrink-0 rounded-full bg-foreground-muted/50"
            />
          ))}
```
and, above `SheetContent`:

```tsx
/**
 * The grab handle as a control (new look): a 28 tall band across the sheet with the handle 10 down it
 * (where it is drawn). A tap, or a pull down of 24 or more that starts on it, dismisses. Pointer only:
 * Escape is the keyboard's way, and the band stays hidden from assistive tech.
 */
function SheetHandleZone({ onDismiss }: { onDismiss: () => void }) {
  const startY = React.useRef<number | null>(null)
  return (
    <div
      data-slot="sheet-handle-zone"
      aria-hidden
      onPointerDown={(e) => {
        startY.current = e.clientY
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }}
      onPointerUp={(e) => {
        const from = startY.current
        startY.current = null
        if (from !== null && e.clientY - from >= 24) onDismiss()
      }}
      onClick={onDismiss}
      className="flex h-7 w-full shrink-0 cursor-grab touch-none justify-center"
    >
      <div data-slot="sheet-handle" className="mt-2.5 h-[5px] w-[38px] rounded-full bg-foreground-muted/50" />
    </div>
  )
}
```

`answer-icons.tsx` (paths from the drawing's `I.copy`, `I.library`, `I.ext`):

```tsx
/** Copy (`I.copy`): two sheets. */
export const CopyIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
    <path d="M5.5 15.5v-9a2 2 0 0 1 2-2h9" />
  </Glyph>
);

/** Save (`I.library`): the bookmark, filled in ink once saved (never the accent). */
export function BookmarkIcon({ filled = false, ...props }: ShellIconProps & { filled?: boolean }) {
  return (
    <Glyph fill={filled ? "currentColor" : "none"} {...props}>
      <path d="M5.5 4.5h13v15l-6.5-3.8-6.5 3.8z" />
    </Glyph>
  );
}

/** Opens elsewhere (`I.ext`): a proof's video, in a new tab. */
export const ExternalIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M13.5 5.5h5v5M18.5 5.5l-8 8M10 6.5H7.5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V14" />
  </Glyph>
);
```

`answer-gauge.tsx`: `function clip(` → `export function clipName(` (its two uses: `SmallGauge`'s empty `aria-label`, `GaugeSlot`'s `aria-label`); `function EmptyArt(` → `export function EmptyArt(`. `remix-answer.tsx`: `function statsOf(` → `export function proofStats(`, `function Cover(` → `export function ProofCover(` (their uses in `SourceRow`).

```tsx
// src/components/thread-next/answer-sheet.tsx
"use client";

import { Dialog as DialogPrimitive } from "radix-ui";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

import { PROSE, keepHyphens } from "./answer-card";

/**
 * The details sheet's shell (thread answers step 2, spec §3 "Where"; drawing P6, `.sheet`, `.grab`,
 * `.ax-sh`): a bottom sheet on the phone (the `Sheet` part, as More), a centred dialog 560 wide from
 * 768 up, the same content. Its name and heading are the text it is about, large (the drawing's 19 / 26 at 620, built 18 / 26 as the remix hook).
 * Escape, the scrim and the grab handle close it. It is opened from a row, not from a Radix trigger, so
 * it hands focus back itself: to `returnFocus` (the row's button), without scrolling the thread.
 */

const HEADING = "text-pretty text-subhead font-[620] leading-[26px] tracking-[-0.018em] text-foreground";

export function AnswerSheet({
  open,
  onOpenChange,
  title,
  returnFocus = null,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  returnFocus?: HTMLElement | null;
  children: React.ReactNode;
}) {
  const wide = useMediaQuery("(min-width: 768px)");
  const onCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    returnFocus?.focus({ preventScroll: true });
  };

  if (wide) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            data-sheet="scrim"
            className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-scrim motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
          />
          <DialogPrimitive.Content
            data-sheet="dialog"
            aria-describedby={undefined}
            onCloseAutoFocus={onCloseAutoFocus}
            className="fixed left-1/2 top-1/2 z-[var(--z-modal)] max-h-[calc(100dvh-48px)] w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-4xl bg-surface p-6 text-foreground shadow-[var(--shadow-float)] motion-safe:duration-200 motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=closed]:zoom-out-95 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95"
          >
            <DialogPrimitive.Title className={cn(HEADING, PROSE, "px-0.5")}>{keepHyphens(title)}</DialogPrimitive.Title>
            {children}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        data-sheet="sheet"
        showCloseButton={false}
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
        onHandleDismiss={() => onOpenChange(false)}
        className="max-h-[calc(100dvh-24px)] gap-0 overflow-y-auto px-5 pb-[max(34px,env(safe-area-inset-bottom))] pt-0"
      >
        <SheetTitle className={cn(HEADING, PROSE, "mt-px px-0.5")}>{keepHyphens(title)}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
```

```tsx
// src/components/thread-next/sheet-actions.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { IconButton } from "@/components/ui/icon-button";
import { useDeleteSavedItem, useSaveItem, useSavedItemByRef } from "@/hooks/queries/use-saved-items";
import { useSaveProvenance } from "@/lib/save-provenance-context";
import type { SavedItemType } from "@/lib/shelf/shelf-repo";

import { BookmarkIcon, CopyIcon } from "./answer-icons";

/**
 * Copy and Save in the details sheet (spec §3): round icon buttons, 44 (drawn 40, `.ax-qi`), on the
 * sunken tint. Save is a new-look button over today's saved-items hooks, with the same identity as
 * `SaveAffordance` (`src/components/thread/save-affordance.tsx:58-101`): the ref is the rendering
 * block's `${messageId}:${index}` (`BlockOriginContext`), the thread is `ThreadIdContext`. Saved: the
 * filled bookmark in ink (never the accent), and "Saved" announced. Copy announces "Copied".
 */

const COPIED_MS = 1600;
const ROUND = "h-11 w-11";

export function CopyButton({ copied, onCopy }: { copied: boolean; onCopy?: () => void }) {
  return (
    <>
      <IconButton surface="card" aria-label="Copy" onClick={onCopy} disabled={!onCopy} className={ROUND}>
        <CopyIcon aria-hidden />
      </IconButton>
      <span role="status" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
}

export function SaveButton({ saved, onToggle }: { saved: boolean; onToggle?: () => void }) {
  return (
    <>
      <IconButton surface="card" aria-label="Save" aria-pressed={saved} onClick={onToggle} disabled={!onToggle} className={ROUND}>
        <BookmarkIcon aria-hidden filled={saved} />
      </IconButton>
      <span role="status" className="sr-only">
        {saved ? "Saved" : ""}
      </span>
    </>
  );
}

/** Writes `text` to the clipboard; `copied` for 1.6 s after. No clipboard (an insecure page): nothing. */
export function useCopyText(text: string): { copied: boolean; copy: () => void } {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), COPIED_MS);
      },
      () => {},
    );
  }, [text]);
  return { copied, copy };
}

/** `SaveAffordance`'s state, without its look: saved, busy, and the toggle (save, or remove a row we can name). */
export function useSaveToggle({
  itemType,
  title,
  snapshot,
}: {
  itemType: SavedItemType;
  title: string;
  snapshot: Record<string, unknown>;
}): { saved: boolean; busy: boolean; toggle: () => void } {
  const save = useSaveItem();
  const remove = useDeleteSavedItem();
  const { threadId, refId } = useSaveProvenance();
  const { item: savedRow } = useSavedItemByRef(itemType, refId);
  // A block with no identity (a live run) keeps the per-mount flag and cannot be removed.
  const savedThisMount = refId === null && save.isSuccess;
  const saved = savedRow !== undefined || savedThisMount;
  const busy = save.isPending || remove.isPending;
  const toggle = () => {
    if (busy) return;
    if (savedRow) {
      remove.mutate(savedRow.id);
      return;
    }
    if (savedThisMount) return;
    save.mutate({ item_type: itemType, ref_id: refId, thread_id: threadId, title, snapshot });
  };
  return { saved, busy, toggle };
}
```

```tsx
// src/components/thread-next/sheet-body.tsx
"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";

import { creditCost } from "@/lib/pricing";
import type { HookCardBlock, HookProof, IdeaCardBlock } from "@/lib/tools/blocks";
import { firstSentence } from "@/lib/thread-next/first-sentence";
import { cn } from "@/lib/utils";

import { AnswerPrimary, PROSE, creditsLabel, keepHyphens } from "./answer-card";
import { EmptyArt, SmallGauge, clipName, type GaugeState } from "./answer-gauge";
import { ExternalIcon } from "./answer-icons";
import { ChevronIcon, DocIcon } from "./field-icons";
import { ProofCover, proofStats } from "./remix-answer";

/**
 * The details sheet's bodies (thread answers step 2, spec §3; drawing P6, `.ax-shg`, `.ax-shl`, `.ax-sec`,
 * `.ax-src`, `.ax-shb`). Under the sheet's large text (the shell's heading):
 *
 * - The gauge row: the 52 gauge, then — simulated: "would stop to watch ›", a link to the result page
 *   (once its key is known; until then the words alone); not simulated: "Simulate" · "1 credit" (the
 *   thread's queue); waiting or running: "Simulating"; failed: "Couldn't simulate" and Simulate. Copy and
 *   Save at the right (`actions`).
 * - A hook: "Why it works" (first sentence, "More" opens the rest in place), "Visual" (`onScreen`),
 *   "Proven" (the proof row; a link to its video in a new tab when it has one).
 * - An idea: "The take" (whole), "Why it fits" (folded), "Format".
 * - The one primary "Script this one" · "2 credits".
 *
 * Never: fraction, band, scroll quote, target, rank, seed line, channel.
 */

export interface SheetGauge {
  state: GaugeState;
  /** Its last simulation failed and it has no number. */
  failed: boolean;
  /** The text it simulates: names its controls. */
  text: string;
  /** The result page, once simulated and its key is known; null: no link (yet). */
  href: string | null;
  onSimulate?: () => void;
}

const LABEL = "flex items-center gap-3 text-reading text-foreground-secondary";

function SheetGaugeControl({ gauge }: { gauge: SheetGauge }) {
  const priceId = useId();
  const { state, failed, text, href, onSimulate } = gauge;

  if (state.kind === "done") {
    const body = (
      <>
        <SmallGauge state={state} size={52} label={text} />
        <span>would stop to watch</span>
        {href && <ChevronIcon size={14} strokeWidth={2.1} aria-hidden className="-ml-1 shrink-0 text-foreground-muted" />}
      </>
    );
    return href ? (
      <Link href={href} aria-label={`Open the result: ${clipName(text)}`} data-sheet="result-link" className={cn(LABEL, "rounded-xl")}>
        {body}
      </Link>
    ) : (
      <div className={LABEL}>{body}</div>
    );
  }

  if (state.kind === "running" || state.kind === "waiting") {
    return (
      <div className={LABEL}>
        <SmallGauge state={state} size={52} label={text} />
        <span>Simulating</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Simulate: ${clipName(text)}`}
      aria-describedby={priceId}
      disabled={!onSimulate}
      onClick={onSimulate}
      className="group flex cursor-pointer items-center gap-3 rounded-xl text-left disabled:cursor-default"
    >
      <span
        aria-hidden
        className="relative block size-[52px] shrink-0 text-foreground-muted transition-colors duration-150 group-hover:text-foreground group-disabled:text-foreground-muted"
      >
        <EmptyArt size={52} />
      </span>
      <span className="flex flex-col">
        <span className="text-reading font-[570] text-foreground">
          Simulate{" "}
          <em id={priceId} className="font-medium not-italic text-foreground-muted">
            {creditsLabel(creditCost("react"))}
          </em>
        </span>
        {failed && <span className="text-meta text-foreground-secondary">Couldn&apos;t simulate</span>}
      </span>
    </button>
  );
}

export function SheetGaugeRow({ gauge, actions }: { gauge: SheetGauge; actions: React.ReactNode }) {
  return (
    <div data-sheet="gauge-row" className="mt-3 flex items-center gap-2 px-0.5 pb-3.5 pt-0.5">
      <SheetGaugeControl gauge={gauge} />
      <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}

/** The first sentence, and "More" that opens the rest in place (focus moves to the whole text). */
function FoldedText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const justOpened = useRef(false);
  const whole = text.trim();
  const first = firstSentence(whole) ?? whole;
  if (open || first === whole) {
    return (
      <span
        tabIndex={open ? -1 : undefined}
        ref={(el) => {
          if (el && justOpened.current) {
            justOpened.current = false;
            el.focus();
          }
        }}
      >
        {keepHyphens(whole)}
      </span>
    );
  }
  return (
    <>
      {keepHyphens(first)}{" "}
      <button
        type="button"
        aria-expanded={false}
        onClick={() => {
          justOpened.current = true;
          setOpen(true);
        }}
        className="tap-44 cursor-pointer font-[650] text-foreground"
      >
        More
      </button>
    </>
  );
}

function SheetSection({ label, plain = false, children }: { label: string; plain?: boolean; children: React.ReactNode }) {
  return (
    <section className="border-t border-border px-0.5 py-3">
      <h3 className="text-meta font-[620] text-foreground-secondary">{label}</h3>
      {plain ? children : <p className={cn("mt-[3px] text-pretty text-ui leading-[21px] text-foreground", PROSE)}>{children}</p>}
    </section>
  );
}

function ProofRow({ proof }: { proof: HookProof }) {
  const handle = proof.handle.trim().replace(/^@+/, "");
  const stats = proofStats(proof);
  const body = (
    <>
      <ProofCover src={proof.coverUrl} />
      <span className="block min-w-0 flex-1">
        <span className="block truncate text-reading font-[620] leading-[21px] text-foreground">@{handle}</span>
        {stats && <span className="block text-meta leading-[21px] text-foreground-secondary tabular-nums">{stats}</span>}
      </span>
      {proof.videoUrl && <ExternalIcon size={16} aria-hidden className="shrink-0 text-foreground-muted" />}
    </>
  );
  const box = "mt-2 flex items-center gap-[11px] rounded-xl bg-foreground/5 py-2 pl-2 pr-3.5";
  return proof.videoUrl ? (
    <a
      href={proof.videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-sheet="proof"
      aria-label={`Proven: @${handle}${stats ? `, ${stats}` : ""}. Opens the video`}
      className={box}
    >
      {body}
    </a>
  ) : (
    <div data-sheet="proof" className={box}>
      {body}
    </div>
  );
}

function SheetPrimary({ onScript }: { onScript?: () => void }) {
  return (
    <div className="mt-2">
      <AnswerPrimary
        icon={<DocIcon size={20} aria-hidden className="shrink-0" />}
        label="Script this one"
        price={creditCost("script")}
        onClick={onScript}
      />
    </div>
  );
}

export function HookSheetBody({
  hook,
  gauge,
  actions,
  onScript,
}: {
  hook: HookCardBlock["props"];
  gauge: SheetGauge;
  actions: React.ReactNode;
  onScript?: () => void;
}) {
  const mechanism = hook.mechanism.trim();
  const visual = hook.visualHook?.onScreen?.trim();
  return (
    <>
      <SheetGaugeRow gauge={gauge} actions={actions} />
      {mechanism && (
        <SheetSection label="Why it works">
          <FoldedText text={mechanism} />
        </SheetSection>
      )}
      {visual && <SheetSection label="Visual">{keepHyphens(visual)}</SheetSection>}
      {hook.proof && (
        <SheetSection label="Proven" plain>
          <ProofRow proof={hook.proof} />
        </SheetSection>
      )}
      <SheetPrimary onScript={onScript} />
    </>
  );
}

export function IdeaSheetBody({
  idea,
  gauge,
  actions,
  onScript,
}: {
  idea: IdeaCardBlock["props"];
  gauge: SheetGauge;
  actions: React.ReactNode;
  onScript?: () => void;
}) {
  const take = idea.take.trim();
  const why = idea.whyItFits.trim();
  const format = idea.format?.trim();
  return (
    <>
      <SheetGaugeRow gauge={gauge} actions={actions} />
      {take && <SheetSection label="The take">{keepHyphens(take)}</SheetSection>}
      {why && (
        <SheetSection label="Why it fits">
          <FoldedText text={why} />
        </SheetSection>
      )}
      {format && <SheetSection label="Format">{keepHyphens(format)}</SheetSection>}
      <SheetPrimary onScript={onScript} />
    </>
  );
}
```

Dev states: in `page.tsx` add `"p6", "p6b", "p6i"` to `STATES` and the doc comment ("p6: hook 1 opened, simulated (P6) · p6b: the same, not simulated · p6i: an idea opened"). In `dev-answers.tsx` extend `DevAnswersState` with `| "p6" | "p6b" | "p6i"`; import `AnswerSheet`, `HookSheetBody`, `IdeaSheetBody`, `type SheetGauge`, `CopyButton`, `SaveButton`, and `IDEA_SHEET`; in `turnOf` add `case "p6": return packTurn(HOOKS_ASK, "hook", hookRows(sealed), null, "hooks");`, `case "p6b": return packTurn(HOOKS_ASK, "hook", hookRows(() => empty), null, "hooks");`, `case "p6i": return packTurn("4 ideas for next week", "idea", ideaRows(), null, "ideas");`; add

```tsx
/** The sheet open over its pack (P6): presentational, so nothing is sent, copied or saved. */
function sheetOf(state: DevAnswersState): React.ReactNode {
  const actions = (
    <>
      <CopyButton copied={false} onCopy={noop} />
      <SaveButton saved={false} onToggle={noop} />
    </>
  );
  if (state === "p6" || state === "p6b") {
    const hook = MEAL_PREP_HOOKS[0]!.props;
    const gauge: SheetGauge = {
      state: state === "p6" ? sealed(hook.hookLine) : empty,
      failed: false,
      text: hook.hookLine,
      href: state === "p6" ? "/dev/answers?state=p7" : null,
      onSimulate: noop,
    };
    return (
      <AnswerSheet open onOpenChange={noop} title={hook.hookLine}>
        <HookSheetBody hook={hook} gauge={gauge} actions={actions} onScript={noop} />
      </AnswerSheet>
    );
  }
  if (state === "p6i") {
    const idea = IDEA_SHEET.props;
    return (
      <AnswerSheet open onOpenChange={noop} title={idea.title}>
        <IdeaSheetBody idea={idea} gauge={{ state: empty, failed: false, text: idea.title, href: null, onSimulate: noop }} actions={actions} onScript={noop} />
      </AnswerSheet>
    );
  }
  return null;
}
```
and render `{sheetOf(state)}` as the last child of `DevAnswers`' root `<div>`.

- [ ] **Step 5: Run → PASS** (Step 3's command), then the neighbours: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/ui src/components/thread-next src/components/__tests__/type-scale.test.ts src/components/thread/__tests__/radius-scale.test.ts src/components/thread/__tests__/save-provenance.test.tsx`. The flag-off sheet snapshot `next-look-parity.test.tsx` must pass unchanged. `npx tsc --noEmit`; `npx eslint src/components/thread-next src/components/ui/sheet.tsx "src/app/(app)/dev/answers"`.
- [ ] **Step 6: Look at it:** `/dev/answers?state=p6|p6b|p6i` at 393×852 (light and dark) and 1440×900, full window, beside `ax-p6.png`. Planned differences: Copy and Save 44 (spec; drawn 40), the text 22 / 28 (spec; drawn 19 / 26), "Visual" prints `onScreen` only (spec; drawn "Cold open: …"), no chevrons on the pack behind yet (Task 6). Check Escape and a scrim click close the desktop dialog (not unit-tested: Radix's outside-pointer handling does not run in happy-dom). Do not commit.

Flag off: `SheetContent` renders the handle only under `NEW_LOOK_ENABLED`, and the zone only when `onHandleDismiss` is passed (no legacy caller does); `next-look-parity.test.tsx` and `next-look-parts.test.tsx` guard the flag-off classes. The rest is new-look-only code; the renames in `answer-gauge.tsx` and `remix-answer.tsx` are internal (their suites stay green).

---

### Task 6: Wiring in the thread (rows open their sheet; links from simulated texts)

**Files:**
- Create: `src/components/thread-next/use-seal-keys.ts`, `src/components/thread-next/pack-sheet.tsx`
- Modify: `pack-answer.tsx:79-177` (`onOpen`, row button, chevron, `RowText`); `answer-gauge.tsx:284-309` (`GaugeSlot` `href`); `script-answer.tsx:32,60-66` (`opener.href`); `remix-answer.tsx:130,155` (`hookOf` returns `href`); `thread-turn-next.tsx:108-179,217-243,306-314` (sheet state, per-row origins, links); `dev-answers.tsx:114-121` (`packTurn` passes `onOpen={noop}`: the drawn chevrons)
- Test: `src/components/thread-next/__tests__/use-seal-keys.test.tsx`; extend `pack-answer.test.tsx`, `answer-gauge.test.tsx`, `script-answer.test.tsx`, `remix-answer.test.tsx`, `thread-turn-next.flag-on.test.tsx` (harness gains `threadId`), `dev-answers.test.tsx`

**Interfaces:**
- Consumes: Task 1's `sealHashOf`, `textResultHref`, `TextResultAs`; Task 5's `AnswerSheet`, `HookSheetBody`, `IdeaSheetBody`, `SheetGauge`, `CopyButton`, `SaveButton`, `useCopyText`, `useSaveToggle`, `clipName`; `useTextSim(): TextSimApi | null` (`text-sim.tsx:316`: `stateOf`, `failed`, `fire`); `useOnWriteScriptHook()`; `ThreadIdContext`, `BlockOriginContext` (`@/lib/save-provenance-context`); `BlockOrigin` (`@/components/app/home/rehydrate-thread`); `AnswerPart` (`@/lib/thread-next/answer-parts`).
- Produces:
```ts
// use-seal-keys.ts
export function useSealKeys(texts: readonly string[]): ReadonlyMap<string, string>;   // trimmed text → key, once known
export function resultLinkOf(state: GaugeState, threadId: string | null, key: string | null | undefined, as: TextResultAs): string | null;
// pack-sheet.tsx
export function PackSheet(p: {
  part: Extract<AnswerPart, { kind: "hooks" | "ideas" }>;
  index: number;                 // the row open (kept while it animates closed)
  origin: BlockOrigin | null;    // that row's own block origin (its Save ref)
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus: HTMLElement | null;
}): JSX.Element | null;
// pack-answer.tsx: PackAnswer gains
onOpen?: (rowIndex: number, trigger: HTMLButtonElement) => void;
// answer-gauge.tsx: GaugeSlot gains
href?: string | null;
// script-answer.tsx: ScriptAnswer's opener becomes
opener: { state: GaugeState; onSimulate?: () => void; href?: string | null };
// remix-answer.tsx: hookOf returns
{ state: GaugeState; onSimulate?: () => void; href?: string | null }
```

Rules: a row's link exists only when its text is simulated (`done`), the thread id is known (`ThreadIdContext`, the composer's `openThreadId`) AND its key has resolved: before that, the words without a link — never a dead link. A pack row's done gauge stays the number, not a link (spec §5). A row is ONE button ("Open: <text>", `aria-haspopup="dialog"`) holding its text and the 14 chevron; its `::after` covers the whole row, the gauge column sits above it (`relative z-[1]`) so the gauge stays its own Simulate button. Hooks link as `hook`, ideas as `idea`, a script's opener as `opening`, a remix hook as `hook`.

- [ ] **Step 1: Write the failing tests.**

```tsx
// src/components/thread-next/__tests__/use-seal-keys.test.tsx
/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { resultLinkOf, useSealKeys } from "../use-seal-keys";

describe("useSealKeys", () => {
  it("knows each trimmed text's key a tick after the first render, and at once on a later mount", async () => {
    const first = renderHook(() => useSealKeys(["  abc ", "abc", ""]));
    expect(first.result.current.get("abc")).toBeUndefined();
    await waitFor(() => expect(first.result.current.get("abc")).toBe("ungWv48Bz-"));
    expect(first.result.current.size).toBe(1);
    const again = renderHook(() => useSealKeys(["abc"]));
    expect(again.result.current.get("abc")).toBe("ungWv48Bz-");
  });
});

describe("resultLinkOf", () => {
  it("a link only for a simulated text with a thread and a key", () => {
    const done = { kind: "done", value: 30 } as const;
    expect(resultLinkOf(done, "t1", "ungWv48Bz-", "hook")).toBe("/simulation/hook/t1/ungWv48Bz-");
    expect(resultLinkOf(done, "t1", "ungWv48Bz-", "opening")).toBe("/simulation/hook/t1/ungWv48Bz-?as=opening");
    expect(resultLinkOf(done, null, "ungWv48Bz-", "hook")).toBeNull();
    expect(resultLinkOf(done, "t1", undefined, "hook")).toBeNull();
    expect(resultLinkOf({ kind: "empty" }, "t1", "ungWv48Bz-", "hook")).toBeNull();
  });
});
```

`pack-answer.test.tsx`, a new describe:

```tsx
describe("PackAnswer — a row opens its details (step 2)", () => {
  it("with onOpen each row is one button named 'Open: <text>', with a chevron; the gauge stays its own button", () => {
    const onOpen = vi.fn();
    const onSimulate = vi.fn();
    render(<PackAnswer kind="hook" rows={hookRows([empty, done(22), empty])} queue={null} onSimulate={onSimulate} onOpen={onOpen} />);
    const open = screen.getAllByRole("button", { name: /^Open: / });
    expect(open).toHaveLength(3);
    expect(open[1]).toHaveAttribute("aria-haspopup", "dialog");
    expect(open[1]!.querySelector("svg")).not.toBeNull();
    fireEvent.click(open[1]!);
    expect(onOpen).toHaveBeenCalledWith(1, open[1]);
    fireEvent.click(within(rows()[0]!).getByRole("button", { name: /^Simulate: / }));
    expect(onSimulate).toHaveBeenCalledWith(HOOKS[0]);
    expect(onOpen).toHaveBeenCalledTimes(1);
    // A simulated row's number is not a link: the row opens the sheet, and the sheet links.
    expect(within(rows()[1]!).getByRole("img", { name: "22% would stop to watch" })).toBeInTheDocument();
    expect(within(rows()[1]!).queryByRole("link")).toBeNull();
  });

  it("the row's name is its text cut to 60 characters, as the gauge's", () => {
    render(<PackAnswer kind="hook" rows={hookRows([empty, empty, empty])} queue={null} onOpen={() => {}} />);
    const name = screen.getAllByRole("button", { name: /^Open: / })[0]!.getAttribute("aria-label")!;
    expect(name.startsWith("Open: I spent $40 on meal prep")).toBe(true);
    expect(name.length).toBeLessThanOrEqual("Open: ".length + 60);
  });

  it("an idea row's button holds its title and its grey line; a failed row's line too", () => {
    const rows2: PackRow[] = IDEAS_4.slice(0, 2).map((b, i) => ({ key: b.props.title, text: b.props.title, sub: b.props.angle, state: empty, failed: i === 1 }));
    render(<PackAnswer kind="idea" rows={rows2} queue={null} onOpen={() => {}} />);
    const second = screen.getAllByRole("button", { name: /^Open: / })[1]!;
    expect(second).toHaveTextContent("Short sessions stick better.");
    expect(second).toHaveTextContent("Couldn't simulate");
  });

  it("without onOpen: no row button and no chevron (step 1's rows)", () => {
    render(<PackAnswer kind="hook" rows={hookRows([empty, empty, empty])} queue={null} />);
    expect(screen.queryAllByRole("button", { name: /^Open: / })).toHaveLength(0);
  });
});
```

`answer-gauge.test.tsx` (its import `:14` becomes `import { GaugeSlot, SmallGauge } from "../answer-gauge";`):

```tsx
describe("GaugeSlot — the link to the result (step 2)", () => {
  const OPENER = "I fed 10 million viral videos into an AI to simulate your exact audience.";

  it("simulated with a page: 'would stop to watch' and a chevron, one link named after the text", () => {
    render(<GaugeSlot state={{ kind: "done", value: 41 }} label="Simulate the opening" text={OPENER} href="/simulation/hook/t/k?as=opening" />);
    const link = screen.getByRole("link", { name: /^Open the result: I fed 10 million/ });
    expect(link).toHaveAttribute("href", "/simulation/hook/t/k?as=opening");
    expect(link).toHaveTextContent("would stop to watch");
  });

  it("simulated without a page (key not known yet): no link", () => {
    render(<GaugeSlot state={{ kind: "done", value: 41 }} label="Simulate the opening" text={OPENER} href={null} />);
    expect(screen.getByText("would stop to watch")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("not simulated: still the Simulate button, whatever the href", () => {
    render(<GaugeSlot state={{ kind: "empty" }} label="Simulate the opening" text={OPENER} href="/x" onSimulate={() => {}} />);
    expect(screen.getByRole("button", { name: /^Simulate the opening: / })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
```

`script-answer.test.tsx`:

```tsx
  it("a simulated opening with its page links there (step 2)", () => {
    render(<ScriptAnswer block={SCRIPT_AI} opener={{ state: { kind: "done", value: 41 }, href: "/simulation/hook/t/k?as=opening" }} />);
    expect(screen.getByRole("link", { name: /^Open the result: / })).toHaveAttribute("href", "/simulation/hook/t/k?as=opening");
  });
```

`remix-answer.test.tsx`:

```tsx
  it("a simulated remix hook with its page links there (step 2)", () => {
    render(<RemixAnswer items={[REMIX_CAMERA]} hookOf={() => ({ state: { kind: "done", value: 33 }, href: "/simulation/hook/t/k" })} />);
    expect(screen.getByRole("link", { name: /^Open the result: / })).toHaveAttribute("href", "/simulation/hook/t/k");
  });
```

`thread-turn-next.flag-on.test.tsx`: the harness gains a thread id — `interface Opts` adds `threadId?: string | null;`, import `ThreadIdContext` from `@/lib/save-provenance-context`, and `ui` wraps `<Seals …>` in `<ThreadIdContext.Provider value={opts.threadId ?? null}>`. Then (imports: `sealHashOf` from `@/lib/thread-next/seal-hash`, `IDEA_SHEET` from the fixtures):

```tsx
describe("step 2: a pack row opens its details", () => {
  const THREAD = "00000000-0000-4000-8000-0000000000bb";
  const HOOK_1 = MEAL_PREP_HOOKS[0]!.props.hookLine;
  const seal = (n: number) => ({ pct: 70, band: null, at: "2026-11-22T00:00:00Z", population: population(n) });
  const hooksTurn = (): ThreadTurnProps => ({ userTurn: "3 hooks", blocks: [runHeader("hooks"), ...MEAL_PREP_HOOKS] });
  const rowButton = (text: string) => screen.getByRole("button", { name: (name) => name.startsWith(`Open: ${text.slice(0, 30)}`) });

  it("a tap on a row opens its sheet: the hook large, why, visual, proof; none of the old card's numbers", () => {
    renderTurn(hooksTurn());
    fireEvent.click(rowButton(HOOK_1));
    const dialog = screen.getByRole("dialog", { name: HOOK_1 });
    expect(within(dialog).getByRole("heading", { level: 2, name: HOOK_1 })).toBeInTheDocument();
    expect(within(dialog).getByText("Why it works")).toBeInTheDocument();
    expect(within(dialog).getByText("Sad grey food next to textbooks")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /^Proven: @dij\.arc/ })).toHaveAttribute("target", "_blank");
    expect(within(dialog).queryByText("5/10 stop")).toBeNull();
    expect(within(dialog).queryByText("Mixed")).toBeNull();
  });

  it("Simulate in the sheet runs the thread's one queue once (1 credit); the number lands and the link names the thread and the key", async () => {
    renderTurn(hooksTurn(), { threadId: THREAD });
    fireEvent.click(rowButton(HOOK_1));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^Simulate: I spent \$40/ }));
    expect(reacts()).toHaveLength(1);
    expect(reacts()[0]!.body).toEqual(reactRequestBody({ text: HOOK_1, kind: "hook" }));
    expect(within(dialog).getByText("Simulating")).toBeInTheDocument();
    await act(async () => reacts()[0]!.resolve(reacted(30)));
    const link = await within(dialog).findByRole("link", { name: /^Open the result: I spent \$40/ });
    expect(link).toHaveAttribute("href", `/simulation/hook/${THREAD}/${await sealHashOf(HOOK_1)}`);
    expect(within(dialog).getByRole("img", { name: "30% would stop to watch" })).toBeInTheDocument();
    expect(reacts()).toHaveLength(1);
  });

  it("no dead link: a simulated text's link appears only once its key is known", async () => {
    const fresh = "A hook no other test hashes, for the link's first tick.";
    renderTurn({ userTurn: "x", blocks: [runHeader("hooks"), hook(fresh)] }, { threadId: THREAD, seals: { [fresh]: seal(41) } });
    fireEvent.click(rowButton(fresh));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("would stop to watch")).toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: /^Open the result/ })).toBeNull();
    expect(await within(dialog).findByRole("link", { name: /^Open the result/ })).toHaveAttribute(
      "href",
      `/simulation/hook/${THREAD}/${await sealHashOf(fresh)}`,
    );
  });

  it("without a thread id the number shows and nothing links", async () => {
    renderTurn(hooksTurn(), { seals: SEALS_DONE });
    fireEvent.click(rowButton(HOOK_1));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(within(screen.getByRole("dialog")).queryByRole("link", { name: /^Open the result/ })).toBeNull();
  });

  it("Save keeps the row's own ref and the thread", async () => {
    renderTurn(
      { ...hooksTurn(), blockOrigins: [0, 1, 2, 3].map((index) => ({ messageId: "m1", index })) },
      { threadId: THREAD },
    );
    fireEvent.click(rowButton(MEAL_PREP_HOOKS[1]!.props.hookLine));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/saved" && c.body)).toBe(true));
    expect(calls.find((c) => c.url === "/api/saved" && c.body)!.body).toMatchObject({
      item_type: "hook",
      ref_id: "m1:2",
      thread_id: THREAD,
      title: MEAL_PREP_HOOKS[1]!.props.hookLine,
    });
  });

  it("Script this one writes the script from this hook, closes the sheet and gives focus back to the row", async () => {
    const writeScript = vi.fn();
    renderTurn(hooksTurn(), { writeScript });
    const row = rowButton(HOOK_1);
    fireEvent.click(row);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Script this one, 2 credits" }));
    expect(writeScript).toHaveBeenCalledWith(HOOK_1, "lurker");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(row);
  });

  it("Escape closes it and focus goes back to the row", async () => {
    renderTurn(hooksTurn());
    const row = rowButton(HOOK_1);
    fireEvent.click(row);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(row);
  });

  it("an idea row: the take, why it fits, format; Script this one starts from its seed hook; its link says ?as=idea", async () => {
    const writeScript = vi.fn();
    const title = IDEA_SHEET.props.title;
    renderTurn({ userTurn: "ideas", blocks: [runHeader("ideas"), IDEA_SHEET, IDEAS_4[0]!] }, { writeScript, threadId: THREAD, seals: { [title]: seal(44) } });
    fireEvent.click(rowButton(title));
    const dialog = screen.getByRole("dialog", { name: title });
    expect(within(dialog).getByText("The take")).toBeInTheDocument();
    expect(within(dialog).getByText("Why it fits")).toBeInTheDocument();
    expect(within(dialog).getByText("Format")).toBeInTheDocument();
    expect(await within(dialog).findByRole("link", { name: /^Open the result/ })).toHaveAttribute(
      "href",
      `/simulation/hook/${THREAD}/${await sealHashOf(title)}?as=idea`,
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Script this one, 2 credits" }));
    expect(writeScript).toHaveBeenCalledWith(IDEA_SHEET.props.seedHook, "");
  });

  it("a simulated script opener links as an opening line; a simulated remix hook as a hook", async () => {
    const opener = SCRIPT_AI.props.openingBeatSeed!;
    const adapted = REMIX_CAMERA.props.adaptedHook;
    renderTurn(
      { userTurn: "both", blocks: [runHeader("script"), SCRIPT_AI, REMIX_CAMERA] },
      { threadId: THREAD, seals: { [opener]: seal(41), [adapted]: seal(33) } },
    );
    expect(await screen.findByRole("link", { name: /^Open the result: I fed 10 million/ })).toHaveAttribute(
      "href",
      `/simulation/hook/${THREAD}/${await sealHashOf(opener)}?as=opening`,
    );
    expect(await screen.findByRole("link", { name: /^Open the result: I’m gonna show/ })).toHaveAttribute(
      "href",
      `/simulation/hook/${THREAD}/${await sealHashOf(adapted)}`,
    );
  });
});
```

`dev-answers.test.tsx`: in the existing "p3" case add `expect(screen.getAllByRole("button", { name: /^Open: / })).toHaveLength(3);`.

- [ ] **Step 2: Run, watch them fail.** `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/thread-next "src/app/(app)/dev/answers"` → FAIL: `Failed to resolve import "../use-seal-keys"`; no "Open:" buttons; no result links.

- [ ] **Step 3: Implement.**

```ts
// src/components/thread-next/use-seal-keys.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { textResultHref, type TextResultAs } from "@/lib/result/text-result";
import { sealHashOf } from "@/lib/thread-next/seal-hash";
import type { GaugeState } from "./answer-gauge";

/**
 * The result-page keys of the texts a card can link (thread answers step 2). The key is async
 * (`sealHashOf`, Web Crypto), so a text's key is known one tick after it first renders; until then the
 * card draws no link, never a dead one. Keys found are kept for the tab (a key never changes), so a
 * remount (the live → persisted swap) has them at once.
 */

const KNOWN = new Map<string, string>();
const SEP = "\u0000";

export function useSealKeys(texts: readonly string[]): ReadonlyMap<string, string> {
  const sig = texts
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .join(SEP);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const missing = [...new Set(sig ? sig.split(SEP) : [])].filter((t) => !KNOWN.has(t));
    if (missing.length === 0) return;
    let live = true;
    Promise.all(missing.map(async (t) => KNOWN.set(t, await sealHashOf(t))))
      .then(() => {
        if (live) setVersion((v) => v + 1);
      })
      .catch(() => {
        // No Web Crypto (an insecure page): no keys, so no links.
      });
    return () => {
      live = false;
    };
  }, [sig]);

  return useMemo(() => {
    void version; // a key resolved: read the map again
    const out = new Map<string, string>();
    for (const t of sig ? sig.split(SEP) : []) {
      const key = KNOWN.get(t);
      if (key) out.set(t, key);
    }
    return out;
  }, [sig, version]);
}

/** The result page of a simulated text, once the thread and its key are known; else none. */
export function resultLinkOf(
  state: GaugeState,
  threadId: string | null,
  key: string | null | undefined,
  as: TextResultAs,
): string | null {
  return state.kind === "done" && threadId && key ? textResultHref(threadId, key, as) : null;
}
```

```tsx
// src/components/thread-next/pack-sheet.tsx
"use client";

import { useContext } from "react";

import type { BlockOrigin } from "@/components/app/home/rehydrate-thread";
import { useOnWriteScriptHook } from "@/lib/hook-test-context";
import { BlockOriginContext, ThreadIdContext } from "@/lib/save-provenance-context";
import type { AnswerPart } from "@/lib/thread-next/answer-parts";

import type { GaugeState } from "./answer-gauge";
import { AnswerSheet } from "./answer-sheet";
import { CopyButton, SaveButton, useCopyText, useSaveToggle } from "./sheet-actions";
import { HookSheetBody, IdeaSheetBody, type SheetGauge } from "./sheet-body";
import { useTextSim } from "./text-sim";
import { resultLinkOf, useSealKeys } from "./use-seal-keys";

/**
 * A pack row's details sheet in the thread (thread answers step 2, spec §3): the presentational sheet
 * wired to the thread's one text-sim queue (Simulate = the row's own fire), the write-script hand-off
 * ("Script this one": closes the sheet, the script lands at the bottom), the thread id and the text's
 * key (the result-page link), and the row's OWN block origin, so Save keeps that row's
 * `${messageId}:${index}` (the pack's part carries only its first item's).
 */

type Pack = Extract<AnswerPart, { kind: "hooks" | "ideas" }>;

const EMPTY: GaugeState = { kind: "empty" };

export function PackSheet({
  part,
  index,
  origin,
  open,
  onOpenChange,
  returnFocus,
}: {
  part: Pack;
  index: number;
  origin: BlockOrigin | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus: HTMLElement | null;
}) {
  return (
    <BlockOriginContext.Provider value={origin}>
      <PackSheetInner part={part} index={index} open={open} onOpenChange={onOpenChange} returnFocus={returnFocus} />
    </BlockOriginContext.Provider>
  );
}

function PackSheetInner({
  part,
  index,
  open,
  onOpenChange,
  returnFocus,
}: {
  part: Pack;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus: HTMLElement | null;
}) {
  const sim = useTextSim();
  const writeScript = useOnWriteScriptHook();
  const threadId = useContext(ThreadIdContext);
  const hook = part.kind === "hooks" ? (part.items[index]?.block.props ?? null) : null;
  const idea = part.kind === "ideas" ? (part.items[index]?.block.props ?? null) : null;
  const text = hook?.hookLine ?? idea?.title ?? "";
  // One word for all three: the queue's kind, the saved item's type, the page's `as`.
  const kind: "hook" | "idea" = hook ? "hook" : "idea";
  const keys = useSealKeys(text ? [text] : []);
  const copy = useCopyText(text);
  const save = useSaveToggle({ itemType: kind, title: text, snapshot: hook ?? idea ?? {} });

  if (!hook && !idea) return null;

  const state = sim?.stateOf(text) ?? EMPTY;
  const gauge: SheetGauge = {
    state,
    failed: sim?.failed(text) ?? false,
    text,
    href: resultLinkOf(state, threadId, keys.get(text.trim()), kind),
    onSimulate: sim ? () => sim.fire(text, kind) : undefined,
  };
  const actions = (
    <>
      <CopyButton copied={copy.copied} onCopy={copy.copy} />
      <SaveButton saved={save.saved} onToggle={save.toggle} />
    </>
  );
  const onScript = writeScript
    ? () => {
        onOpenChange(false);
        if (hook) writeScript(hook.hookLine, hook.audienceArchetype ?? "");
        else if (idea) writeScript(idea.seedHook || idea.title, "");
      }
    : undefined;

  return (
    <AnswerSheet open={open} onOpenChange={onOpenChange} title={text} returnFocus={returnFocus}>
      {hook ? (
        <HookSheetBody hook={hook} gauge={gauge} actions={actions} onScript={onScript} />
      ) : (
        <IdeaSheetBody idea={idea!} gauge={gauge} actions={actions} onScript={onScript} />
      )}
    </AnswerSheet>
  );
}
```
(`kind` is `"hook" | "idea"`: assignable to `TextKind`, `SavedItemType` and `TextResultAs` alike.)

`pack-answer.tsx`: import `ChevronIcon` from `./field-icons` and `clipName` from `./answer-gauge`; add the prop `onOpen?: (rowIndex: number, trigger: HTMLButtonElement) => void;` (doc: "Opens the row's details (step 2): the row becomes one button with a chevron."); replace the text `<div>` of each row (`:149-175`) and the `li`/gauge-column classes:

```tsx
            <li
              key={`${i}:${row.key}`}
              data-row={i}
              className={cn("flex items-center gap-[13px] border-t border-border px-0.5 py-2.5", onOpen && "relative")}
            >
              <span className={cn("flex shrink-0 flex-col items-center gap-[5px]", onOpen && "relative z-[1]")}>
                <SmallGauge
                  state={row.state}
                  label={row.text}
                  onSimulate={onSimulate ? () => onSimulate(row.key) : undefined}
                />
                {lead.best === i && (
                  <span className="inline-flex h-5 items-center whitespace-nowrap rounded-full bg-[color-mix(in_srgb,var(--color-foreground)_7%,transparent)] px-[7px] text-label font-[650] leading-none tracking-normal text-foreground">
                    Best
                  </span>
                )}
              </span>
              {onOpen ? (
                <button
                  type="button"
                  aria-label={`Open: ${clipName(row.text)}`}
                  aria-haspopup="dialog"
                  onClick={(e) => onOpen(i, e.currentTarget)}
                  // Its ::after covers the whole row, so a tap anywhere but the gauge opens the sheet.
                  className={cn("flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl text-left after:absolute after:inset-0", PROSE)}
                >
                  <span className="block min-w-0 flex-1">
                    <RowText kind={kind} row={row} waiting={waiting} />
                  </span>
                  <ChevronIcon size={14} strokeWidth={2.1} aria-hidden className="shrink-0 text-foreground-muted" />
                </button>
              ) : (
                <div className={cn("min-w-0 flex-1", PROSE)}>
                  <RowText kind={kind} row={row} waiting={waiting} />
                </div>
              )}
            </li>
```
with, above `PackAnswer` (spans, so the text is valid inside a button):

```tsx
/** A row's words: a hook's line, or an idea's title and its grey line; a failed row's note. */
function RowText({ kind, row, waiting }: { kind: "hook" | "idea"; row: PackRow; waiting: boolean }) {
  const ink = waiting ? "text-foreground-secondary" : "text-foreground";
  return (
    <>
      {kind === "idea" ? (
        <>
          <span className={cn("block text-ui font-[620] leading-5 tracking-[-0.012em]", ink)}>{keepHyphens(row.text)}</span>
          {row.sub && <span className="mt-0.5 block text-pretty text-meta leading-[18px] text-foreground-secondary">{keepHyphens(row.sub)}</span>}
        </>
      ) : (
        <span className={cn("block text-pretty text-ui font-[520] leading-5 tracking-[-0.01em]", ink)}>{keepHyphens(row.text)}</span>
      )}
      {row.failed && <span className="mt-0.5 block text-meta text-foreground-secondary">Couldn&apos;t simulate</span>}
    </>
  );
}
```

`answer-gauge.tsx` `GaugeSlot`: add `href?: string | null` (doc: "A simulated slot's result page (step 2): the caption becomes a link"); import `Link` from `next/link` and `ChevronIcon` from `./field-icons`; at the top of the `state.kind !== "empty"` branch:

```tsx
    if (state.kind === "done" && href) {
      return (
        <Link
          href={href}
          data-slot="done"
          aria-label={`Open the result: ${clipName(text)}`}
          className={cn(row, "tap-44 -mx-1.5 rounded-xl px-1.5", className)}
        >
          <SmallGauge state={state} size={30} label={text} />
          <span>{SLOT_CAPTION.done}</span>
          <ChevronIcon size={14} strokeWidth={2.1} aria-hidden className="-ml-1 shrink-0 text-foreground-muted" />
        </Link>
      );
    }
```

`script-answer.tsx`: `opener: { state: GaugeState; onSimulate?: () => void; href?: string | null }` and `<GaugeSlot … href={opener.href ?? null} />`. `remix-answer.tsx`: `hookOf: (adaptedHook: string) => { state: GaugeState; onSimulate?: () => void; href?: string | null }` and `<GaugeSlot … href={hook.href ?? null} />`.

`thread-turn-next.tsx`: import `useContext`, `useState` from `react`; `ThreadIdContext` beside `BlockOriginContext`; `PackSheet` from `./pack-sheet`; `resultLinkOf`, `useSealKeys` from `./use-seal-keys`.

```tsx
function PackPart({ part, origins }: { part: Extract<AnswerPart, { kind: "hooks" | "ideas" }>; origins: readonly (BlockOrigin | null)[] }) {
  const sim = useTextSim();
  const writeScript = useOnWriteScriptHook();
  const kind: TextKind = part.kind === "hooks" ? "hook" : "idea";
  const rows: PackRow[] =
    part.kind === "hooks"
      ? part.items.map(({ block }) => rowOf(sim, block.props.hookLine))
      : part.items.map(({ block }) => ({ ...rowOf(sim, block.props.title), sub: ideaLineOf(block.props) }));
  const texts = rows.map((r) => r.text);
  // The row whose sheet is open (kept while it animates closed) and the button that opened it.
  const [sheet, setSheet] = useState<{ index: number; open: boolean; trigger: HTMLElement | null } | null>(null);

  // What a script starts from: a hook's line and its audience tag; an idea's seed hook, else its title.
  const scriptFrom = (i: number): [string, string] | null => {
    if (part.kind === "hooks") {
      const p = part.items[i]?.block.props;
      return p ? [p.hookLine, p.audienceArchetype ?? ""] : null;
    }
    const p = part.items[i]?.block.props;
    return p ? [p.seedHook || p.title, ""] : null;
  };

  return (
    <>
      <PackAnswer
        kind={kind}
        rows={rows}
        queue={sim?.progress(texts) ?? null}
        onSimulate={sim ? (key) => sim.fire(key, kind) : undefined}
        onSimulateAll={sim ? () => sim.fireAll(texts.map((text) => ({ text, kind }))) : undefined}
        onScript={
          writeScript
            ? (i) => {
                const from = scriptFrom(i);
                if (from) writeScript(...from);
              }
            : undefined
        }
        onOpen={(index, trigger) => setSheet({ index, open: true, trigger })}
      />
      <PackSentence kind={kind} rows={rows} />
      {sheet && (
        <PackSheet
          part={part}
          index={sheet.index}
          origin={origins[sheet.index] ?? null}
          open={sheet.open}
          onOpenChange={(open) => setSheet((s) => (s ? { ...s, open } : s))}
          returnFocus={sheet.trigger}
        />
      )}
    </>
  );
}

function ScriptPart({ block }: { block: ScriptCardBlock }) {
  const sim = useTextSim();
  const testScript = useOnTestScript();
  const threadId = useContext(ThreadIdContext);
  const { beats } = block.props;
  const opener = openerOf(block);
  const keys = useSealKeys(opener ? [opener] : []);
  const state = sim?.stateOf(opener) ?? EMPTY;
  return (
    <ScriptAnswer
      block={block}
      opener={{
        state,
        onSimulate: sim && opener ? () => sim.fire(opener, "script") : undefined,
        href: resultLinkOf(state, threadId, keys.get(opener.trim()), "opening"),
      }}
      onAddTake={testScript ? () => testScript(opener, scriptBrief(beats)) : undefined}
    />
  );
}

function RemixPart({ part }: { part: Extract<AnswerPart, { kind: "remix" }> }) {
  const sim = useTextSim();
  const writeScript = useOnWriteScriptHook();
  const threadId = useContext(ThreadIdContext);
  const keys = useSealKeys(part.items.map((i) => i.block.props.adaptedHook));
  return (
    <RemixAnswer
      items={part.items.map((i) => i.block)}
      hookOf={(hook) => {
        const state = sim?.stateOf(hook) ?? EMPTY;
        return {
          state,
          onSimulate: sim ? () => sim.fire(hook, "remix") : undefined,
          href: resultLinkOf(state, threadId, keys.get(hook.trim()), "hook"),
        };
      }}
      onScript={writeScript ? (hook) => writeScript(hook, "") : undefined}
    />
  );
}
```
`PartView` takes `origins: readonly BlockOrigin[] | undefined` and its hooks/ideas case becomes `return <PackPart part={part} origins={part.items.map((i) => origins?.[i.index] ?? null)} />;`; the turn passes `origins={blockOrigins}` (`:311`).

`dev-answers.tsx` `packTurn`: pass `onOpen={noop}` to `PackAnswer` (the drawn chevrons on P3, P4, P5, P6, P12).

- [ ] **Step 4: Run → PASS:** `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/thread-next "src/app/(app)/dev/answers" src/components/app/home/__tests__/composer-next-field.flag-on.test.tsx`; then the flag-off thread suites unchanged (seam map §6): `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/components/thread src/components/app/home/v8 src/components/app/home/__tests__/composer-v8.test.tsx`. `npx tsc --noEmit`; `npx eslint src/components/thread-next "src/app/(app)/dev/answers"`.
- [ ] **Step 5: Look at it:** `/dev/answers?state=p3|p5|p12` (chevrons) and `p6` at 393×852 and 1440×900, light and dark, full window, beside `ax-p3.png`, `ax-p5.png`, `ax-p12.png`, `ax-p6.png`. Do not commit.

Flag off: all of it is `src/components/thread-next/` (reached only through `ThreadTurnNext`, the flag-on fork of `ThreadTurn`) and the dev page (404 with the flag off). The flag-off suites of step 1 (`hook-test-handoff`, `make-card-value-fields`, `ambient-card-anchors`, `save-provenance`, `run-header`, `chat-turn`, `use-fire-sim`, `composer-v8`) run the legacy path and stay green.

---

### Task 7: Checks (controller)

Evidence into `.scratch/next-look/part3/answers/built/step2/` (screenshots) and `.scratch/next-look/part3/answers/step2/` (logs, scripts). Spend on the test account only (about 5-7 credits: one sheet Simulate, two "Script this one", an opener and a remix hook if no stored seals exist).

- [ ] Dev server on 3021 (flag on); fresh cookie (`.scratch/next-look/cookie.json`, step-1 seam map §0.5).
- [ ] `/dev/answers?state=p6|p6b|p6i|p7` (+ `p7l`, `p7n` for looking) at 393×852 and 1440×900, light and dark: full-window screenshots, side by side with `renders/ax-p6.png`, `ax-p7.png`, and `ax-p7b.png` (P7 with `<main>` scrolled to its end), with a sheet script modelled on `task6-sheets.cjs` (`step2-sheets.cjs`). Planned differences to list, not fix: no Share (spec), text 22 / 28 (spec; drawn 19 / 26), wedges in the video ring's order (spec; drawn by share), Copy/Save 44 (spec; drawn 40), "Visual" = `onScreen` only (spec), the group percent 16 (drawn 17). Fix any other difference and re-shoot.
- [ ] A real hooks thread with stored seals, phone and desktop, light and dark: a row opens its sheet (tap on the text, on the chevron, on the empty space beside "Best"; a tap on the gauge simulates instead). Copy (read the clipboard back in Playwright); Save, then Library shows it with its thread, then unsave. On a row not simulated: Simulate in the sheet → exactly one `POST /api/tools/react` in the network log, credits −1, the gauge fills in the sheet and in the row. "would stop to watch ›" opens the page; its number and ten groups equal the endpoint's body and the stored seal (read-only `select sim_seals` on the test account's thread through the Supabase MCP); reload: the same; Back returns to the thread.
- [ ] Not here: a random uuid thread id, an unknown 10-character key, a malformed key → "This simulation isn't here." with Back. An archived thread of the test account with a text seal (if one exists) → its page shows.
- [ ] "Script this one" from the sheet → one `POST /api/tools/chat` (`skill: "script"`, `anchor` = the hook), credits −2, the sheet closes, the script lands at the bottom. From the page → back in the same thread (header title, sidebar highlight), one chat POST, credits −2, the script at the bottom, the address has no `scriptFrom`; reload `/home`: nothing runs again.
- [ ] A simulated script opener: "would stop to watch ›" → "Opening line", no primary. A simulated remix hook → "Hook" with the primary.
- [ ] Routes: `/simulation/<a real video id>` still opens the video result; `/simulation/hook` alone and `/simulation/hook/x` → not found.
- [ ] Keyboard pass (phone and desktop): rows ("Open: …"), the sheet's controls (the gauge link or Simulate, Copy, Save, More, the proof link, "Script this one"), Escape returns focus to the row, the page's Back and primary; all reachable, named, focus visible, ≥ 44 on touch.
- [ ] Step 1 regression: re-run `task5-census.cjs` on the same threads (no intro, receipt, outro, forward or offer chip, side panel, uppercase label) and the scroll-under-the-field check; nothing changed outside the rows.
- [ ] Flag-off production build vs `.scratch/next-look/baseline` (`node scripts/next-look-probe.cjs`, compared with `scripts/next-look-compare.cjs`, as step 1's Task 7 did in `task7/flagoff`); on that build `/simulation/hook/<uuid>/<key>` and `GET /api/threads/<uuid>/seals/<key>` answer 404.
- [ ] Full suite alone: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run` (the three composer files that time out at 5 s under full load: re-run alone before calling it red); `npx tsc --noEmit`; `npx eslint` on every changed file; `npx next build` with the flag on and off.
- [ ] Independent critic (fresh subagent, Opus) given ONLY the built full-window screenshots, the drawing renders and the spec's rules; apply or answer every point.
- [ ] Write the "Result" section below (no ids, handles or links of real accounts); the owner commits.

## Spec coverage

| Spec | Task |
|---|---|
| §1.1 a row opens its details | 5 (sheet), 6 (rows) |
| §1.2 a simulated text has a result page | 1 (key, model), 2 (endpoint), 3 (page) |
| §1.3 "Script this one" from the page | 1 (`script-from`), 4 |
| §2 the number is `population.stopPct`; seals keyed by trimmed text; leaving `/home` unmounts the composer | 1, 2, 4 |
| §3 opens from / where / closes / focus back | 5 (shell, handle), 6 (row button, focus) |
| §3 a hook's sheet 1-6; "Not shown" | 5 (bodies, tests), 6 (wiring) |
| §3 an idea's sheet | 5, 6 |
| §3 Save and Copy | 5 (buttons, hooks), 6 (per-row ref) |
| §4 address and key | 1, 3, 6 |
| §4 endpoint | 2 |
| §4 the page 1-5 | 3 |
| §4 "Script this one" from the page | 4 |
| §5 what changes in the thread | 6 |
| §6 not in step 2 | Global Constraints (no re-simulate, no Share) |
| §7.1 flag off | each task's flag-off note, 7 |
| §7.2 `/dev/answers` vs the drawing | 3, 5, 6, 7 |
| §7.3 real thread | 7 |
| §7.4 "Script this one" from sheet and page | 4, 6, 7 |
| §7.5 keyboard | 5, 6, 7 |
| §7.6 critic | 7 |

## Risks

1. **The key is async.** No synchronous SHA-256 on the client. A link appears one tick after its text renders; `useSealKeys` draws none before (tested: "no dead link"), keeps keys for the tab (a remount has them at once), and draws none at all without Web Crypto (an insecure origin such as a LAN IP over http). The endpoint hashes every text seal of the thread per request (tens at most).
2. **The composer hand-off.** Gated on `openThreadId !== null && !rehydrating` (Task 4). The cookie steers `/api/threads/open` only to an OPEN thread: from the page of an archived thread, "Script this one" would run in the newest open thread (owner question 2). If the first load fails (401), the parameter waits in the address and runs on a later load of that mount only.
3. **Save's ref per row.** The pack's part carries only its first item's origin; `PackSheet` wraps the sheet in the row's own `BlockOriginContext` (tested: row 2 saves `m1:2`). A live run has no message id: Save works once per mount with a null ref, as `SaveAffordance` does.
4. **The sheet's focus return.** Opened from a row, not a Radix trigger: the clicked button (not `document.activeElement`, which Safari leaves on `body` after a click) is focused on close with `preventScroll`, so "Script this one" does not scroll the thread back up. The sheet closes when its turn remounts (the live → persisted swap).
5. **The static `hook` segment beside `[id]`.** `/simulation/hook/<t>/<k>` reaches the new page; `/simulation/hook` alone must stay not found and `/simulation/<id>` unchanged (checked in Task 7, not by a unit test).
6. **The grab handle** is a new optional prop on the shared `Sheet` part; it renders only in the flag-on bottom sheet and only when passed. The desktop dialog uses Radix directly: the legacy `ui/dialog.tsx` paints a dark glass panel inline.
7. **Next's router and `history.replaceState`:** the composer passes `window.history.state` through so the router keeps its tree; checked in a browser in Task 7.
8. **An idea's page scripts from its title** (the text the seal holds); the idea's sheet scripts from its seed hook (owner question 3).

## Result

Built by Tasks 1-6 on 2026-11-23, each reviewed (ledger `.superpowers/sdd/2026-11-22-thread-answers-step2/progress.md`),
then a review pass by the controller on real threads, an independent design critique and a whole-branch
code review. Nothing is committed. Evidence: `.scratch/next-look/part3/answers/built/review-2026-11-23/`
(the before-and-after sheet `sheet-before-after.png`, the build logs, the flag-off probe).

| Check | Outcome |
|---|---|
| Suite | 679 files pass (1 skipped), 8,447 tests pass (42 skipped), none fail, run alone with the dev server stopped; `tsc` clean; eslint 0 errors on the touched folders (the 7 warnings in `composer.tsx` are at HEAD) |
| Builds | `next build` exit 0 with the flag on (the new page and endpoint are in the route list) and with it off |
| Flag off | Probe on the production build vs `.scratch/next-look/baseline`: 6 pages, 0 real differences (96 token differences are minifier spacing). The endpoint answers 404; the new page, `/dev/answers` and `/simulation/hook` answer the app's not-found page |
| Real run (test account, 3 credits) | An idea's sheet → Simulate there (6 s, one `react`) → "would stop to watch ›" → its page (`?as=idea`), identical after a reload → "Script this one" → back in its thread, one write-script turn after the history, a script card. No page errors. The hand-off entry was there until the thread loaded, then gone |
| Taps and keyboard (real thread) | Tab goes number → row, row by row; Enter opens the sheet with focus on its heading; one Tab reaches the first control; Escape closes and returns focus to the row; a click on the scrim closes; a tap under a gauge (where "Best" / "Ahead" sits) opens the row. A double-click on "Script hook 1" sent one request; a double-tap on a row sent none |
| Against the drawing | P6 and P7 at 393 and 1440, light and dark, beside `ax-p6.png` and `ax-p7.png`: as drawn, apart from the departures in the spec's §8 |
| Critic | A fresh agent with the built screens, the drawing and the owner's rules only. Applied and listed in the ledger; its costliest points are about what the model writes (below) |
| Final code review | "Ready to commit", nothing blocking. Fixed from it: one script per tap (`useOncePerBurst`), a click in a sheet's first 320 ms is dropped, a Close control for a screen reader, the stored frame is fetched only for a tile on screen, no result link while a pack's queue runs, the sidebar mark on the rail, the second engine line under "Why it fits", "taking longer" counted from the run's start |

**Where the build departs from this plan and the spec:** the spec's §8 lists every departure. The two that
change behaviour a reader of this plan would expect: Task 4's address parameter was replaced by a
`sessionStorage` hand-off (see the note at Task 4), and a simulated row's number is a link to its result page.

**Open for the owner (not changed here):**

1. **What the model writes is now the weakest part of these screens** (the critic's first, second, fourth and
   sixth points): scripts state findings that never happened and promise things the creator does not have;
   hooks assert events the creator cannot film; "why it works" is one sentence of jargon; a remix's headline
   can be the source's line word for word and its steps fit any tutorial. The screens fold and reorder around
   it; the fix is in the writers' prompts (engine track).
2. **Thread titles** are the first message cut at 48 characters. The header now ends them on a whole word; a
   short title written after the first answer needs a model call.
3. **The first screen of every session is still the old Home** with its own chip row above the new field
   (two rows of skills, and the word "Test"). It is the plan's last slice; it may be worth doing next.
4. **A reopened thread's sent-video bubble** shows the video mark, not the frame (the card under it shows the
   frame). The bubble could read the same stored frame.
5. **"Script this one" from the page** can go out with the default platform when the audiences have not
   loaded yet (a creator with a non-TikTok audience and no stored choice).
6. The double question (PR #564) and the owner check on video paths (PR #563) are still open against main;
   this branch shows the double bubble until #564 is in its base.
7. Kept as approved, though the critic argued otherwise: "Proven" (he suggested "Based on"), "Add your take",
   the curated chips, rows in the order they were written.
