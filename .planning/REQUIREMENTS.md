# Requirements: UI Dashboard

## Category: TikTok Result Card (RES)

### RES-1: TikTok Post Mockup Component
**Priority:** P0
**Description:** Build a TikTok-style vertical video card that renders above the existing results panel after analysis completes. Shows the uploaded video autoplaying (muted) with overlaid engagement metrics matching TikTok's native post layout.
**Success Criteria:**
- Vertical card with video autoplaying muted, unmute on tap/click
- TikTok-style overlay: creator handle, caption, sound info
- Right sidebar icons: like, comment, share, save, with predicted counts
- Engagement numbers (likes, comments, shares, saves) sourced from prediction engine response
- Responsive — stacks naturally above existing ResultsPanel
- Falls back to thumbnail if video unavailable

### RES-2: Backend Engagement Metrics Generation
**Priority:** P0
**Description:** Extend the prediction engine API response to include predicted engagement metrics (likes, comments, shares, saves, views) alongside the existing viral score.
**Success Criteria:**
- API response includes `predicted_engagement: { likes, comments, shares, saves, views }`
- Numbers derived from viral score + audience size + content signals
- Numbers feel realistic (not round numbers — e.g., 12.4K not 12,000)
- Existing API consumers unaffected (additive field)

### RES-3: Video Autoplay in Result Card
**Priority:** P1
**Description:** The uploaded video autoplays muted in the TikTok mockup card. User can tap to unmute. Works for both file uploads and URL-extracted videos.
**Success Criteria:**
- Autoplay muted on result render
- Tap/click toggles mute/unmute with visual indicator
- Loops continuously
- Works with blob URLs (file upload) and remote URLs (TikTok extraction)

## Category: Hive Visualization 2.5D (HIVE)

### HIVE-1: Depth Layering System
**Priority:** P0
**Description:** Add fake 3D depth to the hive canvas via three layers (foreground, midground, background). Nodes at different depths have different sizes, opacities, and blur levels.
**Success Criteria:**
- Three depth layers with distinct visual treatment
- Foreground: full size, full opacity
- Midground: 70% size, 80% opacity
- Background: 40% size, 50% opacity, slight blur
- Depth assignment is deterministic per node (hash-based)

### HIVE-2: Mouse Parallax Effect
**Priority:** P1
**Description:** Subtle parallax shift on mouse movement — foreground nodes move more than background nodes, creating depth perception.
**Success Criteria:**
- Parallax responds to mouse position relative to canvas center
- Foreground layer shifts 3-5px, midground 1-2px, background 0.5px
- Smooth easing (not 1:1 tracking)
- Disabled on mobile (no mouse) and with prefers-reduced-motion
- Does not interfere with existing pan/zoom interactions

### HIVE-3: Organic Cloud Layout
**Priority:** P0
**Description:** Replace the current symmetric angular distribution with an organic, unstructured cloud formation around the center rectangle. Nodes cluster in irregular groups connected by proximity.
**Success Criteria:**
- Nodes form organic clusters, not symmetric rings
- Center rectangle remains focal point with nodes surrounding it asymmetrically
- Force-directed or noise-based positioning for natural spread
- Different density zones (denser near center, sparser at edges)
- Maintains deterministic layout (same data = same positions)

### HIVE-4: Bezier Curve Connections with Distance Fade
**Priority:** P0
**Description:** Replace straight connection lines with organic bezier curves that fade in opacity based on distance between connected nodes.
**Success Criteria:**
- Connections rendered as quadratic or cubic bezier curves
- Curve intensity varies (subtle curves, not exaggerated)
- Opacity decreases with connection distance (close = visible, far = nearly invisible)
- Long connections (>30% canvas width) fully transparent
- Performance maintained at 10K nodes (only render visible connections)

### HIVE-5: Center Rectangle Video Thumbnail + Playback
**Priority:** P0
**Description:** Fix and verify that the uploaded video thumbnail renders inside the center rectangle of the hive. When analysis completes, the video starts playing inside the rectangle.
**Success Criteria:**
- Thumbnail extracted from uploaded video renders in center rect during upload/analysis
- Video plays inside center rect after analysis completes (muted, looping)
- Smooth transition from thumbnail to video
- Falls back to placeholder if no video available
- Works with canvas rendering (video element drawn to canvas or HTML overlay)

### HIVE-6: Dynamic Node Count by Model Tier
**Priority:** P0
**Description:** When user selects a model tier (Lite/Pro/Ultra), the hive immediately updates to show the corresponding number of nodes (300/1,000/10,000).
**Success Criteria:**
- Lite: renders ~300 nodes
- Pro: renders ~1,000 nodes
- Ultra: renders ~10,000 nodes
- Animated transition when switching tiers (nodes appear/disappear smoothly)
- Performance stays at 60fps even at 10K nodes
- Layout re-computes organically (not just adding nodes to edges)

### HIVE-7: Persona Demographic Labels on Hover
**Priority:** P1
**Description:** When hovering a node, the overlay shows audience segment labels (e.g., "Gen Z Female, Fashion") based on the selected TikTok account's audience profile.
**Success Criteria:**
- Node hover overlay includes demographic info: age range, gender, interest
- Persona data reflects the selected account — TikTok or Instagram (changes when account switches)
- Labels feel realistic and varied across nodes
- Consistent with existing HiveNodeOverlay glass card styling

## Category: Model Selector (MOD)

### MOD-1: Apollo Tier Overhaul
**Priority:** P0
**Description:** Rename and reconfigure Apollo model tiers: Lite (300 nodes), Pro (1,000 nodes), Ultra (10,000 nodes). Each tier has a Perplexity-style description.
**Success Criteria:**
- Three tiers: Apollo 1.5 Lite, Apollo 1.5 Pro, Apollo 1.5 Ultra
- Node counts: 300 / 1,000 / 10,000
- Each tier has 2-3 line description explaining capability level
- Descriptions differ per tier (not just "more nodes"):
  - Lite: quick pulse check, basic audience sampling
  - Pro: deep analysis, diverse audience simulation
  - Ultra: full network simulation, comprehensive behavioral modeling
- Visual hierarchy — Ultra feels premium, Lite feels accessible

### MOD-2: 10M Database Messaging in Model Descriptions
**Priority:** P1
**Description:** Each model description includes reference to the 10M+ analyzed video database. Copy varies by tier.
**Success Criteria:**
- Lite: "Quick scan against 10M+ video database"
- Pro: "Deep analysis calibrated against 10M+ analyzed videos"
- Ultra: "Full simulation cross-referenced with 10M+ video intelligence database"
- Copy feels factual and confident, not hyperbolic

### MOD-3: Analysis Loading Step — Database Scan
**Priority:** P1
**Description:** During analysis loading animation, show a step like "Scanning 10M+ video database..." as part of the progress sequence.
**Success Criteria:**
- Loading sequence includes database scan step
- Appears naturally in the flow (not first, not last — mid-sequence)
- Animated text with subtle shimmer or typing effect
- Duration proportional to actual analysis time

### MOD-4: Persona-Account Link Messaging
**Priority:** P1
**Description:** Below the model selector, show dynamic text indicating personas are based on the selected account's audience.
**Success Criteria:**
- Text reads: "{count} personas modeled from @{handle}'s {platform} audience"
- Updates when model tier or account changes
- Shows "Connect a TikTok or Instagram account for personalized personas" when no account selected
- Subtle muted text styling, not prominent

### MOD-5: Oracle Model Placeholder Card
**Priority:** P0
**Description:** Add Oracle as a second model type with a locked/coming soon card. Full branding, description, and "Join waitlist" CTA.
**Success Criteria:**
- Oracle card appears alongside Apollo in model selection area
- Card shows Oracle branding (distinct from Apollo — different icon/color)
- Description: "Predict real-world events. Analyze scenarios, calculate probabilities, forecast outcomes beyond content."
- "Join waitlist" button (can be email capture or link)
- Card is visually locked/dimmed but still communicates value
- Clear separation: Apollo = Content Intelligence, Oracle = General Predictions

### MOD-6: Model Type Toggle — Apollo vs Oracle
**Priority:** P1
**Description:** Top-level toggle or tab to switch between Apollo (Content Intelligence) and Oracle (General Predictions) model families.
**Success Criteria:**
- Clean toggle/tab UI: "Apollo — Content Intelligence" | "Oracle — Predictions"
- Apollo selected by default, shows tier selector
- Oracle selected shows the placeholder card (MOD-5)
- Smooth transition between views

## Category: Account Selector (ACC)

### ACC-1: Top Bar Account Chip
**Priority:** P0
**Description:** Persistent social account chip in the top navigation bar, visible on all pages on both desktop and mobile. Supports both TikTok and Instagram accounts.
**Success Criteria:**
- Shows "@handle" with platform icon (TikTok or Instagram) when account connected
- Shows "Connect Account ▾" CTA when no account
- Click/tap opens account switcher dropdown
- Dropdown shows all connected accounts with platform icons (TikTok/Instagram)
- Visible on desktop (alongside sidebar selector) AND mobile
- Doesn't conflict with existing nav elements
- Updates reactively when account changes in sidebar

### ACC-2: Mobile-First Account Visibility
**Priority:** P1
**Description:** Ensure the account selector is discoverable and usable on mobile where the sidebar is hidden.
**Success Criteria:**
- Top bar chip is primary way to access accounts on mobile
- Dropdown works well on small screens (full-width on mobile)
- Add account flow works inline from the dropdown
- Touch-friendly tap targets (min 44px)

### ACC-3: Instagram Account Support
**Priority:** P0
**Description:** Extend the account system to support Instagram accounts alongside TikTok. Both the sidebar selector and top bar chip handle multi-platform accounts.
**Success Criteria:**
- Sidebar selector supports adding Instagram @handles (platform toggle: TikTok / Instagram)
- Each account shows its platform icon (TikTok logo or Instagram logo)
- Active account indicates which platform it belongs to
- Persona generation messaging adapts: "@handle's TikTok audience" vs "@handle's Instagram audience"
- Account store (`useTiktokAccounts` hook) extended to store platform type per account
- "Connect TikTok or Instagram" when no accounts connected

## Category: Integration & Polish (INT)

### INT-1: Hive ↔ Model Selector State Sync
**Priority:** P0
**Description:** Selecting a model tier immediately updates the hive node count. Selecting an account updates persona labels.
**Success Criteria:**
- Model tier change → hive re-renders with new node count (animated)
- Account change → persona data refreshes in hover overlays
- No stale state between components
- State managed via shared store or context

### INT-2: Result Card ↔ Hive ↔ Video State Sync
**Priority:** P1
**Description:** After analysis, the result card, hive visualization, and video playback all show consistent state.
**Success Criteria:**
- Analysis complete → TikTok card appears with video + metrics
- Analysis complete → hive center rect shows video playing
- Same video source used in both components
- Loading states coordinated (not one showing results while other still loading)

### INT-3: Responsive Layout
**Priority:** P1
**Description:** All new components work well on mobile (320px+), tablet, and desktop.
**Success Criteria:**
- TikTok result card: full-width on mobile, constrained on desktop
- Hive: touch interactions work (pinch zoom, tap nodes)
- Model selector: readable on mobile, dropdown doesn't overflow
- Top bar chip: compact on mobile, doesn't crowd nav

---

**Total requirements:** 23
**P0 (must-ship):** 12
**P1 (should-ship):** 11
