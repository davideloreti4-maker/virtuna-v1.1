# Composer v8 Phase 3 — the verdict report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three-tab verdict report (Audience · Brain · Engagement) — bottom sheet on mobile, overlay + pinnable panel on desktop — opened from any card's meter and from the composer sub-bar's "Simulate ›" door, and retire `AmbientOverviewRail` under `CONCEPT_V8_ENABLED`.

**Architecture:** One shell (`VerdictReport`) hosts the EXISTING drill (`AmbientDetail`) in three presentations. The drill gains two optional, default-off props (`tabOrder`, `audienceSlot`) so every current mount stays byte-identical while the report gets the spec's tab order and an honest personas-only Audience frame. A report **subject** carries whatever the source actually measured: a drop card supplies its CACHED 10 personas (never re-simmed), a thread card supplies its fired sim's snapshot (personas + the Stage-2 population when the run produced one). Two data grades, one shell: population present → the existing `buildDomainTemplate`; personas only → a new pure `buildPersonaReportTemplate` + `PersonaAudienceFrame`, with Brain and Engagement honestly dimmed. Firing a sim for an unsimulated card is fire-on-demand through a new `useFireSim` hook that reuses the shipped `/api/tools/react` primitive and the sealed-verdict law.

**Tech Stack:** Next.js 15 (client components), TypeScript, Tailwind v4, React portals, Vitest + happy-dom + @testing-library/react, Playwright (raw, for the signed-in visual gate).

## Global Constraints

Copied verbatim from `docs/HANDOFF-2026-08-09-composer-v8-phase-3-kickoff.md` §3 and the SSOT §6. Every task's requirements implicitly include this section.

- **Fire-on-demand is the law.** Generation NEVER auto-simulates; only drops arrive pre-scored. **Opening a report on a drop READS its cached personas — never re-sims.** Never fire per keystroke; debounce; every room reaction costs credits.
- **The Flash SIM is platform-blind** — never imply the verdict moved with the platform lens.
- **No corpus multiplier numbers** anywhere. **Donor niche/handle never shown.**
- **Accent dosage locked** — the live-presence dot is the only accent on the v8 surfaces. Every NEW component in this plan renders **zero** accent. Primary actions are neutral cream (`--color-action` / `text-foreground`). Never `#fff`.
- **Flag-off stays byte-identical** — with `CONCEPT_V8_ENABLED` false, `/home` renders exactly what it renders today, including the ≥xl `AmbientOverviewRail` portal.
- **Drop economics (#3) is an open owner call** — no billing wiring, no quota wiring, no new priced route in this phase.
- **Never fabricate a figure.** A missing population is an honest absence, never a synthesized aggregate.
- Text cream `#ece7de` / `#c2bdb4` / `#8a857c`; borders `white/[0.06]`, hover `white/[0.10]`; cards r12, inputs/buttons r8; Newsreader serif for voice moments only.
- **Never commit** `src/app/(app)/start/page.tsx` or `src/components/surfaces/start-page.tsx` (uncommitted owner call #7). Use explicit `git add <path>` — never `git add -A` / `git add .`.
- **Gates before any push:** `node node_modules/typescript/bin/tsc --noEmit` · `npm run build` · `npx vitest run` (baseline = exactly ONE pre-existing failure, `routing-cut.test.ts`).

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `src/lib/surfaces/v8-report.ts` | PURE. `personasToReportRead` (10 personas → verdict + grouped real voices) and `buildPersonaReportTemplate` (→ a `DomainTemplate` with `population: null`). No React, no I/O, no clock, no RNG. |
| `src/components/app/home/v8/persona-audience-frame.tsx` | The personas-only Audience tab — verdict, ten faces (lit = stopped), why-stopped / why-scrolled with REAL counts and REAL quotes, the fix action. Zero accent. |
| `src/components/app/home/v8/verdict-report.tsx` | The shell: bottom sheet (mobile) · overlay panel (desktop) · pinned panel (desktop, portaled into the layout's rail host). Owns Esc/scrim/pin; renders `AmbientDetail` inside. Exports `ReportSubject`. |
| `src/components/app/home/v8/fire-sim.ts` | PURE helpers for the on-demand sim: request-body builder, `fractionToStopPct`, response → `ReportSnapshot`. |
| `src/components/app/home/v8/use-fire-sim.ts` | The hook: one in-flight run at a time (the debounce), sealed watcher, per-descriptor snapshots. |
| `src/lib/surfaces/__tests__/v8-report.test.ts` | Tests for the pure module. |
| `src/components/app/home/v8/__tests__/persona-audience-frame.test.tsx` | Tests for the frame. |
| `src/components/app/home/v8/__tests__/verdict-report.test.tsx` | Tests for the shell. |
| `src/components/app/home/v8/__tests__/fire-sim.test.ts` | Tests for the pure sim helpers. |
| `src/components/app/home/v8/__tests__/use-fire-sim.test.tsx` | Tests for the hook (fetch stubbed at the I/O boundary only). |

**Modified**

| File | Change |
|---|---|
| `src/components/audience-lens/v2/AmbientDetail.tsx` | Export `Tab`; add optional `tabOrder` and `audienceSlot`; skip the pager chip when `pager` is empty. All default-off. |
| `src/components/app/home/v8/drop-shelf.tsx` | The meter becomes a button → `onOpenReport(card)`. |
| `src/components/app/home/v8/sub-bar.tsx` | Delete `RoomOverlay` (superseded by `VerdictReport`). |
| `src/components/app/home/composer.tsx` | Report state + the three doors; `openRoomForCard` routes to the report under v8; the ≥xl rail portal retires under v8 and hosts the pinned report instead; `onReportPinnedChange` up to the layout. |
| `src/components/app/home/home-page-layout.tsx` | Mount the rail `<aside>` when `threadMode || reportPinned`; thread `onReportPinnedChange` into the composer. |
| `src/components/app/home/__tests__/composer-v8.test.tsx` | Integration tests for Tasks 7 + 8 go HERE — it is the established v8 harness (both flags mocked on; streams/profile/navigation/motion mocked; `installFetchMock` already routes `/api/surfaces/drops`). Do not fork a second harness. |

**Facts the tasks below rely on (verified in the tree, 2026-08-09)**

- The composer's field state is `const [url, setUrl] = useState("")` (`composer.tsx:808`) — a legacy name; `setUrl` is the steer setter.
- `composer-v8.test.tsx`'s `matchMedia` stub matches `min-width <= 1024`, so `isXl` is **false** there by default → the report renders `variant="sheet"`. A desktop assertion must raise that threshold inside the test.
- `/api/threads/open` returns `{ threadId, messages, simSeals }`, where a message is `HydratedMessage` = `{ id, thread_id, role, blocks, created_at }` (`src/lib/threads/messages.ts:52`).
- `dropCardToRemixBlocks(card, audienceName?)` (`src/lib/surfaces/drop-seed.ts:38`) is a PURE builder returning `RemixCardBlock[]` — the exact blocks a seeded thread carries. Build thread fixtures with it; never hand-author the props.

---

### Task 1: The pure report read

The honesty spine of the whole phase lives here. 10 personas carry `{archetype, verdict: "stop"|"scroll", quote}` and nothing else — so the report may print the verdict count, the per-group counts, and the real quotes, and **must not** print a coded-reason tally (`×4` in the mock) that no producer computed.

**Files:**
- Create: `src/lib/surfaces/v8-report.ts`
- Test: `src/lib/surfaces/__tests__/v8-report.test.ts`

**Interfaces:**
- Consumes: `ReactionPersona` from `@/lib/tools/blocks`; `DomainTemplate` from `@/components/audience-lens/v2/domain-template`; `archetypeDisplayName` from `@/lib/audience/archetype-names`.
- Produces:
  - `interface ReportVoice { who: string; quote: string }`
  - `interface ReportRead { stop: number; total: number; stopPct: number; stopped: ReportVoice[]; scrolled: ReportVoice[]; lead: ReportVoice | null }`
  - `function personasToReportRead(personas: ReactionPersona[]): ReportRead`
  - `function buildPersonaReportTemplate(input: { read: ReportRead; title: string; coverSrc?: string | null; audienceName: string; calibratedFrom: string }): DomainTemplate`

- [ ] **Step 1: Write the failing test**

Create `src/lib/surfaces/__tests__/v8-report.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { personasToReportRead, buildPersonaReportTemplate } from "../v8-report";
import type { ReactionPersona } from "@/lib/tools/blocks";

function p(archetype: string, verdict: "stop" | "scroll", quote = ""): ReactionPersona {
  return { archetype, verdict, quote };
}

const TEN: ReactionPersona[] = [
  p("builders", "stop", "ok that's me. fine."),
  p("learners", "stop", "the specificity reads true"),
  p("skeptics", "scroll", "heard this one before"),
  p("drive_by", "stop", ""),
  p("builders", "stop", "first-person beats advice"),
  p("learners", "scroll", "wants the alternative sooner"),
  p("skeptics", "stop", "fair enough"),
  p("drive_by", "stop", ""),
  p("builders", "stop", ""),
  p("learners", "scroll", ""),
];

describe("personasToReportRead", () => {
  it("counts the real verdicts — never rounds a fraction into a claim", () => {
    const read = personasToReportRead(TEN);
    expect(read.stop).toBe(7);
    expect(read.total).toBe(10);
    expect(read.stopPct).toBe(70);
  });

  it("groups only REAL quotes; a persona that said nothing contributes no voice", () => {
    const read = personasToReportRead(TEN);
    expect(read.stopped.map((v) => v.quote)).toEqual([
      "ok that's me. fine.",
      "the specificity reads true",
      "first-person beats advice",
      "fair enough",
    ]);
    expect(read.scrolled.map((v) => v.quote)).toEqual([
      "heard this one before",
      "wants the alternative sooner",
    ]);
  });

  it("humanises the archetype into the voice's name", () => {
    const read = personasToReportRead([p("drive_by", "stop", "sure")]);
    expect(read.stopped[0]!.who).toBe("Drive By");
  });

  it("leads with a stopper's voice on a stopped-majority read", () => {
    const read = personasToReportRead(TEN);
    expect(read.lead?.quote).toBe("ok that's me. fine.");
  });

  it("leads with a scroller's voice when the room bounced", () => {
    const read = personasToReportRead([
      p("a", "scroll", "nope"),
      p("b", "scroll", "boring"),
      p("c", "stop", "kept me"),
    ]);
    expect(read.lead?.quote).toBe("nope");
  });

  it("returns no lead at all when nobody said anything (never invents one)", () => {
    const read = personasToReportRead([p("a", "stop"), p("b", "scroll")]);
    expect(read.lead).toBeNull();
    expect(read.stopped).toEqual([]);
  });

  it("is total on an empty persona list", () => {
    const read = personasToReportRead([]);
    expect(read).toEqual({ stop: 0, total: 0, stopPct: 0, stopped: [], scrolled: [], lead: null });
  });
});

describe("buildPersonaReportTemplate", () => {
  const read = personasToReportRead(TEN);
  const t = buildPersonaReportTemplate({
    read,
    title: "I sit 10 hours a day. Stretching didn't fix me — this did.",
    audienceName: "Your people",
    calibratedFrom: "TikTok",
  });

  it("states the verdict in the surface's own unit", () => {
    expect(t.verdict).toEqual({ value: "7/10", label: "stopped scrolling" });
  });

  it("carries NO population, NO brain and NO engagement — a pre-run read has none of the three", () => {
    expect(t.population).toBeNull();
    expect(t.brain).toBeUndefined();
    expect(t.engagement).toBeUndefined();
  });

  it("renders no pager and no back label — the report is not the drill's pager", () => {
    expect(t.pager).toBe("");
    expect(t.backLabel).toBe("");
  });

  it("discloses the sample honestly, with no multiplier and no donor niche", () => {
    expect(t.simline).toBe("10 simulated · calibrated on TikTok");
    expect(JSON.stringify(t)).not.toMatch(/\d+(\.\d+)?x/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/surfaces/__tests__/v8-report.test.ts`
Expected: FAIL — `Failed to resolve import "../v8-report"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/surfaces/v8-report.ts`:

```ts
/**
 * v8-report — the PURE read behind the verdict report's personas-only grade.
 *
 * A drop card carries its CACHED Flash personas and nothing else: `{archetype, verdict,
 * quote}` × 10. That is the whole evidence base for a pre-run report, and this module is
 * the boundary that refuses to exceed it. What it prints:
 *   - the verdict count (a real tally of `verdict === "stop"`)
 *   - each group's real size (the "with counts" the spec asks for — the COUNT OF PEOPLE,
 *     never a coded-reason tally, because no producer coded the reasons for a Flash text run)
 *   - the real quotes, attributed to their archetype
 * A persona that said nothing contributes no voice; a room that said nothing gets no lead.
 *
 * Pure + deterministic (no clock, no RNG, no I/O) — SSR-safe, engine-determinism-gate safe.
 */

import type { ReactionPersona } from "@/lib/tools/blocks";
import { archetypeDisplayName } from "@/lib/audience/archetype-names";
import type { DomainTemplate } from "@/components/audience-lens/v2/domain-template";

/** One simulated viewer speaking, in their own words. `who` is the humanised archetype. */
export interface ReportVoice {
  who: string;
  quote: string;
}

export interface ReportRead {
  stop: number;
  total: number;
  /** 0..100, rounded. 0 when the room is empty — never a fabricated midpoint. */
  stopPct: number;
  stopped: ReportVoice[];
  scrolled: ReportVoice[];
  /** The one quote the report leads with, from the pool that WON. Null when nobody spoke. */
  lead: ReportVoice | null;
}

function voicesOf(personas: ReactionPersona[], verdict: "stop" | "scroll"): ReportVoice[] {
  return personas
    .filter((p) => p.verdict === verdict && p.quote.trim().length > 0)
    .map((p) => ({ who: archetypeDisplayName(p.archetype), quote: p.quote.trim() }));
}

export function personasToReportRead(personas: ReactionPersona[]): ReportRead {
  const total = personas.length;
  const stop = personas.filter((p) => p.verdict === "stop").length;
  const stopped = voicesOf(personas, "stop");
  const scrolled = voicesOf(personas, "scroll");
  // Lead with the majority's voice — a bounced room leads with a scroller, so the report
  // never opens on an endorsement it did not earn. Empty pool ⇒ no lead (never invented).
  const majorityStopped = stop * 2 >= total;
  const lead = (majorityStopped ? stopped[0] : scrolled[0]) ?? stopped[0] ?? scrolled[0] ?? null;
  return {
    stop,
    total,
    stopPct: total > 0 ? Math.round((stop / total) * 100) : 0,
    stopped,
    scrolled,
    lead,
  };
}

/**
 * The personas-only `DomainTemplate`. `population` is NULL and `brain`/`engagement` are absent
 * on purpose: a pre-run Flash read has no Stage-2 projection, no attention timeline and no
 * retention curve, so `AmbientDetail` dims those tabs and states the absence. The Audience tab
 * is supplied by the host as `audienceSlot` (`PersonaAudienceFrame`).
 */
export function buildPersonaReportTemplate(input: {
  read: ReportRead;
  title: string;
  coverSrc?: string | null;
  audienceName: string;
  calibratedFrom: string;
}): DomainTemplate {
  const { read, title, calibratedFrom } = input;
  return {
    id: "v8-report",
    label: title,
    // The report is not the rail's drill: no back label, no pager, no identity strip.
    backLabel: "",
    pager: "",
    verdict: { value: `${read.stop}/${read.total}`, label: "stopped scrolling" },
    simline: `${read.total} simulated · calibrated on ${calibratedFrom}`,
    population: null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/surfaces/__tests__/v8-report.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/surfaces/v8-report.ts src/lib/surfaces/__tests__/v8-report.test.ts
git commit -m "feat(report): pure personas-only report read — real counts, real voices, no coded tally"
```

---

### Task 2: The personas-only Audience frame

The mock §6 Audience anatomy, built from `ReportRead`: verdict · ten faces (lit = stopped) · why-they-stopped / why-they-scrolled with the real group counts and real quotes · the fix action. The full `PopulationFrame` is NOT used here — its terrain, pools, decision-states and "1,000 simulated" language describe a Stage-2 projection this grade does not have, and synthesizing one would be the fabrication the honesty spine forbids.

**Files:**
- Create: `src/components/app/home/v8/persona-audience-frame.tsx`
- Test: `src/components/app/home/v8/__tests__/persona-audience-frame.test.tsx`

**Interfaces:**
- Consumes: `ReportRead` (Task 1); `Card`, `CardHead`, `SURFACE` from `@/components/audience-lens/v2/rail-kit`; `TONE` from `@/components/audience-lens/v2/AmbientDetail`.
- Produces: `function PersonaAudienceFrame(props: { read: ReportRead; onSteer?: (steer: string) => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Create `src/components/app/home/v8/__tests__/persona-audience-frame.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PersonaAudienceFrame } from "../persona-audience-frame";
import { personasToReportRead } from "@/lib/surfaces/v8-report";
import type { ReactionPersona } from "@/lib/tools/blocks";

function personas(stops: number, total = 10): ReactionPersona[] {
  return Array.from({ length: total }, (_, i) => ({
    archetype: `a${i}`,
    verdict: i < stops ? ("stop" as const) : ("scroll" as const),
    quote: i < stops ? `stopped ${i}` : `scrolled ${i}`,
  }));
}

describe("PersonaAudienceFrame", () => {
  it("states the verdict and draws exactly ten faces, lit = stopped", () => {
    render(<PersonaAudienceFrame read={personasToReportRead(personas(7))} />);
    expect(screen.getByTestId("report-verdict")).toHaveTextContent("7/10");
    expect(screen.getByText(/stopped scrolling/i)).toBeInTheDocument();
    const faces = screen.getAllByTestId(/^report-face-/);
    expect(faces).toHaveLength(10);
    expect(faces.filter((f) => f.dataset.lit === "true")).toHaveLength(7);
  });

  it("counts each group by PEOPLE and prints their real words", () => {
    render(<PersonaAudienceFrame read={personasToReportRead(personas(7))} />);
    expect(screen.getByTestId("report-group-stopped")).toHaveTextContent("7");
    expect(screen.getByTestId("report-group-scrolled")).toHaveTextContent("3");
    expect(screen.getByText("stopped 0")).toBeInTheDocument();
    expect(screen.getByText("scrolled 7")).toBeInTheDocument();
  });

  it("omits a group entirely when nobody in it spoke — never an empty header", () => {
    const read = personasToReportRead(personas(10));
    render(<PersonaAudienceFrame read={read} />);
    expect(screen.queryByTestId("report-group-scrolled")).toBeNull();
  });

  it("the fix action names the REAL number it is asking you to win back", () => {
    const onSteer = vi.fn();
    render(<PersonaAudienceFrame read={personasToReportRead(personas(7))} onSteer={onSteer} />);
    fireEvent.click(screen.getByRole("button", { name: /fix what lost them/i }));
    expect(onSteer).toHaveBeenCalledWith("Rewrite the hook to win back the 3 who scrolled past.");
  });

  it("renders no fix action when nobody scrolled (nothing to fix)", () => {
    render(<PersonaAudienceFrame read={personasToReportRead(personas(10))} onSteer={() => {}} />);
    expect(screen.queryByRole("button", { name: /fix what lost them/i })).toBeNull();
  });

  it("spends ZERO accent (locked) and never prints #fff", () => {
    const { container } = render(<PersonaAudienceFrame read={personasToReportRead(personas(7))} />);
    expect(container.innerHTML).not.toMatch(/FF6363/i);
    expect(container.innerHTML).not.toMatch(/bg-accent|text-accent/);
    expect(container.innerHTML).not.toMatch(/#fff\b|#ffffff/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/app/home/v8/__tests__/persona-audience-frame.test.tsx`
Expected: FAIL — `Failed to resolve import "../persona-audience-frame"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/app/home/v8/persona-audience-frame.tsx`:

```tsx
"use client";

/**
 * PersonaAudienceFrame — the Audience tab of the v8 verdict report at its PERSONAS-ONLY grade
 * (a drop's cached read, or a fired run whose Stage-2 projection came back null).
 *
 * Mock §6 anatomy: verdict · ten faces (lit = stopped) · why they stopped / why they scrolled ·
 * the fix. The counts beside each group head are counts of PEOPLE — real tallies of the ten —
 * not the mock's coded-reason "×4", which no producer computes for a Flash text run.
 *
 * The full <PopulationFrame> is deliberately NOT used at this grade: its terrain, pools and
 * "1,000 simulated" strip describe a Stage-2 projection that does not exist here, and inventing
 * one to fill the slot is exactly the fabrication the honesty spine forbids. When a run DOES
 * carry a population, the report renders PopulationFrame through the normal template path.
 *
 * ZERO accent (locked) — cream on charcoal, the loss reads by position and by label.
 */

import { TONE } from "@/components/audience-lens/v2/AmbientDetail";
import { Card, CardHead, SURFACE } from "@/components/audience-lens/v2/rail-kit";
import type { ReportRead, ReportVoice } from "@/lib/surfaces/v8-report";

function Faces({ stop, total }: { stop: number; total: number }) {
  return (
    <div className="mt-3.5 flex gap-[6px]">
      {Array.from({ length: total }, (_, i) => {
        const lit = i < stop;
        return (
          <span
            key={i}
            data-testid={`report-face-${i}`}
            data-lit={lit ? "true" : "false"}
            aria-hidden
            className="h-[26px] flex-1 rounded-[6px]"
            style={{ background: lit ? "rgba(236,231,222,.30)" : "rgba(236,231,222,.07)" }}
          />
        );
      })}
    </div>
  );
}

function VoiceGroup({
  id,
  title,
  voices,
  count,
}: {
  id: "stopped" | "scrolled";
  title: string;
  voices: ReportVoice[];
  count: number;
}) {
  // Nobody spoke ⇒ no header. An empty section is a promise of evidence we cannot keep.
  if (voices.length === 0) return null;
  return (
    <Card>
      <div data-testid={`report-group-${id}`}>
        <CardHead title={title} meta={`${count} of the room`} />
        <div className="mt-1">
          {voices.map((v, i) => (
            <div key={`${v.who}-${i}`} className="py-2">
              <div className="font-serif text-[13.5px] leading-[1.45]" style={{ color: TONE.dim }}>
                “{v.quote}”
              </div>
              <div className="mt-1 text-[11px]" style={{ color: TONE.faint }}>
                {v.who}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function PersonaAudienceFrame({
  read,
  onSteer,
}: {
  read: ReportRead;
  onSteer?: (steer: string) => void;
}) {
  const lost = read.total - read.stop;
  return (
    <div className="pt-4">
      <div className="rounded-[14px] p-4" style={{ background: SURFACE.figure }}>
        <div className="flex items-baseline gap-1.5">
          <span
            data-testid="report-verdict"
            className="text-[30px] font-light leading-none tracking-[-0.01em] tabular-nums"
            style={{ color: TONE.cream }}
          >
            {read.stop}/{read.total}
          </span>
          <span className="text-[13px]" style={{ color: TONE.faint }}>
            stopped scrolling
          </span>
        </div>
        <Faces stop={read.stop} total={read.total} />
      </div>

      <VoiceGroup id="stopped" title="Why they stopped" voices={read.stopped} count={read.stop} />
      <VoiceGroup id="scrolled" title="Why they scrolled" voices={read.scrolled} count={lost} />

      {/* The tab ends in a fix, and the fix feeds the thread as a steer (spec §2). It names the
          real number it is asking you to win back — never a projected gain, which would be a
          claim about a run that has not happened. */}
      {onSteer && lost > 0 ? (
        <button
          type="button"
          onClick={() =>
            onSteer(`Rewrite the hook to win back the ${lost} who scrolled past.`)
          }
          className="mt-4 w-full rounded-lg border border-white/[0.06] bg-surface-elevated px-3 py-2.5 text-label font-medium text-foreground transition-colors hover:border-white/[0.10]"
        >
          Fix what lost them
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/app/home/v8/__tests__/persona-audience-frame.test.tsx`
Expected: PASS (6 tests).

If the accent assertion fails on `TONE`/`SURFACE` imports, read `rail-kit.tsx:31` — `SURFACE.figure` must be a neutral charcoal. Do not add a colour; pick the neutral token.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/home/v8/persona-audience-frame.tsx src/components/app/home/v8/__tests__/persona-audience-frame.test.tsx
git commit -m "feat(report): personas-only Audience frame — verdict, ten faces, real voices, zero accent"
```

---

### Task 3: `AmbientDetail` — opt-in tab order and audience slot

Two optional props, both default-off, so every existing mount (the rail, the sheet, the sealed drill, the video drill, `/go`) renders byte-identically. The spec and the mock both name the report's order **Audience · Brain · Engagement**; `AmbientDetail`'s own settled order (`brain · engagement · audience`) stays the default for the drill.

**Files:**
- Modify: `src/components/audience-lens/v2/AmbientDetail.tsx:241-245` (export `Tab`, add `REPORT_TAB_ORDER`), `:247-311` (props + availability), `:394-402` (pager chip), `:487-506` (audience branch)
- Test: `src/components/audience-lens/v2/__tests__/ambient-detail-report-props.test.tsx` (create)

**Interfaces:**
- Produces:
  - `export type Tab = "brain" | "engagement" | "audience"`
  - `export const REPORT_TAB_ORDER: readonly Tab[]` — `["audience", "brain", "engagement"]`
  - `AmbientDetail` props gain `tabOrder?: readonly Tab[]` and `audienceSlot?: React.ReactNode`

- [ ] **Step 1: Write the failing test**

Create `src/components/audience-lens/v2/__tests__/ambient-detail-report-props.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AmbientDetail, REPORT_TAB_ORDER } from "../AmbientDetail";
import type { DomainTemplate } from "../domain-template";

function template(over: Partial<DomainTemplate> = {}): DomainTemplate {
  return {
    id: "v8-report",
    label: "A hook",
    backLabel: "",
    pager: "",
    verdict: { value: "7/10", label: "stopped scrolling" },
    population: null,
    ...over,
  };
}

describe("AmbientDetail — report props", () => {
  it("keeps the settled drill order by default", () => {
    render(<AmbientDetail template={template()} presentation="sheet" />);
    const tabs = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") !== null);
    expect(tabs.map((t) => t.textContent)).toEqual(["Brain", "Engagement", "Audience"]);
  });

  it("honours an explicit tabOrder (the report's Audience-first order)", () => {
    render(<AmbientDetail template={template()} presentation="sheet" tabOrder={REPORT_TAB_ORDER} />);
    const tabs = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") !== null);
    expect(tabs.map((t) => t.textContent)).toEqual(["Audience", "Brain", "Engagement"]);
  });

  it("renders audienceSlot instead of the population frame, and opens on it", () => {
    render(
      <AmbientDetail
        template={template()}
        presentation="sheet"
        tabOrder={REPORT_TAB_ORDER}
        audienceSlot={<div data-testid="slot">the personas read</div>}
      />,
    );
    expect(screen.getByTestId("slot")).toBeInTheDocument();
    expect(screen.queryByText(/no run yet/i)).toBeNull();
  });

  it("an audienceSlot un-dims the Audience tab (there IS something behind it)", () => {
    render(
      <AmbientDetail
        template={template()}
        presentation="sheet"
        tabOrder={REPORT_TAB_ORDER}
        audienceSlot={<div data-testid="slot" />}
      />,
    );
    const audience = screen.getAllByRole("button").find((b) => b.textContent === "Audience")!;
    expect(audience.style.opacity).not.toBe("0.5");
  });

  it("renders no pager chip when the template carries no pager", () => {
    const { container } = render(<AmbientDetail template={template()} presentation="sheet" />);
    expect(container.querySelector('[data-testid="ambient-detail-pager"]')).toBeNull();
  });

  it("still renders the pager chip for a drill template that has one", () => {
    render(<AmbientDetail template={template({ pager: "hook 2 of 5" })} presentation="sheet" />);
    expect(screen.getByTestId("ambient-detail-pager")).toHaveTextContent("hook 2 of 5");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/audience-lens/v2/__tests__/ambient-detail-report-props.test.tsx`
Expected: FAIL — `REPORT_TAB_ORDER` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/components/audience-lens/v2/AmbientDetail.tsx`:

(a) At `:241-245`, export the type and add the report order:

```tsx
export type Tab = "brain" | "engagement" | "audience";

/** The order is load-bearing — see the file header. Changing it is a design decision, not a tidy-up. */
const TAB_ORDER = ["brain", "engagement", "audience"] as const;
/** The v8 verdict report's order (spec §2 + mock §6). Opt-in via `tabOrder`; the drill keeps
 *  TAB_ORDER, which twelve revisions settled and which is not reopened by this constant. */
export const REPORT_TAB_ORDER: readonly Tab[] = ["audience", "brain", "engagement"];
const TAB_LABEL: Record<Tab, string> = { brain: "Brain", engagement: "Engagement", audience: "Audience" };
```

(b) Add the two props to the signature (after `onApplyFix`):

```tsx
  tabOrder,
  audienceSlot,
}: {
  // …existing props unchanged…
  /** Tab order override. Omit for the drill's settled `brain · engagement · audience`; the v8
   *  verdict report passes REPORT_TAB_ORDER. */
  tabOrder?: readonly Tab[];
  /** Replaces the Audience page's <PopulationFrame> wholesale. The v8 report's personas-only
   *  grade has real voices and no Stage-2 projection, so it supplies its own honest frame rather
   *  than a synthesized aggregate. Omit ⇒ today's behaviour exactly. */
  audienceSlot?: React.ReactNode;
}) {
```

(c) In the body, after `engagementAvailable`:

```tsx
  // An audience slot IS the audience page — a host that supplies one has something real behind
  // the tab even when `population` is null.
  const audienceAvailable = !!audienceSlot || !!population;
  const order = tabOrder ?? TAB_ORDER;
  const [internalTab, setTab] = useState<Tab>(
    initialTab ??
      (order.find((t) =>
        t === "brain" ? brainAvailable : t === "engagement" ? engagementAvailable : audienceAvailable,
      ) ??
        order[0]!),
  );
```

(d) Replace `TAB_ORDER.map((t) => {` with `order.map((t) => {`, and the `dim` expression's audience arm:

```tsx
              const dim =
                (t === "brain" && !brainAvailable) ||
                (t === "engagement" && !engagementAvailable) ||
                (t === "audience" && !audienceAvailable);
```

(e) At `:394-402`, make the pager chip conditional and testable:

```tsx
          {pager ? (
            <span
              data-testid="ambient-detail-pager"
              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-[3px] text-[12px] font-medium tabular-nums"
              style={{ background: SURFACE.chip, color: TONE.faint }}
            >
              {onPrev ? <Step onClick={onPrev}>‹</Step> : null}
              {pager}
              {onNext ? <Step onClick={onNext}>›</Step> : null}
            </span>
          ) : (
            <span />
          )}
```

(f) In the audience branch at `:487`, prefer the slot:

```tsx
        ) : audienceSlot ? (
          audienceSlot
        ) : population ? (
          <PopulationFrame
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/audience-lens/v2/__tests__/ambient-detail-report-props.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Prove the existing mounts did not move**

Run: `npx vitest run src/components/audience-lens/v2/__tests__/`
Expected: PASS, same count as before this task. If `AmbientDetail`'s default `initialTab` resolution changed for any existing fixture, the `order.find(...)` fallback is wrong — it must reduce to `brainAvailable ? "brain" : engagementAvailable ? "engagement" : "audience"` when `tabOrder` is omitted.

- [ ] **Step 6: Commit**

```bash
git add src/components/audience-lens/v2/AmbientDetail.tsx src/components/audience-lens/v2/__tests__/ambient-detail-report-props.test.tsx
git commit -m "feat(report): AmbientDetail gains opt-in tabOrder + audienceSlot (drill unchanged)"
```

---

### Task 4: The report shell

Three presentations of one component. Mobile = bottom sheet over a scrim. Desktop unpinned = right overlay panel over a scrim. Desktop pinned = the same panel rendered into the layout's rail host, no scrim, page flows beside it. The host decides which by prop; the shell owns Esc, the scrim, the pin toggle and the body-scroll lock.

**Files:**
- Create: `src/components/app/home/v8/verdict-report.tsx`
- Test: `src/components/app/home/v8/__tests__/verdict-report.test.tsx`

**Interfaces:**
- Consumes: `AmbientDetail`, `REPORT_TAB_ORDER` (Task 3); `PersonaAudienceFrame` (Task 2); `personasToReportRead`, `buildPersonaReportTemplate` (Task 1); `buildDomainTemplate` from `@/lib/surfaces/ambient-v2-population`; `audienceToMeta` from `@/lib/surfaces/ambient-v2-audience-meta`.
- Produces:
  - `export interface ReportSubject { id: string; title: string; personas: ReactionPersona[]; population?: PopulationAggregate | null; stopPct?: number }`
  - `export function VerdictReport(props: { open: boolean; onClose: () => void; subject: ReportSubject | null; audience: Audience; variant: "sheet" | "panel"; pinned: boolean; onPinnedChange: (next: boolean) => void; pinHost?: HTMLElement | null; watching?: boolean; reducedMotion?: boolean; onSteer?: (steer: string) => void }): JSX.Element | null`

- [ ] **Step 1: Write the failing test**

Create `src/components/app/home/v8/__tests__/verdict-report.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VerdictReport, type ReportSubject } from "../verdict-report";
import type { Audience } from "@/lib/audience/audience-types";
import type { ReactionPersona } from "@/lib/tools/blocks";

const audience = {
  id: "aud-1",
  name: "Your people",
  platform: "tiktok",
  is_general: false,
  personas: [],
} as unknown as Audience;

function personas(stops: number, total = 10): ReactionPersona[] {
  return Array.from({ length: total }, (_, i) => ({
    archetype: `a${i}`,
    verdict: i < stops ? ("stop" as const) : ("scroll" as const),
    quote: i < stops ? `stopped ${i}` : `scrolled ${i}`,
  }));
}

const subject: ReportSubject = {
  id: "drop-1",
  title: "I sit 10 hours a day. Stretching didn't fix me — this did.",
  personas: personas(7),
};

function base(over: Partial<Parameters<typeof VerdictReport>[0]> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    subject,
    audience,
    variant: "sheet" as const,
    pinned: false,
    onPinnedChange: vi.fn(),
    reducedMotion: true,
    ...over,
  };
}

describe("VerdictReport", () => {
  it("renders nothing when closed", () => {
    render(<VerdictReport {...base({ open: false })} />);
    expect(screen.queryByTestId("verdict-report")).toBeNull();
  });

  it("mobile: a bottom sheet with the three tabs, Audience first", () => {
    render(<VerdictReport {...base()} />);
    const report = screen.getByTestId("verdict-report");
    expect(report.dataset.variant).toBe("sheet");
    const tabs = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") !== null);
    expect(tabs.map((t) => t.textContent)).toEqual(["Audience", "Brain", "Engagement"]);
  });

  it("reads the subject's CACHED personas — the verdict on screen is their real tally", () => {
    render(<VerdictReport {...base()} />);
    expect(screen.getByTestId("report-verdict")).toHaveTextContent("7/10");
  });

  it("Escape closes", () => {
    const onClose = vi.fn();
    render(<VerdictReport {...base({ onClose })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("the scrim closes on mobile", () => {
    const onClose = vi.fn();
    render(<VerdictReport {...base({ onClose })} />);
    fireEvent.click(screen.getByTestId("verdict-report-scrim"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("mobile offers no pin — a bottom sheet has no column to dock into", () => {
    render(<VerdictReport {...base()} />);
    expect(screen.queryByRole("button", { name: /pin the report/i })).toBeNull();
  });

  it("desktop's pin reports the flip up to the host", () => {
    const onPinnedChange = vi.fn();
    render(<VerdictReport {...base({ variant: "panel", onPinnedChange })} />);
    fireEvent.click(screen.getByRole("button", { name: /pin the report/i }));
    expect(onPinnedChange).toHaveBeenCalledWith(true);
  });

  it("pinned: no scrim, and it renders into the pin host", () => {
    const host = document.createElement("div");
    host.id = "pin-host";
    document.body.appendChild(host);
    render(<VerdictReport {...base({ variant: "panel", pinned: true, pinHost: host })} />);
    expect(screen.queryByTestId("verdict-report-scrim")).toBeNull();
    expect(host.querySelector('[data-testid="verdict-report"]')).not.toBeNull();
  });

  it("withholds the verdict while a run is in flight (the sealed-verdict law)", () => {
    render(<VerdictReport {...base({ subject: null, watching: true })} />);
    expect(screen.getByTestId("verdict-report")).toHaveTextContent(/watching/i);
    expect(screen.queryByTestId("report-verdict")).toBeNull();
  });

  it("no subject and no run: an honest empty, never a fabricated figure", () => {
    render(<VerdictReport {...base({ subject: null })} />);
    expect(screen.queryByTestId("report-verdict")).toBeNull();
    expect(screen.getByTestId("verdict-report")).toHaveTextContent(/nothing simulated yet/i);
  });

  it("spends no accent beyond nothing at all (locked)", () => {
    render(<VerdictReport {...base()} />);
    const html = screen.getByTestId("verdict-report").innerHTML;
    expect(html).not.toMatch(/bg-accent|text-accent/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/app/home/v8/__tests__/verdict-report.test.tsx`
Expected: FAIL — `Failed to resolve import "../verdict-report"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/app/home/v8/verdict-report.tsx`:

```tsx
"use client";

/**
 * VerdictReport — the v8 three-tab verdict report (Phase 3, spec §2 + mock §6/§10).
 *
 * One shell, three presentations:
 *   sheet          — mobile bottom sheet over a scrim
 *   panel          — desktop right overlay over a scrim
 *   panel + pinned — the same panel portaled into the layout's rail host; no scrim, the page
 *                    flows beside it. "The old always-on rail, reborn as a choice."
 *
 * TWO DATA GRADES, one shell. A subject that carries a Stage-2 `population` renders the shipped
 * drill (`buildDomainTemplate` → PopulationFrame + the reason-breakdown Brain). A subject with
 * only its ten cached personas — every DROP, by law: opening a drop's report READS its cache and
 * NEVER re-sims — renders the personas-only template plus <PersonaAudienceFrame>, with Brain and
 * Engagement honestly dimmed. Nothing is synthesized to fill an empty slot.
 *
 * The sealed-verdict law carries over: while a run is in flight the report shows the watcher and
 * withholds the number until it returns.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AmbientDetail, REPORT_TAB_ORDER, TONE } from "@/components/audience-lens/v2/AmbientDetail";
import { buildDomainTemplate } from "@/lib/surfaces/ambient-v2-population";
import { audienceToMeta } from "@/lib/surfaces/ambient-v2-audience-meta";
import { personasToReportRead, buildPersonaReportTemplate } from "@/lib/surfaces/v8-report";
import { PersonaAudienceFrame } from "./persona-audience-frame";
import type { Audience } from "@/lib/audience/audience-types";
import type { ReactionPersona } from "@/lib/tools/blocks";
import type { PopulationAggregate } from "@/lib/audience/population";

/** What the report is a report OF. `population` present ⇒ the full drill; absent ⇒ personas only. */
export interface ReportSubject {
  id: string;
  /** The hook / concept text the run was fired on. */
  title: string;
  personas: ReactionPersona[];
  population?: PopulationAggregate | null;
  /** The measured stop % when a fired run sealed one. Absent ⇒ derived from the personas. */
  stopPct?: number;
}

export function VerdictReport({
  open,
  onClose,
  subject,
  audience,
  variant,
  pinned,
  onPinnedChange,
  pinHost,
  watching = false,
  reducedMotion = false,
  onSteer,
}: {
  open: boolean;
  onClose: () => void;
  subject: ReportSubject | null;
  audience: Audience;
  variant: "sheet" | "panel";
  pinned: boolean;
  onPinnedChange: (next: boolean) => void;
  /** Where a PINNED panel docks (the layout's rail host). Null ⇒ the panel stays an overlay. */
  pinHost?: HTMLElement | null;
  watching?: boolean;
  reducedMotion?: boolean;
  /** A tab's fix action feeds the thread as a steer (spec §2). */
  onSteer?: (steer: string) => void;
}) {
  const docked = variant === "panel" && pinned && !!pinHost;

  useEffect(() => {
    if (!open || docked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    // A pinned panel is page furniture; only the overlay grades lock the body.
    if (variant === "sheet") document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, docked, variant, onClose]);

  if (!open || typeof document === "undefined") return null;

  const meta = audienceToMeta(audience);
  const read = subject ? personasToReportRead(subject.personas) : null;

  // The full drill when a Stage-2 projection exists; the personas-only template otherwise.
  const template =
    subject && subject.population
      ? buildDomainTemplate({
          pct: subject.stopPct ?? read!.stopPct,
          aggregate: subject.population,
          personas: subject.personas,
          calibratedFrom: meta.calibratedFrom,
          tier: meta.tier,
          conceptLabel: "",
          stimulusKey: subject.id,
          ...(subject.title.trim() ? { transcript: subject.title.trim() } : {}),
        })
      : subject && read
        ? buildPersonaReportTemplate({
            read,
            title: subject.title,
            audienceName: meta.name,
            calibratedFrom: meta.calibratedFrom,
          })
        : null;

  const body =
    watching && !subject ? (
      // The sealed watcher — the verdict is withheld until the run returns.
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <span className="text-[13px]" style={{ color: TONE.faint }}>
          watching…
        </span>
      </div>
    ) : template ? (
      <AmbientDetail
        template={template}
        presentation="sheet"
        tabOrder={REPORT_TAB_ORDER}
        reducedMotion={reducedMotion}
        {...(subject && !subject.population && read
          ? { audienceSlot: <PersonaAudienceFrame read={read} onSteer={onSteer} /> }
          : {})}
      />
    ) : (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <span className="max-w-[240px] text-[12px] leading-[1.5]" style={{ color: TONE.faint }}>
          Nothing simulated yet — open a card and simulate it, and the room's read lands here.
        </span>
      </div>
    );

  const chrome = (
    <div
      data-testid="verdict-report"
      data-variant={variant}
      data-pinned={pinned || undefined}
      role="dialog"
      aria-modal={docked ? undefined : "true"}
      aria-label="The verdict report"
      className={
        docked
          ? "flex min-h-0 w-full flex-1 flex-col"
          : variant === "sheet"
            ? "fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex max-h-[88vh] min-h-0 flex-col overflow-hidden rounded-t-[20px] border-t border-white/[0.06]"
            : "fixed right-0 top-0 z-[var(--z-modal)] flex h-full min-h-0 w-[400px] flex-col overflow-hidden border-l border-white/[0.06]"
      }
      style={{
        background: "#181817",
        ...(docked || variant === "panel" ? {} : { paddingBottom: "env(safe-area-inset-bottom)" }),
      }}
    >
      <div className="flex items-center justify-between px-[22px] pt-3">
        {variant === "sheet" ? (
          <span aria-hidden className="mx-auto h-1 w-9 rounded-full bg-white/[0.14]" />
        ) : (
          <>
            <span className="text-[12.5px] font-semibold" style={{ color: TONE.dim }}>
              Report
            </span>
            <span className="flex items-center gap-3">
              <button
                type="button"
                aria-label={pinned ? "Unpin the report" : "Pin the report"}
                aria-pressed={pinned}
                onClick={() => onPinnedChange(!pinned)}
                className="text-[12px] transition-colors"
                style={{ color: pinned ? TONE.cream : TONE.faint }}
              >
                {pinned ? "pinned" : "pin"}
              </button>
              <button
                type="button"
                aria-label="Close the report"
                onClick={onClose}
                className="text-[13px] transition-colors"
                style={{ color: TONE.faint }}
              >
                ✕
              </button>
            </span>
          </>
        )}
      </div>
      {body}
    </div>
  );

  if (docked) return createPortal(chrome, pinHost!);

  return createPortal(
    <>
      <div
        data-testid="verdict-report-scrim"
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-[var(--z-modal)]"
        style={{ background: "rgba(10,10,10,.55)" }}
      />
      {chrome}
    </>,
    document.body,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/app/home/v8/__tests__/verdict-report.test.tsx`
Expected: PASS (10 tests).

If `TONE` is not exported from `AmbientDetail`, it is (`:96`). If `--z-modal` is missing, grep `globals.css` for the modal z token and use the one that exists.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/home/v8/verdict-report.tsx src/components/app/home/v8/__tests__/verdict-report.test.tsx
git commit -m "feat(report): the three-tab verdict report shell — sheet, overlay, pinnable panel"
```

---

### Task 5: Fire-on-demand — the pure helpers and the hook

The rail's `fireSim` (`AmbientOverviewRail.tsx:351-451`) is the shipped implementation of the sealed-verdict law over `/api/tools/react`. Phase 3 needs it OUTSIDE the rail, and the rail must not be touched (flag-off byte-identical, and it is being retired anyway). So: a new self-contained hook whose pure parts are separately testable. **The temporary duplication is deliberate and ends when the rail is deleted** — say so in the file header.

**Files:**
- Create: `src/components/app/home/v8/fire-sim.ts`, `src/components/app/home/v8/use-fire-sim.ts`
- Test: `src/components/app/home/v8/__tests__/fire-sim.test.ts`, `src/components/app/home/v8/__tests__/use-fire-sim.test.tsx`

**Interfaces:**
- Produces:
  - `interface ReportSnapshot { stopPct: number; personas: ReactionPersona[]; population: PopulationAggregate | null }`
  - `function fractionToStopPct(fraction: string): number | null`
  - `function reactRequestBody(input: { text: string; kind?: string }): Record<string, unknown>`
  - `function reactResponseToSnapshot(data: unknown): ReportSnapshot | null`
  - `function useFireSim(): { watching: boolean; snapshots: Record<string, ReportSnapshot>; fireSim: (id: string, text: string, kind?: string) => Promise<void> }`

- [ ] **Step 1: Write the failing test for the pure helpers**

Create `src/components/app/home/v8/__tests__/fire-sim.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fractionToStopPct, reactRequestBody, reactResponseToSnapshot } from "../fire-sim";

describe("fractionToStopPct", () => {
  it("parses the engine's honest fraction", () => {
    expect(fractionToStopPct("7/10 stop")).toBe(70);
    expect(fractionToStopPct("3 / 10")).toBe(30);
  });
  it("refuses to seal on a malformed fraction (never fabricates a %)", () => {
    expect(fractionToStopPct("")).toBeNull();
    expect(fractionToStopPct("strong")).toBeNull();
    expect(fractionToStopPct("7/0")).toBeNull();
  });
});

describe("reactRequestBody", () => {
  it("pins and persists a deliberate report run", () => {
    expect(reactRequestBody({ text: "a hook" })).toEqual({ text: "a hook", pin: true, persist: true });
  });
  it("carries the framing when the card kind implies one", () => {
    expect(reactRequestBody({ text: "x", kind: "idea" })).toMatchObject({ framing: "idea" });
    expect(reactRequestBody({ text: "x", kind: "hook" })).toMatchObject({ framing: "hook" });
    expect(reactRequestBody({ text: "x", kind: "remix" })).not.toHaveProperty("framing");
  });
  it("sends NO platform — the Flash sim is platform-blind", () => {
    expect(reactRequestBody({ text: "x" })).not.toHaveProperty("platform");
    expect(reactRequestBody({ text: "x" })).not.toHaveProperty("lens");
  });
});

describe("reactResponseToSnapshot", () => {
  it("maps a real response", () => {
    const snap = reactResponseToSnapshot({
      fraction: "8/10 stop",
      personas: [{ archetype: "a", verdict: "stop", quote: "yes" }],
      population: null,
    });
    expect(snap).toEqual({
      stopPct: 80,
      personas: [{ archetype: "a", verdict: "stop", quote: "yes" }],
      population: null,
    });
  });
  it("returns null when the fraction cannot be parsed — the card stays honestly unsimulated", () => {
    expect(reactResponseToSnapshot({ fraction: "??", personas: [] })).toBeNull();
    expect(reactResponseToSnapshot(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/app/home/v8/__tests__/fire-sim.test.ts`
Expected: FAIL — `Failed to resolve import "../fire-sim"`.

- [ ] **Step 3: Write the pure helpers**

Create `src/components/app/home/v8/fire-sim.ts`:

```ts
/**
 * fire-sim — the PURE half of the v8 report's fire-on-demand sim.
 *
 * ⚠️ This intentionally MIRRORS `AmbientOverviewRail`'s shipped fireSim rather than importing
 * from it: the rail is retiring under CONCEPT_V8_ENABLED and must stay byte-identical while the
 * flag is off, so it is not refactored on the way out. Delete this note (and reconcile) when the
 * rail is deleted for good.
 *
 * The report NEVER sends a platform or a lens: the Flash SIM is platform-blind
 * (`buildReactionPanel` has no platform), so a lens on the wire would imply the verdict moved
 * with it. It does not.
 */

import type { ReactionPersona } from "@/lib/tools/blocks";
import type { PopulationAggregate } from "@/lib/audience/population";

export interface ReportSnapshot {
  stopPct: number;
  personas: ReactionPersona[];
  population: PopulationAggregate | null;
}

/** Parse aggregateFlash's honest "N/10 stop" → a 0–100 stop %. Unparseable ⇒ null: we NEVER seal
 *  a row from a malformed fraction. */
export function fractionToStopPct(fraction: string): number | null {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(fraction ?? "");
  if (!m) return null;
  const n = Number(m[1]);
  const d = Number(m[2]);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((n / d) * 100)));
}

/** The Flash framing a card's kind implies — a hook's read is first-2s, an idea's is "would they
 *  want it". Anything else takes the route's default. */
function framingOf(kind?: string): "hook" | "idea" | undefined {
  if (kind === "hook") return "hook";
  if (kind === "idea") return "idea";
  return undefined;
}

export function reactRequestBody(input: { text: string; kind?: string }): Record<string, unknown> {
  const framing = framingOf(input.kind);
  // pin: the flywheel's predicted vector. persist: the seal survives reload.
  return { text: input.text, pin: true, persist: true, ...(framing ? { framing } : {}) };
}

export function reactResponseToSnapshot(data: unknown): ReportSnapshot | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { fraction?: string; personas?: ReactionPersona[]; population?: PopulationAggregate | null };
  const stopPct = fractionToStopPct(d.fraction ?? "");
  if (stopPct === null) return null;
  return { stopPct, personas: d.personas ?? [], population: d.population ?? null };
}
```

- [ ] **Step 4: Run the pure tests**

Run: `npx vitest run src/components/app/home/v8/__tests__/fire-sim.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the failing hook test**

Create `src/components/app/home/v8/__tests__/use-fire-sim.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFireSim } from "../use-fire-sim";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("useFireSim", () => {
  it("fires one real reaction and seals the snapshot", async () => {
    const fetchMock = stubFetch({
      fraction: "8/10 stop",
      personas: [{ archetype: "a", verdict: "stop", quote: "yes" }],
      population: null,
    });
    const { result } = renderHook(() => useFireSim());
    await act(async () => {
      await result.current.fireSim("card-1", "a hook", "hook");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/tools/react");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({ text: "a hook", framing: "hook" });
    expect(result.current.snapshots["card-1"]!.stopPct).toBe(80);
    expect(result.current.watching).toBe(false);
  });

  it("IGNORES a second fire while one is in flight — the debounce that protects credits", async () => {
    let release!: (v: unknown) => void;
    const gate = new Promise((r) => (release = r));
    const fetchMock = vi.fn().mockImplementation(async () => {
      await gate;
      return { ok: true, json: async () => ({ fraction: "5/10 stop", personas: [] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useFireSim());
    act(() => {
      void result.current.fireSim("card-1", "a hook");
      void result.current.fireSim("card-2", "another hook");
    });
    await waitFor(() => expect(result.current.watching).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      release(null);
      await Promise.resolve();
    });
  });

  it("never fires on empty text", async () => {
    const fetchMock = stubFetch({});
    const { result } = renderHook(() => useFireSim());
    await act(async () => {
      await result.current.fireSim("card-1", "   ");
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a refused run seals NOTHING and clears the watcher", async () => {
    stubFetch({ error: "insufficient_credits" }, false);
    const { result } = renderHook(() => useFireSim());
    await act(async () => {
      await result.current.fireSim("card-1", "a hook");
    });
    expect(result.current.snapshots["card-1"]).toBeUndefined();
    expect(result.current.watching).toBe(false);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/components/app/home/v8/__tests__/use-fire-sim.test.tsx`
Expected: FAIL — `Failed to resolve import "../use-fire-sim"`.

- [ ] **Step 7: Write the hook**

Create `src/components/app/home/v8/use-fire-sim.ts`:

```ts
"use client";

/**
 * useFireSim — the v8 report's fire-on-demand sim (Phase 3).
 *
 * THE LAW (SSOT §1, spec v8 block): generation NEVER auto-simulates. This hook fires only from a
 * deliberate act — a card's Simulate action — and exactly ONE run may be in flight at a time:
 * a second tap while watching is DROPPED, not queued. Every room reaction costs credits, so the
 * in-flight guard IS the debounce.
 *
 * Reuses the shipped `/api/tools/react` primitive (same engine every card already uses; resolves
 * the audience SERVER-side off the open thread). The sealed-verdict beat lives in `watching`:
 * the verdict is withheld while true and lands with the snapshot.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { reportCredit402 } from "@/lib/billing/credit-wall";
import { reportSession401 } from "@/lib/auth/session-expired";
import { reactRequestBody, reactResponseToSnapshot, type ReportSnapshot } from "./fire-sim";

export function useFireSim(): {
  watching: boolean;
  snapshots: Record<string, ReportSnapshot>;
  fireSim: (id: string, text: string, kind?: string) => Promise<void>;
} {
  const [snapshots, setSnapshots] = useState<Record<string, ReportSnapshot>>({});
  const [watching, setWatching] = useState(false);
  const inflightRef = useRef<AbortController | null>(null);
  useEffect(() => () => inflightRef.current?.abort(), []);

  const fireSim = useCallback(async (id: string, text: string, kind?: string) => {
    const stimulus = text.trim();
    if (stimulus.length === 0) return;
    // One run at a time. A second tap while watching is DROPPED — never a second billed call.
    if (inflightRef.current) return;

    const controller = new AbortController();
    inflightRef.current = controller;
    setWatching(true);
    try {
      const res = await fetch("/api/tools/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reactRequestBody({ text: stimulus, ...(kind ? { kind } : {}) })),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        reportSession401(res.status);
        reportCredit402(res.status, err);
        return;
      }
      const snap = reactResponseToSnapshot(await res.json());
      if (controller.signal.aborted || !snap) return;
      setSnapshots((prev) => ({ ...prev, [id]: snap }));
    } catch {
      // Aborted or failed → no seal. An unsimulated card is the honest resting state.
    } finally {
      if (inflightRef.current === controller) {
        inflightRef.current = null;
        setWatching(false);
      }
    }
  }, []);

  return { watching, snapshots, fireSim };
}
```

- [ ] **Step 8: Run the hook tests**

Run: `npx vitest run src/components/app/home/v8/__tests__/use-fire-sim.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add src/components/app/home/v8/fire-sim.ts src/components/app/home/v8/use-fire-sim.ts src/components/app/home/v8/__tests__/fire-sim.test.ts src/components/app/home/v8/__tests__/use-fire-sim.test.tsx
git commit -m "feat(report): fire-on-demand sim hook — one run in flight, sealed verdict, platform-blind"
```

---

### Task 6: The drop card's meter becomes the door

Phase 2 shipped the meter as display-only. It becomes a button. **It opens the report on the card's CACHED personas — it must never trigger a sim.**

**Files:**
- Modify: `src/components/app/home/v8/drop-shelf.tsx:20-26` (props), `:108-130` (the meter)
- Test: `src/components/app/home/v8/__tests__/drop-shelf.test.tsx` (extend)

**Interfaces:**
- Consumes: `LiveDropCard`.
- Produces: `DropShelfProps` gains `onOpenReport: (card: LiveDropCard) => void`.

- [ ] **Step 1: Write the failing test**

Append to `src/components/app/home/v8/__tests__/drop-shelf.test.tsx` inside `describe("DropShelf")`:

```tsx
  it("the meter is the report's door — it hands over the card's CACHED personas", () => {
    const onOpenReport = vi.fn();
    render(
      <DropShelf cards={[card()]} status="ready" onRemix={() => {}} onOpenReport={onOpenReport} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /8 of 10 stopped/i }));
    expect(onOpenReport).toHaveBeenCalledTimes(1);
    expect(onOpenReport.mock.calls[0]![0].personas).toHaveLength(10);
  });

  it("opening the report never fires a network call (drops read the cache, never re-sim)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<DropShelf cards={[card()]} status="ready" onRemix={() => {}} onOpenReport={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /8 of 10 stopped/i }));
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
```

Update every existing `render(<DropShelf …/>)` in the file to pass `onOpenReport={() => {}}`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/app/home/v8/__tests__/drop-shelf.test.tsx`
Expected: FAIL — no button with that accessible name (the meter is a `<span>`).

- [ ] **Step 3: Write minimal implementation**

In `drop-shelf.tsx`, add to `DropShelfProps`:

```tsx
  /** The meter's door — opens the verdict report on this card's CACHED personas.
   *  ⚠️ Reads the cache; never re-sims (fire-on-demand law, SSOT §1). */
  onOpenReport: (card: LiveDropCard) => void;
```

Thread it through `DropShelf` → `DropCard` (`onOpenReport` on both signatures, passed on the `<DropCard>` element), and replace the meter `<span>` with:

```tsx
          <button
            type="button"
            data-testid={`drop-meter-${card.contentId}`}
            aria-label={`${face.stop} of 10 stopped — open the report`}
            onClick={() => onOpenReport(card)}
            className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]"
          >
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
          </button>
```

Update the file header: the meter is no longer "display-only until Phase 3" — it is the report's door.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/app/home/v8/__tests__/drop-shelf.test.tsx`
Expected: PASS — all prior assertions plus the two new ones. The existing `drop-meter-t1` `toHaveTextContent("8/10")` assertion still holds.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/home/v8/drop-shelf.tsx src/components/app/home/v8/__tests__/drop-shelf.test.tsx
git commit -m "feat(shelf): the drop meter opens the report on cached personas — never a re-sim"
```

---

### Task 7: Composer wiring — the report replaces the room overlay

The sub-bar's "Simulate ›" and the drop meters both land here. `RoomOverlay` is deleted; `roomExpanded` now drives `VerdictReport`.

**Files:**
- Modify: `src/components/app/home/composer.tsx:104` (import), `:3564-3579` (the mount), plus new state near `:528`
- Modify: `src/components/app/home/v8/sub-bar.tsx:99-162` (delete `RoomOverlay`)
- Test: `src/components/app/home/v8/__tests__/sub-bar.test.tsx` (drop the `RoomOverlay` cases if present), `src/components/app/home/__tests__/composer-v8.test.tsx` (extend — this is the established harness)

**Interfaces:**
- Consumes: `VerdictReport`, `ReportSubject` (Task 4); `useFireSim` (Task 5); `DropShelf.onOpenReport` (Task 6).
- Produces: composer-internal `reportOpen`, `reportSubject`, `reportPinned`, `openReportForDrop(card)`.

- [ ] **Step 1: Write the failing test**

First widen the harness's `DROP_CARD` fixture (`composer-v8.test.tsx:~80`) so its meter carries a real tally — replace its single-persona `personas` with ten:

```tsx
  personas: Array.from({ length: 10 }, (_, i) => ({
    archetype: `a${i}`,
    verdict: i < 8 ? ("stop" as const) : ("scroll" as const),
    quote: i < 8 ? `stopped ${i}` : `scrolled ${i}`,
  })),
```

Then append to `describe("composer v8 (flag on)")` in `src/components/app/home/__tests__/composer-v8.test.tsx`:

```tsx
  it("the sub-bar's Simulate door opens the report", async () => {
    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByRole("button", { name: /open the simulation room/i }));
    expect(await screen.findByTestId("verdict-report")).toBeInTheDocument();
  });

  it("with nothing simulated, the report is honestly empty — no figure", async () => {
    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByRole("button", { name: /open the simulation room/i }));
    expect(await screen.findByTestId("verdict-report")).toHaveTextContent(/nothing simulated yet/i);
    expect(screen.queryByTestId("report-verdict")).toBeNull();
  });

  it("a drop's meter opens the report on that drop's own cached read", async () => {
    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByRole("button", { name: /8 of 10 stopped/i }));
    expect(await screen.findByTestId("report-verdict")).toHaveTextContent("8/10");
  });

  it("opening a drop's report fires NO sim (fire-on-demand law)", async () => {
    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByRole("button", { name: /8 of 10 stopped/i }));
    await screen.findByTestId("report-verdict");
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes("/api/tools/react"))).toBe(false);
  });

  it("the v8 room overlay is gone — the report is the room now", async () => {
    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByRole("button", { name: /open the simulation room/i }));
    await screen.findByTestId("verdict-report");
    expect(screen.queryByTestId("v8-room-overlay")).toBeNull();
  });

  it("mobile renders the report as a sheet (the harness matchMedia is <xl)", async () => {
    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByRole("button", { name: /8 of 10 stopped/i }));
    expect((await screen.findByTestId("verdict-report")).dataset.variant).toBe("sheet");
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/app/home/__tests__/composer-v8.test.tsx`
Expected: FAIL — `verdict-report` never renders (the composer still mounts `RoomOverlay`).

- [ ] **Step 3: Write minimal implementation**

(a) In `composer.tsx:104`, replace the import:

```tsx
import { ComposerSubBar } from "./v8/sub-bar";
import { VerdictReport, type ReportSubject } from "./v8/verdict-report";
import { useFireSim } from "./v8/use-fire-sim";
```

(b) Near the other v8 state (`:528`):

```tsx
  // ── v8 report (Phase 3) ────────────────────────────────────────────────────
  // `roomExpanded` remains the open flag (the sub-bar door and a card's "See the room →" both
  // set it); the SUBJECT is what the report is a report of. Null ⇒ the honest empty state.
  const [reportSubject, setReportSubject] = useState<ReportSubject | null>(null);
  const [reportPinned, setReportPinned] = useState(false);
  const { watching: simWatching, snapshots: simSnapshots, fireSim: fireCardSim } = useFireSim();

  // A drop's meter → its CACHED read. This path never touches the network (SSOT §1).
  const openReportForDrop = useCallback((card: LiveDropCard) => {
    setReportSubject({ id: card.contentId, title: card.hook, personas: card.personas });
    setRoomExpanded(true);
  }, []);
```

(c) Pass `onOpenReport={openReportForDrop}` to both `<DropShelf>` mounts (`:3738`, `:3827`).

(d) Replace the `RoomOverlay` mount (`:3568-3579`) with:

```tsx
          <VerdictReport
            open={roomExpanded}
            onClose={() => handleRoomExpandedChange(false)}
            subject={reportSubject}
            audience={effectiveAudience}
            variant={isXl ? "panel" : "sheet"}
            pinned={reportPinned}
            onPinnedChange={setReportPinned}
            pinHost={railHost}
            watching={simWatching}
            reducedMotion={reducedMotion}
            onSteer={(steer) => {
              // The fix feeds the thread as a steer: it lands in the FIELD, it does not send.
              // Fire-on-demand means the user still presses the button.
              setUrl(steer);
              handleRoomExpandedChange(false);
            }}
          />
```

`setUrl` is the field's real setter (`composer.tsx:808` — `const [url, setUrl] = useState("")`, a legacy name for the composer textarea's value).

(e) Delete `RoomOverlay` from `v8/sub-bar.tsx` (the whole export plus the now-unused `useEffect`, `createPortal`, `AmbientOverviewRail`, `AmbientCardDescriptor`, `WireSimSealMap` imports). Update the file header: the room is `VerdictReport` now.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/app/home/__tests__/composer-v8.test.tsx src/components/app/home/v8/__tests__/sub-bar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Prove the flag is still inert**

Run: `npx vitest run src/components/app/home/__tests__/`
Expected: PASS at the pre-task count. Any composer test that asserted `v8-room-overlay` must be updated to `verdict-report` — a rename, not a behaviour change.

- [ ] **Step 6: Commit**

```bash
git add src/components/app/home/composer.tsx src/components/app/home/v8/sub-bar.tsx src/components/app/home/v8/drop-shelf.tsx src/components/app/home/__tests__/composer-v8.test.tsx src/components/app/home/v8/__tests__/sub-bar.test.tsx
git commit -m "feat(report): the report replaces the v8 room overlay; drop meters and the sub-bar door open it"
```

---

### Task 8: Thread cards — meter opens the report, Simulate fires on demand

`openRoomForCard(conceptText, cardId)` (`composer.tsx:2406`) is the shipped door from every Make card's `SimDoor`. Under v8 it routes to the report: a card that has been simulated opens on its snapshot; a card that has NOT is the fire-on-demand path.

**Files:**
- Modify: `src/components/app/home/composer.tsx:2406-2419`
- Test: `src/components/app/home/__tests__/composer-v8.test.tsx` (extend)

**Interfaces:**
- Consumes: `resolveFocusDescriptor`, `ambientDescriptors`, `persistedSimSeals`, `simSnapshots`, `fireCardSim`.

- [ ] **Step 1: Write the failing test**

First give the harness a thread that actually holds a card. Add above `installFetchMock` in `composer-v8.test.tsx`:

```tsx
import { dropCardToRemixBlocks } from "@/lib/surfaces/drop-seed";

/** A thread carrying the SAME remix-card stack the Phase-2 seed route writes. Built by the real
 *  pure producer — never hand-authored props, which would drift from the block schema. */
function seededThread() {
  return {
    threadId: "t1",
    messages: [
      {
        id: "m1",
        thread_id: "t1",
        role: "assistant" as const,
        blocks: dropCardToRemixBlocks({ ...DROP_CARD, concepts: [ADAPT_CONCEPT] }, "Your people"),
        created_at: "2026-08-09T00:00:00.000Z",
      },
    ],
    simSeals: {},
  };
}
```

`ADAPT_CONCEPT` must satisfy `AdaptConcept` — read `src/lib/engine/remix/decode-types.ts` for the exact fields and author one valid concept (`hook`, `angle`, `who_its_for`, `format_borrowed`, `personaStops`). If `dropCardToRemixBlocks` returns `[]`, the concept failed `safeParse` — fix the fixture, do not pad it.

Add a `threadSeeded` switch to `installFetchMock` so a test can opt in:

```tsx
let threadFixture: unknown = { threadId: "t1", messages: [] };
// …inside installFetchMock:
    else if (url.includes("/api/threads/open")) body = threadFixture;
```

with `beforeEach` resetting `threadFixture = { threadId: "t1", messages: [] }`.

Then append the cases:

```tsx
  it("an UNSIMULATED card's door fires the sim and shows the sealed watcher", async () => {
    threadFixture = seededThread();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/tools/react"))
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              fraction: "6/10 stop",
              personas: Array.from({ length: 10 }, (_, i) => ({
                archetype: `a${i}`,
                verdict: i < 6 ? "stop" : "scroll",
                quote: `v${i}`,
              })),
              population: null,
            }),
        } as Response);
      if (url.includes("/api/audiences"))
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ audiences: [SOCIALS_AUD] }) } as Response);
      if (url.includes("/api/threads/open"))
        return Promise.resolve({ ok: true, json: () => Promise.resolve(threadFixture) } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });

    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByRole("button", { name: /simulate with your audience/i }));
    expect(await screen.findByTestId("verdict-report")).toHaveTextContent(/watching/i);
    await waitFor(() => expect(screen.getByTestId("report-verdict")).toHaveTextContent("6/10"));
  });

  it("a second tap while watching does NOT fire a second billed call", async () => {
    threadFixture = seededThread();
    renderWithClient(<Composer />);
    const door = await screen.findByRole("button", { name: /simulate with your audience/i });
    fireEvent.click(door);
    fireEvent.click(door);
    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
        String(c[0]).includes("/api/tools/react"),
      );
      expect(calls).toHaveLength(1);
    });
  });
```

- [ ] **Step 1b: Add the already-simulated case**

```tsx
  it("an ALREADY-simulated card re-opens its snapshot without firing again", async () => {
    threadFixture = seededThread();
    renderWithClient(<Composer />);
    fireEvent.click(await screen.findByRole("button", { name: /simulate with your audience/i }));
    await waitFor(() => expect(screen.getByTestId("report-verdict")).toBeInTheDocument());
    const before = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
      String(c[0]).includes("/api/tools/react"),
    ).length;
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: /see your audience/i }));
    await screen.findByTestId("report-verdict");
    expect(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
        String(c[0]).includes("/api/tools/react"),
      ),
    ).toHaveLength(before);
  });
```

The card's door label flips from "Simulate with your audience →" to "See your audience →" once a seal exists (`sim-door.tsx:165` vs `:205`) — that flip is itself the assertion that the sealed state reached the card.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/app/home/__tests__/composer-v8.test.tsx`
Expected: FAIL — the card door still blooms the old room, no `verdict-report`.

- [ ] **Step 3: Write minimal implementation**

Replace `openRoomForCard`'s body (`composer.tsx:2406-2419`):

```tsx
  const openRoomForCard = useCallback(
    (conceptText: string, cardId?: string | null): boolean => {
      // Resolve by the card's LEDGER id first (dup-concept safe), falling back to concept text —
      // matching text alone opened the FIRST of two identical concepts (family of #306).
      const d = resolveFocusDescriptor(ambientDescriptors, conceptText, cardId);
      if (!d) return false;

      if (CONCEPT_V8_ENABLED) {
        // v8: the card's door opens THE REPORT. A card already simulated this session opens on
        // its snapshot; a persisted seal re-opens after reload; an unsimulated card is the
        // fire-on-demand path — one deliberate act, one billed run (the hook drops re-taps).
        const snap = simSnapshots[d.id];
        const seal = persistedSimSeals?.[d.conceptText.trim()];
        const sealed = seal && !isSealedSimSeal(seal) ? seal : null;
        if (snap) {
          setReportSubject({
            id: d.id,
            title: d.conceptText,
            personas: snap.personas,
            population: snap.population,
            stopPct: snap.stopPct,
          });
        } else if (sealed) {
          setReportSubject({
            id: d.id,
            title: d.conceptText,
            personas: sealed.personas ?? [],
            population: sealed.population ?? null,
            stopPct: sealed.pct,
          });
        } else {
          setReportSubject(null);
          void fireCardSim(d.id, d.conceptText, d.kind);
        }
        setRoomExpanded(true);
        return true;
      }

      setRoomDrill(true);
      focusByTap(d.id);
      // Visual expand only (dock/header) — drilling into a card's read never arms the ask verb.
      setRoomExpanded(true);
      return true;
    },
    [ambientDescriptors, focusByTap, simSnapshots, persistedSimSeals, fireCardSim],
  );
```

Then, so a fired run lands in the open report, add after the state block:

```tsx
  // A fired run seals into `simSnapshots`; promote it into the open report. Keyed on the
  // snapshot itself, so the reveal happens exactly once per run (the sealed-verdict beat).
  const pendingSimIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = pendingSimIdRef.current;
    if (!id) return;
    const snap = simSnapshots[id];
    if (!snap) return;
    pendingSimIdRef.current = null;
    const d = ambientDescriptors.find((x) => x.id === id);
    setReportSubject({
      id,
      title: d?.conceptText ?? "",
      personas: snap.personas,
      population: snap.population,
      stopPct: snap.stopPct,
    });
  }, [simSnapshots, ambientDescriptors]);
```

and set `pendingSimIdRef.current = d.id;` immediately before the `void fireCardSim(...)` call.

`isSealedSimSeal` is already imported in composer scope — confirm with `grep -n "isSealedSimSeal" src/components/app/home/composer.tsx`; if absent, import it from `@/lib/onboarding/verdict-seal`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/app/home/__tests__/composer-v8.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/app/home/composer.tsx src/components/app/home/__tests__/composer-v8.test.tsx
git commit -m "feat(report): thread cards open the report; an unsimulated card fires one on-demand run"
```

---

### Task 9: Desktop pinning and the rail's retirement

The pinned report docks in the layout's right `<aside>` — the retiring rail's own column. That aside only mounts in thread mode today, so a report pinned from the arrival needs it too. Under `CONCEPT_V8_ENABLED` the aside stops hosting `AmbientOverviewRail`; with the flag off, everything here is unchanged.

**Files:**
- Modify: `src/components/app/home/home-page-layout.tsx:22-35` (state), `:114-135` (aside condition + new prop)
- Modify: `src/components/app/home/composer.tsx:315-318` (props), `:3459-3463` (the portal)
- Test: `src/components/app/home/__tests__/home-page-layout.test.tsx` (extend)

**Interfaces:**
- Produces: `ComposerProps` gains `onReportPinnedChange?: (next: boolean) => void`.

- [ ] **Step 1: Write the failing test**

Append to `src/components/app/home/__tests__/home-page-layout.test.tsx`:

```tsx
  it("mounts the right rail when the report is pinned, even with no thread", () => {
    render(<HomePageLayout />);
    expect(screen.queryByRole("complementary", { name: /your audience/i })).toBeNull();
    act(() => capturedProps.onReportPinnedChange!(true));
    expect(screen.getByRole("complementary", { name: /your audience/i })).toBeInTheDocument();
  });

  it("unpinning takes the rail away again", () => {
    render(<HomePageLayout />);
    act(() => capturedProps.onReportPinnedChange!(true));
    act(() => capturedProps.onReportPinnedChange!(false));
    expect(screen.queryByRole("complementary", { name: /your audience/i })).toBeNull();
  });
```

Read the file's existing `vi.mock("../composer", …)` harness first and capture props through the same mechanism it already uses; if it has none, mock `Composer` to record its props into a module-scoped `capturedProps`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/app/home/__tests__/home-page-layout.test.tsx`
Expected: FAIL — `onReportPinnedChange` is undefined.

- [ ] **Step 3: Write minimal implementation**

(a) `home-page-layout.tsx` — add state, handler, and widen the aside condition:

```tsx
  // v8 (Phase 3): a PINNED verdict report docks in the same right column the retiring rail used.
  // It may be pinned from the ARRIVAL (no thread), so the aside mounts for it too.
  const [reportPinned, setReportPinned] = useState(false);
  const handleReportPinnedChange = useCallback((next: boolean) => {
    setReportPinned(next);
  }, []);
```

Pass `onReportPinnedChange={handleReportPinnedChange}` to `<Composer>`, and change `{threadMode && (` to `{(threadMode || reportPinned) && (`.

(b) `composer.tsx` — add the prop:

```tsx
  railHost?: HTMLElement | null;
  /** v8: the composer owns the report's pinned state; the layout owns the column it docks in. */
  onReportPinnedChange?: (next: boolean) => void;
}

export function Composer({ className, onThreadChange, onEngagedChange, onConversationChange, onRehydratingChange, railHost = null, onReportPinnedChange }: ComposerProps) {
```

Report the change up whenever it flips:

```tsx
  useEffect(() => {
    onReportPinnedChange?.(reportPinned);
  }, [reportPinned, onReportPinnedChange]);
```

(c) Retire the rail under the flag (`:3459-3463`):

```tsx
      {/* v8 (Phase 3): AmbientOverviewRail RETIRES — the persistent rail becomes a choice. The
          column now hosts the PINNED report (VerdictReport portals itself into `railHost`), and
          nothing at all when it is unpinned. Flag off ⇒ the rail portal is untouched. */}
      {CONCEPT_V8_ENABLED
        ? null
        : useRail && railHost
          ? createPortal(AMBIENT_V2_ENABLED ? audienceRailV2 : audienceRail, railHost)
          : useHeader || !roomExpanded
            ? null
            : audiencePresence}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/app/home/__tests__/home-page-layout.test.tsx`
Expected: PASS.

- [ ] **Step 5: Prove the retirement is flag-scoped**

Run: `npx vitest run src/components/app/home/ src/components/audience-lens/`
Expected: PASS at the pre-task count. `AmbientOverviewRail` stays imported and mounted with the flag off; no rail test may change.

- [ ] **Step 6: Commit**

```bash
git add src/components/app/home/home-page-layout.tsx src/components/app/home/composer.tsx src/components/app/home/__tests__/home-page-layout.test.tsx
git commit -m "feat(report): desktop pinning docks the report in the retiring rail's column (v8 only)"
```

---

### Task 10: Gates, flag-off proof, and signed-in browser verification

Nothing here is complete until it has been seen in a real browser. The e2e user is a **REAL PROD account**: render and open only. Do not fire a sim against it — Task 8's fire path is proven by its tests and by a flag-on **local** account if one is available; if it is not, say so explicitly in the report rather than firing.

**Files:**
- Create: scratchpad probe scripts (outside the repo — the Write tool is worktree-guarded, so write these with a Bash heredoc).

- [ ] **Step 1: Run the three gates**

```bash
node node_modules/typescript/bin/tsc --noEmit
npm run build
set -o pipefail; npx vitest run 2>&1 | tail -40
```

Expected: tsc clean · build clean · vitest with **exactly one** failure, `routing-cut.test.ts` (the pre-existing `/start` baseline). Any second failure is yours.

- [ ] **Step 2: Prove flag-off is byte-identical**

```bash
lsof -ti:3007 || true
NEXT_PUBLIC_CONCEPT_V8=false npm run dev -- --port 3007
```

With the auth cookie set (see Step 3), load `/home` and confirm: the ≥xl rail renders `AmbientOverviewRail`, no `verdict-report` node exists, and the drop shelf is absent. Assert in the page, not by eye:

```js
document.querySelector('[data-testid="verdict-report"]') === null &&
document.querySelector('[data-testid="drop-shelf"]') === null
```

- [ ] **Step 3: Mint auth and probe signed-in at both sizes**

Rewrite the Phase-2 probe scripts (~5 min each; the originals are in the previous session's scratchpad, which may be gone):
- `mint-auth.mjs` — POST the Supabase auth REST endpoint with the e2e credentials, write the chunked cookie into a Playwright `storage-state.json`. Recipe: memory `signed-in-verification-recipe.md`; credentials: `e2e-auth-state-is-dead.md`.
- `shoot-report.mjs` — **one browser context per viewport, opened AT that size** (resizing a loaded page does not give you the mobile UI). Set the blank-thread sentinel cookie `maven_active_thread=__new__` or the empty-home arrival never mounts. Screenshot with `animations: 'disabled'`, `caret: 'hide'` and a tight `clip` — full-page shots hang here.

Run the dev server flag-ON on a free port (`lsof -ti:3006`), then:

- [ ] **Step 4: Verify at 393×852 (mobile)**

Open `/home`, tap a drop's meter. Confirm by screenshot AND by assertion:
- the report is a **bottom sheet** (`[data-variant="sheet"]`), not a right panel
- tabs read `Audience · Brain · Engagement`, Audience active
- the verdict matches that card's meter exactly
- Brain and Engagement are dimmed and state the absence — they do not show a fabricated figure
- **zero accent**: `[...document.querySelectorAll('[data-testid="verdict-report"] *')].filter(el => getComputedStyle(el).color.includes('255, 99, 99') || getComputedStyle(el).backgroundColor.includes('255, 99, 99')).length === 0`
- opening it issued **no** `/api/tools/react` request (record `page.on('request')`)

- [ ] **Step 5: Verify at 1440×900 (desktop)**

Fresh context at 1440×900. Open the report from a meter, then:
- unpinned: a right overlay panel over a scrim; Esc closes it
- click **pin**: the scrim goes, the page content sits beside the panel and is not covered — assert the composer's right edge is left of the panel's left edge via `getBoundingClientRect()`
- unpin: the column disappears and the arrival is centered again
- `AmbientOverviewRail` is nowhere on the page

- [ ] **Step 6: Write the results into the PR body and commit the docs**

Record: what was verified, at what sizes, with which screenshots, and — explicitly — anything that was NOT verified and why (e.g. the fire-on-demand path if no non-prod account was available).

```bash
git add docs/superpowers/plans/2026-08-09-composer-v8-phase-3-report.md
git commit -m "docs(concept): phase-3 report implementation plan"
```

- [ ] **Step 7: Re-measure main before proposing a PR**

```bash
git fetch --all --prune
git rev-parse HEAD origin/lane/platform-concept main origin/main
git rev-list --count HEAD..main
```

`main` moves while you work, and a repo hook appears to push on commit — verify with `git rev-parse`, never assume. Phase 2 is PR #458; Phase 3 stacks on the same branch unless the owner says otherwise.

---

## Deliberate non-goals (do not build them in this phase)

- **No billing or quota wiring.** Drop economics is open owner call #3.
- **No corpus multiplier**, anywhere, in any grade of the report.
- **No platform threading into the sim.** The Flash SIM is platform-blind; the report must never imply otherwise (Task 5's request body test enforces this).
- **No Audience surface** (SSOT §4.4) — that is Phase 4.
- **No deletion of `AmbientOverviewRail`.** It retires behind the flag only; the file stays, mounted, flag-off.

## Open questions to raise with the owner (do not resolve unilaterally)

1. **Tab order.** `AmbientDetail`'s header calls its `brain · engagement · audience` order load-bearing and settled over twelve revisions; the v8 spec §2 and mock §6 both order the report `Audience · Brain · Engagement`. This plan follows the spec for the REPORT and leaves the drill's order alone. Flag it in the PR.
2. **The mock's `×4` reason counts.** No producer codes reasons for a Flash text run, so the report prints per-group people counts instead. If the owner wants coded reasons on the personas-only grade, that is a producer change (a second model call per card) and it collides with open call #3.
