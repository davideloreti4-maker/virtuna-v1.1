# Discussion Context: Viral Predictor Results Card Structure

**Purpose:** Prepare context for a `/gsd:discuss-phase` session focused on redesigning the viral predictor results card — the breakdown/analysis shown to users after running a prediction.

**Status:** Awaiting discussion session

---

## Background

The viral predictor currently shows results after analyzing content. This same results format will be reused in the Trending Page's "Analyze" action. Before building either, we need to nail the breakdown structure.

## Current State

The existing results view (from v1.1 clone) includes:
- Impact score
- Attention metrics
- Variants
- Insights
- Themes

**Location:** `src/components/app/results/` (mocked data)

## What Needs Research

### 1. Breakdown Structure

What makes a viral video breakdown useful and actionable?

**Reference:** @personalbrandlaunch on Instagram — reportedly has a 7-step breakdown format. Research this account and similar viral analysis frameworks.

**Questions to answer:**
- What are the key components of a viral video breakdown?
- How many steps/sections is optimal (7? fewer? more?)
- What information drives action vs. is just "nice to know"?
- How do other tools (Vidiq, TubeBuddy, etc.) present viral analysis?

### 2. Scoring System

How should the viral score be calculated and presented?

**Questions to answer:**
- Single score vs. multi-dimensional scoring?
- What factors contribute to virality that can be detected/measured?
- How to make the score feel credible and useful?
- Should score include confidence level?

### 3. Visual Presentation

How to present the breakdown for maximum clarity and impact?

**Questions to answer:**
- Card layout vs. expandable sections vs. tabs?
- How much information to show at once vs. progressive disclosure?
- Visual hierarchy — what's most important?
- Mobile-first considerations

### 4. Actionability

How to make the breakdown drive user action?

**Questions to answer:**
- What insights lead to "I know what to do now"?
- Connection to Remix feature — how does analysis feed into creation?
- Save/export functionality?

---

## Research Sources to Check

1. **@personalbrandlaunch** (Instagram) — 7-step breakdown format
2. **Vidiq** — YouTube viral analysis UI
3. **TubeBuddy** — Video score presentation
4. **Sprout Social** — Social media analytics cards
5. **Buffer** — Content performance breakdown
6. **Hootsuite** — Analytics presentation patterns

---

## Expected Output

After discussion session, should have:
1. Defined breakdown structure (what sections, what info)
2. Scoring approach (calculation, presentation)
3. UI wireframe direction (layout, hierarchy)
4. Requirements ready for implementation phase

---

## How to Use This File

Run: `/gsd:discuss-phase` and reference this file for context, or start a fresh conversation with:

```
I want to design the viral predictor results card structure.
Context: .planning/DISCUSS-CONTEXT-viral-predictor-results.md
```

---

*Created: 2026-02-02*
*Status: Awaiting discussion*
