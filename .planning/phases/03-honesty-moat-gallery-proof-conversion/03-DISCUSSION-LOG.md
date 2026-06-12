# Phase 3: Honesty Moat, Gallery, Proof & Conversion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 03-honesty-moat-gallery-proof-conversion
**Areas discussed:** Conversion CTA wiring, Gallery content sourcing, Comparison move framing, Social proof content
**Note:** User asked Claude to provide a reasoned recommendation on each area; all four recommendations were accepted as-is.

---

## Conversion CTA wiring (CTA-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase waitlist form | Minimal email form → server action → insert into new `waitlist` table + honeypot/validation; records the signup, feeds live count | ✓ |
| Link out to app signup | CTA routes to existing app signup; no capture at landing — likely fails "records the signup" | |
| 3rd-party form service | Email posts to external ESP; no Supabase table, external dependency | |

**User's choice:** Supabase waitlist form (recommended).
**Notes:** Supabase infra already in repo + reachable via anon key even if landing deploys separately. `waitlist` table does not exist — net-new migration + RLS + types regen required. Mirror `signup/actions.ts` server-action pattern.

---

## Gallery content sourcing (GALLERY-01/02)

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholders now, real set Phase 4 | Build 3 niche cards on real-shaped placeholder stills; final rights-cleared ≥3-niche set deferred to Phase 4 (D-L4) | ✓ |
| User supplies 3+ real stills now | Human checkpoints ×3 during the phase; ships real final assets now | |
| Reuse Phase-2 keyframe only | One still varied across cards — fails ≥3-distinct-niche intent | |

**User's choice:** Placeholders now, real set Phase 4 (recommended).
**Notes:** Ship-first (§6) + Phase 2 placeholder precedent. Stills extracted from short videos the user supplies (ffmpeg→cwebp, same as Phase 2 comedy keyframe); supplying real distinct-niche stills is a non-blocking in-phase checkpoint.

---

## Comparison move framing (TRUST-01/02)

| Option | Description | Selected |
|--------|-------------|----------|
| Generic 'virality-score tools' column | kero 2-column table: Numen vs unnamed virality-score tier (fake-precision pattern) | ✓ |
| Name real rivals | Name Viralocity/quso/etc.; sharper but disparagement/legal risk | |
| Prose-only contrast | No table; drops the kero comparison-table move | |

**User's choice:** Generic unnamed column (recommended).
**Notes:** Rival column is the one sanctioned place "% accuracy"/"virality score" strings appear — labeling the rejected category, never a Numen claim. Tasteful contrast, not a teardown.

---

## Social proof content (PROOF-01/02)

| Option | Description | Selected |
|--------|-------------|----------|
| Live count + early strip, testimonials placeholder | Live waitlist count primary; thin early strip + fuller #proof block; testimonial cards built placeholder-ready; honesty guard on low counts | ✓ |
| Testimonials-first | Lead with testimonial cards; needs real quotes now (fabrication violates honesty moat) | |
| Staged/placeholder all, real at launch | Defer ALL real proof to Phase 4; no live count this phase | |

**User's choice:** Live count + early strip, testimonials placeholder (recommended).
**Notes:** Live count fed by CTA-02 table. Honesty guard (D-09): show number only above a threshold, else qualitative anchor — never "0 creators". Credibility anchored early (strip) + fuller block in #proof.

---

## Claude's Discretion

- Component file split under `src/components/numen-landing/`.
- `waitlist` table schema beyond core columns, RLS policy shape, count-read path.
- Waitlist-count display threshold + qualitative-anchor copy.
- Comparison-table row contents + table-vs-grid (accessible + VOICE-clean).
- Gallery layout, card count beyond 3, niche labels.
- Exact section/positioning copy (must pass VOICE).
- Form spam/abuse hardening depth (honeypot is the floor).

## Deferred Ideas

- Final rights-cleared ≥3-niche gallery assets + real testimonial quotes (D-L4) → Phase 4 / launch.
- Double opt-in / confirmation email → post-MVP.
- Use cases / personas section (§4.5) → post-MVP.
- Named-rival comparison → rejected (legal/positioning).
- App deep-linking / app entry routing → not this milestone.
- Final token swap (D-L3), scroll-reveal (MOT-01), LCP/OG/a11y (PERF-01/03) → Phase 4.
