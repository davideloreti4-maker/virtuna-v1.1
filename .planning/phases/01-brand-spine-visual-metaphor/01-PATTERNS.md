# Phase 1: Brand Spine & Visual Metaphor — Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 7 new artifacts (2 docs, 1 doc-addendum, 2 phase audit docs, 1 script, 2 config touches)
**Analogs found:** 7 / 7 (all artifacts have an existing analog in this codebase)
**Note:** Phase 1 produces ARTIFACTS ONLY — no production code. Most "files" are markdown docs whose pattern is the existing markdown style of repo docs (`BRAND-BIBLE.md`, `docs/motion-guidelines.md`, `docs/tokens.md`).

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `.planning/reference/BRAND-SPINE.md` | doc (voice / brand reference) | static reference (read by future planners + executors) | `docs/motion-guidelines.md` + `BRAND-BIBLE.md` | exact (same role: brand-language reference doc) |
| `BRAND-BIBLE.md` (append-only addendum) | doc (existing, append) | static reference | `BRAND-BIBLE.md` (its own existing structure) | exact (we mirror the file's own H2 + table style) |
| `.planning/phases/01-*/01-PLAGIARISM-AUDIT.md` | doc (phase audit) | one-shot diff artifact | `01-CONTEXT.md`, `01-RESEARCH.md` (existing phase docs in same dir) | exact (same dir, same `01-` prefix, same H1 → H2 structure) |
| `.planning/phases/01-*/01-REPLACEMENT-COPY.md` | doc (phase deliverable) | source-of-truth copy strings, sign-off block | `01-CONTEXT.md` (sign-off `<decisions>` style); `BRAND-BIBLE.md` (table-led structure) | exact |
| `scripts/lint-vocab.mjs` | utility script | file-I/O batch (walks dirs, scans, exits 0/1) | `.githooks/post-commit` (only true CLI script in repo); `scripts/*.ts` (existing analyze scripts — but TypeScript via tsx, not Node ESM) | role-match (existing scripts run via `npx tsx`; the new script must be plain `.mjs` per RESEARCH.md A8 — no new deps; no exact analog exists) |
| `.githooks/pre-commit` | git hook (shell) | event-driven (git pre-commit) | `.githooks/post-commit` | exact (same dir, same shebang convention, same silent-fail pattern) |
| `package.json` `scripts.lint:vocab` | config entry | npm-script registration | `package.json` `scripts.test`, `scripts.analyze` | exact |

**Why no exact analog for `scripts/lint-vocab.mjs`:** every file in `scripts/` today is either TypeScript (`.ts`, run via `npx tsx`) or Python (`.py`). There is no existing `.mjs` ESM script. The closest match by role (CLI utility script) is the TS scripts; by execution style (plain Node, no transpile) is the `.githooks/post-commit` shell. RESEARCH.md A8 explicitly chose `.mjs` to avoid adding `tsx` to the pre-commit hook's hot path. Pattern is therefore "new convention, justified by no-deps constraint" — planner should not flag the divergence as a mistake.

---

## Pattern Assignments

### `.planning/reference/BRAND-SPINE.md` (doc — voice/brand reference)

**Analog:** `BRAND-BIBLE.md` (existing 351-line brand reference) + `docs/motion-guidelines.md` (existing reference doc with similar tone-style)

**Header / opening pattern** (`BRAND-BIBLE.md:1-22`):

```markdown
# Virtuna Design System

> Raycast-derived dark design language with coral (#FF7F50) branding.
> Complete design system reference for all components, tokens, and patterns.

---

## Design Direction

**Raycast Design Language** -- Clean, dark, minimal. No colored tinting, no glow effects. Color is used only for accents and interactive elements.

Core principles:

- **Dark-mode only** -- Every token, component, and effect is optimized for dark surfaces
- **Transparent surfaces** -- Cards use `bg-transparent`, not gradient backgrounds
- **Subtle borders** -- Universal 6% white opacity borders, hover 10%
```

Apply: `# Virtuna Brand Spine` → blockquote one-liner → `---` → first H2. Match the double-hyphen `--` style (not em-dash) used throughout this file.

**Token-table pattern** (`BRAND-BIBLE.md:25-41`):

```markdown
### Brand (Coral Scale)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-coral-100` | `oklch(0.97 0.03 40)` | Subtle tinted backgrounds |
| `--color-coral-200` | `oklch(0.93 0.06 40)` | Light accent backgrounds, selected fills |
```

Apply directly to BRAND-SPINE.md `## 4. Banned → Replacement Table` (D-02): three-column `| Banned | Replacement | Reason |` (RESEARCH.md skeleton lines 273-281).

**Section-tone pattern** (`docs/motion-guidelines.md:1-15`):

```markdown
# Motion Guidelines

> Animation patterns and usage guidance for Virtuna.

All motion components are built on `motion/react` (Framer Motion) and use IntersectionObserver for scroll-triggered reveals. Every component respects `prefers-reduced-motion`.

---

## Principles

- **Subtle over dramatic:** Animations enhance, never distract
- **Performance-first:** All animations respect `prefers-reduced-motion: reduce`
```

Apply: `## 2. Tone Descriptors` should follow the same bold-keyword + em-dash gloss style: `**Calm** -- never breathless. No exclamation marks in body copy.` (RESEARCH.md skeleton lines 256-258).

**Footer pattern** (`BRAND-BIBLE.md:348-351`):

```markdown
---

*Virtuna Design System v2.3.5 -- Brand Bible*
*Last updated: 2026-02-08*
```

Apply: end BRAND-SPINE.md with the same italic two-line footer (`*Virtuna Brand Spine v1.0*` / `*Last updated: 2026-05-XX*`).

---

### `BRAND-BIBLE.md` (append-only addendum)

**Analog:** `BRAND-BIBLE.md` itself (the file we are appending to). Mirror its existing structure verbatim.

**File length & insertion point:**
- Existing file: **351 lines**, ends at `*Last updated: 2026-02-08*` (line 351).
- Last existing H2: `## Resources` (line 338).
- Existing structure ends with: `## Resources` block → `---` separator (line 348) → italic footer lines 350-351.

**Append protocol** (per RESEARCH.md Pitfall 4):

1. Locate the existing footer block at lines 348-351.
2. Insert NEW content **before** line 348's `---` separator? No — insert AFTER line 351 (entire footer stays where it is, addendum becomes the new last section, then a new updated footer).
3. The cleanest pattern: append a new `---` separator + `## Visual Metaphor Lock` section, then update the date footer line to today's date.

**Existing tail** (`BRAND-BIBLE.md:336-351`) — what the planner must preserve:

```markdown
---

## Resources

- [Token Reference](docs/tokens.md) -- All design tokens with values and usage guidance
- [Component API](docs/components.md) -- Complete props, variants, and code examples
- [Component Index](docs/component-index.md) -- Source files, showcase pages, exports per component
- [Accessibility](docs/accessibility.md) -- WCAG AA contrast requirements per component
- [Contributing](docs/contributing.md) -- How to add components, modify tokens, extend the system
- [Design Specs](docs/design-specs.json) -- Structured token export (W3C Design Tokens-adjacent)
- [Live Showcase](/showcase) -- Interactive component demos

---

*Virtuna Design System v2.3.5 -- Brand Bible*
*Last updated: 2026-02-08*
```

**Concrete append target** — after line 351, insert:

```markdown


---

## Visual Metaphor Lock

> Phase 1 of the Brand Statement Landing milestone locked the paired visual language of Virtuna. This section is the source of truth for both visuals; Phase 2 implementation honors these specs.

### 1. Hero -- Behavioral Simulation Visual

[... per RESEARCH.md skeleton lines 326-356 ...]

### 2. Pipeline -- Engine Diagram

[... per RESEARCH.md skeleton lines 358-392 ...]

### 3. Rejected Alternatives (don't re-litigate)

[... per RESEARCH.md skeleton lines 394-403 ...]

### 4. Performance Budget

[... per RESEARCH.md skeleton lines 405-411 ...]
```

Then update the existing footer (replace lines 350-351 with):

```markdown
*Virtuna Design System v2.3.6 -- Brand Bible*
*Last updated: 2026-05-XX*
```

**Style invariants from existing file (must match in addendum):**
- Use double-hyphen `--`, not em-dash `—` (see lines 19, 340-346 — every list line uses ` -- `).
- H3 uses bold-emphasis labels followed by code examples (see lines 28, 60, 70 of `BRAND-BIBLE.md`).
- Tables use 3-column `| X | Y | Z |` with no alignment markers (see lines 31-41).
- Blockquotes use `> Internal note: …` for asides (line 20).

**Hive viz file:line landmarks the addendum must cite** (per RESEARCH.md "What Phase 2 finalizes" + Don't Hand-Roll table):

| Pattern | File:line | Verified by |
|---------|-----------|-------------|
| DPR-aware ResizeObserver | `src/components/hive/use-canvas-resize.ts:43-100` | RESEARCH.md line 587 |
| RAF + module-level "complete" flag | `src/components/hive/use-hive-animation.ts:42-49` (verified: `globalAnimationComplete` declared at line 43, `resetGlobalAnimation` exported at 49) | direct read |
| Animation lifecycle / completion | `src/components/hive/use-hive-animation.ts:121-193` | RESEARCH.md line 588 |
| Ref-based render state | `src/components/hive/HiveCanvas.tsx:54-57, 147-186` | RESEARCH.md line 589 |
| Reduced-motion early return | `src/components/hive/use-hive-animation.ts:65-69` (verified: `FULL_VISIBILITY` constant at line 65) | direct read |
| Color batching | `src/components/hive/hive-renderer.ts:240-298` | RESEARCH.md line 591 |
| Skeleton render path | `src/components/hive/hive-renderer.ts:464-511` | RESEARCH.md line 590 |
| Reduced-motion hook (reuse verbatim) | `src/hooks/usePrefersReducedMotion.ts:1-29` (verified: 29 lines, returns boolean, defaults to true for SSR safety) | direct read |
| `motion/react` reveal example | `src/components/motion/fade-in.tsx` (referenced by `docs/motion-guidelines.md:29`) | direct read of motion-guidelines.md |
| Easing token | `docs/tokens.md` § Easings — `--ease-out-cubic: cubic-bezier(0.215, 0.61, 0.355, 1)` matches `easeOutCubic(t)` defined at `src/components/hive/use-hive-animation.ts:57` | direct read |

---

### `.planning/phases/01-*/01-PLAGIARISM-AUDIT.md` (phase audit doc)

**Analog:** `.planning/phases/01-brand-spine-visual-metaphor/01-CONTEXT.md` (existing 155-line phase doc in the same directory)

**Filename pattern** (verified by `ls .planning/phases/01-brand-spine-visual-metaphor/`):
- `01-CONTEXT.md`
- `01-RESEARCH.md`
- `01-DISCUSSION-LOG.md` (mentioned in research)
- New file MUST be: `01-PLAGIARISM-AUDIT.md` (NOT `PLAGIARISM-AUDIT.md`).

**Note:** RESEARCH.md skeleton at line 484 says `PLAGIARISM-AUDIT.md` (no `01-` prefix). The actual phase-dir convention uses the `01-` prefix on every artifact. Planner should use `01-PLAGIARISM-AUDIT.md`.

**Header pattern** (`01-CONTEXT.md:1-13`):

```markdown
# Phase 1: Brand Spine & Visual Metaphor - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Lock the brand voice, vocabulary guardrails, and both visual concepts...
</domain>
```

Apply: `# Phase 1: Brand Spine & Visual Metaphor - Plagiarism Audit` → `**Captured:** YYYY-MM-DD` / `**Snapshot source:** [URL]` / `**Scope:** D-12 — landing + onboarding + dashboard-visible copy`. The phase docs use plain bold key:value lines for metadata, not YAML frontmatter.

**Section-tag wrapping (`<domain>`, `<decisions>`, `<canonical_refs>`)**: existing phase docs use HTML-like comment tags to demarcate sections. Planner should use the same tags in the new audit doc:
- `<scope>...</scope>` for D-12 scope statement
- `<method>...</method>` for the 5-step capture method
- `<findings>...</findings>` for the per-section diff tables
- `<sign_off>...</sign_off>` for the approval checkboxes

**Findings-table pattern** (RESEARCH.md skeleton lines 503-509):

```markdown
| Surface | Societies.io | Virtuna v1.1 (current) | Verdict |
|---------|--------------|------------------------|---------|
| H1 | "[exact text from snapshot]" | "Human Behavior, Simulated." (`src/components/landing/hero-section.tsx:29`) | Plagiarized — pattern + tone match |
```

This 4-column table style matches the project's preferred pattern (see `BRAND-BIBLE.md:25-92` Token Tables, `01-CONTEXT.md:84-95` `<canonical_refs>` table).

**Footer pattern** (`01-CONTEXT.md:151-154`):

```markdown
---

*Phase: 1-Brand Spine & Visual Metaphor*
*Context gathered: 2026-05-10*
```

Apply: italic two-line footer with phase identity + capture date.

---

### `.planning/phases/01-*/01-REPLACEMENT-COPY.md` (phase deliverable)

**Analog:** `01-CONTEXT.md` (structure) + `BRAND-BIBLE.md` (token-table style for copy entries)

**Filename:** `01-REPLACEMENT-COPY.md` (mirrors `01-CONTEXT.md` prefix; RESEARCH.md skeleton at line 534 says `REPLACEMENT-COPY.md` — planner should use `01-` prefix).

**Section pattern** (RESEARCH.md skeleton lines 538-558) extended with `<viewport>` tags borrowed from `01-CONTEXT.md`'s `<domain>` style:

```markdown
# Phase 1: Brand Spine & Visual Metaphor - Replacement Copy

**Drafted:** YYYY-MM-DD
**Conforms to:** `.planning/reference/BRAND-SPINE.md`
**Sign-off model:** D-15 (approve once at end)

<viewport name="hero">
## Hero (HERO-01..10)

| Element | Copy | Source ID |
|---------|------|-----------|
| Pre-headline | `VIRTUNA · A NUMEN MACHINES PRODUCT` | HERO-01 |
| H1 | "Predict how your audience will respond. Before you post." | HERO-02 |
| Sub-headline | "Virtuna simulates your audience to forecast every video before it ships." | HERO-03 |
| Subline | "Trained on decades of behavioral research. Self-improving with every outcome." | HERO-04 |
| Primary CTA | "Run a prediction →" | HERO-08 |
| Secondary CTA | "See the science" | HERO-09 |
</viewport>

[... repeat for demo, how-it-works, three-surfaces, science, social-proof, pricing, footer, onboarding ...]
```

**Sign-off pattern** (per D-15 + RESEARCH.md skeleton line 556):

```markdown
## Sign-off

- [ ] Davide reviewed full document end-to-end
- [ ] Davide approved replacement copy as-is OR redlined sections sent back
- [ ] No remaining banned-vocab matches per `scripts/lint-vocab.mjs`
- [ ] Hero copy locked per BRAND-06 / D-16
```

This checkbox pattern (`- [ ]` / `- [x]`) is used in `01-CONTEXT.md`'s deferred sections and matches GitHub-flavored markdown rendering. The phase-acceptance-criteria block at RESEARCH.md lines 967-983 confirms the convention (`grep -q "\[x\] Davide approved"`).

---

### `scripts/lint-vocab.mjs` (utility script — file-I/O batch)

**Analog:** `.githooks/post-commit` (only true CLI utility in repo; same exit-code, silent-fail style) + `scripts/extract-training-data.ts:1-9` (only existing scripts/ file showing dotenv + script-prefix logging)

**Critical divergence from existing scripts/:** all current files (`analyze-dataset.ts`, `benchmark.ts`, `import-apify-data.ts`, `extract-training-data.ts`) are TypeScript run via `npx tsx`. The new file is plain `.mjs` ESM Node — RESEARCH.md A8 chose this to avoid adding tsx to the pre-commit hot path. **Planner: do not "fix" this divergence by switching back to TS.**

**Shebang convention** — `.githooks/post-commit:1`:

```sh
#!/bin/sh
```

The hook uses `/bin/sh` (POSIX shell). For a Node ESM script, the analog is:

```js
#!/usr/bin/env node
```

This matches the RESEARCH.md skeleton at line 879 verbatim. The shebang line MUST be present so the script can be `chmod +x scripts/lint-vocab.mjs && ./scripts/lint-vocab.mjs` without `node` prefix.

**Logging pattern** — `scripts/extract-training-data.ts:45`:

```ts
const log = (msg: string) => console.log(`[extract-training] ${msg}`);
```

Apply to lint-vocab.mjs: prefix all output with `[lint-vocab]` (or `ERROR ` / `WARN ` per the RESEARCH.md skeleton at lines 928-929 — that prefix style is acceptable too because it surfaces severity).

**Exit-code conventions** — `.githooks/post-commit:4`:

```sh
git push origin HEAD 2>/dev/null || true
```

Note: post-commit uses `|| true` to silently swallow failures (it's a non-blocking hook). The new `lint-vocab.mjs` is the OPPOSITE: it is a blocking hook by design (RESEARCH.md line 937 — `exit(errors > 0 ? 1 : 0)`). Pattern: explicit `process.exit(1)` on violation, `exit(0)` on clean.

**Glob handling** — Node ≥20 has `node:fs/promises` glob, but RESEARCH.md skeleton at lines 902-914 recursively walks via `readdirSync({ withFileTypes: true })` (more portable across Node 20 / 22). Apply that pattern verbatim — it's the only walk-pattern in the proposed script and matches Node-stdlib-only constraint.

**No-deps constraint** — `package.json:25-90` shows zero relevant deps for file scanning (`glob`, `chalk`, `globby` etc. are all absent). Confirms RESEARCH.md A8: stdlib only.

**Suppress-marker pattern** — RESEARCH.md skeleton line 900 (`vocab-lint-disable-next-line`) mirrors ESLint's `eslint-disable-next-line` convention. This is the right pattern — developers who already understand ESLint will recognize it.

**Concrete file template** (RESEARCH.md skeleton lines 879-940 is complete and correct — planner should use it verbatim with NO substantive edits, ~70 LOC, well under the ≤100 LOC budget cited in CONTEXT.md):

```js
#!/usr/bin/env node
// Scans for banned vocabulary in customer-facing source files.
// Exits 1 if violations found, 0 if clean.
// No third-party deps -- Node ≥20 standard library only.

import { readFileSync } from "node:fs";
import { argv, exit } from "node:process";

const BANNED = [
  { rx: /\bviral\b/gi, hint: "use 'breakout' or 'high-performing'", severity: "error" },
  { rx: /\bgo viral\b/gi, hint: "use 'land with audience'", severity: "error" },
  { rx: /\bAI\b(?!.*\bai-powered\b)/gi, hint: "use 'behavioral simulation' or 'engine'", severity: "error" },
  { rx: /\busers\b/gi, hint: "use 'creators' (or specific role)", severity: "warn" },
  { rx: /from ['"]framer-motion['"]/g, hint: "import from 'motion/react' (legacy uses grandfathered)", severity: "warn" },
];

const SUPPRESS_RX = /vocab-lint-disable-next-line/;

async function* walk(dir) {
  const { readdirSync } = await import("node:fs");
  const { join, extname } = await import("node:path");
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      yield* walk(full);
    } else if ([".ts", ".tsx", ".md"].includes(extname(entry.name))) {
      yield full;
    }
  }
}

async function main() {
  const dirs = argv.slice(2).length > 0
    ? argv.slice(2)
    : ["src/app", "src/components/landing", "src/components/onboarding"];
  let errors = 0, warnings = 0;
  for (const dir of dirs) {
    for await (const file of walk(dir)) {
      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        if (i > 0 && SUPPRESS_RX.test(lines[i - 1])) return;
        for (const { rx, hint, severity } of BANNED) {
          for (const match of line.matchAll(rx)) {
            const tag = severity === "error" ? "ERROR" : "WARN ";
            console.error(`${tag} ${file}:${i + 1}  "${match[0]}" → ${hint}`);
            severity === "error" ? errors++ : warnings++;
          }
        }
      });
    }
  }
  console.error(`\nVocab lint: ${errors} errors, ${warnings} warnings`);
  exit(errors > 0 ? 1 : 0);
}
main();
```

---

### `.githooks/pre-commit` (git hook — event-driven)

**Analog:** `.githooks/post-commit` (existing 8-line hook in same dir)

**Existing file** (`.githooks/post-commit:1-7`):

```sh
#!/bin/sh
# Auto-push after commit so Web Claude sessions can access the branch.
# Fails silently if offline or no remote configured.
git push origin HEAD 2>/dev/null || true

# Telegram notification (non-blocking)
"$HOME/.claude/hooks/telegram-notify.sh" commit 2>/dev/null &
```

**Conventions extracted:**

| Convention | Value | Apply to pre-commit? |
|------------|-------|----------------------|
| Shebang | `#!/bin/sh` (POSIX shell, NOT bash) | YES — planner should use `#!/bin/sh` |
| Comment style | `# Plain English description` | YES |
| Stderr suppression | `2>/dev/null` for non-blocking | NO — pre-commit is blocking by design |
| Failure handling | `\|\| true` to swallow exit codes | NO — pre-commit MUST fail on violation |
| Background tasks | `&` suffix | NO |
| Permission bit | `chmod +x` (verified by `ls -la`: `-rwxr-xr-x`) | YES |

**Concrete file** (RESEARCH.md skeleton lines 944-947 with one improvement — match the post-commit `#!/bin/sh` shebang style instead of the proposed `#!/usr/bin/env bash`):

```sh
#!/bin/sh
# Vocab guardrail: block commits that introduce banned brand-spine vocabulary.
# See .planning/reference/BRAND-SPINE.md §4 for the rules.
node scripts/lint-vocab.mjs src/app src/components/landing src/components/onboarding || exit 1
```

**Note:** RESEARCH.md skeleton at line 945 says `#!/usr/bin/env bash`. The repo's existing convention (post-commit) is `#!/bin/sh`. Planner should match the existing convention for consistency; `sh` works fine for the single Node invocation. The README pattern (`.githooks/README.md`) just documents `git config core.hooksPath .githooks` — no shebang preference is documented, so we follow the existing file.

**Activation pattern** (`.githooks/README.md:5-9`) — already documented:

```sh
git config core.hooksPath .githooks
```

The README mentions it as a one-time-per-clone setup; CLAUDE.md confirms the same step. Planner does NOT need to update `.githooks/README.md` unless they want to add a "pre-commit" section parallel to the existing "post-commit" section (recommended but optional).

---

### `package.json` `scripts.lint:vocab` entry (config addition)

**Analog:** `package.json:5-24` (existing `scripts` block with 18 entries)

**Existing scripts** (verified by direct read):

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "extraction": "npx tsx extraction/scripts/capture-all-session.ts",
    "extraction:auth": "npx playwright test --project=setup --config=extraction/playwright.config.ts",
    "extraction:all": "npx playwright test --project=desktop --config=extraction/playwright.config.ts",
    "extraction:ui": "npx playwright test --ui --config=extraction/playwright.config.ts",
    "extraction:report": "npx playwright show-report extraction/playwright-report",
    "extraction:gifs": "npx tsx extraction/scripts/generate-gifs.ts",
    "e2e": "npx playwright test --config=e2e/playwright.config.ts",
    "e2e:auth": "npx playwright test --project=setup --config=e2e/playwright.config.ts",
    "e2e:ui": "npx playwright test --ui --config=e2e/playwright.config.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "analyze": "npx tsx scripts/analyze-dataset.ts",
    "benchmark": "npx tsx scripts/benchmark.ts"
  }
}
```

**Naming convention extracted:**

| Pattern | Examples | Apply? |
|---------|----------|--------|
| Colon-prefixed grouping | `extraction:auth`, `e2e:auth`, `test:watch`, `test:coverage` | YES — `lint:vocab` matches the `lint` family |
| Hyphenated single-word | (none — all multi-word entries use colon) | n/a |
| Run command style | `npx tsx scripts/X.ts` (TS) OR direct binary (`next dev`, `vitest run`, `eslint`) | use direct `node` for `.mjs` |

**Recommended entry:**

```json
"lint:vocab": "node scripts/lint-vocab.mjs src/app src/components/landing src/components/onboarding"
```

**Where to place it in the file:** between `"lint": "eslint"` (line 9) and `"extraction"` (line 10). Or appended at the end of the scripts block. The convention in this file is `dev/build/start` first, then `lint`, then sub-systems (extraction, e2e, test, analyze). `lint:vocab` is a sibling of `lint` — placing it at line 10 (right after `lint`) preserves the family grouping that's used for `test:watch`/`test:coverage`.

**No new deps** — RESEARCH.md A8 confirms; `node` ≥20 is already required for Next.js 16.1.5. Planner should NOT add anything to `dependencies` or `devDependencies`.

---

## Shared Patterns

### Markdown Style (applies to all 4 doc artifacts)

**Source:** `BRAND-BIBLE.md`, `docs/motion-guidelines.md`, `01-CONTEXT.md`

**Apply to:** `BRAND-SPINE.md`, BRAND-BIBLE addendum, `01-PLAGIARISM-AUDIT.md`, `01-REPLACEMENT-COPY.md`

| Convention | Concrete example | Apply |
|-----------|------------------|-------|
| Double-hyphen `--`, never em-dash `—` | `BRAND-BIBLE.md:11` `**Raycast Design Language** -- Clean, dark, minimal.` | All four docs |
| Blockquote opener under H1 | `docs/motion-guidelines.md:3` `> Animation patterns and usage guidance for Virtuna.` | BRAND-SPINE.md (line 2 of file) and addendum (under `## Visual Metaphor Lock`) |
| 3-column tables for token-style refs | `BRAND-BIBLE.md:30-41` (Token / Value / Usage) | BRAND-SPINE.md `Banned → Replacement` table; addendum performance budget |
| 4-column tables for surface-mapping | `01-CONTEXT.md:84-95` `<canonical_refs>` block | PLAGIARISM-AUDIT.md findings; REPLACEMENT-COPY.md viewport tables |
| Italic dual-line footer | `BRAND-BIBLE.md:350-351` (`*Virtuna Design System v2.3.5 -- Brand Bible*` / `*Last updated: 2026-02-08*`) | All four docs |
| HTML-tag section wrappers | `01-CONTEXT.md:5-13` (`<domain>...</domain>`), `15-66` (`<decisions>`), `68-97` (`<canonical_refs>`) | PLAGIARISM-AUDIT.md (`<scope>`, `<method>`, `<findings>`, `<sign_off>`); REPLACEMENT-COPY.md (`<viewport>`) |
| `**Bolded:** value` metadata under H1 | `01-CONTEXT.md:3-4` (`**Gathered:** 2026-05-10` / `**Status:** Ready for planning`) | All four docs |
| `### Section title` for H3 (no decoration) | `BRAND-BIBLE.md:28` `### Brand (Coral Scale)` | All H3 sections |
| Decision-ID inline references | `01-CONTEXT.md` uses `D-01..D-19` to anchor every decision; `01-RESEARCH.md` cross-references them | BRAND-SPINE.md should reference D-02 / D-03; addendum should reference D-08..D-11 / D-19; PLAGIARISM-AUDIT should reference D-12..D-15 |
| Requirement-ID inline references | `01-CONTEXT.md` references `BRAND-01..06`, `VIZ-01..05` | BRAND-SPINE.md cites BRAND-01..04; addendum cites VIZ-01..05; PLAGIARISM cites BRAND-05; REPLACEMENT-COPY cites BRAND-05/06 + HERO-* |

### Path Reference Style (file:line in docs)

**Source:** `01-CONTEXT.md:106-108` and `01-RESEARCH.md` consistently uses backticked paths with explicit line ranges.

**Apply to:** All addendum and audit references.

```markdown
- **`src/components/hive/HiveCanvas.tsx`** (existing in app at ~43,000 LOC TypeScript)
- `src/components/hive/use-hive-animation.ts:42-49, 121-193` -- RAF-driven animation pattern
```

Pattern: backticked path + colon + line range, separated by `, ` for multi-range. Hyphen for ranges, comma for disjunctions.

### React/Next.js patterns referenced (NOT written) in addendum code examples

**Source:** existing repo conventions (per `CLAUDE.md` + verified files)

**Apply to:** ANY code snippet shown in BRAND-BIBLE addendum (illustrative only — Phase 1 writes no code, but the addendum's example tsx must reflect target conventions to avoid copy-paste errors in Phase 2).

| Pattern | Source | Apply? |
|---------|--------|--------|
| `'use client'` directive on motion/canvas components | RESEARCH.md skeleton line 643, 699 | YES in addendum examples |
| `import ... from "motion/react"` (NOT `framer-motion`) | RESEARCH.md "Pitfall 5"; BRAND-BIBLE addendum tech rationale | YES |
| `import { useId } from "react"` for SVG defs | `CLAUDE.md` "Key Decisions" + RESEARCH.md skeleton line 645 | YES in pipeline example |
| `useReducedMotion()` (motion built-in) for declarative; `usePrefersReducedMotion()` (`src/hooks/usePrefersReducedMotion.ts`) for canvas | RESEARCH.md examples 1 & 2 | YES — distinguish in addendum |
| Path alias `@/components/...` and `@/hooks/...` | `tsconfig.json` convention; verified by RESEARCH.md skeleton lines 701-702 | YES in addendum examples |

---

## No Analog Found

None — every artifact has at least a role-match analog in the codebase.

The closest "no analog" case is `scripts/lint-vocab.mjs` (no existing `.mjs` script in `scripts/`), but the role (CLI utility script with file-I/O + exit codes) IS represented by existing TS scripts and `.githooks/post-commit`. Planner can reference both.

---

## Metadata

**Analog search scope:**
- `BRAND-BIBLE.md` (whole file, 351 lines)
- `docs/motion-guidelines.md` (header + first 60 lines)
- `docs/tokens.md` (referenced via index in `BRAND-BIBLE.md:340`)
- `.githooks/post-commit` (whole file)
- `.githooks/README.md` (whole file)
- `.planning/phases/01-brand-spine-visual-metaphor/01-CONTEXT.md` (whole file)
- `.planning/phases/01-brand-spine-visual-metaphor/01-RESEARCH.md` (whole file, in chunks)
- `.planning/reference/` directory listing
- `package.json` (whole file)
- `scripts/` directory listing + heads of each script
- `src/components/hive/` directory listing
- `src/components/hive/use-hive-animation.ts` lines 40-115 (verified RESEARCH.md line refs)
- `src/hooks/usePrefersReducedMotion.ts` (whole file, 29 lines)

**Files scanned:** ~14 (all read or directory-listed)
**Pattern extraction date:** 2026-05-10
**Confidence:** HIGH — every pattern citation is backed by a direct file:line read or a directory listing in this session.

---

## PATTERN MAPPING COMPLETE

**Phase:** 1 — Brand Spine & Visual Metaphor
**Files classified:** 7
**Analogs found:** 7 / 7

### Coverage
- Files with exact analog: 6 (4 docs + pre-commit hook + package.json entry)
- Files with role-match analog: 1 (`scripts/lint-vocab.mjs` — closest role match is TS scripts; new convention `.mjs` is justified)
- Files with no analog: 0

### Key Patterns Identified
- **Repo doc style is consistent and tight:** `BRAND-BIBLE.md` and `docs/motion-guidelines.md` share `--` separators, blockquote openers, 3-column tables, italic two-line footers. All four Phase 1 docs should mirror this style verbatim.
- **Phase-doc convention uses `01-` prefix on every artifact** (`01-CONTEXT.md`, `01-RESEARCH.md`, `01-DISCUSSION-LOG.md`). Planner must add `01-` to RESEARCH.md's `PLAGIARISM-AUDIT.md` / `REPLACEMENT-COPY.md` filenames → `01-PLAGIARISM-AUDIT.md`, `01-REPLACEMENT-COPY.md`.
- **HTML-tag section wrappers** (`<domain>`, `<decisions>`, `<canonical_refs>`) are a stylistic convention in `.planning/phases/` docs — apply to new audit + replacement-copy docs as `<scope>`, `<method>`, `<findings>`, `<sign_off>`, `<viewport>`.
- **Existing `.githooks/post-commit` uses `#!/bin/sh`, NOT `#!/usr/bin/env bash`** — RESEARCH.md skeleton suggested bash; planner should use sh for consistency.
- **`scripts/` is a TypeScript-via-tsx zone today** — the new `.mjs` is a deliberate divergence (no-deps requirement, no-tsx in pre-commit hot path); planner must NOT switch it back to `.ts`.
- **`package.json` scripts use colon-grouping** (`test:watch`, `extraction:auth`) — `lint:vocab` fits the family.
- **BRAND-BIBLE.md addendum target is line 351 (after the existing date footer)** — append cleanly with new `---` + `## Visual Metaphor Lock` + new updated date footer; do NOT insert mid-file.

### File Created
`/Users/davideloreti/virtuna-v1.1/.planning/phases/01-brand-spine-visual-metaphor/01-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files for Plans 1-4.
