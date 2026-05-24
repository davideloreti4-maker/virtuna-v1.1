# Requirements — Result Surface

**Milestone:** Result Surface (M2-I of Intelligence Surface drop)
**Started:** 2026-05-24

Requirements are testable. Each must have a clear pass condition. Items grouped by surface area.

---

## R1 — Polished Result Card

### R1.1 — Result card shell
- [ ] Single unified card on `/analyze` result view replaces current placeholder
- [ ] All 8 panels render in collapsed-by-default state with expand-on-tap
- [ ] Card respects Raycast design language: GlassPanel container, 12px radius, 6% borders
- [ ] Cross-panel layout: mobile = single column stack, desktop = 2-col grid with primary verdict spanning full width
- [ ] Loading skeleton for each panel until its engine signal arrives via SSE

### R1.2 — Retention curve panel
- [ ] Recharts line chart of predicted viewer retention across video timeline (0-100% video position)
- [ ] Marks drop-off points (predicted swipes) with red dots
- [ ] Hover/tap shows percentage and timestamp
- [ ] Empty state if retention signal unavailable (graceful)

### R1.3 — Persona breakdown panels
- [ ] All 10 personas (6 FYP non-followers + 2 niche-aligned + 1 loyalist + 1 cross-niche) render as expandable cards
- [ ] Each card shows: persona archetype name, demographic chip, verdict color (green/yellow/red), one-line summary
- [ ] Tap expands to full persona reasoning + specific objections + what would convert them
- [ ] FYP-weighted layout: 6 FYP personas grouped, 2 niche together, 2 specialized below

### R1.4 — Hook decomposition UI
- [ ] Visual sub-score, audio sub-score, text sub-score, speech sub-score render as 4-bar GlassProgress group
- [ ] Coherence score and cognitive load shown as separate metric chips
- [ ] Each sub-score expandable for engine reasoning
- [ ] Hook timestamp range (0-3s default, dynamic from engine) labeled

### R1.5 — Similar videos panel
- [ ] Top-K (5 default) pgvector matches render as VideoCard mini-tiles (reuse `/trending` VideoCard pattern)
- [ ] Each tile shows: thumbnail, creator @handle, view count, similarity score
- [ ] Tap opens existing TikTok embed modal
- [ ] Empty state if retrieval signal unavailable

### R1.6 — Reasoning narrative panel
- [ ] DeepSeek synthesis + self-critique rendered as structured sections (not wall of text)
- [ ] Sections: Why this works / Why this might not / What the engine flagged / Counterfactual considered
- [ ] Each section collapsible
- [ ] Markdown rendering with inline citations to other panels (e.g., "see Hook Decomp")

### R1.7 — Emotion arc visualization
- [ ] Recharts area chart of emotional intensity across video timeline
- [ ] Color-coded: low energy = gray, mid = coral-200, high = coral-500
- [ ] Marks peak/valley moments
- [ ] Engine signal source confirmed in P1 (likely from segmentation)

### R1.8 — Comparative baseline panel
- [ ] Shows this video's predicted percentile rank vs creator's last 10 analyses
- [ ] Shows this video's predicted rank vs niche cohort (from training corpus)
- [ ] Two horizontal bar charts with the user's score marked
- [ ] Empty state if creator has <3 prior analyses

### R1.9 — Anti-virality verdict state
- [ ] When aggregator predicts confidence < threshold (set in P1, likely 0.4) → result card top renders "Don't post yet" verdict instead of percentile prediction
- [ ] Warning state surfaces top 3 specific fixes from counterfactuals
- [ ] Visual treatment: orange GlassPill warning, not red (constructive not punitive)
- [ ] User can override and post-anyway (no hard block)

---

## R2 — Live Audience Simulation Viz

### R2.1 — SSE consumer in result view
- [ ] Result page subscribes to `/api/analyze` SSE stream on submit
- [ ] Stage events (`wave_0`, `wave_1`, `wave_2`, `wave_3`, `aggregation`, `complete`) trigger UI state transitions
- [ ] Connection-drop handling: reconnect once, then fall back to polling
- [ ] All stage events logged client-side for debugging (gated behind dev flag)

### R2.2 — Live persona hive
- [ ] Canvas 2D extension of existing hive, scoped to result page only
- [ ] 10 persona nodes appear as Wave 3 starts, color-coded by persona type
- [ ] Each node "pulses" while its DeepSeek call is in flight, settles to verdict color when complete
- [ ] Reactions stream in parallel (not sequential — matches engine parallelization)
- [ ] Hive holds 60fps on iPhone 13+ during animation

### R2.3 — Verdict reveal animation
- [ ] On `complete` SSE event, all persona nodes animate to final positions
- [ ] Aggregated verdict animates in (percentile + confidence)
- [ ] Smooth ease, ~800ms total reveal
- [ ] Reduced-motion fallback: static breakdown, no animation

### R2.4 — Wave-by-wave stage labels
- [ ] Subtle stage label above hive: "Analyzing hook…" → "Reading audience…" → "Synthesizing…"
- [ ] Plain-English labels, not engine wave numbers
- [ ] Disappears on `complete`

---

## R3 — Mobile-First Analysis Route

### R3.1 — Mobile upload flow
- [ ] `/analyze` route renders mobile-optimized layout below 768px breakpoint
- [ ] Native file picker (camera roll on iOS, gallery on Android)
- [ ] Client-side file size check before upload (max 100MB, configurable)
- [ ] Watermark scan runs client-side on upload (TF.js — deferred to M2-II actually, just placeholder hook here)
- [ ] Upload progress bar with cancel
- [ ] Auth-gated: redirects to login if not signed in

### R3.2 — Mobile live viz
- [ ] Live persona hive rotates to vertical layout on mobile
- [ ] Personas stack as swipeable cards once Wave 3 completes (alternative to horizontal hive)
- [ ] Touch-pan and pinch-zoom work
- [ ] Reduced-motion fallback works the same on mobile

### R3.3 — Mobile result card
- [ ] All panels collapsible, default-collapsed to one-screen overview
- [ ] Swipe-down between panels (not required, scroll fine)
- [ ] Bottom-sheet pattern for panel expansion (not full-screen modal)
- [ ] Result card share button surfaces native share sheet

### R3.4 — Mobile lighthouse score ≥ 90
- [ ] Performance ≥ 90, Accessibility = 100, Best Practices ≥ 90, SEO ≥ 90
- [ ] Measured on iPhone 13 simulator, throttled to 4G
- [ ] CLS < 0.1, LCP < 2.5s, FID < 100ms

---

## R4 — Share & Export

### R4.1 — Share-image generation
- [ ] Satori + @vercel/og generates branded PNG of result card
- [ ] Image includes: verdict, hook decomp summary, top 3 persona reactions, Virtuna logo + permalink URL
- [ ] Image dimensions: 1080×1920 (story format) + 1200×630 (OG format) — two variants
- [ ] Generation completes server-side in ≤ 2s p95

### R4.2 — Public permalink
- [ ] Each analysis gets a public-readable URL `/r/<id>` (id = short slug, not UUID)
- [ ] Public page shows result card in read-only mode (no edit, no re-analyze)
- [ ] Creator can toggle public/private per analysis (default private)
- [ ] Permalink URL appears on share button
- [ ] Public page is server-rendered for OG embed compatibility

### R4.3 — Native share sheet (mobile)
- [ ] Share button on mobile triggers `navigator.share()` with: title, url, image file
- [ ] Falls back to copy-link if Web Share API unavailable
- [ ] Tracked as event: `result_share` with platform

### R4.4 — Copy-link (desktop)
- [ ] Share button on desktop opens dropdown: Copy Link, Download PNG (story), Download PNG (OG)
- [ ] Copy-link writes permalink to clipboard with toast confirmation
- [ ] Download buttons trigger PNG download

---

## R5 — Re-shoot Script Generator

### R5.1 — Script extraction from engine output
- [ ] Server endpoint `/api/analyze/<id>/script` returns structured script from counterfactuals + A/B variants
- [ ] Schema: `{ opening_line: string, scene_order: string[], voiceover: string, captions: string[] }`
- [ ] Endpoint is fast (<200ms) — pure transformation, no new LLM calls
- [ ] Cache the script result alongside the analysis result

### R5.2 — Script UI panel
- [ ] New panel on result card: "Reshoot Script"
- [ ] Renders 4 sections: New Opening, Scene Order, Voiceover, Captions
- [ ] Each section has dedicated copy button
- [ ] Whole script has a "Copy all" button that includes section headers
- [ ] "Open in Notion" link generates a Notion import URL (deferred — flag for M2-II)

### R5.3 — Script empty state
- [ ] When engine confidence ≥ 0.7 (no major rework needed), script panel shows: "Your video is solid. Optional tweaks below."
- [ ] Reduced script: just optional A/B variants on the opening, no full reshoot

---

## R6 — Optimal Post Time

### R6.1 — Engine signal
- [ ] Aggregator output extended with `optimal_post_window: { day_of_week: string, hour_range: [number, number], timezone: string }`
- [ ] Signal derived from niche + creator profile + corpus posting-time data (analysis in P1)
- [ ] Fallback: generic niche-level recommendation if creator-specific data insufficient

### R6.2 — UI panel
- [ ] Result card includes "When to post" panel
- [ ] Shows day + time window in creator's timezone (auto-detected, editable)
- [ ] Brief one-liner reasoning: "Your niche peaks on Tue evenings — 3.2x normal reach"
- [ ] No calendar integration in this milestone (deferred)

---

## R7 — First-Analysis WOW Onboarding

### R7.1 — Tutorial overlay
- [ ] On first-ever analysis submit (detected via `creator_profiles.first_analysis_at IS NULL`), tutorial overlay appears
- [ ] Overlay is dismissable and skippable from any step
- [ ] 3 steps: (1) "Watch the audience react" pointing at live viz, (2) "See exactly what works" pointing at hook decomp, (3) "Get a script to reshoot" pointing at script panel

### R7.2 — Paced reveal
- [ ] On first analysis, verdict reveal is gated behind a "Reveal verdict" tap (after live viz settles)
- [ ] Subsequent analyses auto-reveal (no gating)
- [ ] Tracked: time from upload → reveal tap, time on result page

### R7.3 — Next-action prompt
- [ ] After first analysis result viewed, surface bottom prompt: "Try the reshoot script →" deep-linking to script panel
- [ ] After reshoot script viewed (any analysis), surface: "Want to test the new version? Upload again →"
- [ ] Prompts dismissable; track dismiss vs engage

### R7.4 — Success metric instrumentation
- [ ] Track: first-analysis completion rate, time-to-second-analysis, share rate from first analysis
- [ ] Bake events into existing Sentry + structured logger pipeline
- [ ] Dashboard view deferred (post-drop), data must be captured now

---

## Cross-cutting / Non-functional

### NF1 — Performance
- [ ] p95 end-to-end (upload → verdict reveal) ≤ 60s on 4G (engine SLA already 60s, UI must not add latency)
- [ ] Result card initial render ≤ 1s after `complete` SSE event
- [ ] Share image generation ≤ 2s p95
- [ ] Live viz holds 60fps on iPhone 13+

### NF2 — Accessibility
- [ ] All panels keyboard-navigable
- [ ] Screen reader: live viz announces stage transitions
- [ ] Reduced-motion respects `prefers-reduced-motion`
- [ ] WCAG AA contrast maintained across all new components

### NF3 — Regression safety
- [ ] Zero regressions on existing pages (`/dashboard`, `/trending`, `/competitors`, `/brand-deals`, `/`, `/login`, etc.)
- [ ] Full regression audit at end of milestone (10+ pages, design system components)
- [ ] No new design tokens introduced (reuse Raycast scale)

### NF4 — Telemetry & cost
- [ ] All new endpoints (`/api/analyze/<id>/script`, share image generation) instrumented with structured logger (requestId, duration_ms, cost_cents)
- [ ] Share image generation cost ≤ $0.0001/image (Satori is local — should be free, log to confirm)

### NF5 — Tier gating
- [ ] Free tier: limited to 5 analyses/month, full result card, share enabled, permalink public-by-default
- [ ] Pro tier: unlimited, permalink private-by-default, full export options
- [ ] TierGate component reuses existing pattern (no new gating logic)

### NF6 — Privacy
- [ ] Public permalinks do not expose creator profile data (just video output, no PII)
- [ ] Share images do not include @handle unless creator opts in
- [ ] Existing 30-day storage retention applies to uploaded videos (unchanged)

---

## Open Questions (resolve in /discuss-phase before planning)

1. **Live viz canvas**: extend existing hive Canvas or new dedicated canvas? (Affects code reuse vs isolation)
2. **Permalink ID format**: short slug (`/r/abc123`) or full UUID? (Aesthetics vs collision resistance — short slug recommended)
3. **Anti-virality threshold**: 0.4 confidence is a guess — calibrate on corpus before locking
4. **Script generator**: do we expose to free tier or gate as Pro? (Engine cost is zero, free seems right for cheatcode positioning)
5. **Onboarding skip rate target**: what % skipping is acceptable before we re-tune?
