---
status: testing
phase: 3-hive-2.5d
source: PLAN.md
started: 2026-03-11T12:50:00Z
updated: 2026-03-11T12:51:00Z
code_verification: pass
notes: Build, lint, and test all pass. Visual UAT requires interactive user testing.
---

## Current Test

number: 1
name: Depth Layer Visual Differentiation
expected: |
  On the dashboard, the hive visualization shows three distinct depth layers:
  foreground nodes are full size and fully opaque, midground nodes are ~70% size
  and slightly faded, background nodes are ~40% size and noticeably faded.
  This creates a visible 2.5D depth effect.
awaiting: user response

## Tests

### 1. Depth Layer Visual Differentiation (HIVE-1)
expected: Hive shows three distinct depth layers — foreground nodes full size/opaque, midground ~70%/slightly faded, background ~40%/noticeably faded. Creates visible 2.5D depth effect.
result: [pending]

### 2. Mouse Parallax Effect (HIVE-2)
expected: Moving mouse over the hive canvas shifts foreground nodes ~5px, midground ~1.5px, background barely moves (~0.5px). Creates a smooth parallax depth sensation. Movement is smoothly interpolated (no snapping).
result: [pending]

### 3. Parallax Accessibility (HIVE-2)
expected: With prefers-reduced-motion enabled (System Settings > Accessibility > Reduce motion), parallax effect is completely disabled. On touch devices, parallax is also disabled.
result: [pending]

### 4. Organic Cloud Layout (HIVE-3)
expected: Nodes are scattered organically (not in perfect concentric rings). Tier-1 nodes have varied distances from center. Tier-2 nodes spread widely around their parent direction. Layout looks cloud-like, not geometric.
result: [pending]

### 5. Bezier Curve Connections (HIVE-4)
expected: Connection lines between nodes are curved (bezier), not straight. When zoomed in, curves are clearly visible. Connections fade out with distance — long connections disappear entirely.
result: [pending]

### 6. Apollo Tier Node Count (HIVE-6)
expected: Switching Apollo tier in the model selector changes node count: Lite shows ~300 nodes, Pro shows ~1000, Ultra shows ~10000. Transition triggers the progressive build animation.
result: [pending]

### 7. Persona Demographic Labels (HIVE-7)
expected: Clicking a tier-2 (sub-theme) node shows an overlay with demographic pills showing age range, gender, and interest (e.g., "18-24", "Female", "Gaming").
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0

## Gaps

[none yet]
