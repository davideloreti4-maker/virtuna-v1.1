# Phase 1: Model Selector & Oracle Placeholder — Execution Plan

## Goal
Overhaul Apollo model selector with Lite/Pro/Ultra tiers, add Perplexity-style descriptions with 10M database messaging, persona-account link text, Oracle coming-soon card, and create the shared `simulation-store`.

## Requirements
- MOD-1: Apollo Tier Overhaul — Lite (300), Pro (1K), Ultra (10K) with Perplexity-style descriptions
- MOD-2: 10M Database Messaging — Each tier references 10M+ video database
- MOD-4: Persona-Account Link — "{nodeCount} personas modeled from @{handle}'s audience"
- MOD-5: Oracle Placeholder Card — Locked card + "Join waitlist"
- MOD-6: Model Type Toggle — Apollo vs Oracle tab

## Execution Steps

### Plan 01-01: Create model tier data definitions
**File:** `src/lib/models.ts` (CREATE)
**Wave:** 1 (no dependencies)

Create pure data file with:
- Types: `ApolloTier = 'lite' | 'pro' | 'ultra'`, `ModelFamily = 'apollo' | 'oracle'`
- `ApolloTierConfig` type: `{ id: ApolloTier, name: string, fullName: string, nodeCount: 300 | 1000 | 10000, description: string, databaseCopy: string, recommended?: boolean }`
- `APOLLO_TIERS: ApolloTierConfig[]` with 3 entries:
  - Lite: 300 nodes, "Fast, efficient analysis for quick predictions", "Scans 10M+ videos for quick pattern matching"
  - Pro: 1000 nodes, "Balanced depth and speed. Recommended for most content.", "Analyzes 10M+ videos for behavioral predictions", `recommended: true`
  - Ultra: 10000 nodes, "Maximum simulation depth. Most accurate predictions.", "Deep-scans 10M+ videos across all engagement signals"
- `NODE_COUNT_MAP: Record<ApolloTier, 300 | 1000 | 10000>` = `{ lite: 300, pro: 1000, ultra: 10000 }`
- `ORACLE_CONFIG = { name: 'Oracle', description: 'Predict real-world outcomes beyond content performance.', accentColor: 'oklch(0.55 0.18 285)' }`

**Verify:** File imports cleanly, types are correct.

---

### Plan 01-02: Create simulation Zustand store
**File:** `src/stores/simulation-store.ts` (CREATE)
**Wave:** 1 (depends on 01-01 for NODE_COUNT_MAP import)

Follow `test-store.ts` pattern (Zustand v5 `create`, no persistence):

```typescript
import { create } from 'zustand';
import { NODE_COUNT_MAP } from '@/lib/models';
import type { ApolloTier, ModelFamily } from '@/lib/models';

interface PredictedEngagement {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
}

interface SimulationStore {
  modelFamily: ModelFamily;
  apolloTier: ApolloTier;
  nodeCount: 300 | 1000 | 10000;
  setApolloTier: (tier: ApolloTier) => void;
  setModelFamily: (family: ModelFamily) => void;
  videoSrc: string | null;
  thumbnailSrc: string | null;
  setVideoSrc: (src: string | null) => void;
  setThumbnailSrc: (src: string | null) => void;
  analysisStatus: 'idle' | 'loading' | 'complete' | 'error';
  predictedEngagement: PredictedEngagement | null;
  setAnalysisResult: (engagement: PredictedEngagement) => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  modelFamily: 'apollo',
  apolloTier: 'pro',
  nodeCount: 1000,
  setApolloTier: (tier) => set({ apolloTier: tier, nodeCount: NODE_COUNT_MAP[tier] }),
  setModelFamily: (family) => set({ modelFamily: family }),
  videoSrc: null,
  thumbnailSrc: null,
  setVideoSrc: (src) => set({ videoSrc: src }),
  setThumbnailSrc: (src) => set({ thumbnailSrc: src }),
  analysisStatus: 'idle',
  predictedEngagement: null,
  setAnalysisResult: (engagement) => set({ predictedEngagement: engagement, analysisStatus: 'complete' }),
}));
```

Key: `setApolloTier` auto-derives `nodeCount` from `NODE_COUNT_MAP` — prevents stale state.

**Verify:** Store creates without error, `useSimulationStore.getState()` returns defaults.

---

### Plan 01-03: Create ApolloTierSelector component
**File:** `src/components/app/model-selector/ApolloTierSelector.tsx` (CREATE)
**Wave:** 2 (depends on 01-01, 01-02)

3-column grid of tier cards:
- Layout: `grid grid-cols-1 sm:grid-cols-3 gap-2`
- Uses `Card` from `@/components/ui/card` as base for each tier
- Selected card: add `border-accent bg-white/[0.04]` override; unselected: default Card
- Each card `<button>` with `role="radio"` + `aria-checked` in `role="radiogroup"` container

Card contents (top to bottom):
1. Row: tier name ("Lite") + `Badge` with node count ("300 nodes") — use `variant="accent"` for selected, `variant="default"` for unselected
2. Full name: "Apollo 1.5 Lite" — `text-xs text-foreground-secondary`
3. Description: Perplexity-style — `text-xs text-foreground-muted mt-1`
4. Database copy (MOD-2): with `Database` icon from lucide-react — `text-[11px] text-foreground-muted mt-2`
5. "Recommended" `Badge variant="accent" size="sm"` on Pro card only

State: reads `apolloTier` from `useSimulationStore`, calls `setApolloTier` on click.
Data: imports `APOLLO_TIERS` from `@/lib/models`.
Props: `className?: string`

**Verify:** 3 cards render, clicking changes selection, selected card has coral border.

---

### Plan 01-04: Create OracleCard component
**File:** `src/components/app/model-selector/OracleCard.tsx` (CREATE)
**Wave:** 2 (depends on 01-01)

Locked coming-soon card:
- Uses `Card` from `@/components/ui/card` with `opacity-60` wrapper
- `Lock` icon from lucide-react in top-right
- "Oracle" heading + `Badge variant="info"` "Coming Soon"
- Description from `ORACLE_CONFIG.description`
- `<button>` styled as secondary button: "Join Waitlist" — non-functional placeholder
- Purple accent via inline style using `ORACLE_CONFIG.accentColor`
- `pointer-events-none` on card body (except CTA button) to feel locked

Props: `className?: string` — purely presentational, no state.

**Verify:** Card renders dimmed with lock icon, "Coming Soon" badge, and "Join Waitlist" button.

---

### Plan 01-05: Create ModelSelector composition component
**File:** `src/components/app/model-selector/ModelSelector.tsx` (CREATE)
**Wave:** 3 (depends on 01-03, 01-04)

Top-level composition using existing Radix `Tabs`:
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useSimulationStore } from '@/stores/simulation-store';
import { useTiktokAccounts } from '@/hooks/use-tiktok-accounts';
import { ApolloTierSelector } from './ApolloTierSelector';
import { OracleCard } from './OracleCard';
```

Structure:
```
<Tabs value={modelFamily} onValueChange={setModelFamily}>
  <TabsList centered>
    <TabsTrigger value="apollo" size="sm">Apollo</TabsTrigger>
    <TabsTrigger value="oracle" size="sm">Oracle</TabsTrigger>
  </TabsList>
  <TabsContent value="apollo">
    <ApolloTierSelector />
    {/* MOD-4: Persona-account link */}
    <p className="text-xs text-foreground-muted text-center mt-3">
      {activeAccount
        ? `${nodeCount.toLocaleString()} personas modeled from @${activeAccount.handle}'s audience`
        : 'Connect an account for personalized audience modeling'}
    </p>
  </TabsContent>
  <TabsContent value="oracle">
    <OracleCard />
  </TabsContent>
</Tabs>
```

Reads from: `useSimulationStore` (modelFamily, setModelFamily, nodeCount), `useTiktokAccounts` (activeAccount)
Props: `className?: string`

**Verify:** Toggle switches between Apollo tiers and Oracle card. Persona text shows account handle or fallback.

---

### Plan 01-06: Create barrel export
**File:** `src/components/app/model-selector/index.ts` (CREATE)
**Wave:** 3

```typescript
export { ModelSelector } from './ModelSelector';
export { ApolloTierSelector } from './ApolloTierSelector';
export { OracleCard } from './OracleCard';
```

---

### Plan 01-07: Refactor content-form.tsx — remove dead model code
**File:** `src/components/app/content-form.tsx` (MODIFY)
**Wave:** 4 (depends on 01-02)

**Remove:**
- Line 46: `type ModelTier = "mini" | "pro" | "max"` type alias
- Lines 48-52: `MODEL_TIERS` constant array
- Line 66: `const [modelTier, setModelTier] = useState<ModelTier>("pro")`
- Line 67: `const [modelDropdownOpen, setModelDropdownOpen] = useState(false)`
- Line 68: `const modelDropdownRef = useRef<HTMLDivElement>(null)`
- Lines 84-93: click-outside useEffect for model dropdown
- Lines 251-293: entire model dropdown `<div>` in bottom bar
- Remove `ChevronDown`, `Check` from lucide-react imports (verify unused first)

**Add:**
- `import { useSimulationStore } from '@/stores/simulation-store'`
- Inside component: `const apolloTier = useSimulationStore((s) => s.apolloTier)`
- In the bottom bar right side (where dropdown was), add compact label:
  ```tsx
  <span className="text-xs text-foreground-muted px-2 py-1.5">
    Apollo {apolloTier}
  </span>
  ```

**Verify:** Form renders without model dropdown, shows compact tier label, no TypeScript errors.

---

### Plan 01-08: Integrate ModelSelector into dashboard
**File:** `src/app/(app)/dashboard/dashboard-client.tsx` (MODIFY)
**Wave:** 5 (depends on 01-05, 01-07)

**Add imports:**
```typescript
import { ModelSelector } from '@/components/app/model-selector';
```

**Modify** the floating container (lines 203-208):
```tsx
{(currentStatus === "idle" || currentStatus === "filling-form") ? (
  <div className="space-y-3">
    <ModelSelector />
    <ContentForm
      onSubmit={handleContentSubmit}
      uploadProgress={videoUpload.progress}
    />
  </div>
) : currentStatus === "simulating" ? (
```

**Verify:** ModelSelector renders above ContentForm. Tier selection works. Oracle toggle works. Full flow unbroken.

---

## Execution Waves

| Wave | Plans | Can Parallelize |
|------|-------|-----------------|
| 1 | 01-01, 01-02 | Yes (01-02 after 01-01) |
| 2 | 01-03, 01-04 | Yes (independent components) |
| 3 | 01-05, 01-06 | Yes (composition + barrel) |
| 4 | 01-07 | No (content-form refactor) |
| 5 | 01-08 | No (dashboard integration) |

## File Ownership

| File | Action | Owner |
|------|--------|-------|
| `src/lib/models.ts` | CREATE | Phase 1 |
| `src/stores/simulation-store.ts` | CREATE | Phase 1 |
| `src/components/app/model-selector/ApolloTierSelector.tsx` | CREATE | Phase 1 |
| `src/components/app/model-selector/OracleCard.tsx` | CREATE | Phase 1 |
| `src/components/app/model-selector/ModelSelector.tsx` | CREATE | Phase 1 |
| `src/components/app/model-selector/index.ts` | CREATE | Phase 1 |
| `src/components/app/content-form.tsx` | MODIFY | Phase 1 |
| `src/app/(app)/dashboard/dashboard-client.tsx` | MODIFY | Phase 1 |

## Reuse Inventory

| Component | Path | Usage |
|-----------|------|-------|
| `Card` | `src/components/ui/card.tsx` | Tier cards, Oracle card |
| `Tabs/TabsList/TabsTrigger/TabsContent` | `src/components/ui/tabs.tsx` | Apollo/Oracle toggle |
| `Badge` | `src/components/ui/badge.tsx` | Node counts, "Recommended", "Coming Soon" |
| `cn()` | `src/lib/utils.ts` | className merging |
| `useTiktokAccounts()` | `src/hooks/use-tiktok-accounts.ts` | MOD-4 persona text |
| Zustand `create` pattern | `src/stores/test-store.ts` | Pattern for simulation-store |

## Success Criteria

- [ ] Apollo 1.5 Lite/Pro/Ultra with Perplexity-style descriptions and node counts
- [ ] 10M database reference in each tier description
- [ ] Persona-account link text: "{count} personas modeled from @{handle}'s audience"
- [ ] Oracle card with distinct branding + description + "Join waitlist"
- [ ] Apollo | Oracle toggle/tab at top level
- [ ] `simulation-store.ts` created with model state (apolloTier, nodeCount, modelFamily)
- [ ] Model tier selection writes to simulation-store (not local state)
- [ ] `pnpm build` passes
- [ ] No existing tests broken
