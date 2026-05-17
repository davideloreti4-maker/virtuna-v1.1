# Milestone: Engine Foundation

**Branch:** `milestone/engine-foundation`
**Worktree:** `~/virtuna-engine-foundation/`
**Started:** 2026-05-11
**Status:** Active

## Purpose

Build, train, and validate the Virtuna content intelligence engine. Ship measurable accuracy improvements **before** investing in polished UX (which ships in the follow-up milestone "Intelligence Surface").

## Out of Scope (Belongs to "Intelligence Surface" Milestone)

- Live audience simulation visualization (SSE-driven)
- Polished result card (retention curve, persona breakdown panels, hook decomp UI, etc.)
- Mobile-first analysis route
- Concept mode (text-only "predict my hook idea")
- A/B variant generation UI
- Comparative baseline display
- Watermark detection UI
- Hook archetype library
- Trend velocity / lifecycle prediction
- Cross-platform repurposing analysis

These ship in the next milestone, on top of a validated engine.

## Stack Decisions (locked 2026-05-17)

After exploring an on-device Gemma 4 path for free tier, **the milestone stays cloud-only** with a capped free tier. On-device was rejected because:
- Adds an entire engineering track (Capacitor + MLX runtime + native Swift bridge + 3GB model download)
- Introduces a second quality baseline to measure and calibrate
- Locks free tier to iOS 26+ users (loses iOS 17/18 cohort)
- ~30-40% milestone scope overhead for a "privacy moat" the target market (TikTok creators) doesn't value

### Engine stack (free + Pro share the same pipeline)

| Stage | Model | Promo cost | Post-2026-05-31 cost |
|-------|-------|------------|----------------------|
| Wave 0 niche/content | Gemini 3 Flash | ~$0.001 | same |
| Video segmentation + hook decomp | Gemini 3 Flash (native video) | ~$0.015-0.025 | same |
| Audio analysis | Gemini 3 Flash (audio channel) | ~$0.005 | same |
| 10 personas (Wave 3) | DeepSeek V4 Flash, parallel | ~$0.02 | ~$0.08 |
| Self-critique + counterfactuals | DeepSeek V4 Flash | ~$0.005-0.01 | ~$0.02-0.04 |
| Aggregator + retrieval | local + pgvector | ~$0.001 | same |
| **Total per 30s analysis** | | **~$0.05** | **~$0.15** |

**Target cost cap:** $0.15/analysis post-promo. If DeepSeek V4 Flash post-promo pricing pushes us over, fall back to fewer personas (5 instead of 10) or batch persona calls.

### Tier structure

| Tier | Stack | Quota | Latency cap | Price |
|------|-------|-------|-------------|-------|
| **Free** | Same as Pro | 5 analyses/month, recurring | 60s | $0 (recurring) |
| **Pro** | Full engine | Unlimited | 60s | Existing Pro pricing (Whop) |
| **Ultra** *(M3, deferred)* | Gemini 3.1 Pro + DeepSeek V4 Pro | Unlimited | 30s | TBD |

Free tier enforcement: Supabase `creator_profiles.tier` + monthly quota counter + Whop upgrade flow at quota exhaustion. Email verification mandatory to limit burner-account abuse.

### Optimization priority (in order)

1. **Quality floor:** v3 must beat v2.1 baseline on locked corpus (`macro_f1 ≥ 0.338`)
2. **Cost cap:** Pro/Free under $0.15/analysis post-promo
3. **Latency cap:** under 60s end-to-end
4. **Optimize within caps for each tier**

### Privacy posture (replaces lost "on-device" story)

- Uploaded videos deleted within 24h of analysis
- No training on user uploads (state in ToS)
- Anonymized cloud calls (no user_id sent to Gemini/DeepSeek)
- GDPR/CCPA-clean DPA in place before launch

### Deferred to M1.5 (post-M1 fast-follow)

- **iOS Capacitor wrapper** — wrap existing Next.js webapp as a Capacitor iOS app. ~1 week of work since no native LLM integration is needed. Submit to App Store.

### Deferred to M3

- **Ultra tier** with Gemini 3.1 Pro + DeepSeek V4 Pro for top-end analysis
- **Display-paywall option** (unlimited free with gated insights, vs. usage cap)
- **Ad-supported free tier extension**

## Identity

This file is immutable. It signals to all sessions opened in this worktree that they are scoped to the Engine Foundation milestone, regardless of which branch is checked out.
