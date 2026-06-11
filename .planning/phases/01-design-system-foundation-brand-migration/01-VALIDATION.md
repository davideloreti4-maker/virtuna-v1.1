---
phase: 1
slug: design-system-foundation-brand-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 01-RESEARCH.md § Validation Architecture. Design-system phase →
> mix of unit (token/variant/motion logic) + visual/deployed-build checks.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 (+ @testing-library/react 16, happy-dom, vitest-axe) — already installed |
| **Config file** | vitest config present (test scripts in package.json) |
| **Quick run command** | `pnpm vitest run <file>` |
| **Full suite command** | `pnpm test` (`vitest run`) |
| **Visual/deployed check** | `pnpm build && pnpm start` → open showcase route, or Vercel preview (D-06 "verified on deployed build") |
| **Contrast check** | `pnpm tsx scripts/check-apca.ts` (dev gate, DS-02/03) |
| **Estimated runtime** | ~15s unit suite; build smoke ~60s |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run <touched test>` + (for glass/token tasks) a local `pnpm build` smoke
- **After every plan wave:** Run `pnpm test` + `pnpm tsx scripts/check-apca.ts`
- **Before `/gsd:verify-work`:** Full suite green + `pnpm build` clean + showcase route verified on a DEPLOYED build (Vercel preview) — directly proves success criteria 1 & 3
- **Max feedback latency:** ~15 seconds (unit); build smoke ~60s

---

## Per-Task Verification Map

> Plan/wave/task IDs are placeholders until the planner finalizes plan structure.
> Requirement → behavior → test mapping is binding (from RESEARCH).

| Req ID | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|--------|----------|------------|-----------|-------------------|-------------|--------|
| DS-01 | Token utilities resolve under `.numen-surface`; no pure black; dark tokens authored as hex | — | unit + visual | `pnpm vitest run tests/numen/tokens.test.ts` (resolved CSS-var assertions) + deployed showcase | ❌ W0 | ⬜ pending |
| DS-02 | Verdict color scale is the only load-bearing functional color; meets APCA Lc targets | — | script | `pnpm tsx scripts/check-apca.ts` | ❌ W0 | ⬜ pending |
| DS-03 | Warm-clay brand accent calibrated; APCA-valid on base | — | script | `pnpm tsx scripts/check-apca.ts` | ❌ W0 | ⬜ pending |
| DS-04 | `--font-serif` applied only on voice slots; body = sans | — | unit (class) + visual | `pnpm vitest run tests/numen/type.test.ts` | ❌ W0 | ⬜ pending |
| DS-05 | Glass uses inline `backdropFilter` (not class); blur survives prod build | — | unit + deployed | `pnpm vitest run tests/numen/glass.test.ts` (inline-style presence) + deployed check | ❌ W0 | ⬜ pending |
| DS-05 | tailwind-variants primitives produce expected slot classes | — | unit | `pnpm vitest run tests/numen/primitives.test.ts` | ❌ W0 | ⬜ pending |
| DS-07 | StageReveal: reduced-motion strips translate; no spring overshoot | — | unit | `pnpm vitest run tests/numen/stage-reveal.test.ts` (mock `useReducedMotion`) | ❌ W0 | ⬜ pending |
| DS-06 | Boundary doc exists + grep counts captured | — | doc/manual | review `docs/numen-migration-boundary.md` | ❌ W0 | ⬜ pending |
| DS-08 | Keyframe stills carry chroma; warm-neutral chrome recedes (showcase) | — | visual | deployed showcase review | ❌ W0 | ⬜ pending |
| a11y | Showcase primitives pass axe | — | unit | `vitest-axe` on showcase render | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/numen/tokens.test.ts` — DS-01 (resolved-var assertions via happy-dom)
- [ ] `tests/numen/type.test.ts` — DS-04
- [ ] `tests/numen/glass.test.ts` — DS-05 (inline-style presence)
- [ ] `tests/numen/primitives.test.ts` — DS-05 (tailwind-variants slot output)
- [ ] `tests/numen/stage-reveal.test.ts` — DS-07 (reduced-motion gate)
- [ ] `scripts/check-apca.ts` — DS-02/DS-03 contrast gate
- [ ] Install: `pnpm add tailwind-variants` + `pnpm add -D apca-w3`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Glass blur survives Lightning CSS in production | DS-05 | Class-form `backdrop-filter` is stripped by Lightning CSS; works in dev, can fail in prod — must observe on a real build | `pnpm build && pnpm start` (or Vercel preview) → open showcase → confirm blur renders on glass primitive |
| Warm-neutral chrome recedes / keyframe carries chroma | DS-08 | Perceptual judgment of color discipline; not unit-assertable | Deployed showcase review against VISION §6 |
| Palette/serif calibration sign-off | DS-02/03/04 | §9 forks require user approval of actual swatches + serif specimen | Review rendered swatches + specimen in showcase; user approves hexes + final serif |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
