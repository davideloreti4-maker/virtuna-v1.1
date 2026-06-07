import type { PredictionResult } from '@/lib/engine/types';

// Base fixture — complete happy-path result. Other fixtures spread + override.
const base: PredictionResult = {
  // Core prediction
  overall_score: 78,
  confidence: 0.82,
  confidence_label: 'HIGH',

  // Behavioral predictions
  behavioral_predictions: {
    completion_pct: 62,
    completion_percentile: '74th',
    share_pct: 8,
    share_percentile: '80th',
    comment_pct: 5,
    comment_percentile: '70th',
    save_pct: 4,
    save_percentile: '68th',
  },

  // Feature vector
  feature_vector: {
    hookScore: 8,
    completionPull: 7,
    rewatchPotential: 6,
    shareTrigger: 7,
    emotionalCharge: 6,
    visualProductionQuality: 8,
    hookVisualImpact: 8,
    pacingScore: 7,
    transitionQuality: 6,
    hookEffectiveness: 8,
    retentionStrength: 7,
    shareability: 7,
    commentProvocation: 5,
    saveWorthiness: 6,
    trendAlignment: 7,
    originality: 6,
    ruleScore: 72,
    trendScore: 68,
    audioTrendingMatch: null,
    captionScore: 7,
    hashtagRelevance: 0.8,
    hashtagCount: 4,
    durationSeconds: 15,
    hasVideo: true,
  },

  // Reasoning
  reasoning:
    'Strong hook in first 2 seconds, clear narrative arc, niche-aligned visual style. **Hook works** because the visual stop power is high (8.2/10). Could be improved by tightening the text overlay timing.',
  warnings: [],

  // Predicted engagement
  predicted_engagement: {
    likes: 4200,
    comments: 310,
    shares: 580,
    saves: 420,
    views: 52000,
  },

  // Factors
  factors: [
    { id: 'visual-hook', name: 'Visual hook', score: 8, max_score: 10, rationale: 'Strong cold open', improvement_tip: 'Hold the frame 0.5s longer' },
    { id: 'audio-quality', name: 'Audio quality', score: 7, max_score: 10, rationale: 'Clear voice, good music', improvement_tip: 'Reduce music in dialog' },
    { id: 'pacing', name: 'Pacing', score: 6, max_score: 10, rationale: 'Slight drag at 0:18', improvement_tip: 'Cut 2s from mid-section' },
    { id: 'cta', name: 'CTA', score: 3, max_score: 10, rationale: 'Weak end CTA', improvement_tip: 'Add explicit follow request' },
  ],

  // Suggestions
  suggestions: [
    { id: 'sug-1', text: 'Add explicit CTA at the end', priority: 'high', category: 'engagement' },
    { id: 'sug-2', text: 'Tighten text overlay timing', priority: 'medium', category: 'hook' },
  ],

  // Scoring breakdown
  rule_score: 72,
  trend_score: 68,
  gemini_score: 76,
  behavioral_score: 80,
  ml_score: 74,

  // Anti-virality
  anti_virality_gated: false,
  analysis_unavailable: false,

  // Hook decomposition
  hook_decomposition: {
    visual_stop_power: 8.2,
    audio_hook_quality: 6.5,
    text_overlay_score: 5.1,
    first_words_speech_score: 7.8,
    weakest_modality: 'text_overlay_score',
    visual_audio_coherence: 7.4,
    cognitive_load: 4, // raw value; UI inverts to 'Med'
  },

  // Emotion arc
  emotion_arc: [
    { timestamp_ms: 0, intensity_0_1: 0.3, label: 'low' },
    { timestamp_ms: 2000, intensity_0_1: 0.7, label: 'high' },
    { timestamp_ms: 5000, intensity_0_1: 0.5, label: 'mid' },
    { timestamp_ms: 8000, intensity_0_1: 0.85, label: 'high' },
    { timestamp_ms: 12000, intensity_0_1: 0.4, label: 'low' },
  ],

  // Counterfactuals
  counterfactuals: {
    band: 'mid',
    suggestions: [
      { type: 'fix', headline: 'Tighten text overlay', detail: 'Move the first card up to 0:01.', timestamp_ms: 1000, signal_anchor: 'hook' },
      { type: 'stretch', headline: 'Add CTA card', detail: 'Final 0:02 should ask for follow.', timestamp_ms: 14000, signal_anchor: 'cta' },
      { type: 'reinforcement', headline: 'Keep the hook frame', detail: 'Visual stop power is your asset.', timestamp_ms: 0, signal_anchor: 'hook' },
    ],
  },

  // Retrieval evidence
  retrieval_score: 0.85,
  retrieval_evidence: [
    {
      source_pool: 'scraped_videos',
      source_id: '00000000-0000-0000-0000-000000000001',
      similarity_score: 0.92,
      video_url: 'https://tiktok.com/@a/video/1',
      creator_handle: 'creator_a',
      caption_snippet: 'similar hook…',
      views: 124000,
      likes: 8400,
      shares: 2100,
      comments: 740,
      saves: null,
      hashtags: ['#hook', '#fyp'],
      posted_at: '2025-11-01T12:00:00Z',
      bucket_label: 'viral',
      bucket_source: 'corpus',
      relaxed_to: null,
    },
    {
      source_pool: 'scraped_videos',
      source_id: '00000000-0000-0000-0000-000000000002',
      similarity_score: 0.88,
      video_url: 'https://tiktok.com/@b/video/2',
      creator_handle: 'creator_b',
      caption_snippet: 'similar arc…',
      views: 89000,
      likes: 5200,
      shares: 1400,
      comments: 430,
      saves: null,
      hashtags: ['#viral', '#trend'],
      posted_at: '2025-11-05T09:00:00Z',
      bucket_label: 'viral',
      bucket_source: 'corpus',
      relaxed_to: null,
    },
    {
      source_pool: 'scraped_videos',
      source_id: '00000000-0000-0000-0000-000000000003',
      similarity_score: 0.84,
      video_url: 'https://tiktok.com/@c/video/3',
      creator_handle: 'creator_c',
      caption_snippet: 'similar style…',
      views: 56000,
      likes: 3100,
      shares: 820,
      comments: 290,
      saves: null,
      hashtags: ['#content'],
      posted_at: '2025-10-28T15:00:00Z',
      bucket_label: 'average',
      bucket_source: 'derived',
      relaxed_to: 'niche+platform',
    },
    {
      source_pool: 'scraped_videos',
      source_id: '00000000-0000-0000-0000-000000000004',
      similarity_score: 0.81,
      video_url: 'https://tiktok.com/@d/video/4',
      creator_handle: 'creator_d',
      caption_snippet: 'similar pacing…',
      views: 41000,
      likes: 2200,
      shares: 540,
      comments: 180,
      saves: null,
      hashtags: ['#pacing'],
      posted_at: '2025-10-20T11:00:00Z',
      bucket_label: 'average',
      bucket_source: 'derived',
      relaxed_to: null,
    },
    {
      source_pool: 'scraped_videos',
      source_id: '00000000-0000-0000-0000-000000000005',
      similarity_score: 0.78,
      video_url: 'https://tiktok.com/@e/video/5',
      creator_handle: 'creator_e',
      caption_snippet: 'similar CTA…',
      views: 38000,
      likes: 1900,
      shares: 410,
      comments: 140,
      saves: null,
      hashtags: ['#cta'],
      posted_at: '2025-10-15T08:00:00Z',
      bucket_label: 'average',
      bucket_source: 'derived',
      relaxed_to: 'niche_only',
    },
  ],

  // Signal availability
  signal_availability: {
    retrieval: true,
    behavioral: true,
    gemini: true,
    ml: true,
    rules: true,
    trends: true,
    content_type: true,
    niche: false,
    gemini_hook: true,
    gemini_body: true,
    gemini_cta: true,
    personas: true,
  },

  // Persona data (required fields)
  persona_behavioral_aggregate: null,
  persona_simulation_results: [],

  // Meta
  latency_ms: 4200,
  cost_cents: 3.2,
  engine_version: '3.0.0',
  gemini_model: 'gemini-2.0-flash',
  deepseek_model: 'deepseek-r1',
  input_mode: 'tiktok_url',
  has_video: true,

  // Heatmap (not needed for Phase 5 tests)
  heatmap: null,

  // Score weights — Plan 03-04 (D-04): apollo replaces gemini as live blend term
  score_weights: {
    behavioral: 0.33,
    apollo: 0.24,  // Plan 03-04: live blend term (replaces gemini)
    gemini: 0,     // RETIRED (D-04) — kept for back-compat
    ml: 0.14,
    rules: 0.14,
    trends: 0.10,
    retrieval: 0.05,
  },
} as PredictionResult;

export const fixtures = {
  complete: base,
  antiVirality: {
    ...base,
    anti_virality_gated: true,
    anti_virality_reason: 'confidence' as const,
    dropoff_segment_indices: [3, 5, 7],
    warnings: ['Hook lands but momentum stalls at 0:08'],
    counterfactuals: {
      band: 'low' as const,
      suggestions: [
        { type: 'fix' as const, headline: 'Re-hook at 0:08', detail: 'Add a pattern interrupt at the stall point.', timestamp_ms: 8000, signal_anchor: 'retention' },
        { type: 'fix' as const, headline: 'Tighten text overlay', detail: 'Move the first card up to 0:01.', timestamp_ms: 1000, signal_anchor: 'hook' },
        { type: 'fix' as const, headline: 'Add strong CTA', detail: 'Final 0:02 should ask for follow.', timestamp_ms: 14000, signal_anchor: 'cta' },
      ],
    },
  } satisfies PredictionResult,
  lowConfidence: {
    ...base,
    confidence: 0.3,
    confidence_label: 'LOW' as const,
  } satisfies PredictionResult,
  emptyHookDecomp: {
    ...base,
    hook_decomposition: null,
  } satisfies PredictionResult,
  emptyEmotionArc: {
    ...base,
    emotion_arc: null,
  } satisfies PredictionResult,
  emptyRetrievalEvidence: {
    ...base,
    retrieval_evidence: [],
    retrieval_score: null,
    signal_availability: { ...base.signal_availability, retrieval: false },
  } satisfies PredictionResult,
  historyEmpty: { ...base } satisfies PredictionResult,  // comparisons endpoint returns history: []
  historyFull: { ...base } satisfies PredictionResult,   // comparisons endpoint returns history.length === 10
};

export const comparisonsFixtures = {
  empty: { history: [] as number[], niche: null as null | { median: number; p75: number; count: number } },
  partial: { history: [72, 68], niche: null },
  full: {
    history: [72, 68, 74, 65, 80, 71, 69, 77, 73, 70],
    niche: null,
  },
  fullWithNiche: {
    history: [72, 68, 74, 65, 80, 71, 69, 77, 73, 70],
    niche: { median: 68, p75: 78, count: 234 },
  },
};
