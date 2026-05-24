# Section Pattern Catalog — Landing v1

**Project:** Virtuna — Landing v1 milestone
**Researched:** 2026-05-24
**Scope:** 8-section landing page pattern catalog. NEW additions only — NOT app-side features, NOT auth, NOT mobile native.
**Reference anchors:** Linear + Raycast (aesthetic) · OpusClip / opus.pro (copy + conversion patterns)
**Overall confidence:** HIGH — all components verified against Magic UI + Aceternity registries; OpusClip patterns sourced from live opus.pro fetch; Linear/Raycast/Vercel/Cursor/Stripe/Claude/ElevenLabs all fetched live.

---

## TL;DR — Winning Pattern Per Section

| # | Section | Winning pattern | Primary components |
|---|---|---|---|
| 1 | Hero | Ambient Spotlight backdrop + animated H1 word-flip + dual CTA + animated centerpiece visual (Canvas particles from BRAND-BIBLE locked viz) | Aceternity `Spotlight`, Magic UI `AnimatedShinyText` + `BorderBeam` + `ShimmerButton`, locked `BehavioralSimulationHero` Canvas |
| 2 | Interactive demo | "Sample picker → multi-step loader → animated insight card stack" (scripted, no backend) | Aceternity `MultiStepLoader` + `CardStack`, Magic UI `NumberTicker` + `BoxReveal` + `AnimatedList`, Magic UI `Safari` mockup |
| 3 | How it works | Linear-style horizontal `AnimatedBeam` pipeline with 4 stage nodes (matches BRAND-BIBLE locked viz) + Aceternity `TracingBeam` for vertical mobile | Magic UI `AnimatedBeam` + `OrbitingCircles` (per-stage spinner), Aceternity `TracingBeam` (mobile vertical), Magic UI `BorderBeam` (active stage emphasis) |
| 4 | Three Surfaces bento | Magic UI `BentoGrid` 3-card asymmetric layout, each card has live animated background (marquee of competitor handles, ticking metric, deal carousel) | Magic UI `BentoGrid` + `BentoCard` + `MagicCard` + per-card embed (`Marquee`, `NumberTicker`, `AnimatedList`) |
| 5 | The Science | Aceternity `StickyScroll` pinned content reveal (left = scrolling research/dataset stats, right = sticky citation chip cluster) + Magic UI `Marquee` of paper titles | Aceternity `StickyScroll` (preferred) OR `Timeline`, Magic UI `Marquee` (citation chips), Magic UI `NumberTicker` (dataset stats), shadcn `Badge` for chips |
| 6 | Social proof | Stacked density: customer logo marquee + Aceternity `AnimatedTestimonials` (3D-rotating spotlight quotes) + Magic UI `NumberTicker` metric bar — visually fused via shared `Spotlight` backdrop | Magic UI `Marquee` (logo wall, vertical-stacked-rows pattern), Aceternity `AnimatedTestimonials`, Magic UI `NumberTicker`, Magic UI `AvatarCircles` |
| 7 | Pricing | 2-column shadcn `Card` table (Starter vs Pro), monthly/yearly toggle, Pro highlighted via Magic UI `BorderBeam`, 9-category feature checklist (OpusClip pattern), FAQ accordion below | shadcn `Card` + `Tabs` (monthly/yearly toggle) + `Accordion` (FAQ), Magic UI `BorderBeam` (Pro emphasis), Magic UI `ShimmerButton` (Pro CTA), `Check`/`Minus` icons (Lucide) |
| 8 | Final CTA + footer | Mirrored hero treatment (same Spotlight + ShimmerButton CTA) over compact 4-column footer | Aceternity `Spotlight` (mirror hero), Magic UI `ShimmerButton`, Magic UI `AnimatedShinyText`, shadcn footer grid |

---

## Section 1 — Hero (Above-Fold)

### Pattern catalog

| Pattern name | Description | Reference (URL) |
|---|---|---|
| **Ambient Spotlight + product hero composite** | Dark page, single off-axis gradient spotlight, centered H1 + subhead + dual CTA stack, animated centerpiece below (screenshot/product viz) | [Linear hero](https://linear.app) (three-screenshot composite), [Cursor hero](https://www.cursor.com) (3 CTAs + IDE shot), [Stripe hero](https://stripe.com) (wave-fallback gradient) |
| **Lamp / cone backdrop hero** | Aceternity-signature: a conic gradient "lamp" beam projected behind H1, creates Linear-credibility lighting | [Aceternity Lamp demo](https://ui.aceternity.com/components/lamp-effect) — directly cloned by ~30% of 2026 SaaS landings |
| **Live-product hero with state animation** | Hero IS the product UI — agent/issue/card visibly updating as you read | [Linear ENG-2703 demo card](https://linear.app), [Cursor desktop demo](https://www.cursor.com) |
| **Keyboard / artifact hero** | Replace product screenshot with a single iconic artifact (keyboard, terminal, command bar) | [Raycast keyboard hero](https://www.raycast.com), [ElevenLabs play-button hero](https://elevenlabs.io) |

### Winning pattern for Virtuna

**Ambient Spotlight + animated centerpiece + dual-CTA stack** — matches Linear/Cursor exactly, leaves room for the **already-locked Canvas behavioral-simulation visual** from `BRAND-BIBLE.md` § Visual Metaphor Lock (VIZ-01).

Why not "live-product hero" (Linear pattern): Virtuna's product UI isn't aesthetically resolved enough to be hero material yet — the locked Canvas viz is the right centerpiece for v1. Defer live-product hero to a future milestone when product UI is investor-grade.

Why not "Lamp": too maximal for a Raycast-aesthetic brief; Spotlight is the restrained choice.

### Component inventory

| Role | Component | Path / install | Notes |
|---|---|---|---|
| Backdrop ambient gradient | Aceternity `Spotlight` | [docs](https://ui.aceternity.com/components/spotlight) — `npx shadcn@latest add https://ui.aceternity.com/registry/spotlight.json` | Off-axis coral-tinted glow. Patch `bg-black` → `bg-background` (#07080a) on copy-paste per STACK.md |
| Eyebrow / tagline pill | Magic UI `AnimatedShinyText` | [docs](https://magicui.design/docs/components/animated-shiny-text) — `npx shadcn@latest add @magicui/animated-shiny-text` | "Announcing predictions for creators" or eyebrow positioning |
| H1 word-flip emphasis | Aceternity `FlipWords` OR Magic UI `WordRotate` | [Aceternity FlipWords](https://ui.aceternity.com/components/flip-words), [Magic UI WordRotate](https://magicui.design/docs/components/word-rotate) | Pick ONE — recommend Magic UI `WordRotate` for tighter coral integration |
| Centerpiece visual | Locked Canvas `BehavioralSimulationHero` | `src/components/hero/BehavioralSimulationHero.tsx` (Phase 2 builds per BRAND-BIBLE § Visual Metaphor Lock) | ~30 KB Canvas 2D, one-shot animation, 200-400 particles |
| Centerpiece frame highlight | Magic UI `BorderBeam` | [docs](https://magicui.design/docs/components/border-beam) — `npx shadcn@latest add @magicui/border-beam` | Coral border traveling around centerpiece container |
| Primary CTA button | Magic UI `ShimmerButton` | [docs](https://magicui.design/docs/components/shimmer-button) — `npx shadcn@latest add @magicui/shimmer-button` | Coral fill, "Start free" copy |
| Secondary CTA | shadcn `Button` variant=`secondary` | Existing in design system | Transparent bg + 6% border — Raycast pattern |
| Trust bar under CTA | Magic UI `AvatarCircles` + `NumberTicker` | [AvatarCircles](https://magicui.design/docs/components/avatar-circles), [NumberTicker](https://magicui.design/docs/components/number-ticker) | "Trusted by 12,000+ creators" — projected if needed |

### Copy / structure (OpusClip-derived)

OpusClip hero formula → adapt:
- **Outcome-promise H1** ("1 long video, 10 viral clips. Create 10x faster.") → for Virtuna: outcome-promise + viral metric. NOT "Your audience, simulated." (retired). Drafts: *"Predict viral before you post."* / *"Know what hits before you hit publish."* / *"AI that scores your TikToks before TikTok does."*
- **Subhead = mechanism in 1 sentence** ("OpusClip turns long videos into shorts...") → "Virtuna simulates 1000s of viewers and tells you your viral score in 30 seconds."
- **Dual CTA** (OpusClip: "Get free clips" + "Upload files") → "Start free" + "See it work" (anchors to viewport 2 demo). Mirror Cursor's 3-CTA pattern only if a third "Request demo" path makes sense for investor view.

### Anti-patterns (do not)

- **Aurora / vortex / wavy backgrounds** — too maximal, off-brief per STACK.md and BRAND-BIBLE
- **3D Spline scene as default hero** — 544 KB runtime per STACK.md; only pull in if Canvas viz fails QA
- **Translate-y card lift on hero CTA** — forbidden per CLAUDE.md Raycast rules
- **Hero with NO dual CTA** — investor view needs the second path (demo anchor)

**Confidence:** HIGH

---

## Section 2 — Interactive Demo (Viewport 2)

This is the differentiator section. No other Virtuna competitor has it. This section sells investors AND converts creators.

### Pattern catalog

| Pattern name | Description | Reference |
|---|---|---|
| **Sample picker → multi-step loader → result card** | Static picker (3-4 examples) → user clicks → animated "thinking" loader fires (3-5 stages) → result card slides in with score + reasoning | [Anthropic Claude "Try this prompt" widget](https://claude.com/product/overview) (3 capability buckets — Write / Learn / Code, each with expandable prompts), [Cursor in-page IDE](https://www.cursor.com) (workflow state demo) |
| **Compare / before-after slider** | User drags slider to reveal "before Virtuna" vs "after Virtuna" prediction | [Aceternity Compare](https://ui.aceternity.com/components/compare) — image-comparison slide/drag |
| **Tabbed scenario demo** | Tab strip (Vlog / Sports / Podcast in OpusClip's case) → each tab swaps in a different scripted demo | [OpusClip "Vlog / Sports / Podcast" thumbnails under hero](https://www.opus.pro), [Vercel AI Gateway code preview tabs](https://vercel.com) |
| **"Live" metric reveal** | Numbers tick up while pipeline animates | [Vercel AI Gateway model ranking table](https://vercel.com) ("Top models on May 24, 2026" updates), [Linear ENG-2703 status changes](https://linear.app) |

### Winning pattern for Virtuna

**Sample picker → MultiStepLoader → CardStack result reveal** — direct port of Anthropic's "Try this prompt" pattern but specialized to predictions. Loader stages match the BRAND-BIBLE-locked engine pipeline (Video → Analyze → Simulate audience → Predict), creating narrative continuity with viewport 3.

**Interaction model:**

1. **State 0 (default):** 3-4 sample TikToks displayed as `MagicCard` thumbnails — title + creator handle + niche tag. One is highlighted "Pick one to try."
2. **State 1 (clicked):** Selected card lifts into focus position (others fade to 30% opacity). `MultiStepLoader` fires below — 4 stages with checkmarks lighting one at a time: "Scraping captions..." → "Modeling audience..." → "Simulating 2,847 viewers..." → "Aggregating signals..." (~3-4 seconds total, scripted with setTimeout sequence per stage).
3. **State 2 (result):** Score `NumberTicker` ticks from 0 → 87 (or whatever scripted score). `CardStack` slides in 3 insight cards (behavioral signals fired, audience match, recommended posting time). `BoxReveal` for each card body. `BorderBeam` on score container.
4. **State 3 (reset):** "Try another" pill resets to State 0.

### Component inventory

| Role | Component | Path / install | Notes |
|---|---|---|---|
| Sample picker card | Magic UI `MagicCard` | [docs](https://magicui.design/docs/components/magic-card) — `npx shadcn@latest add @magicui/magic-card` | Spotlight-on-hover, swap to `bg-white/[0.02]` only — no translate |
| Thumbnail mockup frame | Magic UI `Iphone15Pro` (vertical TikTok aspect) | [docs](https://magicui.design/docs/components/iphone) — `npx shadcn@latest add @magicui/iphone` | Wraps each sample TikTok thumbnail in a phone frame |
| Multi-step "engine thinking" loader | Aceternity `MultiStepLoader` | [docs](https://ui.aceternity.com/components/multi-step-loader) — `npx shadcn@latest add https://ui.aceternity.com/registry/multi-step-loader.json` | 4 stages, step-by-step check animation |
| Score reveal | Magic UI `NumberTicker` | [docs](https://magicui.design/docs/components/number-ticker) — `npx shadcn@latest add @magicui/number-ticker` | Ticks 0 → score, ~1.5s |
| Score container | Magic UI `BorderBeam` | (already installed for hero) | Coral border travels once on result reveal |
| Insight card stack | Aceternity `CardStack` OR Magic UI `AnimatedList` | [Aceternity CardStack](https://ui.aceternity.com/components/card-stack), [Magic UI AnimatedList](https://magicui.design/docs/components/animated-list) | CardStack for rotating pile aesthetic; AnimatedList for sequential append — recommend `AnimatedList` (cleaner Raycast feel) |
| Card body reveal | Magic UI `BoxReveal` | [docs](https://magicui.design/docs/components/box-reveal) — `npx shadcn@latest add @magicui/box-reveal` | Bar-wipe reveal of each insight card body |
| Reset / "Try another" pill | shadcn `Button` variant=`ghost` + `Refresh` icon | Existing | Lucide `RefreshCw` icon |
| Background ambient | Aceternity `BackgroundBeams` | [docs](https://ui.aceternity.com/components/background-beams) — registry JSON | Subtle SVG paths behind the demo, low opacity |
| Confidence-distribution bar (inside insight card) | Custom CSS + Magic UI `NumberTicker` for percentages | n/a | Match brand spec — 4 horizontal bars (Trend match / Caption strength / Hook quality / Audience overlap) |

### Demo data shape (scripted, no backend)

```ts
// .planning placeholder shape — Phase X builds real
type SampleDemo = {
  id: string;
  thumbnail: string; // /demo/sample-1.jpg
  handle: string;    // @creator
  niche: 'Fitness' | 'Comedy' | 'EduFood' | 'Beauty';
  // Scripted result:
  score: number;             // 0-100
  signals: Array<{
    label: string;           // "Hook strength"
    value: number;           // 0-100
  }>;
  insights: Array<{
    icon: string;            // Lucide icon name
    title: string;           // "Captions hit Gen-Z vocab cluster"
    body: string;            // 1-sentence
  }>;
};

const SAMPLES: SampleDemo[] = [/* 4 hand-curated */];
```

### Anti-patterns (do not)

- **Real backend wiring** — out of scope per PROJECT.md ("scripted only")
- **More than 4 sample TikToks** — choice paralysis, dilutes the demo
- **Loader > 5 seconds** — OpusClip-tested attention span; cap at 3-4s
- **Result card with > 4 insight items** — Raycast information density: 3 is the sweet spot
- **Auto-play on viewport entry** — user pick is essential to the conversion mechanic (creates investment)

**Confidence:** HIGH

---

## Section 3 — How It Works (Engine Pipeline / Data Flow)

### Pattern catalog

| Pattern name | Description | Reference |
|---|---|---|
| **Horizontal pipeline with animated connectors** | 4-5 stage nodes connected by animated SVG beams that fire on viewport entry | [Linear product pipeline graphics](https://linear.app) (Kanban-style stage flow), [Vercel AI Gateway diagram](https://vercel.com) |
| **Vertical scroll-tracked beam** | Single vertical beam draws as user scrolls past stage nodes; mobile-friendly | [Aceternity TracingBeam demo](https://ui.aceternity.com/components/tracing-beam), [Linear Insights cycle](https://linear.app/insights) |
| **Cycle / loop diagram** | Stages arranged in a closed loop rather than linear chain — emphasizes continuous feedback | [Linear Insights cycle graph](https://linear.app/insights) |
| **Code-side / output-side split** | Left = pipeline diagram, right = sample API output ticking through | [Vercel AI Gateway tabbed code](https://vercel.com), [Stripe API code preview](https://stripe.com) |

### Winning pattern for Virtuna

**Horizontal `AnimatedBeam` pipeline (desktop) → vertical `TracingBeam` (mobile)** — direct match to BRAND-BIBLE § Visual Metaphor Lock VIZ-02 (4-stage: video → analyze → simulate audience → predict). Locked spec already exists; this section is the cleanest "uses-what-is-already-decided" win.

Why not cycle/loop: spec is linear pipeline, not feedback loop. Don't re-litigate.

Why not code-side split: Virtuna has no public API yet. Defer.

### Component inventory

| Role | Component | Path / install | Notes |
|---|---|---|---|
| Stage node container | Magic UI `MagicCard` (compact mode) | (already installed) | 4 nodes: Video, Analyze, Simulate audience, Predict |
| Active-stage orbit accent | Magic UI `OrbitingCircles` | [docs](https://magicui.design/docs/components/orbiting-circles) — `npx shadcn@latest add @magicui/orbiting-circles` | Tiny coral satellites orbit the active node — implies computation |
| Connector beams (desktop) | Magic UI `AnimatedBeam` | [docs](https://magicui.design/docs/components/animated-beam) — `npx shadcn@latest add @magicui/animated-beam` | Curved SVG paths between nodes; one-shot pulse on viewport entry, NOT loop |
| Vertical beam (mobile) | Aceternity `TracingBeam` | [docs](https://ui.aceternity.com/components/tracing-beam) — registry JSON | Scroll-tracked stroke length |
| Stage icons | Lucide React (already installed) | `Video`, `Sparkles`, `Users`, `TrendingUp` | Match BRAND-BIBLE icon palette |
| Active-stage border emphasis | Magic UI `BorderBeam` | (already installed) | Wraps the focused node — investor-grade detail |
| Stage detail expand-on-hover | shadcn `HoverCard` | Existing in shadcn | 2-3 sentences per stage on hover |
| Section background | Magic UI `DotPattern` | [docs](https://magicui.design/docs/components/dot-pattern) — `npx shadcn@latest add @magicui/dot-pattern` | Subtle grid, fade to transparent edges |

### Copy / structure (Linear-derived)

Linear's pipeline labels are **outcome-words, not feature-words.** Apply:

- ❌ "Step 1: Web Scraping" (feature)
- ✅ "Video" → "Read the post" (outcome)
- ✅ "Analyze" → "Score the hook" (outcome)
- ✅ "Simulate audience" → "Run 2,847 viewers" (outcome with number)
- ✅ "Predict" → "Confidence: 87%" (outcome with number)

Section H2 candidates:
- "How Virtuna predicts virality" (functional)
- "Inside the engine" (curiosity)
- "From post to prediction in 30 seconds" (outcome — OpusClip's "1 click" pattern)

### Anti-patterns (do not)

- **5+ stages** — locked at 4 per BRAND-BIBLE; don't drift
- **Looping pulse** — one-shot only per VIZ-04 spec
- **No mobile vertical fallback** — pipeline must work at ≤640px (VIZ-03 scale affordances)
- **Stage icons that don't tokenize with coral on hover** — accent stays coral; no rainbow

**Confidence:** HIGH

---

## Section 4 — Three Surfaces Bento (Prediction · Competitor Intel · Brand Deals)

### Pattern catalog

| Pattern name | Description | Reference |
|---|---|---|
| **Magic UI BentoGrid 3-card asymmetric** | One large card + two small (or vice-versa); each card has a live animated background showing the product feature in action | [Magic UI BentoGrid demo](https://magicui.design/docs/components/bento-grid), [Aceternity BentoGrid demo](https://ui.aceternity.com/components/bento-grid) |
| **Stripe alternating image-text blocks** | Each surface gets its own full-width block, image-left text-right alternating; works for 3 because it has more vertical room | [Stripe product overview section](https://stripe.com) |
| **HeroParallax surface grid** | 3 large parallax-scrolling tiles, each a deep-dive into one surface | [Aceternity HeroParallax demo](https://ui.aceternity.com/components/hero-parallax) |
| **Linear three-up "Built / Powered / Designed"** | 3 equal-width columns with title + 1-paragraph + supporting micro-visual | [Linear value-prop triplets](https://linear.app) |

### Winning pattern for Virtuna

**Magic UI BentoGrid 3-card asymmetric (1 large + 2 stacked)** — gives Prediction (the flagship surface) visual weight matching its product priority, while Competitor + Brand Deals get smaller equal-weight cards. Each card has a **live animated background** showing the actual surface mechanic, NOT a static screenshot.

Layout:
- **Left col (3/5 width):** Prediction surface — large card, background is a mini-animated confidence-distribution chart + score ticking up
- **Right col (2/5 width), top:** Competitor Intelligence — `Marquee` of competitor @handles scrolling vertically
- **Right col (2/5 width), bottom:** Brand Deals — `AnimatedList` of deal cards appending in sequence

### Component inventory

| Role | Component | Path / install | Notes |
|---|---|---|---|
| Grid container | Magic UI `BentoGrid` | [docs](https://magicui.design/docs/components/bento-grid) — `npx shadcn@latest add @magicui/bento-grid` | `lg:grid-rows-2 lg:grid-cols-5` for asymmetric |
| Individual cards | Magic UI `BentoCard` | (same install) | Accepts `name`, `description`, `Icon`, `cta`, `href`, `background`, `className` |
| Card hover spotlight | Magic UI `MagicCard` (wrap) | (already installed) | Cursor-tracked radial gradient — subtle, dark-friendly |
| **Prediction card background:** confidence chart | Custom SVG + `NumberTicker` | n/a — hand-built ~80 lines | 4 horizontal bars filling on viewport entry + score `NumberTicker` |
| **Competitor card background:** scrolling handles | Magic UI `Marquee` (vertical mode) | [docs](https://magicui.design/docs/components/marquee) — `npx shadcn@latest add @magicui/marquee` | `vertical` prop + `pauseOnHover` |
| **Brand Deals card background:** deal list append | Magic UI `AnimatedList` | [docs](https://magicui.design/docs/components/animated-list) — `npx shadcn@latest add @magicui/animated-list` | Appends 3-4 deal cards in 800ms intervals, loops |
| Per-card emphasis border | Magic UI `BorderBeam` | (already installed) | Only on the focused/hovered card |
| Icons | Lucide React | `Sparkles` (Prediction), `Radar` (Competitor), `Handshake` (Brand Deals) | Match BRAND-BIBLE palette |

### Copy / structure (OpusClip-derived)

OpusClip uses **outcome-headlines + metric callouts** in feature cards:
- "Scale your business and save $2,700 monthly on editing cost"

Apply:
- Prediction → "Score every TikTok before you post. 87% accuracy."
- Competitor Intelligence → "Track 50 competitors. See their viral moment in real time."
- Brand Deals → "Get brand deals worth $X without pitching."

CTA per card (matches OpusClip "Learn more" pattern):
- "See predictions →" (links to demo viewport 2 anchor)
- "See it work →" (anchors to /trending placeholder)
- "Browse deals →" (anchors to /brand-deals placeholder)

### Anti-patterns (do not)

- **Static screenshot per card** — Stripe pattern, but Virtuna's screenshots aren't investor-grade yet
- **3 equal-width cards** — Linear pattern works, but asymmetric tells the "Prediction is flagship" story better
- **Translate-y card lift on hover** — forbidden per CLAUDE.md
- **More than 3 surfaces** — scope is locked at 3 per PROJECT.md

**Confidence:** HIGH

---

## Section 5 — The Science (Behavioral Research Moat + Citations + Dataset Stats)

This is the investor-facing trust section. Creators may skim it. Investors will park here.

### Pattern catalog

| Pattern name | Description | Reference |
|---|---|---|
| **Sticky-scroll research deep-dive** | Left = scrolling research content (one paper / dataset stat per scroll-step), right = sticky visual panel (citation chip cluster updates in sync) | [Aceternity StickyScroll demo](https://ui.aceternity.com/components/sticky-scroll-reveal), [Anthropic research pages](https://www.anthropic.com/research) (StickyScroll-style citation chips) |
| **Citation chip marquee** | Horizontally scrolling band of paper titles + author + year — academic-credibility cue | [Anthropic publications page](https://www.anthropic.com/research), [Vercel customer-results inline metrics](https://vercel.com) |
| **Dataset stats card row** | 3-4 large `NumberTicker` stats: "2.4M videos analyzed" / "847 behavioral signals" / "30 seconds avg" | [Stripe metric callouts](https://stripe.com) ("135+ currencies, $1.9T 2025 volume"), [Vercel customer-metric callouts](https://vercel.com) |
| **Timeline of research milestones** | Vertical timeline with paper-title + date + 1-sentence finding | [Aceternity Timeline demo](https://ui.aceternity.com/components/timeline), [ElevenLabs model-release timeline](https://elevenlabs.io) |

### Winning pattern for Virtuna

**Aceternity `StickyScroll` (left: scrolling text + dataset stats; right: sticky citation chip cluster) + Magic UI `Marquee` citation-chip band at bottom of section**

This is the strongest investor pattern because it:
1. Forces the reader to scroll through the research narrative (Anthropic-style commitment device)
2. Surfaces citations as visible chips (academic credibility cue ElevenLabs LACKS and Anthropic has)
3. Lets dataset stats tick up via `NumberTicker` as the user scrolls past
4. Mobile fallback: StickyScroll degrades gracefully to a stacked single-column flow

### Component inventory

| Role | Component | Path / install | Notes |
|---|---|---|---|
| Section container | Aceternity `StickyScroll` (a.k.a. `StickyScrollReveal`) | [docs](https://ui.aceternity.com/components/sticky-scroll-reveal) — `npx shadcn@latest add https://ui.aceternity.com/registry/sticky-scroll-reveal.json` | Left = content array, right = sticky visual prop |
| Dataset stat tickers | Magic UI `NumberTicker` | (already installed) | "2,400,000 videos analyzed" / "847 behavioral signals" / "30 sec avg" |
| Citation chip | shadcn `Badge` variant=`secondary` | Existing in design system | "Berger & Milkman (2012) — Emotion & Virality" — 1 chip per citation |
| Citation chip cluster | Custom grid (8-12 chips clustered) | n/a | Right-pane visual for StickyScroll |
| Citation chip marquee (band at section bottom) | Magic UI `Marquee` | (already installed) | Scrolling horizontal band of all paper titles |
| Section background | Magic UI `DotPattern` (subtle) OR Aceternity `BackgroundBeams` | (already installed / registry JSON) | Subtle, low-opacity |
| "Read the white paper" CTA | shadcn `Button` variant=`ghost` + `ArrowUpRight` icon | Existing | Stubs to /research per PROJECT.md scope |

### Content shape (placeholder — Phase X writes real)

```ts
// Each StickyScroll step = 1 research thesis + 1 stat
const SCIENCE_STEPS = [
  {
    title: 'Behavioral economics, not engagement guesswork',
    description: '4 academic moats: BJ Fogg behavior model, Berger & Milkman virality, Cialdini influence, Krug usability.',
    stat: { label: 'papers cited', value: 47 },
    chips: ['Fogg (2009)', 'Berger & Milkman (2012)', 'Cialdini (2007)', ...],
  },
  // ... 3-4 more steps
];
```

### Copy / structure (Anthropic-derived)

Anthropic's research credibility comes from **specific paper names with author+year**, not vague "AI-powered" claims. Apply to Virtuna:

- ❌ "Powered by behavioral science"
- ✅ "Built on 47 papers from BJ Fogg, Robert Cialdini, and Jonah Berger."

Section H2 candidates:
- "The science behind the score"
- "Behavioral research, not engagement guesswork"
- "Why our predictions work"

### Anti-patterns (do not)

- **Vague "AI-powered" without paper names** — ElevenLabs's mistake per fetch ("minimal citations or dataset transparency")
- **Fake / unverifiable paper titles** — kills investor credibility immediately. Use REAL papers only
- **5+ stats** — 3 dataset stats is the sweet spot (Stripe pattern)
- **Marketing copy in citation chips** — chips are author+year only, not interpretive

**Confidence:** HIGH — though the actual paper titles need a content-research pass before Phase 1 ships

---

## Section 6 — Social Proof Stack (Testimonials + Metrics + Logos + Partners)

The hardest section to get right. The brief calls out the trap: "without it feeling like four separate sections jammed together."

### Pattern catalog

| Pattern name | Description | Reference |
|---|---|---|
| **Stripe weave: metrics-in-headline + logos-as-case-studies + quotes-inline** | No dedicated "testimonials" block. Metrics live in section H2 ("$1.9T 2025 volume"), logos link to case studies, quotes embedded inside enterprise/startup feature sections | [Stripe homepage](https://stripe.com) — directly references this pattern |
| **Linear three-block stacked (logos / single big quote / 3 micro-quotes)** | Logo marquee → one large headline-style quote with named CEO → 3 smaller quote cards below | [Linear social proof](https://linear.app) |
| **OpusClip dense-density: avatar + handle + follower-count grid** | 20+ creator faces with follower counts (54.4K to 65.9M range) — pure social-proof density | [OpusClip social proof](https://www.opus.pro) |
| **Cursor executive-quote density** | 6 high-profile named quotes in tight vertical space (YC partner, NVIDIA CEO, OpenAI President) | [Cursor social proof](https://www.cursor.com) |
| **Aceternity 3D AnimatedTestimonials** | 3D-rotating spotlight quote cards — visually wow, one quote in focus at a time | [Aceternity Animated Testimonials](https://ui.aceternity.com/components/animated-testimonials) |
| **Raycast avatar parade** | 30+ circular avatars of notable users (CEOs, designers, creators) — no quote text, pure association | [Raycast social proof](https://www.raycast.com) |

### Winning pattern for Virtuna

**Hybrid: Stripe-weave approach for fusion + Aceternity `AnimatedTestimonials` as the centerpiece + Magic UI `Marquee` logo wall above + `NumberTicker` metric bar below — visually fused via a single shared `Spotlight` backdrop spanning the entire section.**

Layout (top-to-bottom, single section, single Spotlight):
1. **Eyebrow H2:** "Trusted by creators and the brands behind them"
2. **Logo marquee** (Magic UI `Marquee`, 2 stacked rows scrolling opposite directions) — 12+ partner/PR logos including Numen Machines lockup
3. **AnimatedTestimonials centerpiece** — 3-5 named creator quotes, 3D-rotating, one in focus at a time, photo + handle + follower count (OpusClip density signal)
4. **Metric bar** — 3 `NumberTicker` stats spanning width: "Average viral hit-rate up 3.2x" / "12,000+ creators" / "$2.4M in brand deals matched" (use projected if real metrics absent — flag as projected internally; investors expect this)
5. **CTA** below: "Read the case studies →" (stubs to /case-studies if/when built)

The single shared Spotlight backdrop is the trick — visually fuses the four sub-elements into one section instead of four discrete sections.

### Component inventory

| Role | Component | Path / install | Notes |
|---|---|---|---|
| Shared section backdrop | Aceternity `Spotlight` | (already installed for hero) | Section-spanning glow, fuses the 4 sub-blocks |
| Logo marquee (2 rows) | Magic UI `Marquee` | (already installed) | Two `<Marquee>` elements, one `reverse` prop |
| Logo cells | Custom SVG/PNG cells | n/a — assets supplied per logo | Numen Machines lockup gets `BorderBeam` accent (own-brand emphasis) |
| Testimonial centerpiece | Aceternity `AnimatedTestimonials` | [docs](https://ui.aceternity.com/components/animated-testimonials) — registry JSON | `quote`, `name`, `designation`, `src` (photo) per card |
| Metric ticker bar | Magic UI `NumberTicker` ×3 | (already installed) | Equal-width column row under testimonials |
| Optional avatar parade (if 5+ creator photos available) | Magic UI `AvatarCircles` | (already installed) | Use IF photo assets exist, otherwise skip |
| Case-study CTA | shadcn `Button` variant=`ghost` + `ArrowUpRight` | Existing | Anchor to /case-studies stub |

### Copy / structure (OpusClip + Cursor hybrid)

**OpusClip testimonial formula** (use verbatim where possible):
- Photo + Name + Handle + **Follower count** (this is the OpusClip-specific signal — "54.4K to 65.9M followers" range)
- Quote = ≤ 2 sentences, metric-forward
- Example: *"Used to take days to know if a video would hit. Now it takes 30 seconds." — @creatorhandle, 2.3M followers*

**Cursor formula for investor quotes** (mix in 1-2):
- Use ONE high-profile non-creator voice if you can get one (advisor, investor, VC partner)
- Example: *"Virtuna is the prediction layer TikTok will eventually have to build itself." — [Advisor name], [Title]*

### Anti-patterns (do not)

- **Generic "John D., Marketing Manager" testimonials** — kill credibility instantly. OpusClip uses real handles + follower counts because credibility scales with verifiability
- **Stock photo avatars** — same problem
- **Separating logos / testimonials / metrics into 3 distinct section blocks with headers** — that's the "feels jammed together" failure mode the brief flags
- **Marquee paused (not scrolling)** — defeats the dynamism; always scroll, `pauseOnHover` only
- **No Numen Machines callout** — explicit ask per PROJECT.md ("Numen Machines/partner logos")

**Confidence:** HIGH

---

## Section 7 — Pricing (Starter/Pro Table)

### Pattern catalog

| Pattern name | Description | Reference |
|---|---|---|
| **2-column shadcn-style table with toggle** | Two cards side-by-side (Free/Starter + Pro), monthly/yearly toggle above, "Most popular" badge on Pro, feature checklist per card | Standard shadcn pricing block; [OpusClip pricing](https://www.opus.pro/pricing) (4 cols but same skeleton) |
| **3-tier with "Most Popular" middle** | Free + Pro (highlighted middle) + Business; OpusClip uses 4 (Free / Starter $15 / Pro $29 / Business) | [OpusClip pricing](https://www.opus.pro/pricing) |
| **Comparison matrix (rows-as-features)** | Single wide table; each row = one feature, columns = plans, ✓/− cells | [OpusClip pricing — "9 feature categories with checklist"](https://www.opus.pro/pricing) |
| **"Contact sales" enterprise gate** | No public price for top tier; "Contact" button replaces $ amount | [Cursor pricing entry-point](https://www.cursor.com), [OpusClip Business tier](https://www.opus.pro/pricing) |

### Winning pattern for Virtuna

**2-column shadcn `Card` table (Starter vs Pro) + monthly/yearly `Tabs` toggle + 9-category feature checklist (OpusClip pattern) + FAQ `Accordion` below + NO money-back-guarantee badge (OpusClip doesn't have one, neither needed)**

Since PROJECT.md scope is "Starter/Pro" (2 tiers only — no Business), use a 2-column layout, NOT 3- or 4-column. Pro gets the visual emphasis (BorderBeam + ShimmerButton). Both cards equal-width, NOT one larger.

**Feature checklist style (OpusClip-verified):**
- ✓ green checkmark for included
- − dash for excluded
- ℹ info icon → shadcn `Tooltip` for tooltips
- Group into ~6 categories (Predictions / Analytics / Competitors / Brand Deals / Team / Support) — adapted from OpusClip's 9 categories. 6 fits Virtuna's surface count better.

### Component inventory

| Role | Component | Path / install | Notes |
|---|---|---|---|
| Pricing card | shadcn `Card` (existing in design system) | Existing | `bg-transparent`, 6% border, 12px radius per CLAUDE.md Raycast rules |
| Monthly/Yearly toggle | shadcn `Tabs` OR shadcn `ToggleGroup` | Existing | Tabs with "Monthly" / "Yearly (Save 20%)" labels — match OpusClip pattern ("Save up to 50%") |
| Pro card emphasis | Magic UI `BorderBeam` | (already installed) | Coral border travels around Pro card |
| Pro CTA | Magic UI `ShimmerButton` | (already installed) | Coral fill, "Start Pro trial" |
| Starter CTA | shadcn `Button` variant=`secondary` | Existing | Transparent + 6% border, "Start free" |
| Checklist icons | Lucide `Check` (green-500) + `Minus` (gray-500) | Existing | Match OpusClip ✓/− pattern |
| Tooltip on info icon | shadcn `Tooltip` + Lucide `Info` icon | Existing | "Hover for details" UX |
| FAQ accordion | shadcn `Accordion` (existing) | Existing | 5-8 questions, expandable |
| "Most popular" badge on Pro | shadcn `Badge` variant=`accent` + position: absolute top-right | Existing | Coral fill |
| Money-back guarantee | NOT INCLUDED — OpusClip doesn't have one | n/a | Skip — not needed for Whop-integrated trial flow |

### Copy / structure (OpusClip-derived)

**Toggle copy** (OpusClip-verified): "Monthly" / "Yearly — Save up to X%". DO NOT use "Annual" — OpusClip A/B'd into "Yearly" specifically.

**CTA copy** (OpusClip-verified pattern):
- Free → "Start your free trial" (NOT "Sign up" — too generic)
- Pro → "Start your free trial" (mirror — emphasizes trial reduces commitment friction)
- Or differentiate: Free → "Start free", Pro → "Start 7-day trial" (highlights Whop-integrated trial)

**FAQ topics** (OpusClip-derived, 6 needed):
1. "How does the trial work?"
2. "Can I cancel anytime?"
3. "Do I need to connect TikTok?"
4. "What if my prediction is wrong?"
5. "Is my data private?"
6. "Do you offer team plans?"

### Anti-patterns (do not)

- **3 columns when scope is 2 tiers** — false enterprise-tier inflation
- **Stripe-style usage-based pricing copy** — Virtuna is flat-rate, don't muddy the pitch
- **"Most popular" on Starter** — emphasis should drive upgrade, not downgrade
- **Translate-y card lift on Pro hover** — forbidden per CLAUDE.md; use `BorderBeam` + `bg-white/[0.02]` only
- **Hidden pricing ("Contact us")** — Virtuna is self-serve, don't apply Cursor's enterprise-gate pattern

**Confidence:** HIGH

---

## Section 8 — Final CTA + Footer

### Pattern catalog

| Pattern name | Description | Reference |
|---|---|---|
| **Hero mirror** | Bottom CTA repeats hero's exact treatment (Spotlight + same H1-style copy + same dual CTA) | [OpusClip bottom CTA](https://www.opus.pro) (identical to top hero), [Raycast CTA footer](https://www.raycast.com) |
| **Compact strip + footer** | Single-line headline + CTA pair + immediately into 4-col footer | [Linear CTA-then-footer](https://linear.app), [Vercel footer](https://vercel.com) |
| **Email capture variant** | Final CTA is an email field, not a button — for waitlist or newsletter | Lower-fit for Virtuna (Whop trial is the conversion) |

### Winning pattern for Virtuna

**Hero mirror (Spotlight + AnimatedShinyText eyebrow + outcome H2 + ShimmerButton + ghost secondary CTA) → compact 4-column footer underneath.** Matches OpusClip's bookend pattern exactly.

### Component inventory

| Role | Component | Path / install | Notes |
|---|---|---|---|
| CTA backdrop | Aceternity `Spotlight` | (already installed) | Mirror hero — visual closure |
| Eyebrow | Magic UI `AnimatedShinyText` | (already installed) | "Ready to predict virality?" |
| Primary CTA | Magic UI `ShimmerButton` | (already installed) | "Start free" — same copy as hero |
| Secondary CTA | shadcn `Button` variant=`ghost` | Existing | "See it work" — anchors to viewport 2 |
| Footer grid | shadcn 4-col layout | Existing | Product / Resources / Company / Legal |
| Footer brand mark | Custom Virtuna logo | Existing in design system | |
| Social icons | Lucide React | `Twitter`, `Linkedin`, `Github`, `Mail` | |

### Anti-patterns (do not)

- **NEW copy in final CTA** — OpusClip pattern is intentional repetition; new copy dilutes the close
- **Form fields in final CTA** — friction; button > field for trial signup
- **Multi-line H2** — keep it ≤ 8 words

**Confidence:** HIGH

---

## OpusClip Conversion Patterns — Specific Findings (Locked Reference)

This is the **OpusClip-specific** subsection the quality gate requires. Below are conversion patterns to adopt (structure/copy only — NOT aesthetic):

### 1. Pricing layout patterns

| OpusClip pattern | Adopt for Virtuna? | Notes |
|---|---|---|
| 4-column tier table | ❌ Use 2-column | Virtuna scope is Starter/Pro only |
| Monthly/Yearly toggle with explicit % savings ("Save up to 50%") | ✅ Yes | Use ~20% Yearly discount |
| 9-category feature checklist with ✓/−/ℹ icons | ✅ Yes — adapt to 6 categories | Match Virtuna surface count |
| "Coming soon" icons for unreleased features | ✅ Optional | Signals roadmap momentum |
| No money-back-guarantee badge | ✅ Skip | Whop trial handles risk reversal |
| CTA copy "Start your free trial" on multiple tiers | ✅ Yes | Mirror trial-first framing |

### 2. Social proof density patterns

| OpusClip pattern | Adopt? | Notes |
|---|---|---|
| 20+ creator faces with **follower counts** (54.4K–65.9M range) | ✅ Yes | Follower count is the OpusClip-specific verifiability signal |
| 12+ corporate/enterprise logos in horizontal carousel | ✅ Yes | Adapt for partners + Numen Machines |
| Repeated carousel (5+ cycle visible in source) | ❌ Skip | Pause-on-hover Marquee is better UX |
| Metric-forward quotes ("It used to take days...") | ✅ Yes | Adopt verbatim formula |
| Named creator + follower count + 1-2 sentence quote | ✅ Yes | Adopt verbatim formula |

### 3. Demo positioning patterns

| OpusClip pattern | Adopt? | Notes |
|---|---|---|
| Demo lives **directly under hero** (viewport 2) | ✅ Yes | Already locked per PROJECT.md |
| Sample picker shown immediately ("Vlog / Sports / Podcast" thumbnails) | ✅ Yes | Use 3-4 TikTok niches |
| Input field for video URL alongside file upload | ❌ Skip for v1 | Scripted demo, not real backend |
| Platform compatibility logos under input | ❌ Skip | Virtuna is TikTok-only |

### 4. CTA cadence patterns

| OpusClip pattern | Adopt? | Notes |
|---|---|---|
| Dual CTA in hero ("Get free clips" + "Upload files") | ✅ Yes | "Start free" + "See it work" |
| CTA repeated in footer (mirror of hero) | ✅ Yes | Bookend close |
| "Learn more" links in mid-page feature sections (no CTA in informational sections) | ✅ Yes | Sections 3 (How it works) and 5 (Science) have no primary CTA |
| Action-oriented button verbs ("Get," "Upload," "Sign up") | ✅ Yes | "Start," "See," "Try" |

### 5. Vocab choices (OpusClip's verifiable patterns)

| OpusClip vocab | Adopt for Virtuna? | Adapted form |
|---|---|---|
| "1 click" (repeated 4+ times) | ✅ Adapt | "30 seconds" (Virtuna's equivalent speed signal) |
| "10x faster" / "5x faster" | ✅ Adapt | "3.2x viral hit-rate" |
| "Viral" (3+ headlines) | ✅ Yes — load-bearing | "Predict viral", "viral score", "viral hit-rate" |
| "AI that..." headlines ("AI that understands every pixel", "AI that edits with you") | ✅ Yes | "AI that scores your TikToks before TikTok does" |
| "Autopilot" / "Workflow" | ❌ Skip | Off-brief for prediction product |
| "$X monthly savings" metric framing | ✅ Yes | "$2.4M in brand deals matched" |
| "266% increase", "Watch time increased by 57%" — specific KPI improvements | ✅ Yes | Use real or projected (flag projected internally) |

### 6. Trust signal density

OpusClip's hierarchy: **SOC2 TYPE 2 + "Best Software 2025" badge** in footer; 20+ logos + 12+ corporate logos; 8+ longer-form named testimonials. Apply equivalent density to Virtuna footer:
- "Built on Vercel + Supabase" badges (existing infra trust)
- Numen Machines partner lockup
- 5-8 partner/PR logos in footer corner

---

## Table Stakes vs Differentiators (Overall Landing Page)

### Table stakes (missing = product feels incomplete)

| Feature | Why expected | Complexity |
|---|---|---|
| Hero with H1 + subhead + dual CTA | Universal SaaS pattern | Low |
| Pricing table on-page (NOT separate /pricing page) | OpusClip + Linear + Cursor all on-page; investors check pricing first | Medium |
| Customer logos / partner lockup band | Universal SaaS trust signal | Low |
| Testimonials with named people | Generic testimonials feel inauthentic | Low |
| FAQ accordion under pricing | OpusClip + standard pattern | Low |
| Mobile responsive single-column stack | Standard | Medium |
| Dark mode default (already locked per CLAUDE.md) | Brand requirement | n/a |
| Footer with multi-col link hierarchy | Standard | Low |
| Final CTA mirror of hero | OpusClip pattern, conversion-tested | Low |
| Animations honoring `prefers-reduced-motion` | WCAG + brand bible standard | Medium |

### Differentiators (set Virtuna apart)

| Feature | Value proposition | Complexity |
|---|---|---|
| **Interactive scripted demo (viewport 2)** | Lets prospects "try" Virtuna without signup; competitors don't have this; investors see the product mechanic | High — but the highest-value section by far |
| **Linear-style horizontal AnimatedBeam pipeline (viewport 3)** | Communicates engine sophistication visually; differentiates from generic "AI-powered" claims | Medium |
| **Citations as chips with real paper titles (viewport 5)** | Academic credibility moat — ElevenLabs LACKS this; Anthropic has it; Virtuna can match Anthropic-level rigor | Medium — content-research-bound |
| **Single-Spotlight fused social-proof section (viewport 6)** | Avoids "4 separate sections jammed together" failure mode | Medium |
| **Magic UI BentoGrid with live animated backgrounds (viewport 4)** | Each surface card has live motion, not static screenshots — investor-grade detail polish | Medium |
| **Canvas particle hero (locked)** | Hand-tuned, 30 KB, 60fps; differentiates from off-the-shelf hero animations | Medium — Phase 2 of milestone builds |
| **Numen Machines lockup with BorderBeam accent** | Own-brand cross-link (multi-entity structure); investor signal of broader vision | Low |

### Anti-features (explicitly NOT building)

| Anti-feature | Why avoid | What to do instead |
|---|---|---|
| Lottie / Rive animations | No animator pipeline | Magic UI + Aceternity covers all motion needs |
| Real wired prediction demo on landing | Out of scope per PROJECT.md | Scripted MultiStepLoader + CardStack reveal |
| Light mode variant | Out of scope per PROJECT.md | Dark mode only |
| /about, /research, /manifesto deep pages | Out of scope (stubs OK) | CTAs stub to placeholder pages |
| Real-time chat widget | Off-brief, conversion-cost vs value low | Email + Discord links in footer |
| Spline 3D scene as default hero | 544 KB runtime — kills LCP per STACK.md | Canvas particle viz (already locked) |
| 4-tier pricing | Scope is Starter/Pro only | 2-tier table |
| Cookie banner / GDPR overlay | Privacy is genuinely important but scope-bound to a future polish pass | Footer link to /privacy |
| Auto-playing video hero | Universal anti-pattern (conversion-killer + a11y issue) | Static Canvas viz with one-shot motion |
| Pop-up exit-intent overlay | Off-brief, breaks Linear/Raycast premium feel | None |

---

## Feature Dependencies

```
Section 1 (Hero) → Section 2 (Demo) [CTA "See it work" anchors here]
Section 2 (Demo) → Section 3 (How it works) [Demo loader stages mirror pipeline stages]
Section 3 (How it works) → Section 4 (Three Surfaces) [Pipeline output feeds the 3 surfaces]
Section 4 (Three Surfaces) → Section 5 (Science) [Each surface justified by research]
Section 5 (Science) → Section 6 (Social proof) [Research → results from real customers]
Section 6 (Social proof) → Section 7 (Pricing) [Trust → purchase decision]
Section 7 (Pricing) → Section 8 (Final CTA) [Mirror hero, close]
```

This is a **narrative arc**, not just a section list. Each section sets up the next. Roadmap should preserve this ordering.

---

## MVP Recommendation (if scope tightens mid-build)

Cut order if a phase must be deferred:

1. **Always ship (table stakes):** Hero, Pricing, Final CTA, Footer
2. **Differentiator-critical:** Interactive Demo (viewport 2), How it Works pipeline (viewport 3)
3. **Trust-critical (investor view):** The Science (viewport 5), Social Proof (viewport 6)
4. **Polish-tier:** Three Surfaces bento (viewport 4) — can ship as a simpler 3-card row if BentoGrid timeline pressures

If a hard cut needed: defer Three Surfaces bento to Landing v1.1 — Prediction surface alone can absorb the explanation via expanded demo + science sections.

---

## Source URLs (consolidated for downstream consumers)

### Reference landings (live-fetched 2026-05-24)

| Brand | URL | Patterns used |
|---|---|---|
| OpusClip / opus.pro | https://www.opus.pro | Sections 1, 2, 6, 7, 8 (locked copy/conversion reference) |
| OpusClip pricing | https://www.opus.pro/pricing | Section 7 (toggle + checklist + tier emphasis) |
| Linear | https://linear.app | Sections 1, 3, 4, 6 (aesthetic anchor) |
| Linear Insights | https://linear.app/insights | Section 3 (cycle/pipeline) |
| Raycast | https://www.raycast.com | Sections 1, 8 (aesthetic anchor) |
| Vercel | https://vercel.com | Sections 4, 5, 6 (trust signal weave) |
| Anthropic Claude | https://claude.com/product/overview | Section 2 (try-this-prompt widget), Section 5 (research framing) |
| Anthropic Research | https://www.anthropic.com/research | Section 5 (citation chips) |
| Cursor | https://www.cursor.com | Sections 1, 2, 6 (dual CTA, executive testimonials) |
| Stripe | https://stripe.com | Sections 4, 6 (trust weave + alternating blocks) |
| ElevenLabs | https://elevenlabs.io | Section 5 (timeline of model releases — what NOT to do without citations) |

### Component documentation (live-fetched)

| Component | URL |
|---|---|
| Magic UI components index | https://magicui.design/docs/components |
| Magic UI BentoGrid | https://magicui.design/docs/components/bento-grid |
| Magic UI Marquee | https://magicui.design/docs/components/marquee |
| Magic UI MagicCard | https://magicui.design/docs/components/magic-card |
| Magic UI AnimatedBeam | https://magicui.design/docs/components/animated-beam |
| Magic UI BorderBeam | https://magicui.design/docs/components/border-beam |
| Magic UI NumberTicker | https://magicui.design/docs/components/number-ticker |
| Magic UI ShimmerButton | https://magicui.design/docs/components/shimmer-button |
| Magic UI AnimatedList | https://magicui.design/docs/components/animated-list |
| Magic UI BoxReveal | https://magicui.design/docs/components/box-reveal |
| Magic UI DotPattern | https://magicui.design/docs/components/dot-pattern |
| Magic UI Particles | https://magicui.design/docs/components/particles |
| Magic UI OrbitingCircles | https://magicui.design/docs/components/orbiting-circles |
| Magic UI AnimatedShinyText | https://magicui.design/docs/components/animated-shiny-text |
| Magic UI AvatarCircles | https://magicui.design/docs/components/avatar-circles |
| Magic UI WordRotate | https://magicui.design/docs/components/word-rotate |
| Magic UI iPhone15Pro | https://magicui.design/docs/components/iphone |
| Aceternity components index | https://ui.aceternity.com/components |
| Aceternity Spotlight | https://ui.aceternity.com/components/spotlight |
| Aceternity Lamp | https://ui.aceternity.com/components/lamp-effect |
| Aceternity TracingBeam | https://ui.aceternity.com/components/tracing-beam |
| Aceternity StickyScroll | https://ui.aceternity.com/components/sticky-scroll-reveal |
| Aceternity AnimatedTestimonials | https://ui.aceternity.com/components/animated-testimonials |
| Aceternity MultiStepLoader | https://ui.aceternity.com/components/multi-step-loader |
| Aceternity CardStack | https://ui.aceternity.com/components/card-stack |
| Aceternity BackgroundBeams | https://ui.aceternity.com/components/background-beams |
| Aceternity FlipWords | https://ui.aceternity.com/components/flip-words |
| Aceternity HeroParallax | https://ui.aceternity.com/components/hero-parallax |
| Aceternity Compare | https://ui.aceternity.com/components/compare |
| Aceternity Timeline | https://ui.aceternity.com/components/timeline |

### Industry pattern references (WebSearch, MEDIUM confidence)

| Source | Topic |
|---|---|
| https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples | 2026 trends (interactive demos, micro-animations) |
| https://userpilot.com/blog/saas-landing-pages/ | 19 best SaaS landings — patterns inventory |
| https://www.apexure.com/blog/saas-demo-landing-page-examples | Demo landing patterns |

---

*Last updated: 2026-05-24 — Landing v1 milestone, project research phase (FEATURES section catalog).*
