---
phase: 02-knowledge-core-generative-rebuild
reviewed: 2026-06-17T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - scripts/kc-gate.ts
  - scripts/regen-kc.ts
  - src/lib/kc/assembler.ts
  - src/lib/kc/assembler.test.ts
  - src/lib/kc/kc-version.ts
  - src/lib/kc/profile-role-map.ts
  - src/lib/kc/compiled.ts
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-17
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the thin code spine that compiles + grounds the Phase-2 Knowledge-Core corpus. `compiled.ts` was judged only as evidence of generator (`regen-kc.ts`) correctness, per scope. The corpus prose (`.planning/corpus/*.md`) is out of scope.

The biggest concern is in `assembler.ts` (GROUND-02, the per-request live-grounding seam). The char-cap enforcement has a logic gap: when the user's fenced request alone is large, the profile-budget calculation goes negative, the role-drop path is skipped, and the function falls through to a blind `substring(0, CAP)` that can truncate **inside the injection fence** — silently dropping the closing `<<<END_USER_CONTENT>>>` sentinel. This is both a correctness bug (malformed output) and a security weakening of the injection fence (CR-01). A related cap-accounting bug means the documented "drop whole roles, never truncate mid-field" guarantee is not actually upheld in the negative-budget case (CR-02).

Secondary issues: an unsafe `as never` cast that defeats type-checking on the Qwen call params, a non-deterministic `Math.random()` shuffle with no seed (acceptable for a throwaway gate but worth noting), and several robustness gaps around empty responses and the platform formatter.

## Critical Issues

### CR-01: Blind final truncation can cut inside the injection fence, dropping the closing sentinel

**File:** `src/lib/kc/assembler.ts:253-256`
**Issue:** The final safety cap hard-truncates the assembled message at `BUNDLE_CHAR_CAP` with a raw `substring`:

```ts
if (result.length > BUNDLE_CHAR_CAP) {
  return result.substring(0, BUNDLE_CHAR_CAP);
}
```

The fenced user sections (`fencedText`) are appended LAST in `parts` (line 244-249). When a large `ask`/`overrides`/`anchor` pushes the total over the cap, this truncation cuts the tail — which is exactly the fenced content — and can chop off the closing `<<<END_USER_CONTENT>>>` sentinel (or cut mid-sentinel). The result is a system/user message where the user-controlled text is no longer terminated by a fence. That defeats the injection-fence defense this module is specifically built to provide (the fence is the only barrier preventing pasted instructions from being read as real instructions by Qwen). The doc comment at line 51-54 even claims "ask/overrides/anchor sections are always included … never dropped," but partial truncation violates the intent.

The existing test (assembler.test.ts:167-193) only stresses a long `ask` and checks `result.length <= CAP` and profile-label completeness — it never asserts the closing fence survives, so this gap is untested.

**Fix:** Never truncate fenced user content. Cap the user-supplied text BEFORE fencing (so the sentinels are always intact), and treat the fence + sentinels as non-droppable structural overhead:

```ts
// Reserve fixed overhead for fences; cap each user field before fencing.
const FENCE_OVERHEAD = "<<<USER_CONTENT>>>\n\n<<<END_USER_CONTENT>>>".length;
function capField(s: string, max: number): string {
  return s.length > max ? s.substring(0, max) : s;
}
// ... cap ask/overrides/anchor against their share of the budget, THEN fence.
// Final guard: if still over cap, drop the lowest-priority *whole* fenced
// section (e.g. anchor) rather than substring the assembled result.
```
At minimum, if a final hard cap must remain, truncate the profile section (which is non-fenced) to absorb the overflow, never the fenced tail. Add a test asserting that for any input the count of `<<<USER_CONTENT>>>` equals the count of `<<<END_USER_CONTENT>>>` in the output.

### CR-02: Negative profile budget skips role-dropping, violating the "drop whole roles" contract

**File:** `src/lib/kc/assembler.ts:224-241`
**Issue:** The budget is computed as:

```ts
const reservedChars = header.length + fencedText.length + profileHeader.length + 4;
const profileBudget = BUNDLE_CHAR_CAP - reservedChars;
```

When `fencedText` (user request) is large, `reservedChars` can exceed `BUNDLE_CHAR_CAP`, making `profileBudget` negative or near-zero. The role-drop loop is gated on `profileSection.length > profileBudget && profileBudget > 0` (line 229). With a negative budget the `&& profileBudget > 0` short-circuits, so **no roles are dropped at all** — the entire `profileSection` is retained and the message blows well past the cap, then gets blindly chopped by CR-01. This defeats the documented strategy ("drop lowest-priority roles … not truncated mid-field", lines 49-52 / 215-217). The intended graceful degradation (shed profile context, keep a well-formed fenced request) never runs in the very case it was designed for.

Additionally, the per-line accounting uses `line.length + 1` for the joining newline (line 233) but `keptLines.join("\n")` adds N-1 newlines, so the running `used` total slightly over-counts — a minor off-by-one that makes the kept set marginally more conservative than necessary (not harmful on its own, but compounds the brittleness).

**Fix:** Handle the negative-budget case explicitly — when `profileBudget <= 0`, drop the profile section entirely (keep only a one-line baseline marker) and ensure the fenced request itself is capped (see CR-01). Remove the `profileBudget > 0` guard from the drop condition so dropping always runs when over budget:

```ts
if (profileBudget <= 0) {
  profileSection = ""; // no room for profile; user request dominates
} else if (profileSection.length > profileBudget) {
  // ... existing whole-line drop loop
}
```

## Warnings

### WR-01: `as never` cast on Qwen call params defeats all type-checking on the API call

**File:** `scripts/kc-gate.ts:138-157`
**Issue:** `callParams` is built as an untyped object literal, then mutated with `temperature`/`seed` via `@ts-expect-error`, then passed as `callParams as never`. The `as never` erases all type safety on the most failure-prone line in the script (the model call). A typo in a field name, a wrong model id, or a shape change in the client signature would compile clean and fail only at runtime. The `Parameters<typeof getQwenClient>[0] extends never ? never : ...` conditional on line 154 is also dead/no-op type gymnastics (`getQwenClient` takes no params) that obscures intent.

**Fix:** Type `callParams` against the client's actual create-params type and include `temperature`/`seed` in the literal so no `@ts-expect-error` or `as never` is needed:

```ts
const callParams: Parameters<ReturnType<typeof getQwenClient>["chat"]["completions"]["create"]>[0] = {
  model: GATE_MODEL,
  messages,
  temperature: 0,
  seed: QWEN_SEED,
};
const response = await ai.chat.completions.create(callParams, { signal: controller.signal });
```

### WR-02: Empty/whitespace Qwen response silently becomes the literal string `"(empty response)"` and is then scored + ranked

**File:** `scripts/kc-gate.ts:170`
**Issue:** `response.choices[0]?.message?.content ?? "(empty response)"` only guards `null`/`undefined`. An empty string `""` is falsy-but-defined and would pass through as `""`, and a non-empty-but-garbage response passes through unchanged. More importantly, when content is genuinely missing the placeholder `"(empty response)"` is then fed to `getFlashSanity` (line 251) and written into the blind output as if it were a real arm generation — the owner ranks a failed call as a legitimate arm, biasing the D-13 gate. A failed/empty arm should be visibly flagged as a generation failure, not silently substituted.

**Fix:** Detect empty/whitespace content explicitly and mark the arm as failed so it is excluded from (or clearly annotated in) the blind ranking:

```ts
const content = response.choices[0]?.message?.content;
if (!content || !content.trim()) {
  throw new Error("kc-gate: Qwen returned empty content");
}
return content;
```

### WR-03: `formatPlatform` is dead in the assembler path — platform role can never reach the formatter

**File:** `src/lib/kc/assembler.ts:189-194` / `src/lib/kc/profile-role-map.ts:132-135`
**Issue:** In the assembler loop, `role === "platform"` is special-cased to always emit `Target platform: ${platform}` from the per-request param (D-07), so `PROFILE_ROLE_MAP.platform` (`formatPlatform`) is never invoked from `assembleBundle`. The map entry and its null-handling are therefore dead code in the only consumer. This isn't wrong per se (D-07 says the param wins), but it means the documented "profile-stored default fallback" (profile-role-map.ts:124-128) is unreachable — if the per-request `platform` is ever absent or invalid, there is no fallback because zod requires `platform` and the loop never consults the profile. Worth flagging as a latent inconsistency between the documented design and the actual control flow.

**Fix:** Either (a) remove the "fallback" language from `formatPlatform`'s doc since it is never used as a fallback here, or (b) if profile-default fallback is genuinely desired, make `platform` optional in the schema and have the assembler fall back to `PROFILE_ROLE_MAP.platform(profileRow)` when the param is absent.

### WR-04: Non-deterministic `Math.random()` shuffle with no seed makes the gate non-reproducible

**File:** `scripts/kc-gate.ts:197-204`
**Issue:** `shuffleArms` uses `Math.random()`. The rest of the pipeline is deliberately deterministic (temp 0 + `QWEN_SEED`), and the file header stresses reproducibility for pilot comparison. An unseeded shuffle means the blind-output ordering (and thus the decode key) cannot be reproduced from a re-run, and there is no way to audit/replay a given gate session. For a one-shot throwaway this is tolerable, but it undercuts the determinism posture the codebase otherwise enforces.

**Fix:** Seed the shuffle (e.g. a small seeded PRNG keyed off `QWEN_SEED` or a CLI `--shuffle-seed`) so a gate run is replayable, OR document explicitly in the header that shuffle order is intentionally non-reproducible and the key file is the only record. The decode key is written to disk, so correctness is preserved either way — this is about auditability.

### WR-05: Test comment/assertion mismatch — "wins/flops honesty" test does not actually prove no fabricated mechanism

**File:** `src/lib/kc/assembler.test.ts:293-303`
**Issue:** The "wins/flops honesty spine" group asserts the output merely *contains* `/creator-reported|directional/i` and `/avoid|flop/i`. These substrings are guaranteed by the formatter templates (profile-role-map.ts:105,120) regardless of correctness, so the test passes trivially and proves nothing about the actual honesty invariant ("no fabricated mechanism behind a URL"). It cannot fail if the formatter regressed to, say, inventing view counts, as long as the caveat string is still present. The test gives false confidence on the most security/trust-sensitive property (the honesty spine).

**Fix:** Assert the *negative* invariant directly — that no fabricated metric/mechanism leaks (e.g. the stored `url` strings and any numeric view/like claims must NOT appear), in addition to the positive caveat presence:

```ts
expect(result).not.toContain("https://tiktok.com"); // raw urls never surfaced
expect(result).not.toMatch(/\d+[kKmM]?\s*(views|likes)/); // no fabricated metrics
```

## Info

### IN-01: `compiled.ts` byte-stability hinges on a generator detail worth a guard test

**File:** `scripts/regen-kc.ts:29-34, 51-90`
**Issue:** Generator correctness looks sound: `escapeForTemplate` escapes `\` first (correct order), then backtick, then `${`, matching apollo-core's rule. The emitted `KC_*_SYSTEM_PROMPT` lines correctly emit *literal* `${KC_BASE}` template-literal references (the `\${` in the generator source produces a real `${...}` in output, so the compiled file interpolates at its own load time — byte-stable since all operands are constants). No `Date.now()`/`Math.random()` in output. This is correct. However there is no automated test asserting that re-running `regen-kc.ts` on unchanged corpus yields byte-identical output (the hard contract). A drift (e.g. a future edit adding a trailing newline or timestamp) would go unnoticed.

**Fix:** Add a CI/test step: run `regen-kc.ts`, then `git diff --exit-code src/lib/kc/compiled.ts` — fail if the generated file changed without a corpus change.

### IN-02: `KC_BASE` etc. exported but unused by hand-written consumers

**File:** `src/lib/kc/compiled.ts:15,69,72,75` (generated)
**Issue:** Only `KC_IDEAS_SYSTEM_PROMPT` is consumed in this phase's code (kc-gate.ts:56). The raw `KC_BASE`/`KC_*_SLICE` constants and the `HOOKS`/`CHAT` system prompts are unreferenced so far. Expected for a generated module staged ahead of Phase 3 wiring — noted, not a defect. Do not strip them (they are part of the generated contract).

### IN-03: Magic numbers in cap accounting

**File:** `src/lib/kc/assembler.ts:224`
**Issue:** `+ 4 // for separators` is a magic fudge factor and the `+1 for newline` (line 233) double-counts vs the actual `join("\n")` (see CR-02). These hand-tuned offsets make the cap math hard to reason about and were part of why CR-01/CR-02 slipped through.

**Fix:** Compute reserved overhead from the actual `parts.join("\n\n")` separators rather than a literal `+4`, or assemble first and measure, then shed. Removing magic offsets makes the budget logic auditable.

### IN-04: `kc-gate.ts` writes output files to repo root

**File:** `scripts/kc-gate.ts:377-382`
**Issue:** `kc-gate-BLIND.txt` / `kc-gate-KEY.txt` are written to `resolve(__dirname, "..")` (repo root). The project CLAUDE.md explicitly says "NEVER save working files, text/mds, or tests to the root folder." These are throwaway artifacts, but they land in the root and (per git log) have been auto-committed there before.

**Fix:** Write to a gitignored scratch dir (e.g. `.planning/phases/02-.../gate-out/` or `tmp/`), or add both filenames to `.gitignore` so the throwaway artifacts don't pollute root or get committed.

---

_Reviewed: 2026-06-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
