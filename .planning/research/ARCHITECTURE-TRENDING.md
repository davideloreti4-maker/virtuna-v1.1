# Architecture Patterns: Trending Page Integration

**Domain:** Trending video feed with AI analysis and storyboard remix
**Project:** Virtuna v1.5
**Researched:** 2026-02-02
**Confidence:** HIGH (based on existing codebase analysis + current documentation)

---

## Executive Summary

The Trending Page integrates as a **parallel feature domain** alongside the existing Dashboard. It follows the same architectural patterns (App Router route groups, Zustand stores, component composition) but introduces **new concerns**: external data fetching (Apify), API routes for backend processing, and AI-powered content generation.

**Key architectural decisions:**
1. Use **API Routes for external data operations** (Apify, AI classification) and **Server Actions for mutations** (save remix, update status)
2. Keep Zustand for client state only; use TanStack Query for server state
3. Use **v0 MCP for complex UI components** (video cards, storyboard layouts, teleprompter) to accelerate development

---

## Existing Architecture Analysis

### Current Structure

```
src/
├── app/
│   ├── (app)/              # Authenticated app routes
│   │   ├── layout.tsx      # AppShell wrapper (sidebar + auth)
│   │   ├── dashboard/      # Main dashboard (test creation flow)
│   │   └── settings/       # User settings
│   └── (marketing)/        # Public marketing pages
├── components/
│   ├── app/                # App-specific components
│   │   ├── sidebar.tsx     # Navigation sidebar
│   │   ├── simulation/     # Test results components
│   │   └── settings/       # Settings page components
│   ├── ui/                 # Generic UI primitives
│   └── visualization/      # 3D orb visualization
├── stores/
│   ├── test-store.ts       # Test creation/results state
│   ├── society-store.ts    # Society selection state
│   └── settings-store.ts   # User settings state
├── types/
│   └── test.ts             # Test type definitions
└── lib/
    ├── mock-data.ts        # Mock data generators
    └── supabase/           # Supabase client utilities
```

### Existing Patterns to Follow

| Pattern | How Used | Apply to Trending |
|---------|----------|-------------------|
| Route groups `(app)/` | Shared authenticated layout | Add `trending/` under `(app)/` |
| Zustand stores | Client state with localStorage persistence | New `trending-store.ts` |
| Component composition | Feature-specific component folders | New `components/app/trending/` |
| Type definitions | Centralized in `types/` | New `types/trending.ts` |
| Mock data generators | `lib/mock-data.ts` | New `lib/trending-mock.ts` for dev |

### Current Data Flow

```
User Action → Zustand Store → Mock Data Generator → Store Update → Component Re-render
```

**No API routes exist yet.** All data is mocked client-side.

---

## New vs Modified Components (Explicit)

### Components to MODIFY

| Component | File | Modification | Effort |
|-----------|------|--------------|--------|
| **Sidebar** | `components/app/sidebar.tsx` | Add "Trending" nav item with TrendingUp icon | Small |
| **SidebarNavItem** | `components/app/sidebar-nav-item.tsx` | Add `href` prop support (currently onClick only) | Small |
| **Component index** | `components/app/index.ts` | Export new trending components | Small |

### Components to REUSE (No Modification)

| Component | Purpose in Trending |
|-----------|---------------------|
| `ImpactScore` | Display analyze results score |
| `AttentionBreakdown` | Show engagement metrics |
| `InsightsSection` | Display AI insights |
| `ThemesSection` | Show conversation themes |
| Modal primitives (Radix) | Video detail modal wrapper |
| `FilterPill` / `FilterPillGroup` | Category/tag filters |
| `Button`, `Card`, `Input` | UI primitives |

### Components to CREATE

| Component | Folder | Complexity | v0 Candidate? |
|-----------|--------|------------|---------------|
| **Route: trending/page.tsx** | `app/(app)/trending/` | Low | No |
| **TrendingClient** | `app/(app)/trending/` | Medium | No |
| **TrendingDashboard** | `components/app/trending/` | High | **Yes** |
| **VideoCard** | `components/app/trending/` | High | **Yes** |
| **VideoGrid** | `components/app/trending/` | Medium | Partial |
| **CategorySection** | `components/app/trending/` | Medium | **Yes** |
| **VideoDetailModal** | `components/app/trending/` | High | **Yes** |
| **FilterChips** | `components/app/trending/` | Low | No (reuse existing) |
| **NicheSelector** | `components/app/trending/` | Medium | Partial |
| **AnalyzeResults** | `components/app/trending/` | Low | No (wrapper) |
| **RemixForm** | `components/app/remix/` | High | **Yes** |
| **RemixOutput** | `components/app/remix/` | High | **Yes** |
| **RemixCard** | `components/app/remix/` | Medium | **Yes** |
| **TeleprompterView** | `components/app/remix/` | High | **Yes** |
| **RemixStatusBadge** | `components/app/remix/` | Low | No |
| **PDFExportButton** | `components/app/remix/` | Low | No |
| **StoryboardPDF** | `components/pdf/` | Medium | No (React-PDF syntax) |

---

## v0 MCP Integration Strategy

### Why Use v0 MCP

v0 excels at generating complex visual layouts with standard UI patterns. For Trending Page:
- **Video cards** have many visual elements (thumbnail, overlay, badges, hover states)
- **Dashboard layouts** need responsive multi-section grids
- **Storyboard displays** have complex text formatting

**v0 reduces time** for visual implementation, allowing focus on business logic and API integration.

### Recommended v0 Candidates (Prioritized)

#### Phase 2 - Core Feed UI (HIGH Priority)

| Component | v0 Prompt Guidance | Post-Generation Adaptation |
|-----------|-------------------|---------------------------|
| **VideoCard** | "TikTok-style video card with vertical thumbnail, creator handle overlay, view multiplier badge (46x), category tag pill. Dark theme (zinc-900). Hover reveals Analyze/Remix buttons." | Replace any inline styles with Tailwind. Add TypeScript interfaces. Wire to onClick handlers. |
| **TrendingDashboard** | "Dashboard with 3 horizontal category sections (Breaking Out, Sustained Viral, Resurging). Each section has header + horizontal scroll of cards. Dark premium feel." | Connect to TanStack Query hooks. Add loading skeletons. |
| **CategorySection** | "Horizontal scrolling gallery with header, see-all link, 4-6 cards visible, subtle scroll fade indicators." | Wire to category data and routing. |

#### Phase 3 - Video Detail (MEDIUM Priority)

| Component | v0 Prompt Guidance | Post-Generation Adaptation |
|-----------|-------------------|---------------------------|
| **VideoDetailModal** | "Full-height slide-over modal. Left: video thumbnail/preview. Right: details (creator, metrics, description). Bottom: Analyze and Remix action buttons as primary CTAs." | Connect to Radix Dialog. Wire actions to stores/API. |

#### Phase 5 - Remix Feature (HIGH Priority)

| Component | v0 Prompt Guidance | Post-Generation Adaptation |
|-----------|-------------------|---------------------------|
| **RemixForm** | "Multi-step form. Step 1: Goal selection (6 cards: Maximize Reach, Grow Followers, etc.). Step 2: Niche and tweaks (accordion for optional inputs). Generate button." | Wire to remix-store. Add validation with Zod. |
| **RemixOutput** | "3 remix variant cards in responsive grid. Each shows hook preview, expandable shot list, copy buttons. Status badge (To Film/Filmed/Posted)." | Wire to remix data. Add copy-to-clipboard. |
| **RemixCard** | "Expandable card with hook (bold), shot list (numbered), script (collapsible), CTA and hashtags. Copy button per section." | Wire to variant data. Handle expand/collapse state. |

#### Phase 6 - Advanced (MEDIUM Priority)

| Component | v0 Prompt Guidance | Post-Generation Adaptation |
|-----------|-------------------|---------------------------|
| **TeleprompterView** | "Full-screen dark teleprompter. Large white text on black. Auto-scroll control (play/pause, speed slider). Section markers. Exit button top-right." | Wire to script data. Add scroll sync logic. |

### v0 Workflow

```
1. Generate with v0 MCP
   └── Use descriptive prompt from table above
   └── Request Tailwind CSS + TypeScript
   └── Request loading/skeleton variant

2. Copy to project
   └── Create file in appropriate folder
   └── Add to barrel exports (index.ts)

3. Adapt to conventions
   └── Replace any inline styles with Tailwind classes
   └── Use project Button/Card/Modal from components/ui/
   └── Add TypeScript interfaces from types/trending.ts
   └── Ensure dark theme matches existing (zinc-900/950)

4. Wire to system
   └── Connect to Zustand store actions
   └── Add TanStack Query hooks for data
   └── Handle loading/error states
   └── Add proper aria labels

5. Test
   └── Verify responsiveness
   └── Check dark mode consistency
   └── Test with mock data
```

### What NOT to Use v0 For

| Component | Reason |
|-----------|--------|
| Route pages | Just wrappers around client components |
| Zustand stores | Pure logic, no UI |
| API routes | Backend code |
| Type definitions | Schema definitions |
| StoryboardPDF | React-PDF has specific syntax v0 doesn't know |
| Wiring/integration | Manual connection to stores/APIs |

---

## Recommended Architecture for Trending Page

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TRENDING PAGE                                │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   Dashboard  │  │   Category   │  │      Video Detail        │  │
│  │   Overview   │──│   Grid View  │──│    Modal (Analyze/      │  │
│  │   (Home)     │  │   (Drill)    │  │    Remix Actions)        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                         ZUSTAND STORES                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  trending-store  │  │   remix-store    │  │  filter-store    │  │
│  │  (feed state,    │  │  (remix form,    │  │  (niche, tags,   │  │
│  │   selected vid)  │  │   outputs)       │  │   categories)    │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                         API ROUTES                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  /api/trending   │  │  /api/analyze    │  │  /api/remix      │  │
│  │  GET: fetch feed │  │  POST: analyze   │  │  POST: generate  │  │
│  │  (from DB)       │  │  video           │  │  remix variants  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                      BACKGROUND JOBS                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Vercel Cron / External Service (not in Next.js runtime)     │  │
│  │  - Fetch from Apify TikTok scraper                           │  │
│  │  - Calculate views multiplier                                 │  │
│  │  - AI classification (categories, niches, tags)              │  │
│  │  - Store in database                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Apify     │────▶│  Background  │────▶│   Database   │────▶│  API Route   │
│  TikTok API  │     │    Job       │     │  (Supabase)  │     │  GET /feed   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                           │                                          │
                           │                                          │
                     ┌─────▼─────┐                              ┌─────▼─────┐
                     │    AI     │                              │  Frontend │
                     │ Classify  │                              │   Feed    │
                     └───────────┘                              └───────────┘
                                                                      │
                                                               ┌──────▼──────┐
                                                               │   Analyze   │
                                                               │   /Remix    │
                                                               │   Action    │
                                                               └──────┬──────┘
                                                                      │
                                                               ┌──────▼──────┐
                                                               │  API Route  │
                                                               │ POST /remix │
                                                               └──────┬──────┘
                                                                      │
                                                               ┌──────▼──────┐
                                                               │  AI (LLM)   │
                                                               │  Generate   │
                                                               └─────────────┘
```

---

## Integration Points with Existing Architecture

### 1. Sidebar Navigation (MODIFY)

**File:** `src/components/app/sidebar.tsx`

**Change:** Add new navigation item for Trending Page.

```typescript
// Add to navigation items, below "Create a new test"
<SidebarNavItem
  label="Trending"
  icon={TrendingUp}  // from lucide-react
  href="/trending"
  active={pathname === '/trending'}
/>
```

**Placement:** Below "Create a new test" button, as a top-level nav item (per requirements).

### 2. App Layout (NO CHANGE)

**File:** `src/app/(app)/layout.tsx`

The existing layout with `AppShell` wrapper works for Trending Page. No changes needed.

### 3. Results Panel (REUSE)

**File:** `src/components/app/simulation/results-panel.tsx`

The Analyze action should produce output matching the viral predictor format. Reuse:
- `ImpactScore` component
- `AttentionBreakdown` component
- `InsightsSection` component

**Adaptation needed:** Create wrapper component `AnalyzeResults` that accepts video analysis data and renders existing simulation components.

### 4. Zustand Store Pattern (FOLLOW)

**Existing pattern from `test-store.ts`:**
- Hydration pattern for SSR safety (`_isHydrated`, `_hydrate()`)
- localStorage persistence helpers
- Async simulation phases
- Status state machine

**Apply same patterns to:**
- `trending-store.ts` - UI state (selected video, modal open, filters)
- `remix-store.ts` - Remix form inputs, generated outputs, status tracking

---

## New Components Needed

### Route Structure

```
src/app/(app)/
├── dashboard/          # Existing
├── settings/           # Existing
└── trending/           # NEW
    ├── page.tsx        # Dashboard overview (server component)
    ├── trending-client.tsx  # Client component with hydration
    ├── [category]/
    │   └── page.tsx    # Category grid view
    └── layout.tsx      # Optional: trending-specific layout
```

### Component Hierarchy

```
src/components/app/
├── trending/                    # NEW FOLDER
│   ├── index.ts                 # Barrel exports
│   ├── trending-dashboard.tsx   # Dashboard with category sections [v0]
│   ├── video-card.tsx           # Individual video card [v0]
│   ├── video-grid.tsx           # Grid of video cards
│   ├── video-detail-modal.tsx   # Detail modal with actions [v0]
│   ├── category-section.tsx     # Breaking Out, Sustained, etc. [v0]
│   ├── filter-chips.tsx         # Content type + strategic filters
│   ├── niche-selector.tsx       # Primary/secondary niche picker
│   └── analyze-results.tsx      # Analyze output (reuses sim components)
├── remix/                       # NEW FOLDER
│   ├── index.ts
│   ├── remix-form.tsx           # Input form (niche, goal, tweaks) [v0]
│   ├── remix-output.tsx         # Generated briefs display [v0]
│   ├── remix-card.tsx           # Single remix variant card [v0]
│   ├── teleprompter-view.tsx    # Full-screen script mode [v0]
│   ├── remix-status-badge.tsx   # To Film / Filmed / Posted
│   └── pdf-export-button.tsx    # Download storyboard as PDF
```

### API Routes

```
src/app/api/
├── trending/
│   ├── route.ts         # GET: Fetch feed with filters
│   └── [videoId]/
│       └── route.ts     # GET: Single video details
├── analyze/
│   └── route.ts         # POST: Analyze a video (reuse predictor logic)
├── remix/
│   ├── route.ts         # POST: Generate remix variants
│   └── [remixId]/
│       ├── route.ts     # GET: Fetch saved remix, PATCH: Update status
│       └── pdf/
│           └── route.ts # GET: Generate PDF
└── user/
    └── preferences/
        └── route.ts     # GET/PATCH: Niche preferences
```

### Type Definitions

```typescript
// src/types/trending.ts

export interface TrendingVideo {
  id: string;
  tiktokId: string;
  url: string;
  thumbnailUrl: string;
  creatorHandle: string;
  creatorAvatarUrl?: string;
  viewsMultiplier: number;      // Primary metric: 46x their average
  totalViews: number;
  postedAt: string;
  scrapedAt: string;

  // Classification
  behavioralCategory: 'breaking-out' | 'sustained-viral' | 'resurging';
  contentType: ContentType;
  strategicTags: StrategicTag[];
  niches: string[];

  // Creator baseline (for multiplier calc)
  creatorAvgViews: number;
  creatorVideoCount30d: number;
}

export type ContentType =
  | 'challenge'
  | 'tutorial'
  | 'story'
  | 'comedy'
  | 'reaction'
  | 'aesthetic';

export type StrategicTag =
  | 'high-remix-potential'
  | 'niche-breakout'
  | 'trending-sound';

export interface RemixInput {
  sourceVideoId: string;
  niche: string;
  goal: RemixGoal;
  targetAudience?: string;
  tone?: ToneStyle;
  constraints?: string[];
  brandVoiceNotes?: string;
  formatPreference?: FormatPreference;
}

export type RemixGoal =
  | 'maximize-reach'
  | 'grow-followers'
  | 'build-authority'
  | 'drive-sales'
  | 'educate'
  | 'entertain';

export type ToneStyle =
  | 'casual'
  | 'professional'
  | 'raw'
  | 'polished'
  | 'funny'
  | 'serious';

export type FormatPreference =
  | 'talking-head'
  | 'b-roll-heavy'
  | 'text-overlay'
  | 'green-screen';

export interface RemixOutput {
  id: string;
  sourceVideoId: string;
  input: RemixInput;
  variants: RemixVariant[];
  createdAt: string;
  status: 'to-film' | 'filmed' | 'posted';
}

export interface RemixVariant {
  id: string;
  hook: string;
  shotList: ShotItem[];
  fullScript: string;
  audioSuggestion: string;
  cta: string;
  hashtags: string[];
  filmingTips: string[];
}

export interface ShotItem {
  shotNumber: number;
  duration: string;
  visual: string;
  audio: string;
  notes?: string;
}

// Feed state
export interface TrendingFeedState {
  videos: TrendingVideo[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  cursor?: string;
}

// Filter state
export interface TrendingFilters {
  category?: 'breaking-out' | 'sustained-viral' | 'resurging';
  contentTypes: ContentType[];
  strategicTags: StrategicTag[];
  niches: string[];
}
```

---

## Suggested Build Order (Enhanced)

Based on dependencies, risk management, and v0 acceleration opportunities.

### Phase 1: Foundation (Week 1)

**Goal:** Types, stores, routes, mock data - no UI yet.

| Step | Task | Depends On | v0? | Effort |
|------|------|------------|-----|--------|
| 1.1 | Define `types/trending.ts` | None | No | 2h |
| 1.2 | Define `types/remix.ts` | 1.1 | No | 1h |
| 1.3 | Create `stores/trending-store.ts` | 1.1 | No | 3h |
| 1.4 | Create `stores/remix-store.ts` | 1.2 | No | 3h |
| 1.5 | Create `lib/trending-mock.ts` | 1.1, 1.2 | No | 2h |
| 1.6 | Create `app/(app)/trending/page.tsx` (placeholder) | None | No | 30m |
| 1.7 | Modify `sidebar.tsx` to add Trending nav | None | No | 1h |

**Deliverable:** Navigate to /trending, see placeholder, stores ready.

### Phase 2: Core Feed UI (Week 2)

**Goal:** Video cards, dashboard layout, category sections - pure frontend with mock data.

| Step | Task | Depends On | v0? | Effort |
|------|------|------------|-----|--------|
| 2.1 | Generate `VideoCard` with v0 | 1.1 | **Yes** | 1h |
| 2.2 | Adapt VideoCard to project conventions | 2.1 | No | 2h |
| 2.3 | Generate `CategorySection` with v0 | 2.2 | **Yes** | 1h |
| 2.4 | Adapt CategorySection | 2.3 | No | 1h |
| 2.5 | Generate `TrendingDashboard` with v0 | 2.4 | **Yes** | 1h |
| 2.6 | Create `trending-client.tsx` | 2.5, 1.3 | No | 3h |
| 2.7 | Wire dashboard to mock data | 2.6, 1.5 | No | 2h |
| 2.8 | Add VideoGrid for category drill-down | 2.2 | Partial | 3h |

**Deliverable:** Full dashboard with 3 category sections, mock data, working navigation.

### Phase 3: Video Detail + Analyze (Week 3)

**Goal:** Detail modal, analyze integration, filters.

| Step | Task | Depends On | v0? | Effort |
|------|------|------------|-----|--------|
| 3.1 | Generate `VideoDetailModal` with v0 | 2.2 | **Yes** | 1h |
| 3.2 | Adapt and wire modal | 3.1, 1.3 | No | 3h |
| 3.3 | Create `AnalyzeResults` wrapper | Existing simulation/ | No | 2h |
| 3.4 | Wire Analyze action (mock) | 3.3 | No | 2h |
| 3.5 | Add filter chips (reuse/adapt) | 2.5 | No | 2h |
| 3.6 | Add NicheSelector | 3.5 | Partial | 3h |

**Deliverable:** Click video -> see details -> run Analyze -> see results.

### Phase 4: Backend Infrastructure (Week 4)

**Goal:** Real API routes, database, TanStack Query.

| Step | Task | Depends On | v0? | Effort |
|------|------|------------|-----|--------|
| 4.1 | Create Supabase tables (SQL migrations) | 1.1 | No | 3h |
| 4.2 | Create `api/trending/route.ts` | 4.1 | No | 3h |
| 4.3 | Create `api/analyze/route.ts` | Existing predictor | No | 4h |
| 4.4 | Set up TanStack Query provider | None | No | 2h |
| 4.5 | Create query hooks (`lib/queries/`) | 4.2, 4.4 | No | 3h |
| 4.6 | Replace mock data with real API calls | 4.5, 2.7 | No | 3h |

**Deliverable:** Dashboard fetches from database, Analyze calls AI.

### Phase 5: Remix Feature (Week 5)

**Goal:** Remix form, generation, output display.

| Step | Task | Depends On | v0? | Effort |
|------|------|------------|-----|--------|
| 5.1 | Generate `RemixForm` with v0 | 1.2 | **Yes** | 1h |
| 5.2 | Adapt and wire form | 5.1, 1.4 | No | 4h |
| 5.3 | Create `api/remix/route.ts` | 4.1 | No | 4h |
| 5.4 | Generate `RemixOutput` with v0 | 5.1 | **Yes** | 1h |
| 5.5 | Generate `RemixCard` with v0 | 5.4 | **Yes** | 1h |
| 5.6 | Adapt and wire output components | 5.5 | No | 3h |
| 5.7 | Wire remix flow end-to-end | 5.2, 5.3, 5.6 | No | 4h |
| 5.8 | Add status tracking (To Film/Filmed/Posted) | 5.7 | No | 2h |

**Deliverable:** Complete remix flow from video -> form -> 3 briefs.

### Phase 6: Advanced Features (Week 6)

**Goal:** Teleprompter, PDF export, cron job.

| Step | Task | Depends On | v0? | Effort |
|------|------|------------|-----|--------|
| 6.1 | Generate `TeleprompterView` with v0 | 5.6 | **Yes** | 1h |
| 6.2 | Adapt and wire teleprompter | 6.1 | No | 3h |
| 6.3 | Create `StoryboardPDF` component | 1.2 | No | 4h |
| 6.4 | Create `api/remix/[id]/pdf/route.ts` | 6.3 | No | 2h |
| 6.5 | Add PDF export button | 6.4 | No | 1h |
| 6.6 | Set up Vercel cron job | 4.2 | No | 3h |
| 6.7 | Add Apify integration | 6.6 | No | 4h |

**Deliverable:** Full feature set - teleprompter, PDF export, automated scraping.

### Build Order Summary

| Phase | Focus | v0 Components | Deliverable |
|-------|-------|---------------|-------------|
| 1 | Foundation | 0 | Navigate to /trending, stores ready |
| 2 | Core Feed | VideoCard, CategorySection, TrendingDashboard | Working dashboard with mock data |
| 3 | Video Detail | VideoDetailModal | Click -> detail -> analyze |
| 4 | Backend | 0 | Real data from Supabase |
| 5 | Remix | RemixForm, RemixOutput, RemixCard | Full remix flow |
| 6 | Advanced | TeleprompterView | Teleprompter, PDF, cron |

**Total v0 components:** 8 (saves ~16-20 hours of UI development)

---

## Patterns to Follow

### Pattern 1: Route Group for Feature Domain

**What:** Keep Trending Page routes under `(app)/trending/` to share authenticated layout.

**Why:** Consistent with existing `dashboard/` and `settings/` organization.

**Example:**
```
src/app/(app)/trending/
├── page.tsx                    # Server component - initial data fetch
├── trending-client.tsx         # Client component - interactivity
└── [category]/page.tsx         # Dynamic route for category drill-down
```

### Pattern 2: Server Component + Client Component Split

**What:** Use server components for initial data fetch, client components for interactivity.

**Why:** Optimal performance, follows existing Dashboard pattern.

**Example:**
```typescript
// page.tsx (Server Component)
import { TrendingClient } from './trending-client';

export default async function TrendingPage() {
  // Could do initial server-side data fetch here if needed
  return <TrendingClient />;
}

// trending-client.tsx (Client Component)
'use client';
export function TrendingClient() {
  const store = useTrendingStore();
  // Client-side interactivity
}
```

### Pattern 3: API Routes for External Services

**What:** Use Route Handlers (`app/api/*/route.ts`) for Apify calls, AI generation.

**Why:**
- Keeps API keys server-side
- Centralizes external service logic
- Enables caching and rate limiting
- Supports external clients if needed later

**Example:**
```typescript
// app/api/remix/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate input
  // Call AI service
  // Return generated remixes

  return NextResponse.json({ variants: [...] });
}
```

### Pattern 4: Zustand for Client State, TanStack Query for Server State

**What:** Zustand manages UI state (selected video, open modals, form inputs). Use TanStack Query for server data.

**Why:**
- Avoids SSR state hydration issues
- Clear separation of concerns
- Follows 2026 best practices (Zustand for client, Query for server)

**Example:**
```typescript
// trending-store.ts - UI state only
interface TrendingState {
  selectedVideoId: string | null;
  isDetailModalOpen: boolean;
  activeFilters: FilterState;
  // UI state only - not video data

  setSelectedVideo: (id: string | null) => void;
  toggleDetailModal: (open: boolean) => void;
  updateFilters: (filters: Partial<FilterState>) => void;
}

// In component - fetch data with Query
const { data: videos, isLoading } = useQuery({
  queryKey: ['trending', 'dashboard'],
  queryFn: () => fetch('/api/trending').then(r => r.json()),
});
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Server Data in Zustand

**What:** Putting fetched video data directly in Zustand store.

**Why bad:**
- SSR hydration mismatches
- Stale data issues
- Duplicates React Query/SWR capabilities

**Instead:** Use Zustand only for UI state (selected items, filters, form state). Fetch server data with TanStack Query.

### Anti-Pattern 2: Calling Apify Directly from Client

**What:** Making Apify API calls from browser JavaScript.

**Why bad:**
- Exposes API keys
- CORS issues
- No rate limiting control

**Instead:** All Apify calls go through API routes. Client calls `/api/trending`, API route calls Apify (or reads from database populated by background job).

### Anti-Pattern 3: Monolithic Video Detail Component

**What:** Single 500+ line component for video detail modal with all features.

**Why bad:**
- Hard to maintain
- Difficult to test
- Poor reusability

**Instead:** Compose from smaller components: `VideoHeader`, `AnalyzeSection`, `RemixSection`, `ActionButtons`.

### Anti-Pattern 4: Coupling Analyze and Remix Logic

**What:** Tightly coupling the Analyze feature to Remix.

**Why bad:**
- Analyze is reused from viral predictor (independent feature)
- Remix has its own complex flow
- Different update frequencies

**Instead:** Keep Analyze as a standalone action that can feed into Remix. Analyze produces data -> user can choose to Remix -> Remix takes Analyze output as optional input.

### Anti-Pattern 5: Using v0 Output Verbatim

**What:** Copying v0 generated code without adaptation.

**Why bad:**
- Inconsistent styles with project
- Missing TypeScript interfaces
- Not wired to stores/APIs
- May use different component library

**Instead:** Always adapt v0 output:
1. Replace inline styles with Tailwind classes
2. Use project's Button/Card/Modal components
3. Add TypeScript interfaces from types/
4. Wire to Zustand stores and Query hooks
5. Ensure dark theme matches existing (zinc-900/950)

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Feed queries | Direct DB queries | Add caching layer | CDN + edge caching |
| Video storage | Supabase DB | Supabase DB | Consider dedicated video metadata DB |
| Remix generation | On-demand LLM calls | Queue system | Queue + caching popular remixes |
| Apify costs | Minimal | Moderate | Optimize scraping frequency |
| PDF generation | Client-side | Server-side generation | Pre-generate popular templates |

---

## Database Schema Preview

```sql
-- Trending videos (populated by Apify cron job)
CREATE TABLE trending_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiktok_id TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,

  -- Creator info
  creator_handle TEXT NOT NULL,
  creator_avatar_url TEXT,
  creator_avg_views INTEGER,
  creator_video_count_30d INTEGER,

  -- Metrics
  views_multiplier DECIMAL(10,2),
  total_views BIGINT,

  -- Classification
  behavioral_category TEXT NOT NULL,  -- 'breaking-out' | 'sustained-viral' | 'resurging'
  content_type TEXT,
  strategic_tags TEXT[],
  niches TEXT[],

  -- Timestamps
  posted_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Saved remixes
CREATE TABLE remixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source_video_id UUID REFERENCES trending_videos(id),

  -- Input
  niche TEXT NOT NULL,
  goal TEXT NOT NULL,
  input_json JSONB,

  -- Output
  variants JSONB NOT NULL,  -- Array of RemixVariant

  -- Status
  status TEXT DEFAULT 'to-film',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User niche preferences
CREATE TABLE user_niche_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  primary_niche TEXT,
  secondary_niches TEXT[],

  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_trending_category ON trending_videos(behavioral_category);
CREATE INDEX idx_trending_niches ON trending_videos USING GIN(niches);
CREATE INDEX idx_remixes_user ON remixes(user_id);
CREATE INDEX idx_remixes_status ON remixes(status);
```

---

## Integration Checklist

- [ ] Sidebar navigation item added
- [ ] Route group follows `(app)/` pattern
- [ ] Zustand stores follow existing hydration pattern
- [ ] Types defined before implementation
- [ ] Mock data available for frontend development
- [ ] API routes handle external service calls
- [ ] Analyze action reuses predictor components
- [ ] Client/server component split matches Dashboard pattern
- [ ] v0 components adapted to project conventions
- [ ] TanStack Query provider configured

---

## Sources

- Existing codebase analysis (`/Users/davideloreti/virtuna-v1.1/src/`)
- Discussion context (`.planning/DISCUSS-CONTEXT-trending-page.md`)
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Next.js Building APIs Guide](https://nextjs.org/blog/building-apis-with-nextjs)
- [Zustand + React Query Pattern](https://medium.com/@freeyeon96/zustand-react-query-new-state-management-7aad6090af56)
- [TanStack Query v5 Docs](https://tanstack.com/query/latest)
- [Apify TikTok Scraper API](https://apify.com/clockworks/tiktok-scraper)
- [Server Actions vs API Routes](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers)
- [v0.dev Documentation](https://v0.dev/docs)

---

*Research completed: 2026-02-02*
*Ready for roadmap creation*
