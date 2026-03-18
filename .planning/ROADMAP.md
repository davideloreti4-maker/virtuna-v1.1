# Roadmap: UI Dashboard

## Overview

| Property | Value |
|----------|-------|
| Milestone | UI Dashboard |
| Total phases | 5 |
| Total requirements | 23 |
| Estimated complexity | Medium-High |
| Worktree | `/Users/davideloreti/virtuna-ui-dashboard` |
| Branch | `milestone/ui-dashboard` |

## Codebase Discovery (Critical for Workers)

These findings affect how phases are planned and executed:

1. **Model tier is dead code.** The Apollo dropdown in `content-form.tsx` (lines 46-292) renders UI but `modelTier` state is LOCAL ONLY — never passed to `onSubmit`, never sent to API, never reaches hive. Workers must wire this properly.
2. **Hive uses mock data.** `generateMockHiveData()` creates procedural data. The hive has zero connection to model selection or account state. Phase 3 must bridge this.
3. **Account state is hook-based, not Zustand.** `src/hooks/use-tiktok-accounts.ts` queries Supabase `tiktok_accounts` table directly. No global store. Phase 2 extends this.
4. **No shared state between content form and hive.** They are independent components rendered in `dashboard-client.tsx`. A new Zustand store is needed to bridge them.

## Shared State Contracts

Phases that run in different waves MUST agree on interfaces. Workers read these contracts.

### Contract: `simulation-store.ts` (Created by Phase 1, Consumed by Phase 3, 4, 5)

```typescript
// src/stores/simulation-store.ts — Zustand store
interface SimulationStore {
  // Model state (Phase 1 creates)
  modelFamily: 'apollo' | 'oracle';
  apolloTier: 'lite' | 'pro' | 'ultra';
  nodeCount: 300 | 1000 | 10000;
  setApolloTier: (tier: 'lite' | 'pro' | 'ultra') => void;
  setModelFamily: (family: 'apollo' | 'oracle') => void;

  // Video state (Phase 3 creates, Phase 4 consumes)
  videoSrc: string | null;        // blob URL or remote URL
  thumbnailSrc: string | null;    // data URL from extraction
  setVideoSrc: (src: string | null) => void;
  setThumbnailSrc: (src: string | null) => void;

  // Analysis state (Phase 4 creates, Phase 3/5 consumes)
  analysisStatus: 'idle' | 'loading' | 'complete' | 'error';
  predictedEngagement: PredictedEngagement | null;
  setAnalysisResult: (engagement: PredictedEngagement) => void;
}

interface PredictedEngagement {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
}
```

### Contract: Account Hook Extension (Phase 2 creates, Phase 1/3/5 consume)

```typescript
// src/hooks/use-social-accounts.ts — extends use-tiktok-accounts.ts
// IMPORTANT: Phase 2 MUST keep backward-compatible re-export:
//   export { useSocialAccounts as useTiktokAccounts } from './use-social-accounts'
// So Phase 1's MOD-4 can import from the OLD name during parallel execution.

interface SocialAccount {
  id: string;
  handle: string;
  platform: 'tiktok' | 'instagram';  // NEW field
  // ... existing fields
}
```

## Execution Waves

| Wave | Phases | Rationale |
|------|--------|-----------|
| 1 | Phase 1, Phase 2 | Foundation — model selector + account chip (no file conflicts, no shared state) |
| 2 | Phase 3 | Hive 2.5D upgrade (consumes `simulation-store` from Phase 1) |
| 3 | Phase 4, Phase 5 | Result card + integration (consumes hive + model + account state) |

### Wave 1 Parallel Safety

Phase 1 and Phase 2 have **zero file overlap**:
- Phase 1 touches: `content-form.tsx`, `model-selector/*` (new), `src/stores/simulation-store.ts` (new), `src/lib/models.ts` (new)
- Phase 2 touches: `top-bar-account-chip.tsx` (new), `app-shell.tsx`, `tiktok-account-selector.tsx`, `use-social-accounts.ts` (new)
- Phase 1 reads from `use-tiktok-accounts.ts` (existing hook, read-only) for MOD-4 persona text
- Phase 2 extends `use-tiktok-accounts.ts` into `use-social-accounts.ts` and adds backward-compatible re-export
- **No conflict** — Phase 1 imports existing hook, Phase 2 creates new file + re-export alias

### Wave 3 Parallel Safety

Phase 4 and Phase 5 have **partial overlap** but different scopes:
- Phase 4 creates new files (`tiktok-result-card.tsx`) and extends API response
- Phase 5 wires existing components together (import updates, state subscriptions)
- **Risk:** Phase 5 may need Phase 4's result card to be committed before it can wire it
- **Mitigation:** Phase 4 should execute BEFORE Phase 5. Lead dispatches Phase 4 first, Phase 5 after Phase 4 completes.

## Phase Summary

| Phase | Name | Requirements | Wave | Dependencies |
|-------|------|-------------|------|-------------|
| 1 | Model Selector & Oracle Placeholder | MOD-1, MOD-2, MOD-4, MOD-5, MOD-6 | 1 | None |
| 2 | Top Bar Account Selector + Instagram | ACC-1, ACC-2, ACC-3 | 1 | None |
| 3 | Hive 2.5D Visualization | HIVE-1 through HIVE-7 | 2 | Phase 1 (simulation-store) |
| 4 | TikTok Result Card | RES-1, RES-2, RES-3, MOD-3 | 3 | Phase 1 (model state), Phase 3 (video state) |
| 5 | Integration & Polish | INT-1, INT-2, INT-3 | 3 | Phase 1, 2, 3, 4 (all) |

---

## Phase Details

### Phase 1: Model Selector & Oracle Placeholder
**Goal:** Overhaul Apollo model selector with Lite/Pro/Ultra tiers, add Perplexity-style descriptions with 10M database messaging, persona-account link text, Oracle coming-soon card, and create the shared `simulation-store`.
**Wave:** 1
**Dependencies:** None
**Requirements:** MOD-1, MOD-2, MOD-4, MOD-5, MOD-6

**File Ownership:**
- `src/components/app/content-form.tsx` — refactor model selector section, extract to components
- `src/components/app/model-selector/` — new directory: `ApolloTierSelector.tsx`, `OracleCard.tsx`, `ModelFamilyToggle.tsx`
- `src/lib/models.ts` — model tier definitions (names, descriptions, node counts, copy)
- `src/stores/simulation-store.ts` — **NEW Zustand store** (shared state contract above)

**Critical Context for Worker:**
- Current `modelTier` in content-form.tsx is LOCAL state (line 66) — dead code
- Must replace with `simulation-store` Zustand subscription so hive (Phase 3) can read it
- `useTiktokAccounts()` hook exists at `src/hooks/use-tiktok-accounts.ts` — import as-is for MOD-4 persona text
- Apollo tiers: Lite (300 nodes), Pro (1,000 nodes), Ultra (10,000 nodes)
- Oracle is UI-only placeholder — "Join waitlist" CTA, locked/dimmed card

**Success Criteria:**
- Apollo 1.5 Lite/Pro/Ultra with Perplexity-style descriptions and node counts
- 10M database reference in each tier description (copy varies per tier)
- Persona-account link text: "{count} personas modeled from @{handle}'s audience"
- Oracle card with distinct branding + description + "Join waitlist"
- Apollo | Oracle toggle/tab at top level
- `simulation-store.ts` created with model state (apolloTier, nodeCount, modelFamily)
- Model tier selection writes to simulation-store (not local state)

---

### Phase 2: Top Bar Account Selector + Instagram Support
**Goal:** Add persistent social account chip to the top navigation bar (desktop + mobile), extend account system to support both TikTok and Instagram accounts.
**Wave:** 1
**Dependencies:** None
**Requirements:** ACC-1, ACC-2, ACC-3

**File Ownership:**
- `src/components/app/top-bar-account-chip.tsx` — new component
- `src/components/app/app-shell.tsx` — integrate chip into nav header
- `src/components/app/tiktok-account-selector.tsx` — add platform toggle (TikTok/Instagram)
- `src/hooks/use-social-accounts.ts` — new hook extending `use-tiktok-accounts.ts`
- `src/hooks/use-tiktok-accounts.ts` — add backward-compatible re-export to `use-social-accounts`

**Critical Context for Worker:**
- Current hook: `src/hooks/use-tiktok-accounts.ts` — queries Supabase `tiktok_accounts` table
- AppShell: `src/components/app/app-shell.tsx` — uses `useSidebarStore` for sidebar state
- Sidebar selector: `src/components/app/tiktok-account-selector.tsx` — dropdown in sidebar
- **MUST** keep `useTiktokAccounts` name working (backward-compatible re-export) because Phase 1 imports it
- Database: may need migration to add `platform` column to `tiktok_accounts` table (or rename table)

**Success Criteria:**
- "@handle" chip with platform icon (TikTok/Instagram) in top bar on all pages
- "Connect Account ▾" CTA when no account connected
- Dropdown works on mobile (full-width) with touch-friendly 44px targets
- Sidebar selector updated with platform toggle when adding accounts
- `use-social-accounts.ts` created with `platform` field per account
- Backward-compatible `useTiktokAccounts` re-export preserved
- Platform icons (TikTok logo / Instagram logo) shown per account

---

### Phase 3: Hive 2.5D Visualization
**Goal:** Upgrade hive to 2.5D with depth layers, parallax, organic cloud layout, bezier connections, center video, and dynamic node count driven by model tier.
**Wave:** 2
**Dependencies:** Phase 1 (reads `simulation-store` for `apolloTier`/`nodeCount`/`videoSrc`/`thumbnailSrc`)
**Requirements:** HIVE-1, HIVE-2, HIVE-3, HIVE-4, HIVE-5, HIVE-6, HIVE-7

**File Ownership:**
- `src/components/hive/hive-layout.ts` — organic cloud layout algorithm (replace symmetric angular distribution)
- `src/components/hive/hive-renderer.ts` — 2.5D rendering (depth layers, bezier curves, distance fade)
- `src/components/hive/hive-constants.ts` — depth layer config, tier → node count mapping
- `src/components/hive/hive-types.ts` — depth layer types, persona demographic types
- `src/components/hive/HiveCanvas.tsx` — parallax mouse handler, video element overlay in center rect
- `src/components/hive/use-hive-interaction.ts` — updated hit detection accounting for depth/size
- `src/components/hive/HiveNodeOverlay.tsx` — add persona demographic labels (age, gender, interest)

**Critical Context for Worker:**
- Current layout: `computeHiveLayout()` in `hive-layout.ts` uses d3-hierarchy with symmetric angular distribution
- Current rendering: `renderHive()` in `hive-renderer.ts` draws nodes, straight lines, center rect (110×146px)
- Current node structure: Tier 0 (center), Tier 1 (8px, 0.8-1.5x), Tier 2 (4px, 0.5-1.8x)
- Interaction: d3-quadtree hit detection, 16ms hover debounce, 5px click-vs-drag threshold
- Animation: progressive build with 200ms/500ms delays per tier
- `generateMockHiveData()` creates procedural data — must be replaced/extended to accept `nodeCount` param
- Import `useSimulationStore` from `src/stores/simulation-store.ts` (created by Phase 1) for `nodeCount`, `videoSrc`, `thumbnailSrc`
- Import `useSocialAccounts`/`useTiktokAccounts` for active account → persona demographic generation
- **Performance target:** 60fps at 10,000 nodes — may need spatial culling, connection LOD

**Success Criteria:**
- Three depth layers: foreground (full), midground (70%/80%), background (40%/50%)
- Mouse parallax: 3-5px/1-2px/0.5px shift per layer, disabled on mobile + reduced-motion
- Organic cloud layout: irregular clusters, denser near center, sparser at edges, deterministic
- Bezier connections: quadratic curves, opacity fades with distance, long connections invisible
- Center rect: video thumbnail during upload → video playback after analysis (muted, looping)
- Dynamic nodes: Lite=300, Pro=1000, Ultra=10000, animated transitions on tier switch
- Persona hover: demographic labels (age range, gender, interest) from active account profile
- 60fps maintained at 10K nodes

---

### Phase 4: TikTok Result Card
**Goal:** Build TikTok-style post mockup card with autoplay video and predicted engagement metrics, add "Scanning 10M+ database" loading step.
**Wave:** 3
**Dependencies:** Phase 1 (simulation-store for model state), Phase 3 (video handling patterns)
**Requirements:** RES-1, RES-2, RES-3, MOD-3

**File Ownership:**
- `src/components/app/simulation/tiktok-result-card.tsx` — new TikTok post mockup component
- `src/components/app/simulation/results-panel.tsx` — integrate mockup above existing panel
- `src/components/app/simulation/analysis-loading.tsx` — new/extend loading UI with database scan step
- API route or `src/lib/engine/` — extend prediction response with `predicted_engagement`

**Critical Context for Worker:**
- Existing results: `results-panel.tsx` renders HeroScore + ViralResultsCard + warnings + AI reasoning
- Analysis flow: `dashboard-client.tsx` → `handleContentSubmit()` → `analyzeMutation` → `ResultsPanel`
- Current API response: viral score + signal breakdown + confidence + warnings (no engagement numbers)
- Video source available via `simulation-store` (videoSrc, thumbnailSrc)
- Engagement metrics must be GENERATED by prediction engine — not hardcoded or formula-based
- Loading UI: find current loading state handling in dashboard-client.tsx and extend

**Success Criteria:**
- Vertical TikTok-style card: video autoplay muted, right sidebar icons (like/comment/share/save)
- Engagement numbers from API: `predicted_engagement.{likes, comments, shares, saves, views}`
- Numbers feel realistic (12.4K not 12,000), vary by content and tier
- Tap/click toggles mute/unmute with visual indicator
- Video loops continuously
- "Scanning 10M+ video database..." appears mid-sequence in loading animation
- Renders above existing ResultsPanel (additive, no existing UI removed)

---

### Phase 5: Integration & Polish
**Goal:** Wire all new components together, ensure state sync across model selector ↔ hive ↔ result card ↔ account, verify responsive layout.
**Wave:** 3
**Dependencies:** Phase 1, 2, 3, 4 (all must be complete)
**Requirements:** INT-1, INT-2, INT-3

**IMPORTANT: Phase 5 must execute AFTER Phase 4.** Both are Wave 3 but Phase 5 depends on Phase 4's output. Lead must dispatch sequentially.

**File Ownership:**
- `src/app/(app)/dashboard/dashboard-client.tsx` — wire simulation-store into analysis flow
- `src/components/app/content-form.tsx` — verify simulation-store subscription works end-to-end
- `src/components/hive/HiveCanvas.tsx` — verify simulation-store drives node count + video
- `src/components/app/simulation/results-panel.tsx` — verify TikTok card + existing panel coordination
- `src/components/app/model-selector/*.tsx` — update account imports if needed (use-social-accounts)
- `src/hooks/use-social-accounts.ts` — verify backward compat, remove re-export alias if safe
- Responsive CSS across all new components

**Critical Context for Worker:**
- `dashboard-client.tsx` is the orchestrator — imports ContentForm, HiveCanvas, ResultsPanel
- By this phase, all individual components work in isolation — this phase ensures they talk to each other
- Key integration points:
  1. `simulation-store.apolloTier` → `HiveCanvas` re-renders with new nodeCount
  2. `useSocialAccounts().activeAccount` → `HiveNodeOverlay` persona labels
  3. `simulation-store.analysisStatus` → `TikTokResultCard` + `HiveCanvas` center video sync
  4. `simulation-store.videoSrc` → shared between TikTokResultCard and HiveCanvas center rect
- Test all on mobile (320px+), tablet, desktop

**Success Criteria:**
- Model tier change → hive immediately re-renders with correct node count (animated)
- Account switch → persona labels in hive hover update
- Analysis complete → TikTok card shows with video + engagement AND hive center rect plays video
- Loading states coordinated (no partial renders)
- All new components responsive: TikTok card full-width mobile, hive touch works, model selector readable
- No stale state between any components
- 60fps performance maintained at all tiers

---

## Team-Launch Dispatch Order

```
Wave 1 (parallel):
  → worker-a: Plan Phase 1 (Task-Type: plan)
  → worker-b: Plan Phase 2 (Task-Type: plan)
  [wait for plan approval]
  → worker-c: Execute Phase 1 (Task-Type: execute)  ← FRESH worker, not worker-a
  → worker-d: Execute Phase 2 (Task-Type: execute)  ← FRESH worker, not worker-b
  [wait for both to complete]

Wave 2 (sequential):
  → worker-e: Plan Phase 3 (Task-Type: plan)
  [wait for plan approval]
  → worker-f: Execute Phase 3 (Task-Type: execute)
  [wait for completion]

Wave 3 (sequential — Phase 5 depends on Phase 4):
  → worker-g: Plan Phase 4 (Task-Type: plan)
  [wait for plan approval]
  → worker-h: Execute Phase 4 (Task-Type: execute)
  [wait for completion]
  → worker-i: Plan Phase 5 (Task-Type: plan)
  [wait for plan approval]
  → worker-j: Execute Phase 5 (Task-Type: execute)
  [wait for completion]
```

**Lead agent rules:**
- 2 tasks per phase: Plan + Execute (separate workers, separate sessions)
- Worker executes ONE task then STOPs — lead shuts down and re-spawns for next task
- Plan workers use `mode: "plan"` — Execute workers use `mode: "auto"` or `mode: "bypassPermissions"`
- Fresh context for execution — NEVER reuse a plan worker for execution
- Within a wave, parallel phases can be planned and executed in parallel IF no file conflicts
- Cross-wave phases are strictly sequential (wait for previous wave to complete)

---

## Requirement Coverage Matrix

| Requirement | Phase | Status |
|-------------|-------|--------|
| RES-1 | 4 | Planned |
| RES-2 | 4 | Planned |
| RES-3 | 4 | Planned |
| HIVE-1 | 3 | Planned |
| HIVE-2 | 3 | Planned |
| HIVE-3 | 3 | Planned |
| HIVE-4 | 3 | Planned |
| HIVE-5 | 3 | Planned |
| HIVE-6 | 3 | Planned |
| HIVE-7 | 3 | Planned |
| MOD-1 | 1 | Planned |
| MOD-2 | 1 | Planned |
| MOD-3 | 4 | Planned |
| MOD-4 | 1 | Planned |
| MOD-5 | 1 | Planned |
| MOD-6 | 1 | Planned |
| ACC-1 | 2 | Planned |
| ACC-2 | 2 | Planned |
| ACC-3 | 2 | Planned |
| INT-1 | 5 | Planned |
| INT-2 | 5 | Planned |
| INT-3 | 5 | Planned |

All 23 requirements mapped. Zero gaps.
