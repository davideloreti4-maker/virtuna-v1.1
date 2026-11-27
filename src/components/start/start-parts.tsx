/**
 * The parts /start's screens share, in the new look's terms (docs/DESIGN-SYSTEM.md, "Next look"): the screen
 * title, the spacer that sets the buttons at the bottom of a phone, the app's own field and radio
 * (`src/components/audience-next/new-audience-screen.tsx`), the picked ring. Tokens only.
 */
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** -0.035em inline: the app-wide `h1 { letter-spacing: -0.02em }` (unlayered) beats a tracking utility. */
const TITLE_TRACKING: CSSProperties = { letterSpacing: "-0.035em" };

/**
 * A step's title (screen title 30 / 35, bold) and the line under it. `tabIndex={-1}`: the flow moves focus
 * here on a step change so the new screen is announced; not in the tab order, and no ring (not a control).
 */
export function StepTitle({ title, line }: { title: string; line?: string }) {
  return (
    <div className="mt-7">
      <h1 tabIndex={-1} style={TITLE_TRACKING} className="text-3xl font-bold leading-[35px] text-foreground outline-none">
        {title}
      </h1>
      {line ? <p className="mt-2 text-ui text-foreground-secondary">{line}</p> : null}
    </div>
  );
}

/** Sets what follows at the bottom of a phone's screen; on a wide window a fixed gap. */
export function Push() {
  return <div aria-hidden className="min-h-8 flex-1 md:flex-none" />;
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-2 text-meta text-error">
      {children}
    </p>
  );
}

/** A one-line field's box: the sunken tint at rest, the card with its hairline while focused. */
export const FIELD_BOX =
  "flex h-14 w-full min-w-0 items-center gap-0.5 rounded-2xl bg-surface-sunken px-4 text-foreground " +
  "motion-safe:transition-[background-color,box-shadow] focus-within:bg-surface focus-within:shadow-[var(--shadow-control)]";

/** The input inside FIELD_BOX: 17px so iOS does not zoom (anything under 16 does). */
export const FIELD_INPUT = "min-w-0 flex-1 bg-transparent text-[17px] text-foreground outline-none placeholder:text-foreground-muted";

/** The niche's two-line field. */
export const NICHE_FIELD =
  "min-h-24 w-full min-w-0 resize-none rounded-2xl bg-surface-sunken px-4 py-4 text-[18px] leading-6 text-foreground outline-none " +
  "placeholder:text-foreground-muted motion-safe:transition-[background-color,box-shadow] focus:bg-surface focus:shadow-[var(--shadow-control)]";

/** A tile or row at rest, and picked (an ink ring of 2). */
export const REST = "shadow-[var(--shadow-rest)]";
export const PICKED = "shadow-[0_0_0_2px_var(--color-foreground)]";

/** The app's radio (new-audience-screen.tsx), on a card. */
export const RADIO = cn(
  "size-[22px] shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-foreground-muted bg-surface",
  "checked:border-[7px] checked:border-foreground motion-safe:transition-[border-width,border-color] motion-safe:duration-150",
  "focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
);

/**
 * A checkbox on the ground: a rounded square with the hairline, ink filled when ticked; the tick is the svg
 * drawn after it (`peer-checked`), see the account step's consent box.
 */
export const CHECKBOX = cn(
  "peer size-5 shrink-0 cursor-pointer appearance-none rounded-md border-[1.5px] border-foreground-muted bg-surface",
  "checked:border-foreground checked:bg-foreground motion-safe:transition-colors motion-safe:duration-150",
  "focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);
