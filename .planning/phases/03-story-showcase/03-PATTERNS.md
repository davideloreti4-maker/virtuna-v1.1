# Phase 3: Story & Showcase - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 11 (5 create + 1 optional create + 5 modify)
**Analogs found:** 11 / 11 (every new/modified file has an exact in-repo analog)

> Phase 3 is **composition of an existing kit** — every new file mirrors a Phase-1/2 analog almost 1:1. There is NO "no analog found" bucket. The risk is discipline (flat-warm tokens, Placeholder not real components, calm motion, exact section rhythm), not novelty. Flat-warm is LOCKED (D-06) — the analogs below are ALL clean (no glass/glow); the only glass/glow source to avoid is `board/*` / `reading/*` / `viral-results/*`, which are shape-references-only and MUST NOT be imported.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/marketing/story/how-it-works.tsx` (NEW) | component (RSC section) | request-response (static render) | `src/components/marketing/hero/hero.tsx` | exact (same role: RSC marketing section composing Placeholder + motion leaf) |
| `src/components/marketing/story/simulation-showcase.tsx` (NEW) | component (RSC section) | request-response (static render) | `src/components/marketing/hero/hero.tsx` (esp. lines 92–151 device-chrome) | exact |
| `src/components/marketing/story/feature-blocks.tsx` (NEW) | component (RSC section) | request-response (static render) | `src/components/marketing/hero/hero.tsx` | exact |
| `src/components/marketing/story/feature-block.tsx` (NEW, optional) | component (RSC leaf row) | request-response (static render) | `src/components/marketing/placeholder.tsx` consumer pattern + RESEARCH §Code-Examples flip block | role-match (presentational leaf) |
| `src/components/marketing/story/__tests__/how-it-works.test.tsx` (NEW) | test | — | `src/components/marketing/hero/__tests__/hero.test.tsx` | exact (happy-dom pragma, render+token-assert) |
| `src/components/marketing/story/__tests__/simulation-showcase.test.tsx` (NEW) | test | — | `src/components/marketing/hero/__tests__/hero.test.tsx` | exact |
| `src/components/marketing/story/__tests__/feature-blocks.test.tsx` (NEW) | test | — | `src/components/marketing/__tests__/placeholder.test.tsx` (`it.each` + `data-variant` counting) | exact |
| `src/app/(marketing)/page.tsx` (MODIFY) | route (RSC page) | request-response | (self — modify in place) | exact (fill 2 stubs + insert 1 section) |
| `src/components/layout/header.tsx` (MODIFY) | component (client nav) | request-response | (self — `NAV_LINKS` array, line 17–22) | exact (add 1 array entry) |
| `src/components/layout/footer.tsx` (MODIFY) | component (RSC nav) | request-response | (self — `PRODUCT_LINKS` array, line 15–20) | exact (add 1 array entry) |
| `src/components/marketing/index.ts` (MODIFY) | config (barrel) | — | (self — line 7 `export { Hero }`) | exact (add story exports) |
| `src/components/layout/__tests__/header.test.tsx` + `footer.test.tsx` (MODIFY, optional) | test | — | (self — extend existing `NAV_LINKS`/`it.each` anchor assertions) | exact |

---

## Pattern Assignments

### `src/components/marketing/story/how-it-works.tsx` (RSC section, STORY-01)

**Analog:** `src/components/marketing/hero/hero.tsx`
**read_first:** `hero.tsx` (whole file — it's the canonical RSC-section + Placeholder + token pattern), `placeholder.tsx` (the slot API), `stagger-reveal.tsx` (the only client leaf).

**Imports pattern** — mirror hero's import order (Link/cn/local/Placeholder), but `Link`+`Button`+`SIGNUP_URL` are NOT needed here (Phase 3 is CTA-light). Add the motion leaf.
```tsx
// hero.tsx lines 1–7 establish the order: external → @/lib → @/components.
import { StaggerReveal } from "@/components/motion/stagger-reveal";
import { Placeholder } from "@/components/marketing/placeholder";
// (cn only if needed for a flip/order util — see feature-block)
```

**Pure-RSC discipline** (CRITICAL — Pitfall 5): the section file has **NO `"use client"`**. `hero.tsx` has no directive at all (line 1 is a bare import). The ONLY client island is the `StaggerReveal` leaf (which carries its own `"use client"`, line 1 of `stagger-reveal.tsx`). This keeps `/` `○` static.

**Heading + token usage** — hero shows the token palette to mirror. Headline tokens (hero.tsx lines 52–60): `text-foreground` (cream), `tracking-tight`. Body tokens (hero.tsx line 64): `text-foreground-secondary`. Muted captions: `text-foreground-muted` (hero.tsx line 122). **Coral (`text-accent`) appears ONLY on the primary CTA in hero (line 39 doc + line 74)** — Phase 3 keeps coral precious; do NOT sprinkle it (RESEARCH A6).

> **Serif-vs-sans OPEN QUESTION (RESEARCH A3 / Open Q1):** hero's H1 is `font-serif` (hero.tsx line 54) — but that is the landing's ONE reserved serif slot (D-05/D-10). The page-skeleton stub `<h2>`s use **sans** `font-semibold` (page.tsx lines 44, 56, 64, 73). **Recommendation: section `<h2>`s use sans `font-semibold text-foreground`** to keep serif precious. This is a UI-spec/discuss call the planner must resolve explicitly, not the executor silently.

**Core pattern (3-step stagger)** — from RESEARCH §Code-Examples (derived from hero RSC + stagger-reveal):
```tsx
<StaggerReveal className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
  {STEPS.map((s) => (
    <StaggerReveal.Item key={s.n} className="flex flex-col gap-4">
      <span className="font-mono text-sm text-foreground-muted">0{s.n}</span>
      <Placeholder {...s.slot} />
      <h3 className="text-lg font-semibold text-foreground">{s.title}</h3>
      <p className="text-base text-foreground-secondary">{s.body}</p>
    </StaggerReveal.Item>
  ))}
</StaggerReveal>
```
`StaggerReveal.Item` is exposed as a static prop (`stagger-reveal.tsx` line 102: `StaggerReveal.Item = StaggerRevealItem`) — use `<StaggerReveal.Item>`, NOT a separate import.

**Placeholder slot usage** — every step visual is a `<Placeholder>` (placeholder.tsx). Props: `variant` (`image`/`video`/`avatar`/`logo`), `aspect` (free CSS string, e.g. `"16/10"`), `label` (cream-muted caption), optional `src` (the one-prop swap), optional `breathe`. No-CLS comes from the inline `aspectRatio` (placeholder.tsx line 120).

**Noun discipline (Pitfall 1):** product noun = **"Simulation"** (capitalized). Verb = "simulates"/"simulation". NEVER "reading" as a user-facing product noun. Step 3 → "Get your Simulation" / "Get your score" / "your prediction".

---

### `src/components/marketing/story/simulation-showcase.tsx` (RSC section, STORY-02)

**Analog:** `src/components/marketing/hero/hero.tsx` lines 92–151 (the device-chrome showcase block — the EXACT flat-warm browser-window + screenshot slot to reuse).
**read_first:** `hero.tsx` (esp. 92–151), `placeholder.tsx`. Shape reference (READ-ONLY, never import): `~/virtuna-numen-rework/src/components/reading/{reading,score-gauge,driver-rows,persona-cloud}.tsx` (RESEARCH Pitfall 4 cites these for believable IA).

**Browser-window chrome to copy (hero.tsx lines 113–136)** — this is the device frame STORY-02 reuses for the big showcase frame:
```tsx
<div className="overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-[0_40px_80px_-24px_rgba(0,0,0,0.72),0_14px_30px_-12px_rgba(0,0,0,0.5)]">
  {/* window chrome — slim browser bar */}
  <div className="flex items-center border-b border-border px-4 py-2.5">
    <span className="flex gap-2" aria-hidden="true">
      <span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/30" />
      {/* …3 dots… */}
    </span>
    <span className="mx-auto rounded-md bg-background px-4 py-1 font-mono text-[11px] tracking-wide text-foreground-muted">
      numen.app
    </span>
    <span className="w-[42px]" aria-hidden="true" />
  </div>
  <Placeholder variant="image" aspect="16/10" label="Your Simulation"
    className="rounded-none border-0 bg-surface" />
</div>
```
Note the inline box-shadow is a **layered DARK drop shadow** (not a glow) — flat-warm-legal depth (D-06 allows `--shadow-float` + tone-step; hero uses an explicit dark layered shadow for the floated window, which is acceptable set-dressing, NOT a `--shadow-glow-*`). The warm "seat" (hero.tsx lines 99–108) is a very-low-alpha cream radial (`rgba(236,231,222,0.07)`) explicitly commented "NOT a glow" — copy it verbatim if a seat is wanted.

**Heading must be "The Simulation"** (matches the `#the-simulation` anchor — page.tsx line 56 stub already says it). Test will assert this (see test analog).

**Named outputs (requirement):** the section copy/labels MUST surface **audience simulation, watch-through %, Hook, Retention (where viewers drop), Shareability** — these map to the canonical reading IA (RESEARCH Pitfall 4 items 3–4). **Layout A (recommended v1):** one big framed `<Placeholder>` + the three outputs named as text chips beneath. **Honesty floor:** if a score is shown as set-dressing, keep it ≥70 (BAND_THRESHOLDS.STRONG = 70).

---

### `src/components/marketing/story/feature-blocks.tsx` + `feature-block.tsx` (RSC section + leaf, STORY-03)

**Analog:** `src/components/marketing/hero/hero.tsx` (section discipline) + `placeholder.tsx` (the slot) + RESEARCH §Code-Examples "Alternating feature block (the flip)".
**read_first:** `hero.tsx`, `placeholder.tsx`, `src/lib/utils.ts` (`cn`).

**The flip pattern (RESEARCH §Code-Examples — derived, no in-repo alternating-row analog exists, but `cn` order-swap is the idiom):**
```tsx
import { cn } from "@/lib/utils";
import { Placeholder } from "@/components/marketing/placeholder";

export function FeatureBlock({ title, body, flip }: FeatureBlockProps) {
  return (
    <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
      <div className={cn(flip && "md:order-2")}>
        <h3 className="text-2xl font-semibold text-foreground md:text-3xl">{title}</h3>
        <p className="mt-4 text-base text-foreground-secondary md:text-lg">{body}</p>
      </div>
      <Placeholder variant="image" aspect="16/10" label={title}
        className={cn(flip && "md:order-1")} />
    </div>
  );
}
```
`feature-blocks.tsx` maps 3–4 benefit objects through `<FeatureBlock>` with `flip={i % 2 === 1}`, optionally wrapped in `<StaggerReveal>`/`<FadeInUp>`. Stacks to `grid-cols-1` on mobile (Pitfall 6 — responsive by construction, no fixed px). Suggested benefits (RESEARCH Pattern 5): predict / where-they-drop / audience / weakest-lever. Avoid barred words "viral"/"AI" in headlines (D-09 carried).

---

### Test files (Wave 0) — `story/__tests__/*.test.tsx`

**Analog A (render + token assert):** `src/components/marketing/hero/__tests__/hero.test.tsx`
**Analog B (it.each + data-variant counting):** `src/components/marketing/__tests__/placeholder.test.tsx`

**Mandatory pragma (line 1 of BOTH analogs):**
```tsx
/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
```

**Resilience-rule assertion idiom (hero.test.tsx lines 40–49):** assert STABLE TOKENS, not full sentences — e.g. the noun regex `/simulat(?:es|ion|e)/i` and a negative assertion that "reading" never appears as the product noun. Heading verbatim only where LOCKED (e.g. "The Simulation" for STORY-02, matching the anchor).

**Placeholder-presence assertion (placeholder.test.tsx lines 58–63, 74–77):** count `container.querySelectorAll('[data-variant]')` for "every product visual is a Placeholder" (Success Crit 4), and read `root.style.aspectRatio` for the no-CLS check. Each `<Placeholder>` root carries `data-variant` (placeholder.tsx line 125).

**Per-test mapping (RESEARCH §Test-Map → these files):**
- `how-it-works.test.tsx`: exactly 3 steps in order, each a Placeholder; noun = "Simulation"/"simulates", never "reading".
- `simulation-showcase.test.tsx`: heading "The Simulation"; names audience/watch-through %/Hook/Retention/Shareability; product visual is a `<Placeholder>`.
- `feature-blocks.test.tsx`: 3–4 blocks, each pairs a benefit headline with a `<Placeholder>`; alternating `md:order-*` flip applied to alternate rows (use `it.each` like placeholder.test.tsx lines 51–65).

**Quick run:** `npx vitest run src/components/marketing/story/`

---

### `src/app/(marketing)/page.tsx` (MODIFY — fill 2 stubs + insert 1 section)

**Analog:** self. The 5 existing sections (page.tsx lines 39–78) are the rhythm SSOT.

**Pattern 1 — fill stub IN PLACE (STORY-01 `#how-it-works`, STORY-02 `#the-simulation`).** KEEP the `<section>` wrapper EXACTLY (id, `border-t border-border px-6 py-20`, inner `mx-auto max-w-5xl`). Swap only the muted stub `<h2>` for the section component, which renders its OWN real cream heading + body:
```tsx
// BEFORE (page.tsx lines 39–48):
<section id="how-it-works" className="border-t border-border px-6 py-20">
  <div className="mx-auto max-w-5xl">
    <h2 className="text-3xl font-semibold text-foreground-muted">How it works</h2>
  </div>
</section>
// AFTER — swap the stub <h2> for <HowItWorks /> (same wrapper):
<section id="how-it-works" className="border-t border-border px-6 py-20">
  <div className="mx-auto max-w-5xl">
    <HowItWorks />
  </div>
</section>
```

**Pattern 2 — INSERT new `#features` section (STORY-03)** between `#the-simulation` (ends line 60) and `#pricing` (begins line 63), MATCHING the exact wrapper:
```tsx
<section id="features" className="border-t border-border px-6 py-20">
  <div className="mx-auto max-w-5xl">
    <FeatureBlocks />
  </div>
</section>
```

**Pitfall 3 (LOCKED rhythm):** every body section is EXACTLY `border-t border-border px-6 py-20` + inner `mx-auto max-w-5xl`. Do NOT copy the HERO wrapper (page.tsx line 34: `px-6 py-16 md:py-20`, NO border-t — it's first). No `max-w-7xl`, no `py-24`.

**Import update** — currently `import { Hero, MotionConfigShell } from "@/components/marketing"` (page.tsx line 3). Add the 3 sections to that named import once the barrel exports them.

---

### `src/components/layout/header.tsx` (MODIFY — add "Features" nav anchor)

**Analog:** self — the `NAV_LINKS` array (header.tsx lines 17–22). It's a single `const` array mapped twice (desktop lines 80–88, mobile panel lines 130–139), so ONE array edit covers both surfaces:
```tsx
const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "The Simulation", href: "#the-simulation" },
  { label: "Features", href: "#features" },   // ← ADD (RESEARCH Pattern 2 / A1)
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;
```
5 links — verify the mobile `useState` disclosure still reads cleanly at 320px (it's a simple list, fine). **A1 / Open Q2 — planner decision:** add the anchor (recommended) vs id-only-no-nav. State explicitly.

---

### `src/components/layout/footer.tsx` (MODIFY — mirror "Features" anchor)

**Analog:** self — `PRODUCT_LINKS` array (footer.tsx lines 15–20), which by contract "mirror the header nav set exactly" (footer.tsx line 11 doc). Add the SAME entry:
```tsx
const PRODUCT_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "The Simulation", href: "#the-simulation" },
  { label: "Features", href: "#features" },   // ← ADD (mirror header)
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;
```

---

### `src/components/marketing/index.ts` (MODIFY — barrel)

**Analog:** self — line 7 `export { Hero } from "./hero";`. Add the story exports (each section is named-exported, like `Hero`):
```tsx
export { HowItWorks } from "./story/how-it-works";
export { SimulationShowcase } from "./story/simulation-showcase";
export { FeatureBlocks } from "./story/feature-blocks";
```
Mirror the existing convention: value + type exports (`MotionConfigShell` pattern, lines 4–5) — but these sections take no props beyond optional `className`, so a type export is optional.

---

### `header.test.tsx` + `footer.test.tsx` (MODIFY, optional — Wave 0 anchor coverage)

**Analog:** self. RESEARCH flagged "verify if a header/footer test already exists" — **CONFIRMED both exist.** Extend, don't create new page test.
- `footer.test.tsx` lines 38–49 already use `it.each([["#how-it-works"],["#the-simulation"],["#pricing"],["#faq"]])` — ADD `["#features"]` to that array to gate the mirror.
- `header.test.tsx` has no per-anchor `it.each` yet (it tests CTA/auth/mobile, lines 31–86) — add a small `it("renders a 'Features' nav link → #features")` if anchor coverage is wanted in the header gate.
- Cross-req: `#features` mounted in `page.tsx` — no `page.test.tsx` exists; the header/footer anchor tests + the build gate (`○ /`) cover it. A new `page.test.tsx` is optional (RESEARCH §Test-Map "Cross" row).

---

## Shared Patterns

### Reduced-motion-gated entrance (apply to all 3 sections)
**Source:** `src/components/motion/stagger-reveal.tsx` (lines 51–54 self-gate) + `src/components/motion/fade-in-up.tsx` (lines 68–73 self-gate), under the global boundary `src/components/marketing/motion-config.tsx` (line 27 `<MotionConfig reducedMotion="user">`, already wraps the page at page.tsx line 27).
**Apply to:** Section entrances. The primitives return a plain wrapper under reduce — no extra gating needed in new sections.
```tsx
// stagger-reveal.tsx lines 51–54 — the self-gate the new sections inherit for free:
const prefersReducedMotion = useReducedMotion();
if (prefersReducedMotion) {
  return <div className={className}>{children}</div>;
}
```
Import from the path `@/components/motion/stagger-reveal` (used in RESEARCH example) OR the barrel `@/components/motion` (index.ts re-exports `StaggerReveal`, `StaggerRevealItem`, `FadeInUp` — lines 3, 7). Either works; barrel is cleaner.

### Placeholder slot (apply to EVERY product visual — Success Crit 4)
**Source:** `src/components/marketing/placeholder.tsx`
**Apply to:** Every image/video/avatar in all 3 sections. Props recap: `variant` (default `image`), `aspect` (free CSS string; defaults per-variant lines 54–59), `label`, `src` (one-prop swap, lines 130–147), `breathe` (off by default, lines 152–155). No-CLS via inline `aspectRatio` (line 120). Root carries `data-variant` (line 125) — the test hook.
```tsx
// Today (stand-in) → Later (swap), zero layout shift (placeholder.tsx doc lines 98–107):
<Placeholder variant="image" aspect="16/10" label="Your Simulation" />
<Placeholder variant="image" aspect="16/10" label="Your Simulation" src="/simulation.png" />
```

### Flat-warm token palette (apply to all new markup — D-06 LOCKED)
**Source:** `src/components/marketing/hero/hero.tsx` (the clean reference) + `src/app/globals.css` (token SSOT).
**Apply to:** All new sections. Semantic tokens ONLY: `text-foreground` (cream), `text-foreground-secondary`, `text-foreground-muted`, `text-accent` (coral — SPARINGLY), `bg-surface`, `bg-surface-elevated`, `bg-background`, `bg-background-elevated`, `border-border` (6% hairline). Depth = tone-step + hairline border + (`--shadow-float` OR an explicit dark layered drop shadow like hero.tsx line 114). **FORBIDDEN:** `--shadow-glow-*`, `backdrop-blur`, glass `linear-gradient` surfaces, `#FF7F50`, hardcoded hex (the only inline-hex in hero is the explicit dark shadow + the `rgba(236,231,222,0.07)` warm seat, both commented as legal/"NOT a glow").

### Anti-pattern guard (apply to ALL new files)
**Do NOT import** from `src/components/board/*`, `src/components/reading/*`, `src/components/app/simulation/*`, `viral-results/*`, or any engine/Supabase/data hook. These carry store coupling + the RETIRED glass/glow/green-yellow-red aesthetic (RESEARCH Anti-Patterns + Tier sanity note). They are **shape references read during research, never imports.** Mirror the Phase-2 UI-SPEC ban.

---

## No Analog Found

None. Every Phase-3 file maps to an exact or role-match in-repo analog. The only "no in-repo example" micro-pattern is the **alternating feature-row flip** (no existing alternating-2-col row in the repo) — but it's a trivial `cn(flip && "md:order-N")` order-swap fully specified in RESEARCH §Code-Examples, using the existing `cn` (`src/lib/utils.ts`) + `Placeholder`. Not a true gap.

## Metadata

**Analog search scope:** `src/components/marketing/**`, `src/components/motion/**`, `src/components/layout/**`, `src/app/(marketing)/**`, `src/lib/{routes,utils}.ts`, plus a repo-wide test-file census.
**Files scanned:** 13 read in full (hero, placeholder, motion-config, fade-in-up, stagger-reveal, page, header, footer, marketing/index, motion/index, hero.test, placeholder.test, header.test, footer.test) + directory/grep census.
**Key verifications:** `story/` does NOT exist yet (clean create); header.test.tsx + footer.test.tsx DO exist (extend for the Features anchor); `/lib/routes.ts` exports `SIGNUP_URL`/`LOGIN_URL` only.
**Pattern extraction date:** 2026-06-15
