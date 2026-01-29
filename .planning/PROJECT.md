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

## Milestone v1.2 — Test Creation (Full App Clone)

### Vision
1:1 pixel-perfect clone of the entire societies.io app UI with functional TikTok + Instagram test forms.

### What We're Building

| Component | Scope |
|-----------|-------|
| Society Selector | Personal + Target sections, create/edit modals |
| View Selector | Country, City, Generation, Role Level dropdowns |
| Test Forms | All 11 test type forms (TikTok + Instagram functional) |
| Results View | Impact score, attention, variants, insights, themes |
| Test History | Sidebar history, delete, revisit results |
| Settings | Profile, account, notifications, billing UI |
| Modals | Leave Feedback, Create Society |

### Excluded (This Version)
- Network visualization (placeholder/static image only)
- Real authentication (skip login, go straight to app)
- Real backend (mock data only)

### Success Criteria
- All app screens match societies.io reference
- TikTok form → simulate → results flow works
- Instagram form → simulate → results flow works
- Society selector shows/hides correctly
- Create society modal works (local state)
- Test history persists (local storage)
- All modals open/close properly

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
