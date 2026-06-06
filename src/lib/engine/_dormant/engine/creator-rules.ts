/**
 * Creator Intelligence — shared, cache-stable rule block.
 *
 * Single source of truth in code for the distilled teachings of the three
 * researched creators (Jenny Hoyos, Ava Yuergens / @personalbrandlaunch, Alex
 * Hormozi). Derived from `.planning/research/creator-intelligence.md` (recovered
 * 2026-05-31). Injected verbatim into the cache-stable system prompts of the
 * three V3 prompt families: counterfactuals (stage 11), self-critique (stage 10),
 * and platform-fit (wave 4).
 *
 * BYTE-STABILITY CONTRACT: every export here is a build-time constant string with
 * NO interpolation of Date.now()/Math.random()/per-request data. It is safe to
 * embed via template literal in a cache-stable prefix — the result stays
 * byte-identical across requests, preserving Qwen automatic input-cache hits.
 *
 * When `creator-intelligence.md` changes, update these constants in lockstep.
 */

// =====================================================
// General encoding principles (apply to ALL three prompt families).
// =====================================================

export const CREATOR_RULES_PRINCIPLES = `## How to apply the Creator Intelligence rules
1. CITE THE CREATOR when applying a rule (e.g. "Per Jenny Hoyos, hooks ≤3s; this hook runs 4.8s"). No anonymous "best practices."
2. Use the Numerical Rules table below as a scannable checklist against the parsed video.
3. The 11 Cross-Creator Consensus rules are high-confidence DEFAULTS. The 6 Conflicts are platform/goal-dependent — resolve by context, NEVER by averaging.
4. Anchor every suggestion to a NAMED framework ("Three-Hook Stack", "But/Therefore", "Hook → Retain → Reward").
5. NEVER output generic feedback ("improve your hook"). Output rule-grounded feedback with the specific number and creator.
6. Hooks decide ~80% of performance — keep critique weight on the first 3 seconds.`;

// =====================================================
// 11 Cross-Creator Consensus rules (highest-confidence defaults).
// =====================================================

export const CREATOR_RULES_CONSENSUS = `## Cross-Creator Consensus (all 3 creators agree — highest confidence)
1. The Hook Decides Everything — first 2–3s decides 80%+ of performance (Hoyos: "3M views or 3K views"; Hormozi: hooks = ~80% of an ad).
2. Three-Second Window is Sacred — hook lands ≤3s (Hormozi ad hook ≤2s).
3. Specificity > Generality — "specific beats general every time."
4. Numbers / Concrete Outcomes in Hooks — exact figures buy credibility.
5. Assume Audio-Off / Visual-First — ~50% watch muted → burned-in text mandatory; readable on mute.
6. Low Reading Level — 5th grade or below (MrBeast = 1st grade).
7. Cut the Filler — no "hey guys, today we're going to…" / "let's get started" pace-break intros.
8. Niche / Narrow Targeting Wins Conversion — broad hook → narrow body → niche CTA.
9. Repurpose Winners — ~70% of creative = variations of top performers, not net-new.
10. Volume Discipline — sustained, defensible cadence; never zero, never spam.
11. CTA / Conversion Architecture Built In — the ending emotion decides the viewer's verdict.`;

// =====================================================
// 6 Conflicts (resolve by platform + goal, never average).
// =====================================================

export const CREATOR_RULES_CONFLICTS = `## Conflicts / Disagreements (platform- or goal-dependent — resolve by context, never average)
1. Optimal length — Hoyos 34s / Hormozi 30s ("no such thing as too long, only too boring") / Ava ≤60s → use the platform target (Shorts ~34s, TikTok 10–20s, Reels ≤60s).
2. Posting cadence — Hormozi 5–10/day (B2B education) vs Hoyos 1/week (virality) vs Ava 15–30/mo → match the creator's monetization model.
3. North-star metric — retention (reach phase) vs shareability (growth phase) vs RPM/lead conversion (monetization phase).
4. Edutainment vs Education — Hormozi says pick ONE; flag videos that straddle both.
5. Face-first vs Object-first — object-first for entertainment/discovery (Hoyos), face-first for personal-brand/expert positioning (Ava).
6. AI in the pipeline — Ava bans AI-written final scripts → frame script rewrites as DIRECTIONAL for a human writer, not drop-in copy.`;

// =====================================================
// Numerical Rules — full 40-row table, compact form (the primary checklist asset).
// =====================================================

export const CREATOR_RULES_NUMERIC = `## Numerical Rules (cite the row # + creator when used)
1. Outlier = ≥5× follower count in views (Ava)
2. Hook stack = 3 hooks in first 3s: see / read / hear (Ava)
3. 5th-grade reading level (Ava + Hoyos)
4. MrBeast readability = 1st grade (Hoyos)
5. Optimal Short = 34s (Hoyos)
6. Shorts <30s need ~100% retention (Hoyos)
7. Virality retention = 90%+ (Hoyos avg 95%+)
8. Scroll-through target = 70%+ (Hoyos avg 85%)
9. Hook ≤3s, ideally ≤1s (Hormozi ≤2s)
10. Hook + foreshadow ≤3s total (Hoyos)
11. First 5s = multiple scene changes (Hoyos)
12. Max 3 objects in frame (Hoyos)
13. Power words: banned / free / one-dollar / secret / cheap (Hoyos)
14. Idea funnel 1,000 → 100 → 25 → 10 (Hoyos)
15. Cadence 1 upload/week, Sat 10am EST (Hoyos)
16. Hooks = ~80% of ad performance (Hormozi)
17. 5× more read headline than body (Hormozi)
18. Attention window = 3s ads / first 2s short-form (Hormozi)
19. ~50% watch audio-off → burn-in text (Hormozi)
20. Clean cuts every 3–4s (Hormozi)
21. 30s short target (Hormozi)
22. "No such thing as too long, only too boring" (Hormozi)
23. Value:Ask ratio — short 98:2, long 3:1 (Hormozi)
24. Cadence — short 5–10/day, long 1–2/day, min 1/week (Hormozi)
25. 18 months min to build momentum (Hormozi)
26. Cross-platform reliability 6+ months (Hormozi)
27. Ad math: 6 angles × 5 hooks × 2 = 60 ads (Hormozi)
28. 70/20/10 creative allocation: variations / significant variants / new angles (Hormozi)
29. Daily Twitter mix: 1–3 attention + 1 nurture + 1 story (Hormozi)
30. Rule of 100: 100 actions/day for 100 days (Hormozi)
31. Ava DFY tiers: 15/20/30 videos/mo + 7/10/15 stories (Ava)
32. Hook trim: −1s dead time → retention 83% → 88% (Hoyos)
33. 7.9M views → 13K leads → ~$2M annualized (Ava)
34. $1 Fast Food ≈12M/vid; Kitchen Fundraising ≈15M; Burger comparison = 45M (Hoyos)
35. Shareability: 20% shares-to-view + 92% growth (Hoyos)
36. Acquisition.com ≈$70k/mo content; 35K pieces in 40mo → 7.8M followers (Hormozi)
37. Format: ≤60s, 9:16 vertical (Ava)
38. Ava Stories ≈500 clicks/day (Ava)
39. Ava research 10–12 hrs/client/mo; 20 min/day scroll (Ava)
40. Hoyos avg 10M views/Short; 600M+/yr (Hoyos)`;

// =====================================================
// Composed full block — for prompt families that want everything in one paste.
// Order: principles → consensus → conflicts → numeric (matches the reference doc).
// =====================================================

export const CREATOR_RULES_BLOCK = `${CREATOR_RULES_PRINCIPLES}

${CREATOR_RULES_CONSENSUS}

${CREATOR_RULES_CONFLICTS}

${CREATOR_RULES_NUMERIC}`;

// NOTE: a 19-item Anti-Patterns checklist also lives in creator-intelligence.md.
// It is intentionally NOT exported here: the only stage that could act on it is a
// content critic that ingests the parsed hook/frames/transcript — which the engine
// does not yet have. stage10 grades score-consistency (no content input); stage11
// already covers ~80% of those patterns via CREATOR_RULES_BLOCK. Wire it in WITH a
// real content-critique stage, sourcing from the reference doc — not before.
