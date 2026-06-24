# AudienceSignature — Fresh-Session Handoff

> ✅ **MILESTONE 1 MERGED to main 2026-06-24** — PR #24, squash `158a4aea`, branch deleted.
> AudienceSignature build (steps 1–9) COMPLETE + dead-code cuts G1/G2 (−13.6K net LOC) +
> pre-existing DELETE-CSRF bug fixed. Full suite green (3021/0). The "what's next" below is the
> post-merge plan; the historical build log is preserved further down. Read `docs/DISSECTION-BACKLOG.md`
> ("▶ Recommended next sequence") alongside this.

## ▶ Next session — recommended sequence (post-merge)

1. **Validate live what shipped** (~$0.10, owner drives dev server): step-7 creator voice +
   step-8 `sell` lens — wiring is byte-proven but LLM-honors-behavior is unobserved. Prove it works.
2. **A1 DECISION (🔴 strategy):** audience `persona_weights` + the whole flywheel/drift loop are
   read by NOTHING in prod — text runners `void` them AND the Max video path (`pipeline.ts:772
   selectPersonaSlots(contentType, niche)`) routes by content/niche, not audience weights. The
   step-9 drift cron + flywheel derive→nudge→re-bake weights with no consumer. Decide: wire-to-Max /
   wire-to-text / formally dormant + stop the weekly Apify re-scrape cron. (Voice/dispositions half
   IS live via repaint — only the numeric weights are inert.)
3. **Next subsystem (§03 generative skills):** S2 (chat off the hooks/ideas critical path) +
   S5 (delete the dead rubric critic, 255 LOC).
4. Then R1 (fold model flip + cost), G-D retrieval/corpus surgery, backend/grounding, 🟡/🟢 polish.

> ⚠ This worktree (`~/virtuna-engine-rework`) is on the merged local `rework/engine-core` (remote
> deleted) — prunable. Next milestone launches a fresh worktree off `main`.

---

## (Historical) original step-9 handoff banner

> Track A (wire-live) + Track B step-7 (gen/SIM) + step-8 (composer intent, GAP-C1/C2) are
> **DONE, committed, pushed, verified** on `rework/engine-core` (HEAD `0b962d5a`). Plus E1 CSRF
> fix landed. This is the only file the next session must read first; pull the rest on demand.

---

## Paste this as the opening prompt

```
Read docs/subsystems/audience-signature-handoff.md + docs/DISSECTION-BACKLOG.md. The
AudienceSignature build is done through step-8 (intent lens GAP-C1/C2 wired to all 5 skills);
E1 CSRF gap fixed. Branch rework/engine-core, HEAD 0b962d5a, origin synced. Guardrails: do NOT
touch ENGINE_VERSION (3.19.0); keep signature gated behind non-general; keep the
General-regression gate green (run: node ./node_modules/vitest/vitest.mjs run
src/lib/tools/runners/__tests__/steer-closure.test.ts).

Pick up at Track B step 9 (flywheel/drift re-bake) — re-bake the frozen signature on the
weekly drift cron (the ONLY place it re-bakes, per audience.md §P). FIRST trace the existing
recalibration/drift path (src/lib/flywheel/* + cron/audience-drift) and confirm scope with me
before building. After step 9, the milestone continues with the dissection backlog cuts (see
that file's "next-session sequence").
```

---

## State of the world (2026-06-24, end of session)

- **Worktree:** `~/virtuna-engine-rework`, branch `rework/engine-core`. **HEAD `0b962d5a`,
  origin synced (`0 0`).** Working tree clean.
- **Done this session:** step-8 composer intent (GAP-C1+C2, "keep 2 derive down" — see
  `audience.md` §P.10 + `intent-lens.ts`) · E1 CSRF guard on ideas/ideas-develop/refine/react.
- **DB:** migration `20260624000000_audience_signature.sql` **APPLIED** to project
  `qyxvxleheckijapurisj` (virtuna-v1.1, = `.env.local`). `audiences.creator_persona` +
  `audiences.signature` jsonb cols live. Generated types match (no drift).
- **Design SSOT:** `docs/subsystems/audience.md` §P. Backlog: `docs/DISSECTION-BACKLOG.md`
  (A7·S1·E1 FIXED; DONE section has the full 2026-06-24 session log).
- **Guardrails HELD:** `ENGINE_VERSION` 3.19.0 untouched · signature gates behind non-general
  ONLY · General-regression gate green (prompt-level byte-identical proven).
- **⚠ Auto-wip hook caveat:** the post-commit auto-wip/auto-push hook bundles uncommitted work
  + races explicit commits. Commit promptly with a real message (or consider disabling the hook
  for focused build sessions: it lives in `.githooks/`).

## Next-session sequence (highest value first — full detail in DISSECTION-BACKLOG.md)

1. **Step 9** — flywheel/drift re-bake (closes the AudienceSignature build).
2. **G-D decision + G1/G2 cuts** — `_dormant/` ~7.3K LOC + dead simulation UI (14 files); G-D
   ("is M2 RAG alive?") gates ~2K more. Verify zero real imports BEFORE deleting.
3. **S5** (rubric critic OFF ~100% fail — recalibrate or delete 255 LOC) · **S2** (chat off the
   hooks/ideas critical path).
4. **R1** (fold model omni-flash→omni-plus flip + cost call — see memory engine-model-assignment).
5. Squash auto-wip noise (`/gsd-pr-branch`) → PR → squash-merge to main.

### Audience loose ends (lower priority, after step 9)
- Remix generation-voice not wired (adapt path skips `assembleBundle`).
- 2× ~$0.05 live E2Es: LLM honors step-7 creator voice + step-8 sell buying-frame (unobserved live).
- Backlog A1/A2 (legacy profile/weights paths now superseded by §P — decide cut vs leave additive),
  A3 (sell/authority same weights — intentional, document), A4 presets inert, A-T target 3-position.

---

## ✅ Done this session

| Item | What | Files |
|---|---|---|
| Track A.1 | Migration applied to DB; types no-drift | `supabase/migrations/20260624000000_audience_signature.sql` |
| Track A.2 | Full authed browser UAT (create→calibrate→reveal→persist→navigate, @doctormike, real Apify+DashScope) | — (live) |
| A7 fix | Orphan draft row — calibrate route accepts `audienceId` → `updateAudience` in place (no dupe). Live-verified row_count 1. +route test | `src/app/api/audiences/calibrate/route.ts`, `route.test.ts` |
| S1 fix | `script`/`remix` were niche-blind (raw `niche_primary`) → now route through shared `buildReactionPanel` (resolveNicheKey) | `script-runner.ts`, `remix-runner.ts` |
| Step-7 SIM | **FINDING: already live.** `personasFromSignature` maps `repaint = reaction_frame`; runners fold repaint into `buildNicheAwareSystemPrompt`. No work needed. | `calibration.ts:103` |
| Step-7 generation | **DONE.** New `applyCreatorPersona(profileRow, audience)`: voice FALLBACK (manual `writing_voice_sample` wins; auto-derived `writing_style_sample` backfills) + `content_description`/`context` steer into overrides. Wired into idea/hooks/script runners. +unit test (6 cases). | `src/lib/audience/apply-creator-persona.ts`, ideas/hooks/script runners |

**Hot-path traced:** routes (`hooks`/`ideas`/`script`/`remix`) load audience via `getAudience`
→ `rowToAudience` maps `creator_persona` (repo:199) → pass `audience: activeAudience` to runner
→ `applyCreatorPersona` → voice+steer reach the assembled prompt. Proven no-LLM (voice sample +
context + content_desc all present; General byte-identical).

**Verify (all green this session):** tsc clean (src) · eslint 0 errors · 104 runner+kc + 149
audience/gate tests pass. Pre-existing only: 3 DELETE-415 route quirks, 1 stale eslint-disable.

---

## ✅ Track B step 8 (composer intent C1/C2) — DONE 2026-06-24

**GAP-C2 DECIDED: "keep 2, derive down"** (confirmed with user). Composer keeps the 2-value
per-run lens (`grow|sell`); audience's 4-value `goal_intent` maps down for the default
(authority/nurture→grow — already baked into weights + repaint at calibration). C1 plumbed:
intent reaches all 5 skills. See `docs/subsystems/audience.md` §P.10 + `DISSECTION-BACKLOG.md`
DONE 2026-06-24. New module `src/lib/audience/intent-lens.ts`; SIM seam = sell directive in the
`buildFlashUserContent` user message (system-prompt cache prefix + ENGINE_VERSION untouched).
Gate-safe (General → undefined no-op). 413 tests green; tsc/eslint clean (no new issues).

## ▶ What's next — Track B step 9 (flywheel / drift re-bake)

1. **Step 9 flywheel/drift** — mostly built per the original handoff; re-bake the frozen signature
   on the weekly drift cron (the ONLY place it re-bakes — intentional, §P).

### Deferred / loose ends (lower priority)
- **Remix generation voice** — remix generates via the adapt path (not `assembleBundle`), so the
  step-7 creator voice is NOT wired there. Small consistency fix if desired.
- **Live E2E of step-7/8** — wiring is proven; the LLM-honors-voice (step 7) and LLM-honors-buying-frame
  (step 8 sell lens) behaviors are unobserved live (~$0.05 each to check). Optional.

> Start in a FRESH context.

---

## Gotchas / decisions to carry forward

- **Additive, not a rename.** `signature`/`creator_persona` are NEW nullable cols; legacy
  `profile`/`personas`/4-weight-cols stay (back-compat + regression gate). Calibration populates BOTH.
- **Weights are derived** (reality-first); `personasFromSignature` maps `repaint = reaction_frame`
  (this is why the SIM half was already live — don't re-build it).
- **Voice wiring is FALLBACK** (decided): manual profile voice wins; auto-derived backfills only
  when absent. General/no-audience → `applyCreatorPersona` returns inputs unchanged (gate-safe).
- **All enrichment/calibration I/O injectable** (`EnrichDeps`/`CalibrationDeps`) → unit tests zero-LLM.
- **Vitest:** use `node ./node_modules/vitest/vitest.mjs run …` ([[vitest-rtk-shim]]).

## Anchors

| Concern | File |
|---|---|
| Design SSOT | `docs/subsystems/audience.md` §P |
| Backlog (A7/S1 fixed, session log) | `docs/DISSECTION-BACKLOG.md` |
| Step-7 generation helper | `src/lib/audience/apply-creator-persona.ts` |
| Step-8 intent lens (C2) | `src/lib/audience/intent-lens.ts` · `flash-prompts.ts` `SELL_LENS_DIRECTIVE` |
| SIM seam | `src/lib/engine/flash/build-reaction-panel.ts`, `run-flash-text-mode.ts` |
| Calibration (signature→legacy map) | `src/lib/audience/calibration.ts` |
| Generation runners | `src/lib/tools/runners/{ideas,hooks,script,remix}-runner.ts` |
| Calibrate route (A7) | `src/app/api/audiences/calibrate/route.ts` |
| Commerce/intent context | memory [[commerce-marketing-intent-track]] |
