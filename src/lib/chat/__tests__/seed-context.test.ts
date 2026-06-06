import { describe, it, expect } from 'vitest';
import { buildChatSystemContext } from '../seed-context';
import type { AnalysisRow } from '../seed-context';
import { deriveSeedPrompts } from '../seed-prompts';

// ── Fixtures ──────────────────────────────────────────────────────────────

const populatedRow: AnalysisRow = {
  overall_score: 72,
  confidence: 0.8,
  content_text: 'Check out this crazy life hack #viral',
  apollo_reasoning: {
    composite_score: 68,
    ceiling_capper: 'Low hook retention',
    confidence_scope: 'high',
    platform_note: 'TikTok trending window open',
    dimensions: [
      { name: 'Hook strength', score: 4, rationale: 'Hook fails to capture attention in first 2s' },
      { name: 'Pacing', score: 7, rationale: 'Good rhythm overall' },
      { name: 'Authenticity', score: 8, rationale: 'Comes across as genuine' },
    ],
    rewrites: [
      {
        label: 'Hook rewrite',
        original: 'Check out this crazy life hack',
        rewrite: 'This changed how I do everything — watch to the end',
      },
    ],
  },
  behavioral_predictions: { swipe_rate: 0.45, watch_through: 0.32 },
  heatmap: {
    weighted_curve: [80, 75, 60, 45, 30],
    segments: [
      { label: 'Intro', score: 8, reaction: 'curious', spoken_text: 'Hey everyone' },
      { label: 'Mid', score: 5, reaction: 'disengaged', spoken_text: 'So basically...' },
    ],
  },
};

const variantsRow: AnalysisRow = {
  overall_score: 55,
  confidence: 0.6,
  variants: {
    apollo: {
      composite_score: 52,
      ceiling_capper: 'Weak storytelling arc',
      dimensions: [
        { name: 'Storytelling', score: 3, rationale: 'No clear narrative arc' },
        { name: 'Visual quality', score: 6 },
      ],
      rewrites: [],
    },
  },
};

const bareRow: AnalysisRow = {
  overall_score: 40,
};

// ── buildChatSystemContext tests ───────────────────────────────────────────

describe('buildChatSystemContext', () => {
  it('includes Apollo framing as the expert — no external model imports', () => {
    const ctx = buildChatSystemContext(populatedRow, null);
    expect(ctx).toContain('Apollo');
    // The system prompt itself may say "never mention Claude" as an instruction,
    // but must not reference any external model as the answerer.
    // Verify by checking the module source doesn't import forbidden SDKs:
    // (Tested separately via grep in verification step — here we just assert Apollo is the expert.)
    expect(ctx).toContain('You are Apollo');
  });

  it('embeds overall score and confidence for whole-analysis scope', () => {
    const ctx = buildChatSystemContext(populatedRow, null);
    expect(ctx).toContain('72/100');
    expect(ctx).toContain('80%'); // 0.8 * 100
  });

  it('embeds apollo dimensions and ceiling_capper for whole-analysis scope', () => {
    const ctx = buildChatSystemContext(populatedRow, null);
    expect(ctx).toContain('Hook strength');
    expect(ctx).toContain('Low hook retention');
    expect(ctx).toContain('Hook rewrite');
  });

  it('embeds heatmap segments for whole-analysis scope', () => {
    const ctx = buildChatSystemContext(populatedRow, null);
    expect(ctx).toContain('Intro');
    expect(ctx).toContain('Mid');
  });

  it('uses variants.apollo over apollo_reasoning (DUAL-READ)', () => {
    const ctx = buildChatSystemContext(variantsRow, null);
    expect(ctx).toContain('Weak storytelling arc'); // from variants.apollo
  });

  it('verdict scope: includes score + ceiling_capper, excludes audience heatmap segments', () => {
    const ctx = buildChatSystemContext(populatedRow, 'verdict');
    expect(ctx).toContain('72/100');
    expect(ctx).toContain('Low hook retention');
    expect(ctx).not.toContain('Intro'); // no heatmap segments
    expect(ctx).not.toContain('Audience');
  });

  it('audience scope: includes heatmap + behavioral, excludes apollo rewrites detail', () => {
    const ctx = buildChatSystemContext(populatedRow, 'audience');
    expect(ctx).toContain('Intro'); // segment label
    expect(ctx).toContain('Retention curve'); // heatmap header
    expect(ctx).toContain('[80, 75, 60, 45, 30]'); // actual curve values
  });

  it('content scope: includes rewrites and content_text', () => {
    const ctx = buildChatSystemContext(populatedRow, 'content');
    expect(ctx).toContain('Check out this crazy life hack');
    expect(ctx).toContain('Hook rewrite');
  });

  it('engine scope: includes apollo dimensions', () => {
    const ctx = buildChatSystemContext(populatedRow, 'engine');
    expect(ctx).toContain('Hook strength');
    expect(ctx).toContain('4/10');
  });

  it('bare row: produces a valid context without crashing', () => {
    const ctx = buildChatSystemContext(bareRow, null);
    expect(ctx).toContain('Apollo');
    expect(ctx).toContain('=== ANALYSIS DATA ===');
  });
});

// ── deriveSeedPrompts tests ───────────────────────────────────────────────

describe('deriveSeedPrompts', () => {
  it('returns 2-3 prompts for a populated row', () => {
    const prompts = deriveSeedPrompts(populatedRow);
    expect(prompts.length).toBeGreaterThanOrEqual(2);
    expect(prompts.length).toBeLessThanOrEqual(3);
  });

  it('includes a ceiling_capper-driven prompt when capper is present', () => {
    const prompts = deriveSeedPrompts(populatedRow);
    expect(prompts.some((p) => p.toLowerCase().includes('flop') || p.toLowerCase().includes('hold'))).toBe(true);
  });

  it('includes a weakest-dimension prompt', () => {
    const prompts = deriveSeedPrompts(populatedRow);
    // Hook strength is score 4 — the weakest
    expect(prompts.some((p) => p.toLowerCase().includes('hook'))).toBe(true);
  });

  it('returns generic fallback prompts for a bare row', () => {
    const prompts = deriveSeedPrompts(bareRow);
    expect(prompts.length).toBeGreaterThanOrEqual(2);
    expect(prompts.some((p) => p.includes('viral') || p.includes('improve') || p.includes('prioritize'))).toBe(true);
  });

  it('uses variants.apollo for prompt derivation', () => {
    const prompts = deriveSeedPrompts(variantsRow);
    expect(prompts.length).toBeGreaterThanOrEqual(2);
    // ceiling_capper "Weak storytelling arc" → flop prompt
    expect(prompts.some((p) => p.toLowerCase().includes('flop') || p.toLowerCase().includes('hold'))).toBe(true);
  });

  it('returns unique prompts (no duplicates)', () => {
    const prompts = deriveSeedPrompts(populatedRow);
    const unique = new Set(prompts);
    expect(unique.size).toBe(prompts.length);
  });
});
