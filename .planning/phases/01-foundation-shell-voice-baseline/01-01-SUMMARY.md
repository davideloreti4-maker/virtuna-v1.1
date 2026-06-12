---
phase: 01-foundation-shell-voice-baseline
plan: 01
subsystem: marketing-shell
tags: [voice, metadata, seo, anti-snake-oil, foundation]
requires: []
provides:
  - "De-hyped in-voice root-layout SEO metadata baseline (D-11)"
  - "Canonical .planning/VOICE.md voice baseline Phases 2-4 read before writing copy (D-08)"
affects:
  - "Phases 2-4 copy authoring (must obey VOICE.md)"
  - "Plan 03 marketing wrapper (mounts .numen-surface scope — NOT done here, Option B)"
tech-stack:
  added: []
  patterns:
    - "Voice-as-moat: anti-snake-oil rules codified as a durable planning doc, not a section"
    - "Scope-free root body (Option B / D-02): .numen-surface mounts in the marketing wrapper, not root"
key-files:
  created:
    - .planning/VOICE.md
    - .planning/phases/01-foundation-shell-voice-baseline/deferred-items.md
  modified:
    - src/app/layout.tsx
decisions:
  - "D-08 applied: VOICE.md authored as the canonical confident-mentor baseline (jargon ban + hype ban + band+why verdict rule + do/don't lists + example lines)"
  - "D-11 applied: root metadata title/description/OG/twitter de-hyped to the in-voice baseline"
  - "D-02 / Option B honored: root <body> left structurally untouched — no .numen-surface scope mount here"
metrics:
  duration: "~3m (151s)"
  completed: "2026-06-12"
  tasks: 2
  files: 3
requirements: [CONTENT-01, PERF-02]
---

# Phase 01 Plan 01: Foundation Metadata + Voice Baseline Summary

De-hyped the snake-oil root-layout SEO metadata to the in-voice Numen baseline and authored the durable `.planning/VOICE.md` confident-mentor voice guide every later phase reads before writing copy.

## What Shipped

### Task 1 — De-hype root metadata (`src/app/layout.tsx`)
- Replaced the violating `title`/`description` ("Know what will go viral before you post", "AI-powered predictions") with the locked in-voice baseline:
  - **Title:** `Numen — an honest verdict on your content, before you post`
  - **Description:** `Numen reads your video like your sharpest audience would and gives you an honest verdict you can act on. No hype score.`
- De-hyped `openGraph.title/description` and `twitter.title/description` the same way; kept `openGraph.url/siteName/locale/type` and `twitter.card`. OG/share art deferred to Phase 4.
- **Root `<body>` left structurally untouched** — no `.numen-surface` (and no `bg-bg`/`text-text`) added. Per locked D-02 / Option B the token scope mounts on the marketing wrapper `<div>` in Plan 03, keeping the 7 sibling routes untouched.
- Kept unchanged: `inter`/`serif` font wiring, `viewport`, `metadataBase`, `<DevLocator />`, `globals.css` import, body className. Exactly one `<html>` / one `<body>`.
- **Commit:** `dc99aa35`

### Task 2 — Author `.planning/VOICE.md` (D-08)
- Canonical, scannable voice baseline (114 lines, 106 non-heading body lines). Captures:
  - Register: calm, plain-language, **confident-mentor**, second-person.
  - **Hard Rule 1** — zero engine jargon (Apollo/fold/Omni/model/pipeline/…).
  - **Hard Rule 2** — zero hype / fake precision (X% accuracy, go viral, AI-powered predictions, viral score) — the anti-snake-oil moat.
  - **Hard Rule 3** — verdict = calibrated band + one-line why, **never a naked number** (binds Phases 2–3).
  - Specificity-over-abstraction (luma) discipline; do-words / don't-words table; demonstrated example lines (hero H1/subhead per D-08a, honesty heading, metadata title, footer line); per-line self-check.
- **Commit:** `d7ce63c7`

## Verification

| Gate | Result |
|------|--------|
| `grep -q 'numen-surface' src/app/layout.tsx` | NO match (correct — scope mounts in Plan 03) |
| `grep -riE "go viral\|predict viral\|AI-powered prediction\|[0-9]+% accuracy" src/app/layout.tsx` | no matches |
| `grep -q 'Numen' src/app/layout.tsx` | match |
| exactly one `<html>` / one `<body>` | confirmed (1 / 1) |
| `npx tsc --noEmit` | exit 0 — No errors found |
| `eslint src/app/layout.tsx` (changed file) | exit 0 — clean |
| `.planning/VOICE.md` present, ≥30 body lines | present, 106 body lines |
| VOICE.md names confident-mentor / accuracy / go viral / band | all present |

## Deviations from Plan

### Tooling adjustment (not a code deviation)

**1. [Rule 3 - Blocking tooling] Restored declared dev deps so the lint gate could run**
- **Found during:** Task 1 verification. `npm run lint` (bare `eslint`) terminated abnormally (OOM), then `npx eslint` fetched the wrong eslint@10 and failed against the flat config. Root cause: `eslint@^9` is declared in `package.json` but was not installed in `node_modules`; project uses pnpm (`pnpm-lock.yaml` present).
- **Fix:** `pnpm install --frozen-lockfile --prefer-offline` — a deterministic restore of already-declared deps from the lockfile, NOT introduction of a new/unknown package (so the Rule 3 package-install exclusion does not apply — nothing new or unvetted was added).
- **Result:** lint now runs; `src/app/layout.tsx` lints clean.
- **Files modified:** none (node_modules only, untracked).

## Deferred Issues (out of scope — SCOPE BOUNDARY)

Repo-wide `eslint` reports **58 errors / 68 warnings**, all in unrelated engine/store/schema files (`src/lib/engine/*`, `src/lib/schemas/*`, `src/stores/__tests__/*`). The changed file lints clean. Pre-existing, not caused by this plan. Logged to `.planning/phases/01-foundation-shell-voice-baseline/deferred-items.md`; suggested owner = Phase 4 polish (alongside the already-deferred stale-component cleanup).

## Known Stubs

None. (Placeholder copy in VOICE.md example lines is intentional and marked refinable per D-08a — it is a voice deliverable, not a wired-data stub.)

## Threat Flags

None. No new security-relevant surface introduced. Per the plan threat register: static public marketing copy only (no secrets/PII), and VOICE.md is an internal planning doc not shipped to the client bundle. No packages introduced (deps restored from lockfile only).

## Self-Check: PASSED

- Files: `src/app/layout.tsx`, `.planning/VOICE.md`, `01-01-SUMMARY.md` all FOUND.
- Commits: `dc99aa35`, `d7ce63c7` both FOUND in git log.
