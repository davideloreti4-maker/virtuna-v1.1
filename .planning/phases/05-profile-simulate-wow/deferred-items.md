# Phase 05 — Deferred / Out-of-Scope Items

Items discovered during execution that are OUT OF SCOPE for the current task
(pre-existing failures in unrelated files — SCOPE BOUNDARY rule). Logged, not fixed.

| Discovered during | File | Issue | Why deferred | Status |
|-------------------|------|-------|--------------|--------|
| 05-06 Task 1 (wave-gate `next build`) | `src/components/app/brand-deals/earnings-chart.tsx:98` | recharts `<Tooltip content={EarningsTooltip}>` type mismatch (`TooltipContentProps<number,string>` vs `ContentType<ValueType,NameType>`) fails `next build`'s full-project TypeScript step | PRE-EXISTING (verified present on HEAD via stash test, without the 05-06 composer change) and in the brand-deals subsystem — unrelated to the Profile→Simulate surface. Part of the ~20-error tsc baseline carried since 05-01. Fixing recharts typings in brand-deals is outside this plan's scope. | OPEN |

## Notes

- The 05-06 wave-gate `npm run build` **compiles successfully** ("✓ Compiled
  successfully in 12.2s") — the client/server bundle-leak check (the gate's
  load-bearing purpose, GSI P3 BUILD-01 precedent) PASSES for the composer change.
  The build only fails afterwards in the full-project TypeScript type-check step,
  on the pre-existing `earnings-chart.tsx` error above.
- `next dev` does NOT run the blocking full type-check, so the dev server starts
  cleanly for the Task 2 human-verify browser pass.
