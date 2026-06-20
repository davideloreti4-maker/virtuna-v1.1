# Phase 12: Library & Acts/State IA - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 12-library-acts-state-ia
**Areas discussed:** IA collapse mapping, Library shape, Surface↔thread wiring, Audience-surface cut line, Compare UX, Persona-editing scope

---

## IA collapse mapping (IA-01)

First pass used the WRONG (dead legacy) sidebar; owner flagged it. Re-grounded on the active `src/components/sidebar/Sidebar.tsx`, which is already near-4 items.

| Option | Description | Selected |
|--------|-------------|----------|
| Add Library, keep structure | Add Library nav+surface; keep New Simulation + Simulations history as the Thread surface; legacy routes orphaned | |
| Add Library + relabel to Thread | Same, PLUS rename "New Simulation"→"New Thread" and "Simulations" section→"Thread" so the 4 labels are literal | ✓ |
| Full sidebar restructure | Reorganize the whole sidebar from scratch | |

**User's choice:** Add Library + relabel to Thread.
**Notes:** "i dont think you have the right context of the current sidebar" — corrected to the active Sidebar.tsx (legacy `components/app/sidebar.tsx` is dead). Net work is narrow + additive; preserve shipped D-12/D-13.

---

## Library shape (LIB-01/02)

| Option | Description | Selected |
|--------|-------------|----------|
| Extend SavedShelf, replace /saved | One scrollable surface, noun-type filter chips; Library replaces /saved (same store); no folders | ✓ |
| Tabbed: Saved \| Watchlist | Two tabs, each its own sub-view | |
| New aggregator over /saved | Keep /saved; Library links out | |

**User's choice:** Extend SavedShelf, replace /saved.
**Notes:** Watchlist part dropped — see Watchlist decision below.

---

## Surface↔thread wiring (LIB-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Append to open thread; account→Explore | Use-in-thread appends to active thread via CHAIN_HANDOFFS; watchlist account→Explore | ✓ (append part) |
| Open a NEW thread per item | Fresh thread each use | |
| Account→read-only detail | Watchlist tap opens a detail surface | |

**User's choice:** Option 1 (append to open thread). **"but watchlist doesnt make sense?"** — the watchlist→Explore half is moot given the watchlist deferral below.

---

## Watchlist home (LIB-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into Explore, not Library | Manage tracked accounts inline in Explore params/quick-actions; Library = saved nouns only | |
| Keep LIB-02: Watchlist section in Library | Distinct watchlist section in Library | |
| Put tracked accounts on Audience surface | Surface them on the Audience page | |

**User's choice:** Other — **"lets defer the tracked accounts for now we'll add a dedicated channels/accounts page."**
**Notes:** LIB-02 DEFERRED. P11's `tracked_accounts` data persists; surfacing waits for a future Channels/Accounts page.

---

## Audience-surface cut line (AUD-EDIT-01..04)

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-select compare | The killer feature; audience_ids[]-ready | ✓ |
| Persona editing | Unblocked by P8 W0 tuning; override slot, gate-safe | ✓ |
| Compact onboarding redesign | Tier-C polish | |
| Link-social Apify prefill | Tier-C + Apify-plan blocked | |

**User's choice:** Multi-select compare + Persona editing. (Onboarding redesign + link-social deferred.)

---

## Compare UX (AUD-EDIT-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Surface multi-select → reuse P8 Read | Pick any two saved audiences → launch P8's multi-audience Read | ✓ |
| Static profile compare (no SIM) | Side-by-side composition only | |
| Both: profile compare + concept Read | Static diff + concept test | |

**User's choice:** Surface multi-select → reuse P8 Read.

---

## Persona-editing scope (AUD-EDIT-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Edit calibrated audiences only, via override | name/disposition/temperature/description → per-audience override; never General baseline | ✓ |
| Edit text fields only | name/description only | |
| Full edit incl. weights | Direct weight editing | |

**User's choice:** Edit calibrated audiences only, via override (regression-gate-safe).

---

## Claude's Discretion

- Library layout encoding (filter chips vs segmented control; sections vs flat-with-tags).
- "Use in thread" target when no open thread exists (create vs route-to-recent).
- Physically rename `/saved`→`/library` vs relabel-only (keep redirects either way).
- Persona-edit field validation/clamping + how edits surface in the read-only profile view.
- Compare entry affordance on `/audience`.
- Whether "Simulations"→"Thread" relabel extends beyond the sidebar.

## Deferred Ideas

- LIB-02 tracked-accounts/watchlist → future dedicated Channels/Accounts page.
- AUD-EDIT-03 compact onboarding redesign (tier-C).
- AUD-EDIT-04 link-social Apify prefill (tier-C + GAP-ENV-01 Apify blocker).
- Folders/tags/CMS on Library (flat guard).
- Direct persona weight/distribution editing (gate risk).
- Deleting/redirecting legacy monetization routes (/discover, /competitors, /brand-deals, /referrals) — orphaned, not removed.
