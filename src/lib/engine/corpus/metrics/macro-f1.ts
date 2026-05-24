import type { Bucket } from "../eval-config";

// Class order: viral, average, under (consistent with rest of module).
const CLASSES: Bucket[] = ["viral", "average", "under"];

export interface F1PerClass {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface MacroF1Result {
  macroF1: number;
  perClass: Record<Bucket, F1PerClass>;
  /** Confusion matrix indexed as cm[actual][predicted] (CLASSES order). */
  confusionMatrix: number[][];
}

/**
 * Macro-F1 for 3-class bucket classification (D-14).
 *
 * Matches sklearn.metrics.f1_score(..., average='macro') on the same labels,
 * verified by hand-computed fixture in the test file.
 *
 * Pure function. Throws on empty or mismatched-length inputs.
 *
 * Confusion matrix convention follows ml.ts:104-106 — cm[actual][predicted].
 */
export function computeMacroF1(
  predicted: Bucket[],
  actual: Bucket[],
): MacroF1Result {
  if (predicted.length !== actual.length) {
    throw new Error("predicted and actual must be the same length");
  }
  if (predicted.length === 0) {
    throw new Error("cannot compute macro-F1 on empty arrays");
  }

  const classIdx: Record<Bucket, number> = { viral: 0, average: 1, under: 2 };
  const cm: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let i = 0; i < predicted.length; i++) {
    const a = actual[i];
    const p = predicted[i];
    if (a === undefined || p === undefined) continue;
    const row = cm[classIdx[a]];
    if (!row) continue;
    row[classIdx[p]] = (row[classIdx[p]] ?? 0) + 1;
  }

  const perClass = {} as Record<Bucket, F1PerClass>;
  for (const c of CLASSES) {
    const idx = classIdx[c];
    const row = cm[idx];
    if (!row) {
      perClass[c] = { precision: 0, recall: 0, f1: 0, support: 0 };
      continue;
    }
    const tp = row[idx] ?? 0;

    // FP for class c = column c sum minus diagonal
    let fp = 0;
    for (let r = 0; r < cm.length; r++) {
      if (r === idx) continue;
      const otherRow = cm[r];
      if (!otherRow) continue;
      fp += otherRow[idx] ?? 0;
    }

    // FN for class c = row c sum minus diagonal
    let fn = 0;
    for (let pp = 0; pp < row.length; pp++) {
      if (pp === idx) continue;
      fn += row[pp] ?? 0;
    }

    const support = tp + fn;
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 =
      precision + recall === 0
        ? 0
        : (2 * precision * recall) / (precision + recall);

    perClass[c] = {
      precision: round4(precision),
      recall: round4(recall),
      f1: round4(f1),
      support,
    };
  }

  const macroF1 = round4(
    CLASSES.reduce((s, c) => s + perClass[c].f1, 0) / CLASSES.length,
  );

  return { macroF1, perClass, confusionMatrix: cm };
}

function round4(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}
