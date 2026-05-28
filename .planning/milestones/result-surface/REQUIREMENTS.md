# Requirements — Result Surface

**Milestone:** Result Surface (M2-I of Intelligence Surface drop)
**Started:** 2026-05-24
**Refactored:** 2026-05-25 (board model direction shift — see ROADMAP.md)

Requirements are testable. Each must have a clear pass condition. Items grouped by surface area.

**Architecture note:** R1 (previously "Polished Result Card") and R2 (previously "Live Audience Simulation Viz") have been refactored to reflect the **node-based board model**. `/analyze` is a persistent Konva canvas with 5 group container frames. R1 now describes the board substrate and node groups. R2 now describes the audience engine (Pass 2 timeline call + weighted aggregator + heatmap data).

---

## R1 — Result Board (node-based architecture)

### R1.1 — Board substrate
- [ ] `/analyze` renders a Konva-based canvas board with 5 group container frames (Input, Engine, Audience, Verdict, Actions, Content Analysis) — preview-greyed in idle state, active during streaming, populated on complete
- [ ] Pan / pinch-zoom / fit-to-content / camera presets (`fit Audience+Verdict`, `fit overview`, `fit Engine pipeline`) work on desktop AND mobile portrait
- [ ] No manual node positioning — layout is auto-arranged, deterministic across devices for spatial consistency (shared mental map between phone/desktop)
- [ ] Deep-link camera state via URL parameters (`?focus=audience&zoom=2.4`) — shareable
- [ ] Reduced-motion fallback: same composition + same pan/zoom navigation, animations disabled
- [ ] `/dashboard` redirects to `/analyze`; existing `src/components/hive/*` tier-hive component fully removed (zero imports)
- [ ] Raycast design language: GlassPanel containers, 12px radius, 6% borders, coral #FF7F50 brand accent

### R1.2 — Audience node (centerpiece)
- [ ] Combined visualization (top-to-bottom): headline metrics chip row + keyframe filmstrip + retention curve overlay + persona dropoff markers + heatmap underlay (collapsible) + per-persona inline expand
- [ ] Headline metrics: Avg watch %, Loop %, Replayable-hook score (0-3s window), Top dropoff timestamp, vs Niche baseline (diff badge)
- [ ] Retention curve: smooth Canvas-rendered line, weighted aggregate (per R2.3), TikTok-Studio-familiar style — primary signal, immediately readable
- [ ] Dropoff markers: small avatar/dot chips positioned on the curve at swipe timestamps, group on overlap
- [ ] Heatmap (collapsed by default, expand for power view): persona × segment grid, 10 rows (6 FYP + 2 niche + 1 loyalist + 1 cross-niche), coral-intensity-on-dark (no red/green), swipe markers as white ticks, 0-3s hook zone highlighted with warm band
- [ ] Filmstrip: keyframe thumbnails along curve top axis at scene boundaries
- [ ] Live streaming choreography: rows materialize as Pass 2 personas complete (~3-5s total reveal post-Wave-3-complete)
- [ ] Tap interactions:
  - Tap cell → reason popover (persona + timestamp + attention + reason at inflection points)
  - Tap row label → persona's full reasoning detail (bottom sheet on mobile, inspector on desktop)
  - Tap dropoff marker → that persona's reasoning at that swipe moment
  - Tap curve point → aggregate metric overlay + filmstrip frame highlight
  - Pinch on heatmap → zoom into time range
- [ ] Audience weighting transparency: small badge showing weights used (`Weighted: 65% FYP / 20% niche / 10% loyal / 5% cross`); tap reveals explanation
- [ ] Anti-virality state: critical drop zones highlighted in orange/coral treatment with rework guidance anchored to specific segments
- [ ] Mobile portrait: same composition fits portrait without rotation; pinch-zoom for detail; tap-row-expand for per-persona full-width

### R1.3 — Verdict node
- [ ] Always visible: percentile chip (big) + confidence chip + anti-virality state header
- [ ] Anti-virality state (when triggered): orange "Don't post yet" header + top 3 fixes anchored to specific segments (visual treatment constructive, not punitive)
- [ ] Collapsible "Why this verdict?" section: structured reasoning (4 sub-sections — Why this works / Why this might not / What the engine flagged / Counterfactual considered), markdown with inline citations to other nodes
- [ ] Collapsible "vs my history" section: two horizontal bar charts (vs creator's last 10 + vs niche cohort); empty state when <3 prior analyses
- [ ] User can override anti-virality "Don't post yet" verdict (no hard block — tracked as event)

### R1.4 — Actions node
- [ ] Contains: Reshoot script panel (R5 details), Optimal post time panel (R6 details), Similar videos card (R1.5 below), Share/export panel (R4 details)
- [ ] Reshoot script promoted to hero of Actions when anti-virality state triggered
- [ ] All children render against test fixtures + production engine output snapshots

### R1.5 — Similar videos panel (inside Actions group)
- [ ] Top-K (5 default) pgvector matches from competitor corpus render as VideoCard mini-tiles (reuse `/trending` VideoCard pattern)
- [ ] Each tile: thumbnail, creator @handle, view count, similarity score
- [ ] Tap opens existing TikTok embed modal
- [ ] Empty state if retrieval signal unavailable

### R1.6 — Content Analysis nodes (Hook decomp + Emotion arc)
- [ ] Hook decomp node: 4-bar GlassProgress group (visual / audio / text / speech sub-scores) + coherence + cognitive load chips; each expandable for engine reasoning; hook timestamp range (0-3s default, dynamic from engine) labeled
- [ ] Emotion arc node: Recharts area chart of emotional intensity across video timeline; color-coded gray → coral-200 → coral-500; marks peak/valley moments

### R1.7 — Engine group
- [ ] Contains 5 stage children (Qwen-VL segmentation, Hook decomp, Retention model, Persona simulator, Aggregator)
- [ ] Live state during streaming: each child shows `○ waiting` / `◐ active` / `✓ complete` glyphs
- [ ] Stage labels in plain English: "Reading the hook…" / "Reading the audience…" / "Synthesizing…" (not engine wave numbers)
- [ ] Collapses to compact "View pipeline →" status badge post-complete; tap re-expands for power users / process transparency

### R1.8 — Input node + drawer
- [ ] Compact Input node shows video thumbnail + brief snippet after submit
- [ ] Tap node → drawer slides out from left (desktop) or bottom sheet (mobile) with full editable form
- [ ] Drawer includes "Recent inputs" picker (top-3 most-recent briefs/videos for one-tap reuse)
- [ ] Edit brief or swap video → Re-run → drawer closes → board updates in place (URL stays at `/analyze/[id]`, prior verdict optionally archived as ghost node beside Input)

### R1.9 — Cross-group state coordination
- [ ] Anti-virality state ripples across Verdict + Audience + Actions simultaneously (not isolated to one node)
- [ ] Pattern: same engine signal triggers coordinated visual changes across related groups
- [ ] Future signals (high-confidence loop, exceptional hook score, etc.) follow same ripple pattern

### R1.10 — Sidebar
- [ ] Sections: ⊕ New analysis (CTA + ⌘N shortcut) / Navigate (Boards / Trending / Settings) / ● Running (only when streaming) / ⭐ Pinned / 🕐 Recent (paginated) / 📁 Projects (collapsed placeholder in this milestone) / 👤 Account
- [ ] Collapsible to icon-only mode on desktop (⌘\ shortcut)
- [ ] Mobile: hidden behind hamburger top-left, slides as full-height drawer

### R1.11 — Universal context-aware command bar
- [ ] Pinned to bottom of viewport on `/analyze`; same surface used as primary input + co-pilot
- [ ] Behavior adapts to board state:
  - **Empty board:** placeholder "Paste URL, drop file, or describe…"; submit materializes Input node, pipeline starts
  - **Streaming:** disabled, shows live stage text + cancel
  - **Complete:** placeholder "Ask about your audience or generate variant…"; suggested chip actions (rewrite hook, compare to last 3, generate variant, re-weight audience)
- [ ] Phase 2 ships **command bar + chip actions** only (free-form conversational agent deferred to M2-II/III)
- [ ] Auto-hide on idle option (slides down, chevron to re-open) for clean board view

---

## R2 — Audience Engine (time-resolved per-persona prediction)

### R2.1 — SSE consumer in board view ✅ (Phase 1)
- [ ] Board page subscribes to `/api/analyze/[id]/stream` (GET) on submit
- [ ] Stage events trigger board state machine transitions
- [ ] Connection-drop handling: reconnect once with last event ID, then fall back to polling
- [ ] All stage events logged client-side for debugging (gated behind dev flag)

### R2.2 — Pass 2 dedicated per-persona timeline call
- [ ] After Pass 1 verdict per persona, fire dedicated Pass 2 call with Qwen-thinking-mode reasoning effort
- [ ] Pass 2 walks through video segment-by-segment with the persona's archetype lens
- [ ] Structured output: `{ persona_id, segment_reactions: [{ t_start, t_end, attention: 0-1, reason?: string }] }` — `reason` populated only at inflection points (start, end, swipe moment, biggest delta)
- [ ] Latency target: <8s p95 for all 10 personas in parallel
- [ ] Output validation + sanity checks (attention 0-1, monotonic-ish near swipe events, reasoning grounded in segmentation context)

### R2.3 — Weighted aggregator
- [ ] Engine config: `persona_weights` defines audience-share weights per persona type (defaults: FYP non-followers 0.65 / niche-aligned 0.20 / loyalist 0.10 / cross-niche 0.05, sum = 1.0)
- [ ] Aggregate retention curve = weighted mean of Pass 2 per-persona attention scores per segment
- [ ] All headline metrics (Avg watch %, Loop %, Replayable-hook score, Top dropoff, vs Niche) computed against weighted aggregate
- [ ] Schema future-proofed for per-niche / per-creator / per-analysis weight overrides (out of scope for this milestone, schema only)

### R2.4 — Anti-virality threshold recalibration
- [ ] Recalibrate threshold against weighted aggregate distribution (Phase 1's threshold was unweighted)
- [ ] Use existing outcomes corpus + sweep procedure (or ROC-style cutoff, or Platt calibration reuse — researcher decides best method)
- [ ] Document new threshold value + rationale; lock as engine config
- [ ] When triggered, surfaces top 3 specific fixes from counterfactuals, anchored to specific video segments

### R2.5 — Heatmap schema in `PredictionResult`
```ts
heatmap: {
  segments: Array<{
    t_start: number;
    t_end: number;
    label?: string;            // optional Qwen-VL / Gemini scene description
    is_hook_zone: boolean;     // first 0-3s
  }>;
  personas: Array<{
    id: string;                // matches existing persona.id
    attentions: number[];      // same length as segments
    swipe_predicted_at?: number; // t value, optional
    segment_reasons: Record<number, string>; // index → reason, sparse at inflection points
  }>;
  weights: {                   // transparency surface
    fyp: number;
    niche: number;
    loyalist: number;
    cross_niche: number;
  };
}
```
- [ ] Streaming partials extension: `partial.personas[].attentions[]` fills in as Pass 2 returns
- [ ] Backwards-compatible additive change (Phase 1 schema unaffected)

### R2.6 — Filmstrip generation pipeline
- [ ] Keyframe extraction at Gemini-segmented scene boundaries (or Qwen-VL equivalent)
- [ ] Minimum 1s cell width — merge sub-1s scene cuts at display time
- [ ] Storage in Supabase Storage (signed URLs, 30-day retention)
- [ ] Served alongside `heatmap` schema for Audience node top axis
- [ ] Generated during Wave 0 in parallel with other engine work (no SLA hit)

### R2.7 — Stage labels (plain-English)
- [ ] Subtle stage label above Engine group during streaming: "Reading the hook…" → "Reading the audience…" → "Synthesizing…"
- [ ] Plain-English labels, not engine wave numbers
- [ ] Disappears on `complete`; Engine group collapses to "View pipeline →" status badge

---

## R3 — Mobile-First Analysis Route (refactored: mobile board)

### R3.1 — Mobile board
- [ ] `/analyze` renders the same Konva board canvas at all viewport sizes — same spatial layout, same coordinates, same node positions (spatial consistency across devices)
- [ ] Pinch-zoom + two-finger pan + tap-to-focus all work natively
- [ ] Default mobile camera on `complete`: fits Audience + Verdict as hero pair in viewport
- [ ] No orientation lock, no fullscreen escape hatch — portrait does everything (per Audience R1.2 + R4.12)
- [ ] Camera assists (auto-pan-to-active-stage during streaming, "Reset view" button, fit-to-content) work on mobile

### R3.2 — Mobile upload flow
- [ ] Native file picker (camera roll on iOS, gallery on Android)
- [ ] Client-side file size check before upload (max 100MB, configurable)
- [ ] Watermark scan placeholder hook (full implementation deferred to M2-II)
- [ ] Upload progress bar with cancel
- [ ] Auth-gated: redirects to login if not signed in

### R3.3 — Mobile node interactions
- [ ] All node tap interactions open as bottom sheet (not modal)
- [ ] Bottom sheet has fixed top handle + scroll body + dismiss-on-drag-down
- [ ] Sidebar hidden by default; hamburger top-left toggles full-height drawer

### R3.4 — Mobile Lighthouse score ≥ 90
- [ ] Performance ≥ 90, Accessibility = 100, Best Practices ≥ 90, SEO ≥ 90
- [ ] Measured on iPhone 13 simulator, throttled to 4G
- [ ] CLS < 0.1, LCP < 2.5s, FID < 100ms

---

## R4 — Share & Export

### R4.1 — Share-image generation
- [ ] Satori + @vercel/og generates branded PNG of board (verdict + audience heatmap = the share asset)
- [ ] Image includes: verdict, hook decomp summary, audience heatmap thumbnail, Virtuna logo + permalink URL
- [ ] Image dimensions: 1080×1920 (story format) + 1200×630 (OG format) — two variants
- [ ] Generation completes server-side in ≤ 2s p95

### R4.2 — Public permalink
- [ ] Each analysis gets a public-readable URL `/r/<slug>` (short slug, not UUID)
- [ ] Public page shows board in read-only mode (no edit, no re-analyze)
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

### R5.2 — Script UI inside Actions node
- [ ] Reshoot script renders as a section inside the Actions group node
- [ ] 4 sections: New Opening, Scene Order, Voiceover, Captions
- [ ] Each section has dedicated copy button
- [ ] Whole script has a "Copy all" button that includes section headers
- [ ] "Open in Notion" link generates a Notion import URL (deferred — flag for M2-II)

### R5.3 — Script empty state
- [ ] When engine confidence ≥ 0.7 (no major rework needed), script section shows: "Your video is solid. Optional tweaks below."
- [ ] Reduced script: just optional A/B variants on the opening, no full reshoot

---

## R6 — Optimal Post Time

### R6.1 — Engine signal ✅ (Phase 1)
- [ ] Aggregator output extended with `optimal_post_window: { day_of_week: string, hour_range: [number, number], timezone: string }`
- [ ] Signal derived from niche + creator profile + corpus posting-time data
- [ ] Fallback: generic niche-level recommendation if creator-specific data insufficient

### R6.2 — UI inside Actions node
- [ ] "When to post" section inside Actions group node
- [ ] Shows day + time window in creator's timezone (auto-detected, editable)
- [ ] Brief one-liner reasoning: "Your niche peaks on Tue evenings — 3.2x normal reach"
- [ ] No calendar integration in this milestone (deferred)

---

## R7 — First-Analysis WOW Onboarding

### R7.1 — Tutorial overlay
- [ ] On first-ever analysis submit (detected via `creator_profiles.first_analysis_at IS NULL`), tutorial overlay appears
- [ ] Overlay is dismissable and skippable from any step
- [ ] 3 steps: (1) "Watch your audience react" pointing at live Audience node streaming, (2) "See exactly what works" pointing at Hook decomp + Audience heatmap, (3) "Get a script to reshoot" pointing at Actions group

### R7.2 — Paced reveal
- [ ] On first analysis, Verdict reveal is gated behind a "Reveal verdict" tap (after Audience node fully settles)
- [ ] Subsequent analyses auto-reveal (no gating)
- [ ] Tracked: time from upload → reveal tap, time on board

### R7.3 — Next-action prompt
- [ ] After first analysis result viewed, surface bottom prompt: "Try the reshoot script →" deep-linking to Actions group
- [ ] After reshoot script viewed (any analysis), surface: "Want to test the new version? Edit input above →"
- [ ] Prompts dismissable; track dismiss vs engage

### R7.4 — First-board orientation (separate from R7.1 first-analysis tutorial)
- [ ] First-time board visitor sees subtle hint: "Drop a video below or type in command bar to begin"
- [ ] Hint dismissable; auto-dismisses on first command bar interaction
- [ ] Distinct from R7.1 — orients the spatial mental model, not the analysis flow

### R7.5 — Success metric instrumentation
- [ ] Track: first-analysis completion rate, time-to-second-analysis, share rate from first analysis
- [ ] Bake events into existing Sentry + structured logger pipeline
- [ ] Dashboard view deferred (post-drop), data must be captured now

---

## Cross-cutting / Non-functional

### NF1 — Performance (tiered)
- [ ] p95 end-to-end (upload → verdict reveal) ≤ 60s on 4G (engine SLA already 60s, UI must not add latency)
- [ ] Pass 2 timeline call adds ≤5s to wall-clock post-Wave-3 (parallel-fired)
- [ ] Board initial render ≤ 1s after `complete` SSE event
- [ ] Share image generation ≤ 2s p95
- [ ] **Three performance tiers, auto-detected:**
  - **High** (iPhone 13+, modern Android, desktop): 60fps
  - **Medium** (iPhone 11-12, mid-range Android): 45-60fps with reduced parallax + simpler curve interpolation
  - **Low** (older devices / thermal-throttled): 30fps minimum, auto-engage reduced-motion subset
- [ ] Runtime FPS sampling drops tier if sustained <40fps (with small "Optimized for your device" toast)
- [ ] Manual override available in settings

### NF2 — Accessibility (designed in, not retrofit)
- [ ] All board nodes keyboard-navigable
- [ ] Screen reader: Engine group announces stage transitions; Audience node announces verdict + key dropoffs
- [ ] Reduced-motion respects `prefers-reduced-motion`: animations off, board structure + pan/zoom intact (same composition, no rotation)
- [ ] WCAG AA contrast maintained across all new components
- [ ] Heatmap accessibility: numeric attention scores on tap, symbolic swipe markers (not color-only), pattern variants for color-blind mode (togglable), persona row labels always visible, alt text on filmstrip frames from Gemini scene descriptions

### NF3 — Regression safety
- [ ] Zero regressions on existing pages (`/trending`, `/competitors`, `/brand-deals`, `/`, `/login`, etc.)
- [ ] `/dashboard` redirect verified to `/analyze` with no broken inbound links
- [ ] Full regression audit at end of milestone (10+ pages, design system components)
- [ ] No new design tokens introduced (reuse Raycast scale)

### NF4 — Telemetry & cost
- [ ] All new endpoints instrumented with structured logger (requestId, duration_ms, cost_cents)
- [ ] Pass 2 per-persona call telemetry: latency p50/p95/p99, output token count, validation pass rate, hallucination guard triggers
- [ ] Share image generation cost ≤ $0.0001/image (Satori is local — should be free, log to confirm)

### NF5 — Tier gating
- [ ] Free tier: limited to 5 analyses/month, full board access, share enabled, permalink public-by-default
- [ ] Pro tier: unlimited, permalink private-by-default, full export options, future agency features
- [ ] TierGate component reuses existing pattern (no new gating logic)

### NF6 — Privacy
- [ ] Public permalinks do not expose creator profile data (just board output, no PII)
- [ ] Share images do not include @handle unless creator opts in
- [ ] Existing 30-day storage retention applies to uploaded videos + filmstrip keyframes (unchanged)

---

## Open Questions (resolve in /discuss-phase before planning)

1. **Persona prompt v2 implementation specifics** — Qwen-thinking-mode reasoning effort level (high vs max), structured output format (JSON Schema vs grammar), per-segment reason inclusion strategy → researcher decides
2. **Permalink ID format** — short slug (`/r/abc123`) recommended for aesthetics; UUID fallback if collisions
3. **Anti-virality threshold recalibration method** — sweep vs ROC vs Platt calibration → researcher picks defensible approach
4. **Script generator tier gating** — free or Pro? Engine cost is zero so free seems right for cheatcode positioning
5. **Onboarding skip rate target** — what % skipping is acceptable before we re-tune?
6. **Filmstrip cell width policy on very long videos** — fixed-width with horizontal scroll, or dynamic clamp? → planner picks
