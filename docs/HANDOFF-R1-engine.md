# HANDOFF — engine-rework R1′ (model consolidation) + open debt

> Written 2026-06-25 to hand a long session into a fresh one. Worktree `~/virtuna-engine-rework`
> (branch `rework/engine-core` historically; active work on short-lived `fix/*` branches off `main`).
> Tests run via `node ./node_modules/vitest/vitest.mjs run` (plain `npm test`/`npx vitest` print fake
> PASS). tsc baseline = **15** (pre-existing, in test files + onboarding-store). ENGINE_VERSION 3.20.0.

---

## 1. What SHIPPED this session — R1′ Part A (model consolidation)

PR for branch `fix/r1-fold-modernize` (squash → main). **The platform now runs on exactly two models:**
- `qwen3.5-omni-flash` — the **sensor only** (Wave 0 read + audience-bake watch; the one audio-capable model).
- `qwen3.7-plus` — **everything else** (generation, SIM, fold, chat, decode/adapt, audience synth, Apollo).
- **`qwen3.6-flash` RETIRED** (`QWEN_FAST_MODEL` constant removed).

Commits:
1. `4435ada2` — SIM (`run-flash-text-mode`, batch + N=1) → 3.7-plus; fixed `pipeline.ts` no-video
   text-analyze (was unbounded + thinking-unset → temp:0 + seed + thinking-off + max_tokens:2000);
   deleted dead `wave3.ts` (+ its 2 dead tests).
2. `bcdaf87a` — fold `omni-flash → 3.7-plus` (SIGHTED, DEAF — audio via Wave 0 `audio_event`);
   thinking-off; **persona independence directive** (fold-prompts.ts); **fixed the no-op diversity
   retry** → now perturbs temperature (`FOLD_DIVERSITY_RETRY_TEMP=0.7`); max_tokens 4000→8000;
   retired `QWEN_FAST_MODEL`; stale comments fixed.
3. `66cc0e5f` — `docs/MODEL-POLICY.md` rewritten to the 2-model table; `docs/PLAN-R1-fold.md` status.

**SSOTs:** `docs/MODEL-POLICY.md` (the full per-call model/thinking/token table) · `docs/PLAN-R1-fold.md`
(the Read I/O map + fold analysis + Part B design) · `docs/DISSECTION-BACKLOG.md` (the dissection ledger).

Verify state at handoff: full suite **2716 pass / 0 fail / 28 skip**; tsc **15**; eslint touched dirs **0 errors**.

### ✅ #1 VERIFICATION DEBT — CLEARED 2026-06-26 (R1′ fold validated LIVE, clean PASS)
Drove the REAL `runFold` on one real video (UAT TikTok clip, 5 segments) via new harness
`scripts/fold-validate-r1.ts`. **Clean PASS on all three axes:**
- **latency 40.9s** vs the 90s ceiling (single attempt, comfortable headroom — the "plus is slower" fear is unfounded at normal segment counts);
- **diversity avgCurveRange 0.31** (healthy band 0.27–0.41) — **cleared on the FIRST attempt; the temperature-perturbing retry never fired**;
- **audience-score sane** — watch 54.7% mean with a believable per-archetype spread (skeptics bail 5–15%, engaged 92–100%), attention curve `[0.68→0.41]`; blended proxy 34.3;
- **cost 0.33¢ fold + 0.23¢ omni ≈ 0.56¢** (trivial).

**This confirms the core R1′ hypothesis**: the old diversity collapse was a *small-model + greedy* artifact,
NOT a capability limit — 3.7-plus + the independence directive holds the 10 personas distinct natively.
**Caveat:** only 5 segments tested; a long video (more segments → larger output) would stress latency + the
8000-token cap harder — not yet stress-tested. **Harness note:** use `scripts/fold-validate-r1.ts` (drives the
production `runFold`); the older `scripts/fold-audio-ab.ts` is STALE (tests the retired omni variants inline @4000 tok).

---

## 2. The IMMEDIATE next work — R1′ Part B (audience unification)

**Goal:** the Read fold currently simulates GENERIC archetypes; make it simulate the user's **calibrated
ambient audience** (the moat = one audience substrate across every skill). Keep the fold's per-segment
attention-curve mechanic; only the personas change.

**Why it's clean (verified this session):** the fold's archetypes and the `AudienceSignature` reactors are
the **same 10 slots**. `persona-registry.ts:22` defines the 10 archetype slugs; `audience-types.ts:117`
`SignaturePersona` = "one of the 10 fixed-archetype REACTORS" with a per-archetype **`repaint`** (calibration)
+ `share`. The text SIM already consumes this via `build-reaction-panel.ts` (applies `[archetype, repaint]`
when `audience && !is_general`; **General → no-op = raw archetype = byte-identical**, regression-gate-free).

**Build:**
1. Apply the same `repaint` to the fold's archetype block in `fold-prompts.ts` (mirror build-reaction-panel).
   General/no-audience → no repaint → byte-identical to today (gate-safe, same pattern as S3/A1).
2. **Wire the active audience into the Read pipeline** — `pipeline.ts` / `runFold` don't load it today.
   This is the real work: thread the active `AudienceSignature` from the analyze route → pipeline → `runFold`.
3. **Surface the Read audience reaction on the thread** like the other skills, with the **`SIM-1 Max`**
   badge (Max = with-video; Flash = text-only — see §3).

---

## 3. Strategic decisions LOCKED this session (do not relitigate)

- **Two-model stack** (omni sensor + 3.7-plus). `omni-plus` (paid, audio) REJECTED; `3.7-plus` is the cheap
  sighted-deaf reasoner. Pricing (user-confirmed in DashScope): plus ≈ flash for text, plus output cheaper
  on promo; plus's higher *input* rate only bites on video-token-heavy calls.
- **`3.7-plus` is sighted (video) but DEAF (no audio)** — DashScope-confirmed for both plus + flash.
  Only `-omni` ingests audio → omni stays the sensor only.
- **Reproducibility is NOT a hard requirement** — fold base `temperature` is env-tunable; diversity retry
  perturbs temp.
- **Apollo stays 3.7-plus, thinking ON** — the validated home for thinking (A/B-tuned budget 1500,
  `deepseek.ts:28`). Thinking ON only at Apollo + CALIBRATE synth; OFF everywhere else.
- **Badge semantics (product labels, not model ids):** `SIM-1 Flash` = text-only call; `SIM-1 Max` = with-video.
- **Fold = keep the mechanic, change the personas** (unify onto ambient audience; don't drop the fold).
- **The Read is a creator-vertical flagship** — keep + invest.
- **Population vs audience-fit:** the archetypes already span reach (`cross_niche_curiosity`, `tough_crowd`);
  General-10 = the population baseline; a dedicated "Population·1000" lens is a future GSI tier, not now.
- **`enrich-signature` watch stays on omni** (one-time bake; audio helps voice notes; low priority to change).

---

## 4. Open engine-rework DISSECTION debt (from `docs/DISSECTION-BACKLOG.md`)

Done this/prior sessions: S1–S5, A1–A5/A7, E1, G1/G2/**G4** (fake citations dropped, PR #51),
**E3** (dead grounded-thread cut, PR #52), R1′ Part A (PR #53, **validated live** PR #54),
**R1′ Part B** (fold↔audience unification, PR #55), **omni read null-coercion** (PR #56),
**R2 + R4** (verified resolved, this session). Still **OPEN**:

- **§04 The Read:** ~~R2~~ ✅ **verified resolved** (T1.1 fold-in — video headline = 0.5·apollo + 0.5·fold,
  two independent signals; no double-count); R3 (0.5/0.5 apollo↔fold blend never calibrated — post-launch A/B);
  ~~R4~~ ✅ **verified resolved** (F43 — dead ml/rule/trend/platform_fit signals emit honest nulls, removed
  from blend); R5 (wave0 confidence:1.0 / `applyCtaPenalty` / `FeatureVector` — **verify** consumers).
- **§01 Envelope:** E2 (audience-resolve block copy-pasted ~7 routes → extract one helper).
- **§05 Grounding:** G3 (`refresh-corpus` cron stub no-op); G-D (M2 RAG cut — DEFERRED, surgical per-module pass needed).
- **Audience:** A6 (`(supabase as any)` casts in `audience-repo.ts` — type debt); A-T (implement target 3-position model).
- **Skills:** S6 (`assertBlocksInRegistry` no prod caller — rewire or cut).
- **Minor:** `enrich-signature.ts` header says "qwen3.6-flash synthesis" but synth uses 3.7-plus (stale comment).

---

## 5. Other items raised this session (not engine-lane / cross-cutting)

- **main eslint regression: 39 errors / 66 warnings, ALL UI-lane** (composer, board, command-bar,
  competitors, reading) — surfaced when the UI merge landed on main; logged in DISSECTION-BACKLOG.
  **Owned by the UI worktree**, not engine. Recommend `fix/eslint-main-regression` off main next UI session.
- **PR-2** (ambient modal reads per-card personas) — UI-lane HOLD; cards already carry the personas.
- **PR-3** (user-pressed rewrite-for-audience) — **already live** (`/api/tools/refine` + `startRefine` +
  `composer.tsx` `detectRefineIntent`); only an optional per-card button remains (UI-lane).
- **Competitor-intelligence subsystem** (`src/lib/ai/*`: `intelligence-service` + `deepseek` + `gemini`)
  runs on **`deepseek-chat` + `gemini-2.5-flash-lite`** — a NON-Qwen provider stack, live (used by
  `competitors/[handle]` + `api/intelligence`). Out of scope for the Qwen model policy; a future
  provider-consolidation decision (keep DeepSeek/Gemini vs move to Qwen?).
- **Bulk branch cleanup** (44-branch triage in `.planning/WORKTREE-DEBT-LEDGER.md`) was deferred until
  engine-rework lands — now largely unblocked.

---

## 6. How to continue (fresh session)

1. `git worktree list` + confirm branch BEFORE `cc`. Work off `main` on short-lived `fix/*` branches.
2. Start either: **(a) R1′ Part B** (audience unification — §2, the highest-value continuation), or
   **(c) §04 backlog hygiene** (R2/R4 verify-and-mark — cheap, no spend).
   ~~(b) the live R1′ validation~~ ✅ **DONE 2026-06-26 — clean PASS** (see §1; the fold bet is confirmed).
3. Recommended order: **R1′ live validation is done (PASS)** → next is **Part B** (the audience unification).
4. Tests: `node ./node_modules/vitest/vitest.mjs run`. Keep tsc ≤ 15. ENGINE_VERSION bumps only on
   scoring-contract changes (Part B unify is gate-safe → likely no bump).
