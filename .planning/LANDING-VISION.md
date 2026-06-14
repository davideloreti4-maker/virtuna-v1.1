# Landing v2 — Vision & Input Brief

> Seed document for `/gsd-new-milestone`. Captures the human's intent verbatim plus
> product context pulled from the repo. **Design specifics are deliberately left
> open** (see §7) — resolve them in the milestone discussion, don't assume.

---

## 1. The ask (verbatim intent)

> "Build a new landing page from scratch — all the other attempts weren't good.
> A **refined** landing page for **Numen**. Use shadcn, Radix, Magic UI, Aceternity,
> motion / Framer Motion and more. References: **sandcastles.ai, Linear, Raycast,
> OpusClip**. Everything displaying our platform can be a **placeholder** so I can
> add pictures and videos later. Opus 4.8 max effort throughout (incl. cc)."

**Bar:** refined, premium, considered. Not flashy-for-its-own-sake. The previous five
attempts failed the taste bar — this one clears it.

## 2. What Numen is (so copy/visuals are accurate)

Numen (formerly Virtuna; brand: **Numen Machines**) is an **AI virality instrument for
short-form creators**. Core loop: a creator pastes a **TikTok** URL → Numen returns a
**score-forward "reading"** predicting how the video will perform *before it's posted* —
an **audience simulation** (a synthetic crowd reacting), **watch-through %**, and a
breakdown across **Hook · Retention (where viewers drop) · Shareability**. It's a
sensor + interpreter, not a content generator.

**Positioning one-liner (draft, refine in discussion):**
*"Know if it'll pop — before you post."* Predict TikTok performance with a simulated
audience.

## 3. Why from scratch

Five prior landing attempts are **abandoned** — reference only, do not revive their code:
`milestone/landing` · `milestone/landing-page` · `milestone/landing-page-redesign` ·
`milestone/landing-linear-clone` · `milestone/numen-landing`. Start clean off `main`.

## 4. References — what to steal from each

| Reference | What to extract |
|-----------|-----------------|
| **Linear** (linear.app) | Typographic restraint, generous whitespace, dark-theme mastery, subtle gradient glows, crisp product frames, snappy "no fluff" feel. The craft benchmark. |
| **Raycast** (raycast.com) | Dark/minimal, 6% borders + clean cards, product-led hero, feature/store grid, monospace accents. Already our design language (`BRAND-BIBLE.md`). |
| **sandcastles.ai** | A **signature moment** — one immersive, distinctive hero/scroll interaction that makes the page memorable. Our "wow." |
| **OpusClip** (opus.pro) | Category structure: creator-tool positioning, "paste a link → magic" flow, before/after video demos, creator social proof + logo wall, virality framing. **Closest competitor in shape.** |

**Synthesis:** OpusClip's *structure & positioning* × Linear/Raycast's *craft & restraint*
× one sandcastles-grade *signature motion moment*.

## 5. Placeholder strategy (explicit)

Everything that shows the actual product is a **labelled placeholder slot** the human
fills later — build the frame, not the asset:
- Hero product shot / demo video → placeholder with correct aspect ratio + caption.
- "Reading" / audience-sim screenshots → placeholder cards.
- Before/after or walkthrough video → placeholder `<video>` poster slot.
- Creator testimonials / logo wall → placeholder avatars + logos.
Make slots obvious, consistently styled, and trivially swappable (one prop / one file).

## 6. Tech & brand carry-over

- **Stack:** Next.js 15 (App Router), TypeScript, Tailwind v4. Server components by
  default, client only where interactive (motion).
- **Libs permitted:** shadcn/ui, Radix, Magic UI, Aceternity UI, motion (Framer Motion).
  Pull components in deliberately — don't bloat; keep the bundle and the taste tight.
- **Brand (flat-warm — ported from `~/virtuna-numen-rework`, SUPERSEDES the old `main`
  Raycast brand):** neutral charcoal surfaces (`#262624`), cream text (`#ece7de`, never
  pure white), terracotta-clay coral accent (`~#d97757`, matured from `#FF7F50`), Inter for
  UI + **Newsreader serif for voice moments**, flat-matte (no glass/glow; depth = tone-step +
  hairline 6% borders, 12px radius), "Stele" logo + "Numen" wordmark (`numen-logo.tsx`).
  _Updated 2026-06-14 per Phase 1 discussion — `BRAND-BIBLE.md` is stale; SSOT is
  `~/virtuna-numen-rework/src/app/globals.css` + `.planning/phases/01-foundation-shell/01-CONTEXT.md`._
- **Known Tailwind v4 gotchas** (see root `CLAUDE.md`): dark oklch inaccuracy → use hex
  for very dark tokens; Lightning CSS strips `backdrop-filter` → apply via inline style.

## 7. Open questions — resolve in `/gsd-new-milestone` discussion (do NOT pre-decide)

1. **Page sections & order** — hero, social proof, how-it-works, feature deep-dives,
   the signature moment, pricing/waitlist, FAQ, footer? Which make the cut for v1?
2. **Primary CTA** — waitlist capture, "try it free," or "paste a link" interactive demo?
   Does the landing need any live backend (waitlist table) or is it static + placeholders?
3. **Dark only, or light/dark?** (Refs are mostly dark; brand is dark.)
4. **Signature moment** — what *is* the sandcastles-grade hero interaction for Numen?
   (e.g. an animated audience-simulation crowd, a score gauge that fills, a fold/breakout viz.)
5. **Scope of v1** — single long-scroll page, or multi-route (pricing, about)?
6. **Copy voice** — confident/technical (Linear) vs creator-friendly/punchy (OpusClip)?
7. **Routing** — does this live at `/` replacing current home, or a standalone marketing route?

## 8. Guardrails

- Marketing surface only — no engine/app/Supabase product logic beyond a CTA/waitlist.
- Refined over flashy. Every animation must earn its place (calm, purposeful motion).
- Mobile-first responsive; performance-conscious (lazy-load heavy motion/video).
- Accessibility: real semantics, reduced-motion fallbacks, keyboard-navigable.
