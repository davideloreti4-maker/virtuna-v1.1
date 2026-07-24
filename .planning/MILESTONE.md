# MILESTONE — Onboarding funnel

**Branch:** `milestone/onboarding`
**Worktree:** `~/virtuna-onboarding`
**Base:** `main@99c494d1`
**Opened:** 2026-07-24

## Goal

Replace the inert one-field `/welcome` with a guided, conversion-optimized funnel:
playable canned demo on `/go` → 1-tap OAuth → $1 tripwire → handle + video in
parallel → the audience gap → land armed in Ambient v2 Start.

## Owner calls (locked 2026-07-24)

- $1 collected **before** any personal engine run.
- Anonymous traffic gets a **canned but real** demo — never a free engine run.
- Built on **Ambient v2 Start** (`NEXT_PUBLIC_AMBIENT_V2`).

## Design contract

`docs/ONBOARDING-FUNNEL-DESIGN.md` — SSOT for this milestone.

## Ops

Dev server must launch with `NEXT_PUBLIC_AMBIENT_V2=true` (nohup, not setsid).
Verify the flag behaviourally, never via `ps`.
