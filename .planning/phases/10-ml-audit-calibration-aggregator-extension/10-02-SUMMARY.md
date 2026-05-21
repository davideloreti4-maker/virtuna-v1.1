# 10-02 SUMMARY: Platt Calibration + DB Push

**Phase:** 10-ml-audit-calibration-aggregator-extension  
**Plan:** 02  
**Requirements:** ML-03, ML-04, ML-05, AGG-01, AGG-03, AGG-04, AGG-05  
**Commits:** fb455a3  

## Changes Made

### 1. Platt Training CLI (`src/lib/engine/corpus/cli/train-platt.ts`) — new file
- Uses `runEvalOverCorpus` → `fitPlattScaling` → INSERT into `platt_parameters`
- Supports `--dry-run`, `--version`, `--max-rows` flags
- Parallel pattern to `calibrate-thresholds.ts`

### 2. Calibration runtime (`src/lib/engine/calibration.ts`) — modified
- `getPlattParameters()` reads from `platt_parameters` table (SELECT latest row ORDER BY created_at DESC LIMIT 1) on cache miss
- Replaces in-memory recompute path
- `fitPlattScaling` and `applyPlattScaling` functions implemented
- `is_calibrated` flag becomes `true` in PredictionResult when `getPlattParameters()` returns non-null

### 3. Migration extended — same migration file adds platt_parameters table DDL

### 4. Calibration tests (`src/lib/engine/__tests__/calibration.test.ts`) — modified
- 18 passing tests covering getPlattParameters, fitPlattScaling, applyPlattScaling
- Clamp/bounds tests for fitPlattScaling input validation

## Verification
- `platt_parameters` table DDL exists with correct schema and RLS
- `getPlattParameters()` caches in-memory, reads DB on miss
- 1175 tests passing
