---
status: issues_found
phase: 13-proactive-numen-ambient-initiated-expansion-the-ambient-audi
depth: standard
reviewed: 2026-06-20T22:10:00Z
findings_critical: 0
findings_warning: 4
findings_info: 3
---

# Phase 13: Code Review Report — Ambient Numen (AMBIENT-01)

**Reviewed:** 2026-06-20T22:10:00Z
**Depth:** standard (per-file analysis + targeted cross-file tracing)
**Files Reviewed:** 13
**Status:** issues_found (0 Critical / 4 Warning / 3 Info)

## Summary

Reviewed the 13 source files delivered across Plans 13-01..13-04: the new
`POST /api/tools/react` reaction route, the shared `buildReactionPanel` helper,
the two refactored runners, the `CardReactionAtRest` per-card readout, the
`AmbientPresence` strip + its types, the `useAmbientFocus` hook, the composer
mount, and the four card-block promotions.

**The security spine is sound.** The reaction route gets auth-first ordering,
Zod input validation, a server-resolved audience read off `thread.active_audience_id`
(the body carries no audience id — CR-01 honored), Flash-failure → 502, and an
honest ephemeral result shape. No injection surface (Supabase queries are
parameterized; all client-set DOM attributes are React-escaped), no hardcoded
secrets, no `eval`/`exec`, no secret leakage in error responses.

**The determinism / honesty spine is also sound.** No `Math.random`/`Date.now`
in any deterministic render path (the only randomness is the verbatim `mulberry32`
seeded layout; the only animation is a CSS `<animate>` opacity pulse gated on
`reducedMotion`). Reactions are never aggregated — the spotlight reflects exactly
one labeled concept, idles to a calm roster when `focus === null`, and degrades to
silence on unparseable fractions. **THEME-06 is clean** in all six net-new files
(verified: no `#FF7F50` / `255,127,80`). The coral literals in the four
`*-card-block.tsx` files are PRE-EXISTING (git diff `1c2e4413..HEAD` shows Phase 13
only added the `CardReactionAtRest` import + a wrapper `<div>`), so they are out of
the net-new THEME-06 scope.

The defects found are all client-side state-management / lifecycle issues in
`AmbientPresence`, plus one route-layer side-effect that contradicts the documented
"ephemeral, no persistence" guarantee. None block correctness of the security or
honesty contracts, but two of them (WR-01, WR-02) break documented behavioral
guarantees of the phase and should be fixed before ship.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `typedFocus` is never cleared — the spotlight gets permanently stuck on a typed thought, breaking the D-02 moving spotlight

**File:** `src/components/audience-lens/ambient-presence.tsx:116, 236`
**Issue:** The effective focus is `const effectiveFocus: AmbientFocus = typedFocus ?? focus;` (L116). `typedFocus` is set only by `setTypedFocus(next)` in `submitThought` (L236) and has **no clearing path** anywhere in the component. Once the creator submits one type-to-room thought, `typedFocus` is non-null forever, so `effectiveFocus` permanently ignores the composer-driven `focus` prop. After typing once, scrolling the ledger or tapping a different card will NOT re-point the presence's subject/dots/Lens — the strip stays frozen on the old typed thought. This directly violates D-02 ("the presence is a moving spotlight … re-focuses when the creator taps/scrolls"). The composer's `useAmbientFocus` does clear its own `thought` on tap/scroll (`focusByTap`/`focusByScroll` call `setThought(null)`), and it notifies the parent — but the presence keeps a *second, independent* copy in `typedFocus` that the parent can never reset, so the two layers diverge.
**Fix:** Clear the local `typedFocus` whenever the driven `focus` prop changes (the parent is the source of truth once a deliberate tap/scroll lands), e.g.:
```tsx
// Drop the local just-typed override as soon as the parent drives a new focus
// (a deliberate tap/scroll supersedes the ad-hoc typed thought — D-02).
useEffect(() => {
  setTypedFocus(null);
}, [focus]);
```
Alternatively, lift `typedFocus` out entirely and rely solely on `focus` (the composer already round-trips the typed result via `onFocusChange` → `focusByThought`), removing the dual-source-of-truth.

### WR-02: `POST /api/tools/react` writes an open-thread row on every call — contradicts the documented "ephemeral, no persistence" guarantee

**File:** `src/app/api/tools/react/route.ts:102`
**Issue:** The route resolves the audience by calling `createOpenThreadLazy(user.id)` (L102). That helper is **get-or-create**: it first runs `INSERT INTO threads … select` (`threads.ts` L138-146) and only re-selects on a 23505 conflict. So a user who types a thought into the ambient presence **before ever generating a card** gets an open-thread row silently INSERTed as a side effect of a "reaction." This contradicts the route's own header ("NO persistence — type-to-room is ephemeral") and the 13-01-SUMMARY claim ("whole (no streaming), ephemeral (no persistence)"). It also performs the write via the **service client (RLS-bypassing)** — correctly user-scoped, so not a security hole, but an unintended state mutation on a read-shaped endpoint. The route only ever needs to READ `active_audience_id`; if no open thread exists there is no pinned audience anyway (General is the correct answer).
**Fix:** Use the read-only `getOpenThread(user.id)` (already exported from `threads.ts`) instead of `createOpenThreadLazy`, and treat `null` as "no pinned audience → General":
```ts
import { getOpenThread } from "@/lib/threads/threads";
// ...
let audience: Audience = GENERAL_AUDIENCE;
const openThread = await getOpenThread(user.id); // READ-ONLY — never creates a thread
const activeAudienceId =
  (openThread as (typeof openThread & { active_audience_id?: string | null }) | null)
    ?.active_audience_id ?? null;
if (activeAudienceId) {
  try {
    const loaded = await getAudience(supabase, activeAudienceId);
    if (loaded) audience = loaded;
  } catch { /* fall back to General */ }
}
```

### WR-03: `submitThought` has no in-flight/unmount guard — setState-after-unmount and a stale reaction can clobber a newer focus

**File:** `src/components/audience-lens/ambient-presence.tsx:217-246`
**Issue:** `submitThought` is an async `fetch` with no `AbortController` and no mounted/stale guard. Two concrete problems: (1) if the user collapses the panel (the outside-click/Escape effect at L187-201 sets `expanded=false`, which unmounts the textarea but NOT the component) or navigates while a ~8-17s Flash call is in flight, the `setLoading`/`setTypedFocus`/`setError` calls in the `try/finally` fire after teardown of dependent subtrees, producing React "set state on unmounted" warnings and a wasted Lens auto-open. (2) The `loading` re-entry guard (`if (text.length === 0 || loading) return;`) blocks a *second* concurrent submit, but a single slow in-flight request still resolves later and unconditionally calls `setTypedFocus(next)` + `setLensOpen(true)` — so a reaction the user has since moved past will retroactively yank the spotlight and pop the Lens open.
**Fix:** Add an `AbortController` stored in a ref, abort it on a new submit and on unmount, and ignore a resolved response whose controller was aborted:
```tsx
const inflightRef = useRef<AbortController | null>(null);
useEffect(() => () => inflightRef.current?.abort(), []);
// in submitThought:
inflightRef.current?.abort();
const controller = new AbortController();
inflightRef.current = controller;
const res = await fetch('/api/tools/react', { /* … */, signal: controller.signal });
if (controller.signal.aborted) return; // a newer submit / unmount superseded this one
```

### WR-04: stale error + Retry persist while the user composes a new thought

**File:** `src/components/audience-lens/ambient-presence.tsx:111, 381, 429-447`
**Issue:** After a failed submit, `error` is `true` and the verbatim error copy + the "Retry →" button render (L429-447). `error` is only reset inside `submitThought` (L221). The textarea `onChange` (L381) updates `draft` but does NOT clear `error`. So after a failure, the moment the user starts editing/replacing the thought, the old error banner and a "Retry →" that re-submits the **previous** `lastSubmitted` text both stay on screen alongside the fresh draft — a misleading state where Retry sends stale text while the input shows new text.
**Fix:** Reset the error (and ideally the prior result) when the draft is edited:
```tsx
onChange={(e) => {
  setDraft(e.target.value);
  if (error) setError(false);
}}
```

## Info

### IN-01: hardcoded `rgba(236, 231, 222, …)` cream literal bypasses the design-token SSOT

**File:** `src/components/audience-lens/ambient-presence.tsx:168, 172`
**Issue:** Dot fills use a raw `rgba(236, 231, 222, <alpha>)` literal. `236,231,222` is the current value of `--color-cream-primary` (`#ece7de`), which `--color-foreground` aliases (verified in `globals.css` L51/L91) — so it is correct *today*. But the component's own docstring and `CardReactionAtRest` insist cream must read from `var(--color-foreground)`. Hardcoding the RGB to get per-alpha compositing means a future token change silently drifts the presence dots out of sync with every other cream surface — exactly the flat-warm-SSOT drift CLAUDE.md warns against. (The non-data-driven cases already correctly use `var(--color-foreground)` elsewhere; only the alpha-composited dot fills hardcode it.)
**Fix:** Derive the alpha from the token instead of a literal, e.g. `rgb(from var(--color-foreground) r g b / ${alpha})` (modern CSS relative-color syntax, supported in current targets), or hoist the cream RGB into a single named const with a comment binding it to `--color-cream-primary` so the coupling is explicit and greppable.

### IN-02: `r * clamp01(1)` is dead/no-op arithmetic

**File:** `src/components/audience-lens/ambient-presence.tsx:181`
**Issue:** `out.push({ … r: r * clamp01(1), … })` — `clamp01(1)` is a compile-time-constant `1`, so `r * clamp01(1) === r`. The multiply (and the `clamp01` call) is dead code that obscures intent; it reads as if a real radius-clamp were happening when none is.
**Fix:** Use `r` directly: `out.push({ …, r, … })`. If a clamp was intended (e.g. `clamp01(r / SOME_MAX) * SOME_MAX`), implement it; otherwise drop the no-op.

### IN-03: composer scroll-spy markers are zero-height `sr-only` rows — IntersectionObserver focus tracking is effectively non-positional

**File:** `src/components/app/home/composer.tsx:854-875`
**Issue:** The `[data-ambient-card]` wrappers the `IntersectionObserver` observes (via `registerThreadRegion`) are rendered as `className="sr-only"` (L871) — visually collapsed, stacked together at the top of the scroll region, NOT co-located with the real card DOM (which lives inside `MessageBlocks`, out of the declared `files_modified` scope). The observer's `rootMargin: '-48px 0px -60% 0px'` band therefore measures collapsed sr-only rows, not the visible cards, so the "moving spotlight follows scroll" behavior (D-02) is degraded to "crosses markers in card order" rather than tracking which card is actually under the focus line. This is self-documented in the 13-04 "Known Limitation" and the automated ACs pass, so it is logged as Info, not a defect — but the user-facing scroll-spy precision claim in D-02 is not actually met until the markers tag the real card roots.
**Fix:** Out of this plan's scope by design; schedule the follow-up the 13-04 summary names (render the `data-ambient-card` attributes on the real per-card roots inside the thread views / `MessageBlocks`) so the observer measures visible geometry. No change needed in the reviewed files.

---

_Reviewed: 2026-06-20T22:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
