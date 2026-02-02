# Virtuna v1.1

## Vision
A pixel-perfect, AI-verified clone of societies.io (landing + app) serving as the design foundation for a social media intelligence platform.

## Core Value Proposition
1:1 visual and functional match with societies.io, verified by AI video analysis.

## What We're Building

| Component | Scope |
|-----------|-------|
| Landing Site | All marketing pages (home, pricing, about, etc.) |
| App | 10-20 screens + full auth UI flows |
| Responsive | Full mobile + desktop |
| Animations | All except complex node animations |
| Frontend | Working with mock data |
| Auth | Real Supabase Auth integration |
| QA | AI video analysis (Gemini) must pass |
| Deploy | Vercel |

## Out of Scope (This Version)
- Real backend/data integration (v1.2+)
- Complex node animations
- Design customization (v1.2+)

## Tech Stack

| Category | Choice |
|----------|--------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS |
| Auth | Supabase Auth |
| Deployment | Vercel |
| Package Manager | npm |

## Success Criteria

### Visual Fidelity
- AI video analysis passes with 95%+ similarity score
- All pages match societies.io layout pixel-perfectly
- Responsive breakpoints match exactly

### Functional Completeness
- All navigation works correctly
- Auth flows function with Supabase
- All interactive elements respond appropriately
- Animations match (except complex node animations)

### Code Quality
- TypeScript strict mode, no `any` types
- Clean component architecture
- Proper error handling
- Well-organized file structure

## Key Decisions

1. **Greenfield Project**: Starting fresh, no legacy constraints
2. **Mock Data**: Frontend-only, no real API integration
3. **Supabase Auth**: Real authentication for user flows
4. **AI Verification**: Using Gemini for visual QA
5. **Vercel Deploy**: Continuous deployment from GitHub

## Target Reference
- Production site: https://societies.io
- Landing pages + App interface to clone

## Repository
- GitHub: https://github.com/davideloreti4-maker/virtuna-v1.1
- Local: ~/virtuna-v1.1

---

## In Progress: v1.3.2 — Landing Page Redesign

**Goal:** Redesign the homepage with Raycast-inspired aesthetics and iOS 26 design language, creating a premium visual experience.

**Status:** Phase 15 complete (Foundation Primitives), Phases 16-19 remaining

**Design Direction:**
- **Glassmorphism** — Frosted glass panels, translucent overlays
- **Gradient Lighting** — Dramatic glow effects, cinematic depth
- **macOS Window Mockups** — Traffic light buttons, app-like presentations
- **Premium Feature Cards** — Distinct color identities, interactive feel
- **iOS 26 Aesthetic** — Depth, translucency, smooth animations

**Target:**
- Homepage only (full creative freedom)
- Not tied to societies.io structure
- Raycast.com as primary design inspiration

### Success Criteria
- Landing page feels as premium/polished as Raycast
- Glassmorphism and gradient effects implemented smoothly
- Animations are buttery smooth (60fps)
- Mobile responsive with same premium feel
- All interactive elements feel refined

---

## Current Milestone: v1.5 — Trending Page

**Goal:** Real-time viral video discovery feed with analysis and remix capabilities, powered by Apify TikTok scraper.

**Core Concept:**
- Curated feed of currently viral TikTok videos (Instagram later)
- AI-powered tagging system (breaking out, challenges, trends, etc.)
- Quality-filtered — narrow but high signal, no low-quality content

**Key Features:**
- **Trending Feed** — Videos currently going viral, filterable by category/tags
- **Analyze Action** — Get viral score + breakdown + explanation (same system as predictor)
- **Remix Action** — Generate 2-3 customized versions with hooks, scripts, CTAs tailored to user goal/audience + actionable filming steps

**User Flow:** Consume → Learn (analyze) → Create (remix)

**Positioning:** Under Prediction Engine in sidebar with toggle to switch views

**Technical Requirements:**
- Apify TikTok scraper integration
- Backend API for video data
- Automated AI categorization/tagging
- Quality curation layer

**Success Criteria:**
- Feed surfaces genuinely viral, high-quality content
- Analysis matches viral predictor output format
- Remix provides actionable, ready-to-film content
- Smooth UX switching between predictor and trending

---

## In Progress: v1.4 — Node Visualization

**Goal:** Rework the dashboard node visualization into a mesmerizing, addictive, TikTok-viral-worthy experience that delivers real value to power users.

**Status:** Phase 20 complete (Visualization Foundation), Phase 21 next (Particle System)

**Vision:** Hybrid visualization with central AI orb + chaos → order node crystallization

**Core Concept:**
- Central glowing orb as the "AI brain"
- Particles flow toward orb during processing
- Nodes form dynamically, abstract at first, then crystallize into labeled insights
- Full physics playground: drag, fling, spin, magnetic attraction, ripple effects

**Key Features:**
- Sound design layer for satisfying interactions
- Captivating idle hook state (compelling before any action)
- Progress indicators within chaos (subtle but present)
- Compression-proof design (survives TikTok video recording)
- Professional mode toggle for enterprise credibility
- Paced revelation (insights appear sequentially)
- Error/empty state handling

**Technical Requirements:**
- Mobile-first with 60fps performance on mid-range devices
- Touch gesture support (tap = preview, hold = detail sheet)
- High contrast, bold effects for video survival

**Success Criteria:**
- Scroll-stopping visual impact (TikTok-worthy)
- Addictive fidget interactions ("can't stop touching it")
- Real insight value for power users
- 60fps on mobile devices

**Research:** `.planning/research/` (VISUAL-PSYCHOLOGY.md, AI-PERCEPTION.md, MOTION-PSYCHOLOGY.md, INSPIRATION.md, SUMMARY.md)

---

## Completed: v1.2 — Visual Accuracy Refinement ✓

**Completed:** 2026-01-31

**What Was Done:**
- Phase 11: Extraction — 207 screenshots captured from app.societies.io
- Phase 12: Comparison — 45 discrepancies documented (8 critical, 18 major, 19 minor)
- Full discrepancy report with prioritization

**Deliverables:**
- `extraction/screenshots/` — Complete screenshot library
- `.planning/phases/12-comparison/DISCREPANCY-REPORT.md`
- `.planning/phases/12-comparison/DISCREPANCIES.json`

---

## Completed: v1.1 — Pixel-Perfect Clone ✓

### What Was Built
| Component | Scope |
|-----------|-------|
| Society Selector | Personal + Target sections, create/edit modals |
| View Selector | Country, City, Generation, Role Level dropdowns |
| Test Forms | All 11 test type forms (TikTok + Instagram functional) |
| Results View | Impact score, attention, variants, insights, themes |
| Test History | Sidebar history, delete, revisit results |
| Settings | Profile, account, notifications, billing UI |
| Modals | Leave Feedback, Create Society |

### Reference Documentation
All reference files in `.reference/app/`:
- `README.md` - App overview
- `society-selector.md` - Society picker modal
- `view-selector.md` - View dropdown specs
- `tests/README.md` - Test feature overview
- `tests/type-selector.md` - Test type selection
- `tests/content-forms.md` - Content form specs
- `tests/results.md` - Results view specs
- `tests/history.md` - Test history sidebar
- `modals.md` - Feedback and Create Society modals
