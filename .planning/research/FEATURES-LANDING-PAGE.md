# Feature Landscape: Raycast-Style SaaS Landing Page

**Domain:** Dark-themed premium SaaS landing page (Raycast / Linear / Resend aesthetic)
**Product:** Virtuna -- social media intelligence platform
**Researched:** 2026-02-06
**Confidence:** HIGH (based on live analysis of raycast.com, linear.app, vercel.com, resend.com, clerk.com + existing codebase audit)

---

## Existing Codebase Inventory

Before defining features, here is what already exists and can be leveraged or must be replaced.

**Existing landing sections** (`src/components/landing/`):
- `HeroSection` -- "Human Behavior, Simulated" with SVG network viz + floating persona card. CTA: "Get in touch". **Verdict: Replace entirely** -- current content is for "Artificial Societies" brand, not Virtuna. Layout pattern is reusable.
- `BackersSection` -- investor logos (Point72, Y Combinator, etc.). **Verdict: Adapt** -- swap logos/content for Virtuna-relevant social proof.
- `FeaturesSection` -- 4-card grid with Phosphor icons. **Verdict: Rewrite content** -- structure is solid, content needs to be Virtuna features.
- `StatsSection` -- 86% accuracy metric with comparison chart. **Verdict: Replace** -- needs Virtuna-specific metrics.
- `CaseStudySection` -- Teneo case study. **Verdict: Replace or remove** -- Virtuna may not have case studies yet.
- `PartnershipSection` -- Pulsar partnership. **Verdict: Replace or remove.**
- `FAQSection` -- 7 accordion items. **Verdict: Rewrite content** -- accordion pattern is solid.
- `TestimonialQuote` -- quote component. **Verdict: Keep primitive**, swap content.
- `FeatureCard` -- icon + title + description card. **Verdict: Keep primitive.**
- `PersonaCard` -- floating card for hero. **Verdict: May repurpose for product preview.**
- `ComparisonChart` -- bar chart component. **Verdict: Remove or replace.**

**Existing layout** (`src/components/layout/`):
- `Header` -- sticky nav with logo + "Sign in" + "Book a Meeting" CTA + mobile hamburger. **Verdict: Adapt** -- rebrand to Virtuna, change CTAs.
- `Footer` -- CTA section + footer bar with social links. **Verdict: Adapt** -- rebrand.
- `Container` -- max-width wrapper. **Verdict: Keep.**

**Existing motion** (`src/components/motion/`):
- `FadeIn` -- scroll-triggered fade-in-up with Framer Motion, reduced motion support. **Verdict: Keep as-is.**
- `FadeInUp` -- variant with more config. **Verdict: Keep.**
- `StaggerReveal` -- orchestrated stagger container + items. **Verdict: Keep.**
- `HoverScale` -- hover scale effect. **Verdict: Keep.**
- `SlideUp` -- slide-up animation. **Verdict: Keep.**
- `PageTransition` -- page transition wrapper. **Verdict: Keep.**

**Existing effects** (`src/components/effects/`):
- `ChromaticAberration` -- visual effect. **Verdict: Keep for hero.**
- `NoiseTexture` -- film grain overlay. **Verdict: Keep for premium texture.**

**Existing primitives** (`src/components/primitives/`):
- `GlassCard`, `GlassPanel`, `GlassInput`, `GlassPill`, `GlassTextarea` -- glass-morphism components. **Verdict: Keep, use for landing page cards.**
- `GradientGlow`, `GradientMesh` -- gradient effects. **Verdict: Keep for hero/section backgrounds.**
- `TrafficLights` -- macOS window chrome. **Verdict: Keep for product screenshot framing.**

**Existing UI** (`src/components/ui/`):
- `Button`, `Card`, `Badge`, `Input`, `Accordion`, `Dialog`, `Tabs`, `Typography`, etc. -- full Raycast-accurate design system (36 components). **Verdict: Use throughout landing page.**

**Key dependencies already installed:**
- `framer-motion` / `motion` v12 -- animations
- `@phosphor-icons/react` -- iconography
- `@react-three/fiber` + `@react-three/drei` + `three` -- 3D (for hero visual)
- `@splinetool/react-spline` -- Spline 3D scenes
- `react-intersection-observer` -- viewport detection
- `tw-animate-css` -- Tailwind CSS animations
- `sugar-high` -- code syntax highlighting
- Next.js 16, React 19, Tailwind v4

---

## Table Stakes

Features users expect from a professional SaaS landing page. Missing any of these makes the page feel incomplete or amateur.

### TS-1: Hero Section with Clear Value Proposition

| Aspect | Detail |
|--------|--------|
| **Why Expected** | First thing users see. Must answer "what is this?" and "why should I care?" within 3 seconds. Every premium SaaS site (Raycast, Linear, Resend, Clerk) leads with a hero that communicates the core value in a single headline. |
| **Complexity** | Medium |
| **What to Build** | Large headline ("Discover what's going viral"), supporting subheadline (1-2 sentences on what Virtuna does), primary CTA button ("Get started"), optional secondary CTA ("See how it works"). Coral #FF7F50 accent on CTA. |
| **Visual Treatment** | Full-viewport hero with product visual on right (screenshot or 3D). Background: subtle gradient mesh or noise texture (already have `GradientMesh` and `NoiseTexture`). Headline uses `font-display` at 48-64px. |
| **Pattern from References** | Raycast: "Your shortcut to everything" + 3D cube. Linear: "A purpose-built tool..." + product screenshot. Resend: "Email for developers" + dramatic background. Clerk: "More than authentication" + circuit graphics. |
| **Existing to Leverage** | `HeroSection` layout pattern, `FadeIn` animation, `GradientMesh`/`GradientGlow` for background, `Button` component, `ChromaticAberration`/`NoiseTexture` for texture. |
| **Dependency** | Needs product screenshots or a product visual (3D scene, animated illustration, or actual app screenshot). |

### TS-2: Sticky Navigation with CTA

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Every reference site has sticky top nav. Users expect persistent access to navigation and the primary CTA. Mobile hamburger menu is mandatory. |
| **Complexity** | Low (mostly exists) |
| **What to Build** | Adapt existing `Header`: Virtuna logo, nav links (Features, Pricing if applicable, Blog placeholder), "Sign in" link, "Get started" primary CTA button. Sticky with `bg-background` + subtle border-bottom on scroll. Mobile hamburger already works. |
| **Pattern from References** | Raycast: logo + nav links + Download CTA. Linear: Product/Resources/Pricing + Sign up. Resend: Features/Docs/Pricing + Get Started. All use sticky positioning. Clerk: has announcement banner above nav. |
| **Existing to Leverage** | `Header` component is 90% there -- needs rebranding and link updates. |
| **Dependency** | Logo asset for Virtuna. |

### TS-3: Social Proof Section (Logo Bar)

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Establishes credibility immediately. Every single reference site (Raycast, Linear, Resend, Clerk, Vercel) places company logos near the hero. Users scanning the page need trust signals before engaging with features. |
| **Complexity** | Low |
| **What to Build** | Horizontal row of partner/user logos below hero. "Trusted by" or "Powering insights for" label. Minimum 4-6 logos. Grayscale treatment with white filter (existing pattern in `BackersSection`). |
| **Pattern from References** | Linear: "Powering the world's best product teams" + logo row. Resend: company logos after hero. Clerk: scrolling logo carousel. Vercel: customer logos with quotes. |
| **Existing to Leverage** | `BackersSection` is structurally complete -- just needs new logo assets and copy. |
| **Dependency** | Logo assets for Virtuna's customers/partners. Can use placeholder logos initially. |

### TS-4: Feature Showcase Section

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Users need to understand what the product actually does. Every SaaS landing page has a features section, typically 3-6 features in a grid or alternating layout. |
| **Complexity** | Medium |
| **What to Build** | Two approaches: (a) Feature grid -- 3-4 cards with icon + title + description showing core capabilities (trending feed, content analysis, viral scoring, remix suggestions). (b) Feature deep-dives -- alternating left/right sections with screenshot + text for each major feature. Recommend approach (b) for primary features + (a) for secondary features. |
| **Pattern from References** | Raycast: tabbed extensions showcase + feature grid of 12 capabilities. Linear: 3 pillars (Planning, Execution, Intelligence) with deep-dive subsections. Resend: code examples + feature tiles. Clerk: interactive component previews. |
| **Existing to Leverage** | `FeaturesSection` grid pattern, `FeatureCard` component, `FadeIn`/`StaggerReveal` animations. |
| **Dependency** | Product screenshots for deep-dive variant. Feature copy/content. |

### TS-5: Product Screenshot / Visual Demo

| Aspect | Detail |
|--------|--------|
| **Why Expected** | 2026 best practice: "show don't tell." Users want to see the actual interface before signing up. Static screenshots are minimum; interactive demos and video are the current bar set by leading SaaS sites. |
| **Complexity** | Medium-High |
| **What to Build** | At minimum: high-quality product screenshots framed in browser/app chrome (use `TrafficLights` component for macOS window frame). Placed in hero and/or feature sections. Ideal: animated GIF or short video showing the trending feed or dashboard in action. |
| **Pattern from References** | Raycast: 3D animated product. Resend: dashboard screenshots + code examples. Clerk: interactive component previews. Linear: product interface mockups. 2026 trend: "screenshots are evolving into interactive components." |
| **Existing to Leverage** | `TrafficLights` for window chrome, existing Playwright extraction scripts can capture actual app screenshots, `GlassCard`/`GlassPanel` for framing. |
| **Dependency** | Actual product screenshots. The extraction/ directory has Playwright scripts that can capture these. |

### TS-6: Call-to-Action Sections (Multiple)

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Single-CTA pages lose users who scroll past the hero. Best practice: repeat CTA at strategic points. Every reference site has 2-3 CTA placements. |
| **Complexity** | Low |
| **What to Build** | (1) Hero CTA -- "Get started" primary button. (2) Mid-page CTA -- after features section, lightweight prompt to try the product. (3) Bottom CTA -- full-width section before footer with headline + CTA, similar to existing `Footer` CTA block. Consistent coral #FF7F50 accent on all primary CTAs. |
| **Pattern from References** | Raycast: hero Download + bottom "Take the short way" CTA. Resend: hero Get Started + bottom "Available today" CTA. Clerk: hero "Start building" + bottom "Start now, no strings attached." |
| **Existing to Leverage** | `Footer` already has CTA section. `Button` component with accent variant. |
| **Dependency** | None -- pure content and layout. |

### TS-7: Footer with Links and Legal

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Professional SaaS pages have structured footers with product links, company info, legal links, social media. Absence looks unfinished. |
| **Complexity** | Low (mostly exists) |
| **What to Build** | Adapt existing `Footer`: multi-column link groups (Product, Company, Legal, Social), copyright, privacy/terms links. Keep the pre-footer CTA section. |
| **Existing to Leverage** | `Footer` component is 80% there -- add column structure for links. |
| **Dependency** | None. |

### TS-8: Mobile Responsiveness

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Non-negotiable. 50%+ of traffic is mobile. Every reference site is fully responsive. |
| **Complexity** | Medium (throughout, not a separate feature) |
| **What to Build** | All sections must work at 320px-1440px+. Specific concerns: hero text sizing, feature grid stacking (2-col to 1-col), navigation hamburger (already exists), screenshot scaling, CTA button full-width on mobile. |
| **Pattern from References** | All reference sites are fully responsive. Key pattern: sections stack vertically on mobile, images scale down, text sizes reduce. |
| **Existing to Leverage** | Existing sections already have responsive breakpoints (`sm:`, `md:`, `lg:`). Motion components respect reduced motion. |
| **Dependency** | Testing across breakpoints. |

### TS-9: FAQ Section

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Reduces friction for undecided users. Addresses common objections. Present on most SaaS landing pages that target signups. |
| **Complexity** | Low (exists) |
| **What to Build** | Rewrite FAQ content for Virtuna: "What is Virtuna?", "How does trending detection work?", "Is it free?", "What platforms are supported?", "How is this different from [competitor]?". Keep existing accordion pattern. |
| **Existing to Leverage** | `FAQSection` is structurally complete with Radix accordion. Just needs content swap. |
| **Dependency** | FAQ content. |

---

## Differentiators

Features that elevate the page from "professional" to "premium Raycast-quality." Not expected, but they are what makes visitors think "this team knows what they're doing."

### D-1: Animated Hero Visual (3D or Motion)

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Immediate "wow" factor. Raycast's 3D cube, Linear's animated product shots, and Resend's dramatic backgrounds all create a sense of technical sophistication. A static hero with text feels generic in 2026. |
| **Complexity** | High |
| **What to Build** | Options ranked by impact/effort: (a) **Spline 3D scene** -- abstract data visualization or viral content network, rendered with `@splinetool/react-spline` (already installed). (b) **Three.js particle network** -- animated nodes representing trending content, using `@react-three/fiber` + `@react-three/drei` (already installed). (c) **Framer Motion composition** -- animated product screenshot with floating elements (badges, metrics, icons) that assemble on scroll. Recommend (c) for best effort/impact ratio -- it shows the actual product while adding motion. Reserve (a) or (b) for a future polish pass. |
| **Pattern from References** | Raycast: 3D interactive cube with glass effects. Clerk: animated circuit lines + meteor effects. Linear: subtle product animations. |
| **Existing to Leverage** | Three.js and Spline already in `package.json`. `GradientMesh`, `GradientGlow`, `ChromaticAberration`, `NoiseTexture` effects. |
| **Dependency** | Design direction decision. Performance budget (3D can be heavy). |

### D-2: Scroll-Triggered Section Reveals

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Makes the page feel alive. Each section appearing as you scroll creates a narrative flow rather than a static document. All reference sites use this pattern. |
| **Complexity** | Low (already built) |
| **What to Build** | Already have `FadeIn`, `FadeInUp`, `StaggerReveal`, `SlideUp` motion components. Ensure every new section uses them. Add variety: some sections fade left-to-right, others use stagger on grid items. Consider adding a `ScaleIn` variant for hero elements. |
| **Pattern from References** | All reference sites use scroll-triggered animations. Raycast: "fadeInUp". Resend: scroll-triggered code examples. Linear: smooth section transitions. |
| **Existing to Leverage** | Full motion component library. Framer Motion `whileInView` with `once: true`. Reduced motion support already built. |
| **Dependency** | None -- this is a "free" differentiator since the infrastructure exists. |

### D-3: Glass-Morphism Feature Cards

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Glass-morphism is the signature Raycast visual pattern. Using glass cards for features, testimonials, and CTAs elevates the entire page aesthetic. This is what makes it look "Raycast-quality" vs "dark template." |
| **Complexity** | Low (already built) |
| **What to Build** | Use `GlassCard` / `GlassPanel` primitives for feature cards, testimonial blocks, and product screenshot frames. Apply the Raycast glass pattern: `linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)` + `blur(5px)` + `border white/[0.06]` + `inset shadow rgba(255,255,255,0.15)`. |
| **Pattern from References** | Raycast: glass everywhere. Linear: "glass" theme mode. Resend: glassmorphism on buttons. Clerk: subtle glassmorphic effects. |
| **Existing to Leverage** | `GlassCard`, `GlassPanel`, `GlassPill` primitives. Raycast design tokens already in globals.css. |
| **Dependency** | None. |

### D-4: Product Screenshot in Browser Chrome

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Framing product screenshots in macOS-style window chrome (with traffic lights) makes them look polished and intentional rather than lazy screenshots. This is a distinctive pattern in premium dark-themed SaaS sites. |
| **Complexity** | Medium |
| **What to Build** | A `BrowserFrame` or `AppFrame` component that wraps product screenshots with: macOS traffic lights (red/yellow/green), dark title bar with URL or app name, subtle window shadow, glass border. Use for hero product visual and feature deep-dives. |
| **Pattern from References** | Raycast: product shown in native app chrome. Resend: dashboard screenshots in styled frames. Clerk: component previews in custom frames. |
| **Existing to Leverage** | `TrafficLights` component exists. `GlassPanel` for the frame. Playwright extraction scripts can generate real screenshots. |
| **Dependency** | Product screenshots (generated from extraction scripts or manual). |

### D-5: Gradient Accent Lines and Dividers

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Subtle gradient lines between sections replace boring `border-white/10` dividers with a premium, on-brand feel. Resend and Linear use gradient accents extensively. |
| **Complexity** | Low |
| **What to Build** | A `GradientDivider` component: horizontal line with coral-to-transparent gradient or white-to-transparent gradient. Use between major sections. Optional: animated glow that pulses subtly. |
| **Pattern from References** | Resend: gradient overlays on sections. Linear: subtle gradient accents. Raycast: gradient backgrounds on extension cards. |
| **Existing to Leverage** | `GradientGlow` component. Tailwind gradient utilities. |
| **Dependency** | None. |

### D-6: Animated Metrics / Counter Section

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Numbers that count up when scrolled into view are more engaging than static text. Shows traction and scale. "500K+ posts analyzed" counting up from 0 creates a moment of delight. |
| **Complexity** | Medium |
| **What to Build** | A `CountUp` component that animates a number from 0 to target when entering viewport. Use in a metrics bar: "X posts analyzed", "Y trends detected", "Z users". Framer Motion `useSpring` + `useInView` or a lightweight count-up library. |
| **Pattern from References** | Vercel: quantifiable results ("7m to 40s build times"). Clerk: "10,000 monthly active users" stat. Many SaaS pages use animated counters. |
| **Existing to Leverage** | `react-intersection-observer` already installed. Framer Motion for animation. `StatsSection` as layout reference. |
| **Dependency** | Real or plausible metrics to display. |

### D-7: Interactive Feature Tabs or Carousel

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Rather than showing all features at once, a tabbed interface lets users explore features on their terms. Raycast's tabbed extensions showcase is a standout pattern. Keeps the page clean while offering depth. |
| **Complexity** | Medium |
| **What to Build** | A tabbed section where each tab shows a different Virtuna feature with a unique screenshot/visual: Tab 1: Trending Feed, Tab 2: Content Analysis, Tab 3: Viral Scoring, Tab 4: (Future) Remix. Each tab shows a product screenshot with brief description. |
| **Pattern from References** | Raycast: tabbed extensions by category (Productivity, Engineering, Design, Writing). Resend: SDK tabs (Node.js, Python, Ruby). Clerk: categorized component previews. |
| **Existing to Leverage** | `Tabs` UI component (Radix-based). `CategoryTabs` component. `FadeIn` for tab content transitions. |
| **Dependency** | Multiple product screenshots (one per feature tab). |

### D-8: Testimonial Cards with Avatars

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Named testimonials with photos/avatars build more trust than anonymous quotes. Raycast features CEO/founder quotes. Clerk shows testimonials from Vercel, Stripe leaders. |
| **Complexity** | Low |
| **What to Build** | A testimonial grid or carousel. Each card: avatar, name, title, company, quote. Use `TestimonialCard` UI component (already exists in `src/components/ui/`). 3-6 testimonials in a responsive grid. |
| **Pattern from References** | Raycast: user testimonials with avatars. Resend: carousel of endorsements from founders/CTOs. Clerk: quotes from Vercel, Stripe, Supabase leaders. |
| **Existing to Leverage** | `TestimonialCard` component exists in UI library. `TestimonialQuote` in landing components. `StaggerReveal` for grid animation. |
| **Dependency** | Testimonial content (real or placeholder). Avatar images. |

### D-9: Subtle Background Patterns

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | A flat black background looks cheap. Premium dark SaaS sites use subtle patterns -- dot grids, noise textures, radial gradients -- that add depth without distraction. The existing codebase has a dot grid pattern referenced in the hero comment. |
| **Complexity** | Low |
| **What to Build** | Layer multiple subtle effects: (1) CSS dot grid pattern on body or hero. (2) `NoiseTexture` overlay at very low opacity (2-5%). (3) Radial gradient spotlight effect behind hero content. (4) Optional: subtle grid lines that fade at edges. |
| **Pattern from References** | Raycast: gradient backgrounds with glass effects. Resend: visible grid system + dark background. Linear: subtle gradients. Clerk: circuit line graphics. |
| **Existing to Leverage** | `NoiseTexture`, `GradientMesh`, `GradientGlow`, `ChromaticAberration` effects. Dot grid CSS already referenced in hero. |
| **Dependency** | None. |

### D-10: Announcement Banner

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | A thin banner above the nav announcing new features, launches, or milestones. Creates urgency and freshness. Clerk uses this ("Clerk raises $50m Series C"). Linear and Vercel use similar patterns. |
| **Complexity** | Low |
| **What to Build** | Thin bar above header (24-32px height): short announcement text + arrow link. Dismissible (stores state in localStorage). Coral accent background or subtle gradient. Example: "New: Trending feed is live -- Try it now" with arrow icon. |
| **Pattern from References** | Clerk: announcement banner above nav. Linear: "Now" section. Many SaaS sites use this for launches. |
| **Existing to Leverage** | Zustand store pattern for dismiss state. `Badge` component styling. |
| **Dependency** | None. |

---

## Anti-Features

Things to deliberately NOT build. Common mistakes in this domain that waste time or hurt the page.

### AF-1: Pricing Section (for now)

| Anti-Feature | Pricing page or pricing cards on the landing page |
|---|---|
| **Why Avoid** | Virtuna appears to be in early/growth stage. Premature pricing creates friction ("too expensive" or "no free tier") and limits flexibility. Better to gate behind "Get started" which leads to a signup flow. If there is no pricing model yet, showing one would be dishonest. Add pricing only when the business model is solidified. |
| **What to Do Instead** | CTA says "Get started" or "Try free" leading to signup. If asked about pricing, the FAQ can address it: "Virtuna is free during beta" or "Contact us for pricing." |

### AF-2: Excessive Animation

| Anti-Feature | Parallax scrolling, scroll-jacking, page-wide animation orchestration |
|---|---|
| **Why Avoid** | Raycast and Linear feel premium because animations are subtle and purposeful. Over-animation (parallax backgrounds, scroll-jacking that overrides native scroll, complex timeline orchestration) feels gimmicky and hurts performance. 2026 best practice: "minimal motion that adds meaning, not noise." |
| **What to Do Instead** | Stick to `FadeIn` and `StaggerReveal` for section reveals. Use `HoverScale` for interactive elements. One hero animation max (3D scene or product assembly). No scroll-jacking. No parallax. Respect `prefers-reduced-motion`. |

### AF-3: Blog / Content Hub on Landing Page

| Anti-Feature | Blog post listings, content marketing sections embedded in the landing page |
|---|---|
| **Why Avoid** | Landing pages should have one goal: convert visitors into signups. Blog content is a distraction that sends users away from the conversion path. "Removing navigation alone can double conversion rates because it reduces escape hatches." |
| **What to Do Instead** | Blog is a separate route (`/blog`). Landing page may have a single link to blog in nav or footer, but no blog content on the page itself. |

### AF-4: Complex Interactive Demo

| Anti-Feature | Full embedded product demo, interactive sandbox, or playground on the landing page |
|---|---|
| **Why Avoid** | Time and complexity sink. A broken or slow demo is worse than no demo. The product itself (behind auth) is the demo. For a landing page, static screenshots or short videos communicate the product faster than an interactive sandbox. |
| **What to Do Instead** | Product screenshots in browser chrome frames. Optional: short auto-playing video/GIF (10-15 seconds) showing the trending feed in action. If interactive demos are desired later, they should be a separate milestone. |

### AF-5: Multi-Page Landing Site

| Anti-Feature | Separate /features, /about, /team, /how-it-works pages |
|---|---|
| **Why Avoid** | Fragments the conversion funnel. Each page hop loses users. A single-page landing that scrolls through sections is the current pattern for Raycast, Linear, Resend, and Clerk. Multi-page marketing sites are for mature products with complex offerings. |
| **What to Do Instead** | Single-page landing with smooth scroll sections. In-page anchor links from nav ("Features" scrolls to features section). Separate pages only for legal (Privacy, Terms) and blog. |

### AF-6: Custom Cursor / Pointer Effects

| Anti-Feature | Custom cursor graphics, trail effects, magnetic cursor effects |
|---|---|
| **Why Avoid** | None of the reference sites (Raycast, Linear, Resend, Vercel, Clerk) use custom cursors. They are an accessibility concern (confuses users, breaks assistive technology), and they signal "designer portfolio" not "serious product." |
| **What to Do Instead** | Standard cursor. Focus on meaningful interactions: hover states, focus rings, button animations. |

### AF-7: Auto-Playing Video with Sound

| Anti-Feature | Video that plays automatically with audio |
|---|---|
| **Why Avoid** | Universally hated UX pattern. Causes users to immediately close the tab. Violates browser autoplay policies on most browsers anyway. |
| **What to Do Instead** | If using video, autoplay muted with controls visible. Short (10-15s) GIF-like loops for product demos. Let users opt into audio. |

### AF-8: Newsletter Signup on Landing Page

| Anti-Feature | Separate email capture form for a newsletter |
|---|---|
| **Why Avoid** | Competes with the primary CTA (signup/get started). Two conversion goals = neither converts well. The signup flow itself captures the email. |
| **What to Do Instead** | One CTA: "Get started" leading to signup. If a newsletter is needed, put the capture in the footer as a minimal secondary action, not a dedicated section. |

### AF-9: Chatbot / Live Chat Widget

| Anti-Feature | Intercom-style chat bubble on the landing page |
|---|---|
| **Why Avoid** | Premium dark-themed SaaS pages (Raycast, Linear, Resend) do not use chat widgets. They break the aesthetic, add visual clutter, and the typical bot experience is poor. |
| **What to Do Instead** | "Contact us" link in footer or nav. Email. If support is needed, it belongs in the authenticated app, not the landing page. |

---

## Feature Dependencies

```
Header (TS-2) ──────────────────────────── independent, build first
  |
Hero (TS-1) ─────────────────────────────── depends on: logo, product visual
  |                                          optional: D-1 animated hero, D-9 backgrounds
  |
Social Proof (TS-3) ─────────────────────── depends on: logo assets
  |
Features Grid (TS-4) ────────────────────── depends on: feature content, screenshots
  |                                          enhanced by: D-3 glass cards, D-5 gradient dividers
  |                                          optional: D-7 tabbed variant
  |
Product Screenshots (TS-5) ──────────────── depends on: running app, extraction scripts
  |                                          enhanced by: D-4 browser chrome frame
  |
Metrics (D-6) ───────────────────────────── depends on: real/plausible numbers
  |
Testimonials (D-8) ──────────────────────── depends on: testimonial content
  |
FAQ (TS-9) ──────────────────────────────── depends on: FAQ content (easy to write)
  |
CTA Sections (TS-6) ─────────────────────── independent, weave throughout
  |
Footer (TS-7) ───────────────────────────── independent, build last

Cross-cutting:
- D-2 scroll reveals: Apply to all sections (free, infrastructure exists)
- D-9 backgrounds: Apply to body/hero early
- D-10 announcement banner: Independent, add anytime
- TS-8 responsiveness: Test throughout, not a separate phase
```

---

## MVP Recommendation

For the landing page MVP, prioritize in this order:

**Phase 1 -- Structural Foundation:**
1. TS-2: Sticky nav (adapt existing `Header`)
2. TS-1: Hero section with headline + CTA + placeholder visual
3. TS-3: Social proof logos (adapt existing `BackersSection`)
4. TS-4: Features grid (adapt existing `FeaturesSection`)
5. TS-7: Footer (adapt existing `Footer`)
6. D-9: Subtle background patterns (already have components)
7. D-3: Glass-morphism cards (already have components)
8. D-2: Scroll reveals (already built -- just apply consistently)

**Phase 2 -- Content and Polish:**
1. TS-5: Product screenshots in browser chrome (D-4)
2. TS-6: Multiple CTA placements
3. TS-9: FAQ with Virtuna content
4. D-5: Gradient accent dividers
5. D-8: Testimonial cards
6. D-6: Animated metrics
7. D-10: Announcement banner

**Phase 3 -- Premium Visual (optional):**
1. D-1: Animated hero visual (3D or motion composition)
2. D-7: Interactive feature tabs

**Defer to separate milestones:**
- Pricing section: Only when business model is finalized
- Blog: Separate milestone entirely
- Interactive demo: Separate milestone if needed at all

---

## Confidence Notes

| Area | Confidence | Rationale |
|------|------------|-----------|
| Section structure | HIGH | Verified against 5 live reference sites (Raycast, Linear, Resend, Clerk, Vercel) |
| Table stakes features | HIGH | Consistent across all references and 2026 best practice sources |
| Differentiators | HIGH | Based on specific patterns observed in reference sites |
| Anti-features | HIGH | Backed by conversion research and consistent absence from reference sites |
| Existing codebase leverage | HIGH | Directly audited all relevant source files |
| Animation patterns | HIGH | Framer Motion already installed and motion components already built |
| MVP ordering | MEDIUM | Reasonable based on dependencies, but actual priority may shift based on content availability |

---

## Sources

- raycast.com -- live page analysis (2026-02-06)
- linear.app -- live page analysis (2026-02-06)
- vercel.com -- live page analysis (2026-02-06)
- resend.com -- live page analysis (2026-02-06)
- clerk.com -- live page analysis (2026-02-06)
- [SaaSFrame: 10 SaaS Landing Page Trends for 2026](https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples)
- [Fibr: 20 Best SaaS Landing Pages + 2026 Best Practices](https://fibr.ai/landing-page/saas-landing-pages)
- [DesignStudioUIUX: 10 SaaS Landing Page Design Best Practices 2026](https://www.designstudiouiux.com/blog/saas-landing-page-design/)
- [Unbounce: 26 SaaS Landing Pages](https://unbounce.com/conversion-rate-optimization/the-state-of-saas-landing-pages/)
- Existing codebase: `src/components/landing/`, `src/components/layout/`, `src/components/motion/`, `src/components/effects/`, `src/components/primitives/`, `src/components/ui/`
