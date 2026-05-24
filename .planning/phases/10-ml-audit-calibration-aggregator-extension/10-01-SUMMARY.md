# 10-01 SUMMARY: ML Audit CLI + Migration + Test Stubs

**Phase:** 10-ml-audit-calibration-aggregator-extension  
**Plan:** 01  
**Requirements:** ML-01, ML-02, ML-06, AGG-02, AGG-06  
**Commits:** fb455a3  

## Changes Made

### 1. ML Audit CLI (`src/lib/engine/corpus/cli/ml-audit.ts`) — new file
- Runs eval runner over corpus, computes accuracy + confusion matrix + leave-one-out delta
- Parallel pattern to existing CLI tools (`eval-runner.ts`)
- Produces `.planning/research/ml-audit-report.md`

### 2. Migration (`supabase/migrations/20260520000000_phase10_platt_parameters.sql`)
- `CREATE TABLE IF NOT EXISTS platt_parameters` with columns: id (BIGINT PK), a (DOUBLE PRECISION), b (DOUBLE PRECISION), fitted_at (TIMESTAMPTZ), sample_count (INTEGER), created_at
- RLS enabled with service-role write policy

### 3. Aggregator test stubs (`src/lib/engine/__tests__/aggregator-phase10.test.ts`)
- 5 test cases covering weight redistribution with all 8 signals (AGG-02 + AGG-06)

## Verification
- `.planning/research/ml-audit-report.md` written — accuracy=0.67, loo_delta_ml=+7.04
- Migration file exists with correct schema
- 1175 tests passing (85 files)
