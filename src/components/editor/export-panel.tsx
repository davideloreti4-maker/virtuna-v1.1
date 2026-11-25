"use client";

import { useId } from "react";
import type { ExportShown } from "@/lib/edit/edit-view";
import { exportSeconds, waitWords } from "@/lib/edit/waits";

/**
 * export-panel.tsx — the export in the page (spec §3 screen 11, E20, E21; plan 2026-11-24-editor-screens-a, Task 14; drawing
 * `.exp`, `.bar`): it takes the conversation's place while the file is made, the tools and the field resting and the video still
 * to be watched; how long is left in words, from the film's length and how far the render is; the bar; Cancel gives the edit
 * back. Cancel marks the export's job failed and the worker gives up at its next step (R2); a cancel that arrives after the file
 * is made keeps the file (R25), so its answer may bring the finished export instead of the edit (`madeFilm`, `ready-sheet.tsx`).
 */

/** How far the render is, held to between nothing and the whole. */
const shareOf = (progress: number) => Math.min(1, Math.max(0, progress));

/** "About a minute left. You can leave, it keeps going.": the estimate of what is left of the render. */
export function exportLine(filmSeconds: number, progress: number): string {
  const left = Math.round(exportSeconds(filmSeconds) * (1 - shareOf(progress)));
  return `${waitWords(left)} left. You can leave, it keeps going.`;
}

export interface ExportPanelProps {
  shown: ExportShown;
  filmSeconds: number;
  onCancel(): void;
  /** The cancel is out: Cancel rests until it is answered. */
  cancelling: boolean;
}

export function ExportPanel({ shown, filmSeconds, onCancel, cancelling }: ExportPanelProps) {
  const title = useId();
  const percent = Math.round(shareOf(shown.progress) * 100);
  return (
    <section data-part="export" aria-labelledby={title} className="flex flex-col">
      <h2 id={title} className="text-title font-[640] text-foreground">
        Making your video
      </h2>
      <p aria-live="polite" className="mt-0.5 text-ui text-foreground-secondary">
        {exportLine(filmSeconds, shown.progress)}
      </p>
      <div
        role="progressbar" aria-label="Your video" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
        className="mt-3 h-1 overflow-hidden rounded-full bg-surface-sunken"
      >
        <div className="h-full rounded-full bg-action" style={{ width: `${percent}%` }} />
      </div>
      <button type="button" onClick={onCancel} disabled={cancelling} className="tap-44 mt-3 self-start text-ui font-[600] text-foreground disabled:opacity-40">
        Cancel
      </button>
    </section>
  );
}
