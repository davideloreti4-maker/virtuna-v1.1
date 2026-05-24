// ECE moved here 2026-05-24 from src/lib/engine/calibration.ts (Platt apparatus dropped).
// The metric is provider-agnostic — useful for evaluating any 0-1 score → outcome correlation.
export { computeECE, type CalibrationBin, type OutcomePair } from "./ece";

export * from "./macro-f1";
export * from "./bootstrap";
export * from "./score-to-bucket";
export * from "./leave-one-out";
export * from "./stage-latency";
