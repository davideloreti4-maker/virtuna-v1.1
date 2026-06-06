# 260607-00u · Refine Summary — "Ask the expert" dock v2

**Completed:** 2026-06-07
**Branch:** worktree-agent-a4916b9d873b1992e
**Base commit:** 98e46e20

## One-liner

Unified chat panel with composer variant A (embedded send, ✦ Try chips, coral→Stop), markdown + §citation pills + frame-tag renderer, throttled aria-live, mobile full-height sheet fix.

## Commits

| Hash | Task | Description |
|------|------|-------------|
| 466b8382 | r1 Backend | System prompt: concise/structured format, §citation map, FRAME: instruction + corpus index §1-§10; deriveSeedPrompts: risk/urgency framing; tests updated |
| 635c5506 | r2 Thread | react-markdown + rehype-sanitize, §citation pills, FRAME: tag parser, copy/regenerate controls, jump-to-latest, role=log, throttled aria-live, amber errors |
| 5aa5e612 | r3 Panel+Composer | Unified panel (BAR_HEIGHT/THREAD_BOTTOM_OFFSET deleted), composer variant A, Stop button, ✦ Try row, ↑ recall, ⌘⌫ clear, hook stop/clearMessages |
| 4624dff9 | r4 Mobile+a11y | Mobile full-height sheet (sm:max-h-[55vh] desktop-only, no inline maxHeight), focus-visible rings, prefers-reduced-motion |
| e3199964 | fix | TS2532 possibly-undefined — optional chain on array access + match[1] guard |

## Files modified

| File | Change |
|------|--------|
| `src/lib/chat/seed-context.ts` | System prompt: concise/structured rules, §N citation map (§1-§10), FRAME: instruction |
| `src/lib/chat/seed-prompts.ts` | Sharp signal-driven copy: risk framing, urgency for dims ≤4/10, bold **key-terms** |
| `src/lib/chat/__tests__/seed-context.test.ts` | Updated assertions for new copy + AUDIENCE SIMULATION header check |
| `src/components/command-bar/ExpertChatThread.tsx` | Full rewrite: markdown, §pills, frame-tag, copy/regenerate, jump-to-latest, a11y |
| `src/components/command-bar/ExpertChatInput.tsx` | Full rewrite: composer variant A (embedded send, ✦ Try, Stop, ↑ recall) |
| `src/components/command-bar/CommandBar.tsx` | Full rewrite: unified panel, sticky header/thread/footer, mobile sheet, keyboard |
| `src/hooks/queries/use-expert-chat.ts` | Added stop() + clearMessages() methods |

## Backend guardrails verified

- Qwen/DashScope only — no Claude/Gemini/DeepSeek imports introduced (grep clean)
- Persistence, SSE streaming, GET history replay — unchanged
- Per-analysis cap + rate limit — unchanged
- System prompt updated: instruct CONCISE/STRUCTURED format + §citations + FRAME: tag
- No schema change, no database.types.ts change needed

## Deviations from spec

**[Rule 1 - Bug] TS2532 possibly-undefined on ExpertChatThread array access**
- Found during: Task 2 TypeScript check
- Fix: optional chain `messages[i]?.role`, null-guard on `match[1]`
- Commit: e3199964

**[Rule 1 - Bug] Test assertion `not.toContain('Audience')` broke after adding FRAME list to system prompt**
- Found during: Task 1 test run
- The system prompt now mentions "Audience" in the FRAME instruction; the test was checking audience DATA not present
- Fix: updated test to check `AUDIENCE SIMULATION` section header (more precise)
- Commit: 466b8382

## Known Stubs / Deferred

- **FRAME camera-jump**: frame-tag is static (non-interactive pill). Camera-jump to board frame deferred to v2-the-feature per spec.
- **§citation pills on streaming**: During streaming, react-markdown re-renders each token chunk — citations may flicker mid-stream. Acceptable for v1; de-risk with debounced streaming update in v2.

## Test results

```
✓ src/lib/chat/__tests__/seed-context.test.ts (17 tests) — PASS
✓ src/app/api/analyze/[id]/chat/__tests__/route.test.ts (10 tests) — PASS
Total: 27 tests, 0 failures
```

TypeScript: 0 errors in modified files (3 pre-existing unused-var warnings in route.test.ts unrelated to this work).

Build: Next.js build on worktree fails at `/showcase/utilities` with `InvariantError: workUnitAsyncStorage` — pre-existing issue on this worktree (confirmed: engine-opt branch builds clean; showcase/utilities has no dependency on any changed file).

## Self-Check: PASSED

- All 5 commits exist in git log
- 7 files modified (all confirmed present in worktree)
- 27/27 tests pass
- No Claude/Gemini/DeepSeek imports in changed files
