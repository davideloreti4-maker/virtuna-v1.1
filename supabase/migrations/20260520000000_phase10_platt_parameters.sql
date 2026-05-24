-- Phase 10: Platt calibration parameters for engine v3 score calibration.
--
-- Stores the fitted Platt scaling parameters (slope A, intercept B) used to
-- calibrate uncalibrated model scores into well-calibrated probabilities.
-- The ML audit pipeline fits these parameters on a held-out validation set
-- and writes a new row each time calibration is re-fit. Consumers (e.g. the
-- engine-v3 scoring RPC) read the latest row via ORDER BY created_at DESC LIMIT 1.
--
-- Service role bypasses RLS for writes (ML pipeline → service client).
-- No policies exist — the table is service-role-write only.
-- All statements use IF NOT EXISTS for idempotent re-runs.

-- Step 1: Create platt_parameters table (idempotent)
CREATE TABLE IF NOT EXISTS platt_parameters (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  a DOUBLE PRECISION NOT NULL,
  b DOUBLE PRECISION NOT NULL,
  fitted_at TIMESTAMPTZ NOT NULL,
  sample_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 2: Enable row level security (no policies created — service role only)
ALTER TABLE platt_parameters ENABLE ROW LEVEL SECURITY;
