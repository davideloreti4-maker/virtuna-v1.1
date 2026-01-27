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
