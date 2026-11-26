"use client";

import * as React from "react";
import { useId } from "react";

import { getSkill, type ToolId } from "@/components/app/home/composer-controls";
import { DiscoverIcon, type ShellIcon } from "@/components/shell/icons";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

import { BulbIcon, CloseIcon, DocIcon, LoopIcon, PenIcon, PersonIcon, PulseIcon, ScissorsIcon } from "./field-icons";
import { creditsLabel } from "./thread-field";
import { useReturnFocus } from "./use-return-focus";

/**
 * The skill menu (was More, spec 2026-11-20 §4.3; since 2026-11-26 the field has no skill pills, so
 * this lists every skill): each with its price and one line, then the profile read. The audience
 * and the platform lens live in the audience sheet, opened from the field's own audience control.
 *
 * On the phone it is a bottom sheet (the `Sheet` part). From 768 up it is a popover standing on
 * the field's top edge, left-aligned with it, at the sheet's own phone width, so the drawn
 * content keeps its geometry: Radix Popover anchored to the field's outer element through
 * `anchorRef` (the one prop added to the planned interface; without it the sheet is used on
 * every width). Both are Radix layers: Escape and a tap outside close them. A tap on the field's
 * More button is such a tap outside: it closes the popover, and the field does not reopen it.
 */

/** The platform the next run is read for (the run lens). */
export type Lens = "tiktok" | "instagram" | "youtube";

export interface MoreSheetProps {
  open: boolean; onOpenChange(open: boolean): void;
  skills: Array<{ id: ToolId; label: string; line: string; price: number | null }>;   // SKILL_MENU, priced
  /** The skill the next send uses (its row is marked); "chat" or absent: none. */
  selected?: ToolId;
  onSelectSkill(id: ToolId): void;                                      // closes the sheet
  onReadFile(): void;                                                   // the profile read: must click the evidence input synchronously
  readFilePrice: number;                                                // creditCost("profile")
  /** The field's outer element (the same ref the field takes as `anchorRef`): on desktop the
   *  popover stands on it. Added to the planned props; absent, More is the bottom sheet. */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

/** The skills More offers, in the drawn order, with the drawn lines (PROMISE_BY_TOOL in
 *  `v8/skills-panel.tsx`, shortened as the reference shows them). The caller adds each price.
 *  The account read is named as an action here ("Read my account"; the old look keeps "Your
 *  account"): the new look has a page, You, that lists the creator's accounts. */
export const MORE_SKILLS: ReadonlyArray<{ id: ToolId; label: string; line: string }> = [
  { id: "idea", label: getSkill("idea").label, line: "A few video ideas for your audience" },
  { id: "explore", label: getSkill("explore").label, line: "Videos doing well in your niche" },
  { id: "account", label: "Read my account", line: "What works on your account" },
];

/** Every skill the menu lists, in order: the four Home leads with (Edit where the editor is open,
 *  the caller filters it), then the rest. Lines as Home's cards and the menu draw them. */
export const SKILL_MENU: ReadonlyArray<{ id: ToolId; label: string; line: string }> = [
  { id: "test", label: "Simulate", line: "See who keeps watching" },
  { id: "edit", label: "Edit", line: "A raw take to a finished video" },
  { id: "hooks", label: "Hooks", line: "Openings for an idea" },
  { id: "script", label: "Script", line: "A full script, timed" },
  { id: "remix", label: "Remix", line: "Rebuild a proven video" },
  ...MORE_SKILLS,
];

const ICON_BY_SKILL: Partial<Record<ToolId, ShellIcon>> = {
  test: PulseIcon,
  edit: ScissorsIcon,
  hooks: PenIcon,
  script: DocIcon,
  remix: LoopIcon,
  idea: BulbIcon,
  explore: DiscoverIcon,
  account: PersonIcon,
};

/** Named as drawn: where the content ships. */
const LENSES: ReadonlyArray<readonly [Lens, string]> = [
  ["tiktok", "TikTok"],
  ["instagram", "Instagram"],
  ["youtube", "YouTube"],
];

/** The platform for the next run, as a segmented control. More and the audience sheet both show it. */
export function LensControl({ lens, onLensChange }: { lens: Lens; onLensChange(lens: Lens): void }): React.JSX.Element {
  return (
    <div role="group" aria-label="Platform" className="mt-1 grid h-10 grid-cols-3 gap-0.5 rounded-lg bg-surface-sunken p-[3px]">
      {LENSES.map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={lens === id}
          onClick={() => onLensChange(id)}
          className={cn(
            "tap-44 flex items-center justify-center rounded-md text-reading font-[560] leading-none transition-colors duration-150",
            lens === id
              ? "bg-surface text-foreground shadow-[var(--shadow-control)]"
              : "text-foreground-secondary hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** A row's leading icon on its sunken disc. */
function IconDisc({ icon: Icon }: { icon: ShellIcon }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-foreground">
      <Icon size={18} aria-hidden />
    </span>
  );
}

function Row({
  icon,
  label,
  line,
  price,
  selected = false,
  onClick,
}: {
  icon: ShellIcon;
  label: string;
  line: string;
  price: number | null;
  selected?: boolean;
  onClick: () => void;
}) {
  // Named for the skill alone, so "tap Ideas" finds it; its line and its price are the
  // description (final review 6).
  const id = useId();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-labelledby={`${id}-name`}
      aria-describedby={price != null ? `${id}-line ${id}-price` : `${id}-line`}
      aria-current={selected || undefined}
      className={cn(
        "-mx-1 flex min-h-[60px] w-[calc(100%+8px)] items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors duration-150 hover:bg-hover",
        selected && "bg-active hover:bg-active",
      )}
    >
      <IconDisc icon={icon} />
      <span className="min-w-0 flex-1">
        <span id={`${id}-name`} className="block text-ui font-[560] text-foreground">{label}</span>
        <span id={`${id}-line`} className="block text-meta text-foreground-secondary">{line}</span>
      </span>
      {price != null && (
        <span id={`${id}-price`} className="shrink-0 text-meta text-foreground-secondary">
          {creditsLabel(price)}
        </span>
      )}
    </button>
  );
}

function MoreBody({
  title,
  skills,
  onSelectSkill,
  onReadFile,
  readFilePrice,
  selected,
  onOpenChange,
}: MoreSheetProps & { title: React.ReactNode }) {
  const close = () => onOpenChange(false);
  return (
    <>
      <div className="mt-1 flex h-11 items-center justify-between px-1">
        {title}
        <IconButton surface="card" aria-label="Close" onClick={close} className="h-8 w-8 [&_svg]:size-[15px]">
          <CloseIcon strokeWidth={2.6} aria-hidden />
        </IconButton>
      </div>

      <div className="flex flex-col">
        {skills.map((skill) => (
          <Row
            key={skill.id}
            icon={ICON_BY_SKILL[skill.id] ?? BulbIcon}
            label={skill.label}
            line={skill.line}
            price={skill.price}
            selected={skill.id === selected}
            onClick={() => {
              onSelectSkill(skill.id);
              close();
            }}
          />
        ))}
        <Row
          icon={DocIcon}
          label="Read a file"
          line="Reads a person from a screenshot"
          price={readFilePrice}
          onClick={() => {
            // First, inside the tap: the composer clicks its file input here, and iOS Safari
            // drops a picker opened after the gesture.
            onReadFile();
            close();
          }}
        />
      </div>

    </>
  );
}

export function MoreSheet(props: MoreSheetProps): React.JSX.Element {
  const { open, onOpenChange, anchorRef } = props;
  const wide = useMediaQuery("(min-width: 768px)");
  const titleId = useId();

  // The menu opens from the field's button, not from a Radix trigger, so on close focus goes back to
  // what had it (`useReturnFocus`), unless something already took focus (the text, after a pick).
  const { sheetFocus, popoverFocus } = useReturnFocus();

  if (wide && anchorRef) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverAnchor virtualRef={anchorRef as React.RefObject<HTMLElement>} />
        <PopoverContent
          side="top"
          align="start"
          sideOffset={10}
          collisionPadding={12}
          aria-labelledby={titleId}
          {...popoverFocus}
          className="z-[var(--z-modal)] max-h-[var(--radix-popover-content-available-height)] w-[393px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-2xl border-0 bg-surface p-0 px-4 pb-4 pt-1 text-foreground shadow-[var(--shadow-float)]"
        >
          <MoreBody
            {...props}
            title={
              <h2 id={titleId} className="text-title font-[640] text-foreground">
                Skills
              </h2>
            }
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        {...sheetFocus}
        className="gap-0 px-4 pb-[max(34px,env(safe-area-inset-bottom))]"
      >
        <MoreBody {...props} title={<SheetTitle className="text-title font-[640]">Skills</SheetTitle>} />
      </SheetContent>
    </Sheet>
  );
}
