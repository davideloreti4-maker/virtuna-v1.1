// Single source of truth: re-export ECE from the existing calibration module.
// Do NOT reimplement — see .planning/phases/01-training-corpus-eval-foundation/01-CONTEXT.md line 124.
export { computeECE } from "@/lib/engine/calibration";

export * from "./macro-f1";
export * from "./bootstrap";
export * from "./score-to-bucket";
export * from "./leave-one-out";
export * from "./stage-latency";
