-- Engine Eval Harness Output Schema (Phase 1, D-14..20)
-- System-wide table (no user_id) — eval harness service-role inserts.
-- Mirrors outcomes/analysis_results from content_intelligence.sql.
-- One row per eval run. Tagged with (corpus_version, engine_version) per D-12 + D-21.
-- failure_cases JSONB column holds top-10 mispredictions (per Claude's discretion §C.5 —
-- single-column JSONB chosen over separate table for simplicity; 10 cases × ~200 bytes
-- well within JSONB limits).

-- =====================================================
-- SHARED TRIGGER FUNCTION (idempotent reuse)
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- BENCHMARK RESULTS (D-14..20, EVAL-06)
-- =====================================================
CREATE TABLE benchmark_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Version tagging (D-12, D-21) — corpus_version is logical FK to training_corpus.corpus_version
  corpus_version TEXT NOT NULL,
  engine_version TEXT NOT NULL,                               -- "2.1.0" for baseline (D-21)

  -- Primary gate metric (D-14)
  macro_f1 NUMERIC(5,4) NOT NULL,
  per_niche_f1 JSONB NOT NULL,                                -- D-15: { "beauty": 0.42, ... }

  -- Secondary metrics (D-16)
  ece NUMERIC(5,4),
  per_class_metrics JSONB DEFAULT '{}',                       -- precision/recall per bucket
  signal_contribution JSONB DEFAULT '{}',                     -- EVAL-03 LOO per signal
  spearman_within_niche JSONB DEFAULT '{}',                   -- per-niche rank correlation
  mae_engagement_rate NUMERIC(8,6),                           -- EVAL-02 continuous error

  -- Cost / latency
  cost_cents_avg NUMERIC(10,4),                               -- BENCH-03 target ≤ 0.075
  cost_cents_total NUMERIC(12,4),                             -- audit trail for $50 cap
  latency_p50 INTEGER,
  latency_p95 INTEGER,
  latency_p99 INTEGER,
  stage_timings JSONB DEFAULT '{}',                           -- per-stage p50/p95/p99
  drift_metrics JSONB DEFAULT '{}',                           -- bucket-distribution drift vs prior version
  failure_cases JSONB DEFAULT '[]',                           -- top-10 mispredictions

  -- Bucket-specific metrics (D-16)
  viral_recall NUMERIC(5,4),
  under_precision NUMERIC(5,4),

  -- Run context
  notes TEXT,
  run_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ                                      -- soft delete (mirror outcomes:137)
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_benchmark_results_corpus_engine ON benchmark_results(corpus_version, engine_version);
CREATE INDEX idx_benchmark_results_run_at ON benchmark_results(run_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (system-wide, service-role only)
-- =====================================================
ALTER TABLE benchmark_results ENABLE ROW LEVEL SECURITY;
-- System-wide: service role bypasses RLS. No user-scoped policies.

-- =====================================================
-- TRIGGER
-- =====================================================
CREATE TRIGGER benchmark_results_updated_at
  BEFORE UPDATE ON benchmark_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
