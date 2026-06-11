# 01-01 SUMMARY — ENG-02 §-cite honesty (remap + prose-discipline)

> Plan 01-01. Apollo §-citation grounding made honest in-engine. Audit-first,
> co-review-gated. Davide chose **remap + prose-discipline** from faithful runtime
> evidence. Shipped + version bumped 3.13.0 → 3.14.0. 2026-06-11.

## What changed (why the existing smoke wasn't enough)
`scripts/apollo-core-smoke.ts` is NOT the production path — it reads the FULL
`KNOWLEDGE-CORE.md` (incl. §2.6/§7/§8), defines its own instruction, dumps an ad-hoc
signal bundle, and asks for free prose. Its §-cites are unfaithful evidence. Built a
**faithful harness** (`scripts/apollo-cite-harness.ts`) that exercises the real path
byte-for-byte: lean `APOLLO_SYSTEM_PROMPT` (§1–§6) + real `buildDeepSeekUserMessage`
(structured §4 JSON) + sighted video + the production `reasonWithDeepSeek` itself, then
harvests every §-token from the structured output and splits **auditable metadata**
(`lever`/`evidence`/`lever_fixed`) from **user-facing prose** (`ceiling_capper`/
`confidence_scope`/`suggestions`/`variant`).

## Task 1 — runtime §-cite resolution table (test video, composite 53)
| §-token | Resolves to lean core? | Count | Where emitted |
|---|---|---|---|
| §2.1 | ✅ YES | 10 | lever×3, lever_fixed×3, **+ ceiling_capper, confidence_scope, suggestions** |
| §2.2 | ✅ YES | 5  | lever×1, lever_fixed×1, **+ suggestions×2** |
| §2.3 | ✅ YES | 6  | lever×3, lever_fixed×1, **+ suggestions** |
| §2.5 | ✅ YES | 3  | lever×1, **+ ceiling_capper** |

Two findings:
1. **Danglers = NONE.** Every emitted cite resolved to the lean core; no §2.6/§7/§8/§9
   hallucination on this video (answers D-07). The lean prefix already constrains the
   model — the dangling-cite risk did NOT fire on the faithful path.
2. **Prose-leak = REAL, 7 hits.** §-cites leaked into `ceiling_capper` (§2.1, §2.5),
   `confidence_scope` (§2.1), and `suggestions[0/1/2].text` (§2.1/2.2/2.3) — exactly
   F31, and broader than F31 noted (confidence_scope + all suggestions also leak). This
   is the live happy-path bug: the board renders these verbatim → cryptic "(§2.1)".

## Task 2 — decision (Davide, 2026-06-11): REMAP + PROSE-DISCIPLINE
- **Not restore:** no dangler to fix; would re-bloat the cached prefix with §2.6/§7/§8.
- **Not redesign:** F31 downgraded it — the leak is prose-only, no taxonomy rebuild
  needed unless Phase 4 chat later wants a shared legend.
- **Chosen:** prose discipline (the real fix — keep § out of prose) + remap guard
  (cheap insurance for longer/denser/different content a single run can't rule out).

## Task 3 — fix shipped
- **Prose discipline (prompt):** `APOLLO_INSTRUCTION` (apollo-core.ts, in the cached
  system prefix) + the user-message JSON contract (deepseek.ts) now instruct Apollo to
  put § tokens ONLY in `lever`/`evidence`/`lever_fixed` and NEVER in prose. The old
  contract line literally told it to cite inside `ceiling_capper` — that was the leak
  source; removed.
- **Remap guard (backstop, V5):** `guardApolloCites()` in the deepseek.ts post-parse
  backstop. Metadata fields → strip danglers (cites not in `PRESENT_SECTIONS`), keep
  valid. Prose fields → strip ALL § tokens, tidy whitespace/orphan parens, never empty
  a required string. Logs a single `cite_drift` warning with the stripped set.
- **Whitelist:** `PRESENT_SECTIONS` exported from apollo-core.ts (§1/§2.0/§2.0a/§2.1–2.5/
  §3/§4/§4.1/§5/§6) — single source of truth, kept in lockstep with `KNOWLEDGE_CORE`.

## Version
**Bumped 3.13.0 → 3.14.0** (both prefix bytes AND prose output shape change). `version.test.ts`
assertion updated. D-23 auto-invalidates stale 3.13.0 cached rows on next analyze call.

## Verification
- `apollo-cite-resolution.test.ts` (new, 8 tests): §9 dangler stripped + §2.2 kept;
  §2.6/§7/§8 stripped from evidence; valid lever/evidence preserved byte-for-byte; ALL
  cites stripped from ceiling_capper/confidence_scope/suggestions/variant; never-empty
  guard; whitelist membership. GREEN.
- `deepseek.test.ts` (41) + `version.test.ts` (3) GREEN — no regression. 52/52.
- **Live re-run of the faithful harness post-fix:** `prose_leaks 7 → 0`, `danglers 0`,
  ceiling_capper now clean readable prose; cites retained in metadata. Defense-in-depth
  (prompt discipline + guard) both confirmed on the real path.

## Files
- `src/lib/engine/apollo-core.ts` — prose-discipline instruction + `PRESENT_SECTIONS`
- `src/lib/engine/deepseek.ts` — `guardApolloCites()` + contract-line fix + wire-in
- `src/lib/engine/version.ts` + `__tests__/version.test.ts` — 3.14.0
- `src/lib/engine/__tests__/apollo-cite-resolution.test.ts` — new (8 tests)
- `scripts/apollo-cite-harness.ts` — new faithful runtime evidence rig

## Ripple to other plans
- **No redesign → no schema/contract change for plan 02 (ENG-06).** The lever taxonomy
  stays free-text. Plan 03's `buildDeepSeekUserMessage` rebuild should preserve the
  prose-discipline contract line + keep `guardApolloCites` running post-parse.
- **Phase 2 (board):** F32 ("What drives it" re-source) + F31 prose render are still
  Phase-2 display work; the engine now emits clean prose, so the board no longer needs
  to strip § itself. Note for BTEST.
- `KNOWLEDGE_CORE` and `PRESENT_SECTIONS` must change together if a cited section is
  ever added/removed.
