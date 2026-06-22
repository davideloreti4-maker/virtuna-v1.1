# Atlas 05 — Grounding / Knowledge Core trace + the LEAN CUT-LIST

> Worktree: `~/virtuna-numen-tools`. File refs are `path:line`. Companion to `docs/PLATFORM-MAP.md` §6 (Grounding) / §9 (gaps) — goes deeper with file:line.
> Generated 2026-06-22 from full codebase trace + 3 parallel sweeps.

---

## JOB A — Grounding / Knowledge Core trace

The grounding system is a **two-tier cache split** (D-03): a byte-stable system prompt (warm DashScope input-cache) + a volatile per-request user message. Everything below serves that split.

### A1. KC compile → byte-stable constants

**Source SSOT** (`.planning/corpus/`): `base.md` (18.4K, domain-general craft brain) + 4 per-mode slices `ideas.md` (16.7K) / `hooks.md` (27.4K) / `chat.md` (5.8K) / `script.md` (15.0K).

**Compiler:** `scripts/regen-kc.ts`
- Reads the 5 `.md` files, escapes each for template embedding — `escapeForTemplate()` `regen-kc.ts:29-34` (backslash → backtick → `${`, order matters, mirrors `apollo-core.ts:4-6`).
- Emits `src/lib/kc/compiled.ts` (**87,733 bytes**, `wc -c`), marked `GENERATED … do not hand-edit`.
- **Compile-time assembly** (`regen-kc.ts:86-96`): each per-mode prompt is `KC_BASE + "\n\n---\n\n" + KC_<MODE>_SLICE`, fixed in source as `KC_IDEAS_SYSTEM_PROMPT` / `KC_HOOKS_SYSTEM_PROMPT` / `KC_CHAT_SYSTEM_PROMPT` / `KC_SCRIPT_SYSTEM_PROMPT`.

**Why byte-stable** (`regen-kc.ts:7-9, 54-58`): no `Date.now()` / `Math.random()` / per-request data in output → re-running on unchanged `.md` yields byte-identical `compiled.ts`. The constant string is a **cache-stable prefix** → DashScope automatic **input-cache hits** (the warm tier). Decoupled from scoring engine — does NOT import `KNOWLEDGE_CORE` / `APOLLO_SYSTEM_PROMPT` (D-08 bounded-context isolation, `regen-kc.ts:59-60`).

> Note: there is **no separate " scripts/regen-kc.ts → KC_* constants" indirection** — the script writes the constants directly. PLATFORM-MAP §6 is accurate; this is the whole compile path.

### A2. `assembleBundle()` — the volatile per-request tier

`src/lib/kc/assembler.ts:214-311`. Produces the **volatile user message** that rides alongside the byte-stable system prompt (`assembler.ts:23-24`). Explicitly a function, never a mutated module const (Pitfall #4 shared-mutable-state guard, `assembler.ts:12-13`). Does NOT import engine/scoring core (D-08, `assembler.ts:27`).

- **Per-mode profile roles** — `MODE_ROLES` `assembler.ts:117-123`, ordered by priority (tail dropped first under cap):
  - `idea`: niche, audience, goals, voice, wins, flops, platform (full creator picture)
  - `hooks`: niche, audience, voice, wins, flops, platform (goals excluded — idea is primary)
  - `chat`: niche, audience, platform (thin, base-heavy, **voice-free** by design D-14)
  - `script`: = hooks set + voice
  - `remix`: = hooks set + voice
  - **VOICE priority guard** (`assembler.ts:109-116`, KCQ-08/D-11/D-12): voice deliberately NOT in tail position so a routine cap-drop sheds wins/flops/platform before the creator's voice.
- **`<<<USER_CONTENT>>>` fence** — `fenceUserContent()` `assembler.ts:140-143`; sentinels stripped first (`stripUserContentSentinels()` `:132-134`) so the fence is unforgeable (mirrors `creator.ts` sanitize). Sections fenced: Creator ask (always) + Per-request overrides + Chain anchor (`:259-263`).
- **4000-char cap** — `BUNDLE_CHAR_CAP = 4000` `assembler.ts:53`. Two-stage enforcement: (4a) drop lowest-priority profile roles whole-line from tail (`:286-292`), then (4b) if fenced user content alone still overflows, `fenceSectionsWithinBudget()` `:156-175` truncates INNER text only — sentinels always intact (CR-01/CR-02 fix: a blind substring could chop the closing sentinel and void the fence).
- **Cold-start honesty** — `isProfileThin()` `assembler.ts:183-193`; thin → `"Creator profile: thin (using {platform} baseline)"` + `"Craft as universal-{platform}"` (`:231-256`). **Never fabricates** a profile value (D-05). Double-checked: even a full row that resolves all-null falls back to thin (`:251-256`).

### A3. Niches taxonomy

`src/lib/niches/taxonomy.ts`. Hardcoded 2-level TS const tree (D-10, no runtime fetch). **10 primaries** (`:53+`): beauty, fitness, education, comedy, lifestyle (the 5 Phase-1 corpus niches) + food, tech, gaming, fashion, music. Each primary carries:
- `subs[]` — sub-niches (slug + label).
- `personas: PersonaMix[]` `:27-30` — archetype → weight, **sum MUST = 10** (enforced by `taxonomy.test.ts`); consumed by the Phase-7 10-persona Flash SIM.
- `benchmark_filters: BenchmarkFilters` `:38-41` — `tag_filters[]` hashtag tokens + `min_corpus_size`; **consumed by the (disabled) pgvector top-K query** — see A4.

### A4. Retrieval / RAG DISABLED + dormant pgvector pipeline

- **Disabled stub:** `createEmptyRetrievalResult()` `src/lib/engine/retrieval-empty.ts:9-16` → `{ evidence:[], score:null, availability:false, cost_cents:0 }`. Single swap point for M2.
- **Live call site:** `src/lib/engine/pipeline.ts:666` (`const retrievalResult = createEmptyRetrievalResult();`), imported `pipeline.ts:34`. Aggregator null-safe path treats `score:null` as 0; the **0.05 retrieval weight redistributes** across other stages with no aggregator edits (`retrieval-empty.ts:5-6`).
- **Dormant full pipeline:** `src/lib/engine/retrieval/` — 6 files, **774 LOC**: `retrieval-stage.ts` (299, defines `runBenchmarkRetrieval()`), `bucket-derivation.ts` (176), `embedder.ts` (143), `pgvector-client.ts` (93, Tier1/2/3 relaxation), `re-ranker.ts` (63), `cli/embed-corpus-args.ts`. **`runBenchmarkRetrieval()` is imported only by its own test** — zero live request-path imports. Status: **keep-for-M2** (the corpus-grounding moat re-enables here), not "cut now."

### A5. Version provenance

`KC_GEN_VERSION = "gen.1.1.0"` `src/lib/kc/kc-version.ts:26`. Decoupled from `ENGINE_VERSION` (never cross-import, `:4-9`). Stamping helper `kcStamp()` `src/lib/kc/kc-stamp.ts:76-78` → `{ kcGenVersion }`, landed as a message-body JSONB field (`KC_PROVENANCE_FIELD` `:67`). **Now wired** (header says "P1-deferred, now wired") across every tool route — confirmed in `chat/route.ts`, `script/route.ts`, `hooks/route.ts`, `read/route.ts`, `explore/route.ts`.

---

## JOB B — The LEAN CUT-LIST (prioritized)

Sweep verdicts from 3 parallel traces + direct verification. "Blast-radius" = risk of removal.

### B1. Prioritized cut table

| # | Cut-candidate | file:line | Why cuttable | Blast-radius |
|---|---|---|---|---|
| 1 | **`_dormant/` engine tree** — 39 non-test TS files, ~7.3K LOC (old corpus eval/metrics/ML, board UI, removed stages) | `src/lib/engine/_dormant/` | **Zero real imports** from live code — the 3 hits in `aggregator.ts` / `flop-warning.ts` / `analyze/route.ts:207` are **comments only**, not import statements (verified). 100% isolated. | **MEDIUM** (large delete, but no runtime refs; only loses git-history context) |
| 2 | **Dead-shipped legacy simulation UI** — 14 files (`impact-score.tsx`, `results-panel.tsx`, `behavioral-predictions.tsx`, `attention-breakdown.tsx`, `insights-section.tsx`, `loading-phases.tsx`, `share-button.tsx`, …) | `src/components/app/simulation/*` + `src/components/app/test-creation-flow.tsx` | Mounted **only** via `TestCreationFlow`, which is **referenced by nothing live** (grep: zero hits outside its own file). Live `(app)/layout.tsx:4` pulls only `AppShell`. Barrel `components/app/index.ts:22-30` re-exports the whole dead surface (tree-shaken at build, dead in source). This is where the **dead percentile UI** actually lives (`behavioral-predictions.tsx` renders fold percentiles, but the surface is unmounted). | **LOW** (cut `test-creation-flow.tsx` + `simulation/` + 9 barrel lines; verify no Storybook/test relies on it) |
| 3 | **Dormant pgvector retrieval pipeline** — 6 files, 774 LOC + retrieval tests (~1.5K LOC) | `src/lib/engine/retrieval/*`, `src/lib/engine/__tests__/retrieval/` | `runBenchmarkRetrieval()` imported **only by its own test**; live path uses the empty stub (A4). **BUT** = the M2 corpus-grounding moat. **Recommend KEEP, gate behind a clear `// DORMANT — M2` marker**, not delete. If forced to cut for leanness: LOW risk (stub stays). | **LOW** (stub unaffected) — but strategic keep |
| 4 | **Dead engine signals** (5): `ml_score`, `rule_score`, `trend_score`, `audio_fingerprint`, `platform_fit` | produced as `null`: `aggregator.ts:1174/1170/1171/1183/1253`; signal_availability `false`: `:796/799` | All emit `null`; **not in `SCORE_WEIGHT_KEYS` (only `["behavioral","apollo"]`, `aggregator.ts:87`)**; overall-score math (`:883-897`) never references them. Still listed in `learning/fit-weights.ts:25,35` + `learning/predict.ts:37,42` at **0 weight** (back-compat fit-vector shape) and in dead UI (`impact-score.tsx:54-66`, itself cut #2). | **LOW–MED** (output fields are public DB/API shape — keep `null` keys for back-compat, or coordinate a version bump; the *matching logic* is already gone) |
| 5 | **`refresh-corpus` cron STUB** — 44-line no-op, returns `200 "Phase 1 stub"` | `src/app/api/cron/refresh-corpus/route.ts:23-34` | Pure pass-through, no DB/scrape logic; 10 of 11 sibling crons are live. Deferred to P11/12. | **LOW** (drop route; remove `vercel.json` schedule entry — harmless 200 otherwise) |
| 6 | **Fake chat citations** — §N section labels with no RAG behind them | `src/lib/chat/seed-context.ts:90-106` (§1–§10 map embedded as prompt instruction text); consumed `/api/analyze/[id]/chat` `route.ts:166` via `buildChatSystemContext()` | No retrieval — labels are a string nudge telling Qwen to cite `§N` from training knowledge (`seed-context.ts:4` "Zero new engine cost"). Honesty-spine violation (PLATFORM-MAP §4.2). Cut ~17 lines of label instructions. | **LOW** (Qwen stops emitting fake `§N`; no backend logic removed) |
| 7 | **Deactivated rubric critic** — 255 LOC, env-gated OFF | `src/lib/engine/flash/rubric-critic.ts:58-60` (`isRubricCriticEnabled()` → `RUBRIC_CRITIC_ENABLED === "true"`, default false); call sites `hooks-runner.ts:50,363`, `ideas-runner.ts:57,334` | Failed ~100% of candidates in P13 (memory `[[rubric-critic-deactivated]]`); gated OFF, never hits API when off. Isolated (only imports qwen client + strip + flash-prompts). **Recommend KEEP** (reactivation = flip env var, no code change) unless committing to never-revive. | **MEDIUM** (delete file + 3 conditional call sites in 2 runners; loses reactivation path) |
| 8 | **Two remix entry points** — `/api/tools/remix/run` (SSE full pipeline) vs `/api/remix/adapt` (JSON adapt-only) | `tools/remix/run/route.ts:78`, `remix/adapt/route.ts:65` | **NOT redundant** — both live, both UI-wired (`use-remix-stream.ts:137` and `use-adapt-concepts.ts:40` → `AdaptFrameBody.tsx:142`), share `generateAdaptConcepts()` (`engine/remix/adapt.ts`). `run` = URL→decode→adapt; `adapt` = re-adapt from existing decode. **KEEP both.** | **LOW** (cutting either silently breaks one UI feature) |
| 9 | **Dormant corpus CLI scripts** — `embed-corpus.ts`, `build-corpus.ts`, `download-corpus-videos.ts`, `upload-corpus-videos.ts` (~500+ LOC) | `scripts/*` | Offline tooling, no live request-path wiring; depend on the dormant `retrieval/` (cut #3). Same M2 fate as #3. | **LOW** (offline only) — keep-with-M2 or cut alongside #3 |
| 10 | **Benign deprecated re-exports / shims** | `primitives/GlassTextarea.tsx:1-6`, `primitives/GlassInput.tsx:2` (`@deprecated` → UI re-export); `stores/bookmark-store.ts:26-29` (`_hydrate()` no-op + deprecated `toggleBookmark()`); `insights-section.tsx:109-111` (`InsightsSection = SuggestionsSection` alias) | Intentional back-compat shims, ~50 LOC total. Low value to cut individually; sweep opportunistically. | **LOW** (verify each shim's old callers are gone first) |

### B2. What is LIVE (do NOT cut — agents/intuition might flag wrongly)

- **Konva / canvas board** — `react-konva` 19.2.4 + `konva` 10.3.0 in `package.json` are **actively shipped**: `board/GroupFrame.tsx:1`, `BoardCanvas.tsx`, `Board.tsx`, `Node.tsx`. `AdaptFrameBody.tsx` is LIVE (desktop canvas adapt overlay). **Not legacy.** (PLATFORM-MAP doesn't claim otherwise; flagging because the brief listed it.)
- **Behavioral percentiles data** — the *fold-derived* percentile values are real; only the *display surface* (`app/simulation/behavioral-predictions.tsx`) is the dead-shipped one (cut #2). The live reading surface uses its own components.
- **Both remix routes** (#8).

---

## Open questions

1. **Dead-signal output keys** — are `ml_score`/`rule_score`/`trend_score`/`audio_fingerprint`/`platform_fit: null` part of the persisted `analysis_results` JSONB or external API contract? If yes, removing the keys needs an `ENGINE_VERSION` bump + cache invalidation; if internal-only, they're free to drop. **Confirm before cutting #4's output fields** (the matching logic is already safe to delete).
2. **`_dormant/` — archive vs delete?** It's 7.3K LOC of git-tracked history. Delete to shrink the tree, or move outside `src/` (e.g. `archive/`) so it stops counting as shipped code while staying recoverable? Owner call.
3. **Rubric critic + retrieval pipeline + corpus scripts (#3, #7, #9)** — these are the "kept for later" cluster. Is M2 corpus-grounding still on the roadmap (memory says gen-engine work is in `DEBT-BACKLOG.md`)? If M2 is dead, all three become hard cuts (~1.5K LOC + 255 + 500). If alive, mark them `DORMANT — M2` and leave. **This is the single biggest leanness decision.**
4. **`test-creation-flow.tsx` / `app/simulation/`** — confirm nothing in Storybook, e2e, or a hidden route mounts `TestCreationFlow` before deleting (grep found none in `src/`, but check `.storybook`, `tests/`, `e2e/`).
5. **`vercel.json`** — does it still schedule `refresh-corpus`? Remove the entry when cutting #5.
6. **Barrel-export hygiene** — `components/app/index.ts` re-exports 8 dead simulation symbols. After cut #2, prune those lines or the barrel keeps the dead surface reachable.
