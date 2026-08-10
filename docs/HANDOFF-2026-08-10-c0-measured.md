# Handoff — in-thread chat: C0 MEASURED (2026-08-10, session 4)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Position at write time:** `af9e5fc8` (guard×adapt fix) + this doc's commit, on top of session 3's
`7d4bc133`/`3e7b8b58`. Auto-pushed to `origin/lane/in-thread-chat` by the post-commit hook.
**NOT PR'd, NOT merged — main untouched. NO prod flag was flipped.**

## One paragraph

C0 ("flip the built-but-dead adapt levers, measure before building") is MEASURED. Pre-flight found
a real conflict first: Stage A's citation-honesty guard (`templateInstantiated`, built against the
raw-slice contract) strips **23/28 (82%)** of the adapt path's honest citations — measured offline
against the 07-15 briefer A/B raw output joined to the corpus madlibs — and every strip renders a
false "Original — not drawn from a retrieved video". Fixed at the mechanism (corpus-kind marker
threaded adapt→gather→runners; slice contract untouched; gated + committed `af9e5fc8`), then all
three skills were measured LIVE through the composed system (Stage A guards + adapt together).
Verdict: **hooks and script adapt arms are clean and strictly better-instrumented than the slice
arms; ideas is equivocal.** The honest gate (a real outcome signal) stays open — unchanged.

## What was measured (evidence docs, all committed)

| # | Finding | Where |
|---|---|---|
| 1 | **Guard×adapt conflict (FIXED).** madlib check strips honest brief citations: 23/28 on July data, 24/29 counterfactual on the fresh run (clone 5/7, swap 10/13, angle 9/9). No lexical check can verify a remix chain — honest citations share zero words with what the model consumed. Fix: `adaptCorpusBlock` returns `adapted`; false on every internal fallback; runners apply the madlib check only when the slice shipped. Runner-level composition tests added (the seam pure guard tests can't see). | `af9e5fc8` · `citation-guard-adapt.test.ts` |
| 2 | **Hooks re-run through Stage A guards** — 8/8 grounded, briefs kept 2–4/6, dosage varies (swap 10 · angle 8 · clone 5), 0/23 fitted lines over cap, **32/38 hooks cited**, zero runner warnings, receipts survive the diversity cap + trim. July evidence left intact for comparison. | `docs/AB-GROUNDING-BRIEFER-2026-08-10-stage-a.md` |
| 3 | **Ideas, first live measurement** — the subject-bound tension fit is STRICT: briefer keeps ~1/6 per ask. Citation coverage roughly flat vs slice (5 vs 4 of 16 cards) and one case dropped to 0-cited under adapt. Content differences are a craft read (owner's). | `docs/AB-ADAPT-IDEAS-SCRIPT-2026-08-10-ideas.md` |
| 4 | **Script, first live measurement** — the clearest win: adapt arm attributed **4/4** cases (receipts on every script) where the slice arm attributed 0/4 on three cases. Cost: +7–15s per run (the extra flash call). | `docs/AB-ADAPT-IDEAS-SCRIPT-2026-08-10-script.md` |
| 5 | 🔴 **Script adapt leak (1/8 script runs):** a Turn beat shipped VERBATIM prompt boilerplate with unfilled slots — "It was not [the thing they predicted]. It was [the actual finding…]" — echoed from `src/lib/kc/compiled.ts:1317`. Same case also INVERTED the ask's thesis (ask "why founders should post daily" → output "posting daily is ruining your brand"). Both are CHECKABLE properties → C1 judge candidates (unfilled-slot regex; ask-thesis agreement), not Stage-A hotfixes: the failure path (drop beat / retry / warn) is C1's revise-pass design. | case 1 of the script doc |
| 6 | **`GROUNDING_HOOKS_SURFACE=structure`** — hooks-only, Phase 0b experiment flag; the briefer ignores it, so under ADAPT it governs ONLY the fallback slice. Its only measurement is the 07-14 3-arm (no standalone verdict; superseded by remix). Recommendation: flip it WITH hooks ADAPT as a fallback hedge — the verbatim line under the madlib is the measured drift cause and the brief never renders it anyway. | `prompt.ts:258–265` |

## What "flipping" actually means (operational)

- `adapt.ts` is **in main** and prod-built. The flags are env vars: flipping them in Vercel affects
  **prod immediately after a redeploy** — independent of this lane merging. Env vars are write-only
  `sensitive` here and a change needs a REDEPLOY (memory: env-vercel-guide).
- Dev = `.env.local`. The A/B harnesses set them per-process; nothing in this session touched any
  environment.
- Spend note: all 25 live pipeline runs this session were DashScope flash credits via the harnesses —
  **zero prod e2e-account credits used.**

## Recommendation (owner call, not taken)

Flip in prod: `GROUNDING_SCRIPT_ADAPT` + `GROUNDING_HOOKS_ADAPT` + `GROUNDING_HOOKS_SURFACE=structure`.
Hold `GROUNDING_IDEAS_ADAPT` until the ideas craft read says the 1/6-kept brief actually helps —
its citation coverage didn't improve and its selectivity may be over-conservative (C1's judge could
also arbitrate this). Then C1 (checkable-judge) with the measured check list: unfilled slots (#5),
ask-thesis agreement (#5), anchor fidelity (already coded, reusable as a judge check), count.

## Open owner decisions

1. **The prod flip above** — and whether ideas ships with it.
2. **F-6 multiplier positioning** (backfill = scraping / stop printing / relabel) — unchanged, blocks part of D.
3. **`composer.tsx` split** with Stage B or surgical only — unchanged.
4. C1 scope sign-off (checks above; judge = same flash model, revise once, stream-while-validating).

## Resume recipe

Same as session 3 (`docs/HANDOFF-2026-08-10-stage-a-built.md` §Resume). Harness re-runs:

```bash
# hooks (8 cases, ~4 min):   node node_modules/tsx/dist/cli.mjs scripts/ab-grounding-briefer.ts
# ideas / script (4 cases):  AB_SKILL=ideas  node node_modules/tsx/dist/cli.mjs scripts/ab-adapt-ideas-script.ts
#                            AB_SKILL=script node node_modules/tsx/dist/cli.mjs scripts/ab-adapt-ideas-script.ts
# ALL: foreground, sandbox OFF (rtk silently drops DashScope/Supabase; background+sandbox-off do not compose).
# Raw dumps land OUTSIDE the repo (~/ab-*.json) — run residue, not committed.
```

## Traps (session-4 additions)

- **The harness output paths are now DATED** (`ab-grounding-briefer.ts` writes `…-2026-08-10-stage-a.md`).
  A future re-run should re-date them or it overwrites this session's evidence.
- `AB_SKILL` selects skill AND suffixes the ideas/script harness outputs — running it without
  `AB_SKILL` writes one combined un-suffixed doc.
- The offline strip-rate checker lives in `.scratch/` (gitignored, worktree-local) — the durable
  guard is `citation-guard-adapt.test.ts`; the numbers are in `af9e5fc8`'s message and this doc.
- The `.claude` memory store is outside this worktree's git root — the path guard blocks Write from
  here; THIS DOC is the durable record (07-15 precedent).
