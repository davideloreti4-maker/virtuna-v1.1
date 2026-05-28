# Phase 18: M1 Verification Debt Closure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 18-m1-verification-debt-closure
**Areas discussed:** Dead-ref resolution (WR-04/WR-05/IN-01), IN-02 vector cast centralization, IN-03 SSRF allowlist design, UAT execution logistics

---

## Dead-ref resolution (WR-04 + WR-05 + IN-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Verify+close WR-04/WR-05 as already done | Both implemented during M1; plan verifies existing code | ✓ |
| Re-implement WR-04/WR-05 | Not needed | |

**User's choice (IN-01):** Yes to fixing `deepseek.ts` + `rules.ts`. Also audit all other engine files. User clarified: "Qwen also replaced DeepSeek" — confirmed `deepseek.ts` uses `getQwenClient` + `QWEN_REASONING_MODEL` internally.

**Notes:**
- User pointed out the broader Gemini→Qwen migration context: other work also moved from Gemini to Qwen, which is why `gemini.ts` references throughout the codebase became dead. Claude audited all 7 engine files with timers. Only `deepseek.ts` and `rules.ts` have the timer-leak issue (clearTimeout in try but not in catch). `omni-analysis.ts`, `wave3.ts`, `stage10-critique.ts`, `stage11-counterfactuals.ts`, `wave4/platform-fit.ts` are already correct.
- WR-04 and WR-05 discovered as already-implemented during codebase scout — verified in the code before presenting to user.

---

## IN-02 — Vector Cast Centralization

| Option | Description | Selected |
|--------|-------------|----------|
| Create pgvector.ts + replace 2 sites | New `src/lib/supabase/pgvector.ts` with `serializeVector()`, replace 2 `JSON.stringify` instances | ✓ |
| Inline fix — no new file | Add comment at both sites, no centralization | |

**User's choice:** Yes — create pgvector.ts + replace 2 sites.

**Notes:** `as unknown as string` cast was already gone from the codebase (replaced by `JSON.stringify` during M1). The centralization work (creating the utility function) was the remaining piece.

---

## IN-03 — SSRF Allowlist Design

| Option | Description | Selected |
|--------|-------------|----------|
| HTTPS + no-private-IP, log+skip | Permissive: any public hostname, block only RFC1918/loopback | ✓ |
| Also validate Content-Type | Additional response header check | |

**User's choice:** HTTPS + no-private-IP, log+skip.

**Notes:** User was explicit: "don't make the guard high — users should be able to test all kinds of videos (camera roll, exports, downloads, TikTok, IG etc.)." Hostname allowlist explicitly rejected. Guard purpose is to prevent internal network probing (T-06-13 threat model item), not to restrict video sources.

---

## UAT Execution Logistics (VERIF-01/02/03)

| Option | Description | Selected |
|--------|-------------|----------|
| Manual test scripts + pass/fail log template | Claude writes markdown checklists, user executes | ✓ |
| Playwright automation | Automated browser tests | |
| Just a pass/fail log template | No test steps, user improvises | |

**User's choice:** Asked "what's your recommended way" — Claude recommended manual test scripts. User accepted.

**Notes:** Live tests hit Supabase + Qwen/DashScope APIs. Can't be mocked in CI. Playwright would add overhead without value for one-time verification runs. "Defer permanently" escape hatch: checked-in rationale file at same path as the would-be results file.

---

## Claude's Discretion

- Exact wording / structure of VERIF pass/fail log markdown files
- Whether IN-01, IN-02, IN-03 land in one plan or multiple plans
- DNS resolution strategy for IN-03 guard (string-based RFC1918 regex vs actual DNS lookup)
- Whether to split VERIF-01/02/03 UAT scripts into one plan or separate plans

## Deferred Ideas

- **DashScope billing API** — `cost_cents_actual` from billing endpoint; deferred in Phase 17; revisit when `qwen3.5-omni-plus` exits free preview
- **Content-Type response header validation for sound_url** — additional IN-03 hardening; not needed for T-06-13 scope
- **Audio fingerprint re-enable (Phase 16)** — AUDIO-01–05 remain deferred; not part of Phase 18
