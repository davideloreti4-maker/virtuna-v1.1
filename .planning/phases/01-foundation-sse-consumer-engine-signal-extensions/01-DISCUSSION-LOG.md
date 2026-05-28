# Phase 1: Foundation — SSE consumer + engine signal extensions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 1-Foundation-SSE-consumer-engine-signal-extensions
**Areas discussed:** SSE hook shape, Stage → panel mapping, Result page route, optimal_post_window source

---

## SSE hook shape

### Hook evolution
| Option | Description | Selected |
|--------|-------------|----------|
| New `useAnalysisStream` | Build a new dedicated hook. Keep `useAnalyze` untouched for dashboard's simple flow. Clean separation, no risk. | ✓ |
| Extend `useAnalyze` | Add `stages` and `panelReady` to existing hook. Mixes simple + rich needs. | |
| Replace `useAnalyze` | Migrate dashboard too. One source of truth, more risk. | |

### Reconnect policy
| Option | Description | Selected |
|--------|-------------|----------|
| Single reconnect, then poll `/api/analysis/[id]` every 2s | Simple, predictable, matches 60s engine SLA. | ✓ |
| Exponential backoff (1s, 2s, 4s), then poll | More resilient but >3 retries adds little at this duration. | |
| Just poll — skip reconnect | Simplest but kills the live-stream wow moment. | |

### Stream contract
| Option | Description | Selected |
|--------|-------------|----------|
| Add GET stream-by-id endpoint | POST returns ID, GET stream consumed by EventSource. Enables reconnect-by-id, permalink replay. | ✓ |
| Keep POST+body-reader only | No new endpoint but reconnect = re-submit. Wasteful, breaks idempotency. | |
| Hybrid: both POST stream + GET stream | Maximum compat, two paths to maintain. | |

### Hook location + API
| Option | Description | Selected |
|--------|-------------|----------|
| `src/hooks/queries/use-analysis-stream.ts` returning `{ start, result, stages, panelReady, phase, error, reconnect }` | Co-located with other queries. | ✓ |
| `src/hooks/use-analysis-stream.ts` (non-queries subfolder) | Outside queries/. Breaks convention. | |
| `src/lib/engine/use-analysis-stream.ts` | Mixes engine with React hook. Rejected by server-first convention. | |

---

## Stage → panel mapping

### Readiness shape
| Option | Description | Selected |
|--------|-------------|----------|
| Explicit `panelReady: Record<PanelId, 'idle' \| 'loading' \| 'ready' \| 'error'>` | Each panel reads its own slot. Mapping in one place. | ✓ |
| Single `currentStage` + derived booleans | Every panel re-implements mapping. Brittle. | |
| Per-panel Suspense boundaries | Idiomatic React 19 but fiddly with streaming SSE. Defer. | |

### Granularity (intermediate vs final)
| Option | Description | Selected |
|--------|-------------|----------|
| Expose `stages` + `partial` + `result` | Hive reads `partial.personas`, panels read `result`, telemetry reads `stages`. Most flexibility. | ✓ |
| Only final `result` + `panelReady` | Simpler but kills per-persona streaming animation in P2. | |
| Stages + result, no `partial` | Panels listen to stage events directly. Couples panels to wave numbers. | |

### Mapping table ownership
| Option | Description | Selected |
|--------|-------------|----------|
| `src/lib/engine/panel-mapping.ts` shared by hook + panels | Single source of truth. Co-located with events.ts. | ✓ |
| Inline inside the hook | Faster to ship but panels re-derive in their own files. Drift risk. | |
| Per-panel `usePanelStream(['wave_3'])` API | Maximum decoupling but inverts data flow. Over-engineered. | |

### Wave 3 per-persona shape
| Option | Description | Selected |
|--------|-------------|----------|
| `partial.personas: Array<{ id, status, verdict?, reasoning? }>` | Hook maintains array. P2 hive + P3 panels share source. | ✓ |
| Expose raw stage events; P2 hive parses itself | Every Wave 3 consumer re-implements reduction. | |
| Separate `usePersonaStream` stacked hook | Two stream readers. Double-subscription risk. | |

---

## Result page route

### Route structure
| Option | Description | Selected |
|--------|-------------|----------|
| `/analyze` (form) + `/analyze/[id]` (result) | Dedicated route group. Shareable in-app URL. Fits mobile flow. | ✓ |
| `/analyze` only (ID in query string) | Single route. No in-app shareable URL. Back button replays form. | |
| Extend `/dashboard` with result drawer/modal | Minimal route changes but modal pattern fights mobile-first. | |

### Form home
| Option | Description | Selected |
|--------|-------------|----------|
| `/analyze` page (new) | Clean separation. Dashboard becomes history-only. | ✓ |
| Keep form on `/dashboard`, navigate to `/analyze/[id]` after submit | Less churn but dashboard role gets muddy. | |
| Both: form on `/dashboard` AND `/analyze` | Two entry points. Drift risk. | |

### SSR strategy
| Option | Description | Selected |
|--------|-------------|----------|
| Server component shell + client `ResultCard` with stream hook | SSR + OG metadata + fast first paint. Matches server-first convention. | ✓ |
| Full client page | Loses SSR for completed analyses. Permalink previews suffer. | |
| Server-only with no live streaming | Wrong fit — R2.1 requires SSE consumer. | |

### Auth gating
| Option | Description | Selected |
|--------|-------------|----------|
| Both routes in `(app)` group, permalink `/r/<slug>` separate public route | Matches existing middleware pattern. P6 owns public surface. | ✓ |
| `/analyze` in `(app)`, `/analyze/[id]` public-readable | Mixes auth boundaries inside same prefix. Confusing. | |
| All public, gate per-tier inside the page | Big departure from auth-first middleware. | |

---

## optimal_post_window source

### Data source
| Option | Description | Selected |
|--------|-------------|----------|
| Niche-only corpus median in P1, creator-aware in M2-II | Ship fast. Schema future-proofed. Creator history quality unproven. | ✓ |
| Hybrid: niche median + creator override when ≥5 prior analyses | Better personalization day 1 but doubles P1 complexity. | |
| Niche-only forever | Simplest but conflicts with R6.1 mention of creator profile. Creates rework. | |

### Output schema
| Option | Description | Selected |
|--------|-------------|----------|
| `{ day_of_week, hour_range, timezone, reasoning, source }` with `source: 'niche'\|'creator'\|'fallback'` | Matches R6.1. Includes reasoning for panel copy + source for forward compat. | ✓ |
| Just `{ day, hour, timezone }` | Minimal. Forces panel to invent copy. Loses M2-II source distinction. | |
| Array of windows ranked | Over-spec — R6.2 shows single recommendation. | |

### Source table
| Option | Description | Selected |
|--------|-------------|----------|
| `competitor_videos` aggregated by niche tag, materialized to `niche_post_windows` | Pre-computed VIEW or cron. <50ms lookup. | ✓ |
| Live SQL aggregation per analysis | ~200ms latency hit on 60s SLA budget. | |
| Static JSON in repo | Stale fast. Poor signal quality. | |

### Aggregator integration
| Option | Description | Selected |
|--------|-------------|----------|
| `computeOptimalPostWindow(niche, creator)` helper called in aggregator final stage | Lives in `src/lib/engine/optimal-post.ts`. Non-fatal on failure. | ✓ |
| Wave-1 parallel call alongside other Wave-1 stages | Pure data lookup doesn't need wave-1 parallelism. Adds stage noise. | |
| Post-aggregation via separate `/api/analyze/[id]/post-window` endpoint | Splits the contract. Worse for SSE flow. | |

---

## Claude's Discretion

- **Skeleton scaffold pattern (plan 1.6)** — default per-panel `<Skeleton when={panelReady[id] !== 'ready'}>`; planner may revise.
- **Reconnect implementation details** — AbortController, visibility-pause/resume, `Last-Event-ID` semantics — planner discretion within the locked policy.
- **Anti-virality threshold calibration method (plan 1.5)** — researcher evaluates: corpus sweep vs ROC cutoff vs Platt output reuse via `is_calibrated` metadata.
- **Emotion arc verification (plan 1.3)** — researcher verifies segmentation output. Adds non-fatal engine extension if missing. Schema TBD.

## Deferred Ideas

- Creator-aware `optimal_post_window` weighting → M2-II.
- Calendar integration for post-time recommendation → explicitly deferred per R6.2.
- Migrating dashboard to new hook → revisit after P3-P5 ship.
- Per-panel Suspense boundaries → re-evaluate post-milestone.
- Live SQL post-window aggregation → revisit if `niche_post_windows` becomes a hotspot.
- Multi-window ranked recommendations → revisit if M2-III adds a posting-schedule planner.
- Notion-importable script export → flagged for M2-II per R5.2.
