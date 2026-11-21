"use client";

import * as React from "react";
import { useId, useRef } from "react";

import { getSkill, type ToolId } from "@/components/app/home/composer-controls";
import { AudienceIcon, DiscoverIcon, type ShellIcon } from "@/components/shell/icons";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

import { BulbIcon, ChevronIcon, CloseIcon, DocIcon, PersonIcon } from "./field-icons";
import { creditsLabel } from "./thread-field";

/**
 * More (spec 2026-11-20 §4.3; reference `.f1-sheet`): the skills without a pill, each with its
 * price and one line, the profile read, then the audience for the next run and the platform lens.
 *
 * On the phone it is a bottom sheet (the `Sheet` part). From 768 up it is a popover standing on
 * the field's top edge, left-aligned with it, at the sheet's own phone width, so the drawn
 * content keeps its geometry: Radix Popover anchored to the field's outer element through
 * `anchorRef` (the one prop added to the planned interface; without it the sheet is used on
 * every width). Both are Radix layers: Escape and a tap outside close them. A tap on the field's
 * More button is such a tap outside: it closes the popover, and the field does not reopen it.
 */

export interface MoreSheetProps {
  open: boolean; onOpenChange(open: boolean): void;
  skills: Array<{ id: ToolId; label: string; line: string; price: number | null }>;   // Ideas, Explore, Your account
  onSelectSkill(id: ToolId): void;                                      // closes the sheet
  onReadFile(): void;                                                   // the profile read: must click the evidence input synchronously
  readFilePrice: number;                                                // creditCost("profile")
  audienceLabel: string; onOpenAudience(): void;                        // opens today's audience sheet
  lens: "tiktok" | "instagram" | "youtube"; onLensChange(lens: MoreSheetProps["lens"]): void;
  /** The field's outer element (the same ref the field takes as `anchorRef`): on desktop the
   *  popover stands on it. Added to the planned props; absent, More is the bottom sheet. */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

/** The skills More offers, in the drawn order, with the drawn lines (PROMISE_BY_TOOL in
 *  `v8/skills-panel.tsx`, shortened as the reference shows them). The caller adds each price. */
export const MORE_SKILLS: ReadonlyArray<{ id: ToolId; label: string; line: string }> = [
  { id: "idea", label: getSkill("idea").label, line: "A few video ideas for your audience" },
  { id: "explore", label: getSkill("explore").label, line: "Videos doing well in your niche" },
  { id: "account", label: getSkill("account").label, line: "What works on your account" },
];

const ICON_BY_SKILL: Partial<Record<ToolId, ShellIcon>> = {
  idea: BulbIcon,
  explore: DiscoverIcon,
  account: PersonIcon,
};

/** Named as drawn: where the content ships. */
const LENSES: ReadonlyArray<readonly [MoreSheetProps["lens"], string]> = [
  ["tiktok", "TikTok"],
  ["instagram", "Instagram"],
  ["youtube", "YouTube"],
];

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
  onClick,
}: {
  icon: ShellIcon;
  label: string;
  line: string;
  price: number | null;
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
      className="flex min-h-[60px] w-full items-center gap-3 px-1 py-2 text-left"
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
  audienceLabel,
  onOpenAudience,
  lens,
  onLensChange,
  onOpenChange,
  onAudienceRow,
}: MoreSheetProps & { title: React.ReactNode; onAudienceRow: () => void }) {
  const close = () => onOpenChange(false);
  return (
    <>
      <div className="mt-1 flex h-11 items-center justify-between px-1">
        {title}
        <IconButton surface="card" aria-label="Close" onClick={close} className="h-8 w-8 [&_svg]:size-[15px]">
          <CloseIcon strokeWidth={2.6} aria-hidden />
        </IconButton>
      </div>

      <div className="divide-y divide-border">
        {skills.map((skill) => (
          <Row
            key={skill.id}
            icon={ICON_BY_SKILL[skill.id] ?? BulbIcon}
            label={skill.label}
            line={skill.line}
            price={skill.price}
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

      {/* A heading one level under the sheet's title (the sheet's and the popover's are h2). */}
      <h3 className="mx-1 mb-0.5 mt-3.5 text-meta font-[560] text-foreground-secondary">Audience</h3>
      <button
        type="button"
        aria-label={`Audience: ${audienceLabel}`}
        onClick={() => {
          // Today's audience sheet takes the focus from here (the composer moves it), so More
          // does not hand it back to its button behind that sheet (final review 5).
          onAudienceRow();
          close();
          onOpenAudience();
        }}
        className="flex min-h-[52px] w-full items-center gap-3 px-1 py-2 text-left"
      >
        <IconDisc icon={AudienceIcon} />
        <span className="min-w-0 flex-1 truncate text-ui font-[560] text-foreground">{audienceLabel}</span>
        <ChevronIcon size={16} strokeWidth={2.1} aria-hidden className="shrink-0 text-foreground-secondary" />
      </button>

      <div role="group" aria-label="Platform" className="mt-1 grid h-10 grid-cols-3 gap-0.5 rounded-full bg-surface-sunken p-[3px]">
        {LENSES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={lens === id}
            onClick={() => onLensChange(id)}
            className={cn(
              "tap-44 flex items-center justify-center rounded-full text-reading font-[560] leading-none transition-colors duration-150",
              lens === id
                ? "bg-surface text-foreground shadow-[var(--shadow-control)]"
                : "text-foreground-secondary hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

export function MoreSheet(props: MoreSheetProps): React.JSX.Element {
  const { open, onOpenChange, anchorRef } = props;
  const wide = useMediaQuery("(min-width: 768px)");
  const titleId = useId();

  // More opens from the field's button, not from a Radix trigger, so on close Radix has nothing
  // to hand focus back to and it would fall to the page. Remember what had focus when it opened
  // and return there, unless something already took focus (the text, after a pick). The popover
  // also skips it after a pointer outside, as Radix's non-modal popover does (focus stays where
  // that tap left it); the sheet, a modal dialog, returns focus either way, as Radix's dialog does.
  // The audience row is the exception (final review 5): it opens today's audience sheet, which
  // the composer then focuses; focus handed back to More would sit behind that sheet.
  const returnTo = useRef<HTMLElement | null>(null);
  const closedFromOutside = useRef(false);
  const handedOn = useRef(false);
  const onAudienceRow = () => {
    handedOn.current = true;
  };
  const sheetFocus = {
    onOpenAutoFocus: () => {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      closedFromOutside.current = false;
      handedOn.current = false;
    },
    onCloseAutoFocus: (e: Event) => {
      e.preventDefault();
      const active = document.activeElement;
      if (!closedFromOutside.current && !handedOn.current && (!active || active === document.body)) {
        returnTo.current?.focus();
      }
      closedFromOutside.current = false;
      handedOn.current = false;
    },
  };
  const popoverFocus = {
    ...sheetFocus,
    onPointerDownOutside: () => {
      closedFromOutside.current = true;
    },
  };

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
          className="z-[var(--z-modal)] max-h-[var(--radix-popover-content-available-height)] w-[393px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-4xl border-0 bg-surface p-0 px-4 pb-4 pt-1 text-foreground shadow-[var(--shadow-float)]"
        >
          <MoreBody
            {...props}
            onAudienceRow={onAudienceRow}
            title={
              <h2 id={titleId} className="text-title font-[640] text-foreground">
                More
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
        <MoreBody {...props} onAudienceRow={onAudienceRow} title={<SheetTitle className="text-title font-[640]">More</SheetTitle>} />
      </SheetContent>
    </Sheet>
  );
}
