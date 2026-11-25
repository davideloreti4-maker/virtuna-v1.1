"use client";

import type { ShellIconProps } from "@/components/shell/icons";

/**
 * The down arrow, which neither the shell's set nor the field's has. Same drawing rules as
 * `field-icons.tsx` (24×24 viewBox, `currentColor`, 1.75 stroke, round caps and joins): the
 * field's send arrow, pointing down.
 */
function DownArrow({ size = 24, ...props }: ShellIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 5v13.5M6 13l6 6 6-6" />
    </svg>
  );
}

/**
 * "Go to the latest" (thread feel, spec 2026-11-25 §4.1): a round button centred above the field
 * while more than 150 of the last answer is hidden under it (`useThreadAutoscroll.hiddenBelow`). A
 * tap takes the thread to its end. Not shown, it is not rendered at all, so it is never a focus stop
 * nobody can see. 34 across with a 17 arrow; `.tap-44` grows the hit area on touch, as the icon
 * buttons do.
 */
export function JumpButton({ shown, onClick }: { shown: boolean; onClick(): void }) {
  if (!shown) return null;
  return (
    <button
      type="button"
      aria-label="Go to the latest"
      onClick={onClick}
      className="tap-44 pointer-events-auto inline-flex size-[34px] shrink-0 items-center justify-center rounded-full bg-surface text-foreground shadow-[var(--shadow-float)] transition-[scale] duration-150 motion-safe:active:scale-[0.98]"
    >
      <DownArrow size={17} aria-hidden />
    </button>
  );
}
