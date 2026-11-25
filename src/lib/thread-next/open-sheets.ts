/**
 * open-sheets.ts — whether any of the new look's sheets (`AnswerSheet`) is open (thread depth,
 * Task 3).
 *
 * A sheet opened on an answer that has just landed lives in the live turn's component (a pack row's
 * details, the script's "How to film it"). When the run folds into the thread, the live turn makes
 * way for its persisted copy, a new element, and the sheet closed under the creator (measured on a
 * phone: opened 0.6 s after the hooks landed, gone 5.5 s later, the moment the thread was read). So
 * the composer's folds wait while a sheet is open, and start when the last one has closed.
 *
 * `AnswerSheet` reports itself while it is open (`reportSheetOpen`, released when it closes or
 * unmounts); the composer reads `anySheetOpen` and listens (`subscribeOpenSheets`). Module state, on
 * purpose: one page, and the sheets and the composer are far apart in the tree.
 *
 * No React.
 */

const open = new Set<symbol>();
const listeners = new Set<() => void>();

function tell(): void {
  for (const listener of [...listeners]) listener();
}

/** Is any sheet open now? */
export function anySheetOpen(): boolean {
  return open.size > 0;
}

/** Hear every change (a sheet opened or closed). Returns the way to stop. */
export function subscribeOpenSheets(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A sheet is open. Returns its release, for when it closes or unmounts; a second call does nothing. */
export function reportSheetOpen(): () => void {
  const sheet = Symbol("sheet");
  open.add(sheet);
  tell();
  return () => {
    if (open.delete(sheet)) tell();
  };
}
