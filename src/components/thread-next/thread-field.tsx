"use client";

import * as React from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import type { ToolId } from "@/components/app/home/composer-controls";
import { PlusIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { useVideoMeta } from "@/hooks/use-video-meta";
import { cn } from "@/lib/utils";
import { VIDEO_ACCEPT, formatLength, validateVideoFile } from "@/lib/video-file";

import { ChevronIcon, CloseIcon, DocIcon, SendIcon, StopIcon } from "./field-icons";

/**
 * The message field (new look, spec 2026-11-20 §4.1-4.3; reference
 * `.scratch/next-look/part3/design/field.html`, `.f1-field`). Presentational: every value and
 * every request lives in the composer, which passes them in. The field owns only what never
 * leaves it: its textarea ref (focus), the video picker, and the message for a refused file.
 *
 * In a thread (no `home`) it is a glass bar docked at the bottom:
 *
 *   row 1   +  ·  the text  ·  send (Stop while a run streams)
 *   row 2   Simulate · Hooks · Script · Remix · More
 *
 * Geometry as drawn: radius 32, padding 8 / 8 / 10, 10 between the rows, 96 tall at rest and
 * 164 with a video tile. Pills 32 tall, 14 / 560, padding 8 and gap 4 on the phone, 12 and 6
 * from 768 up — built with 7 on the phone, see PILL.
 *
 * On Home (`home`, Home spec 2026-11-23 §3.1-3.2) the same field is a card in the page, solid,
 * not glass (nothing scrolls under it). No pills and no More: the four cards under it are the
 * skills. The text, the send button, the picker, the messages and the drop are the same code.
 *
 *   Hooks · 1 credit  ×        the picked skill, an ink pill (only while one is picked)
 *   the text, two lines at rest
 *   +  ·  Audience: @handle  ·  send
 */

/** The field's Home layout: what it shows that the thread's does not. */
export interface FieldHome {
  audience: { label: string; open: boolean; onOpen(): void };   // "Audience: {label}", opens the audience sheet
  picked: { label: string; price: number | null } | null;       // the picked skill: a pill above the text
  onClearPicked(): void;                                        // the pill's cross, and Backspace in an empty text
}

type FieldTool = "test" | "hooks" | "script" | "remix"; // the four pills, in this order
export interface ThreadFieldProps {
  value: string; onChange(value: string): void;
  onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void;
  onSubmit(e: React.FormEvent<HTMLFormElement>): void;                  // the form's submit; send is type="submit"
  tool: ToolId; onSelectTool(tool: ToolId): void;                       // a second tap on the selected pill calls onSelectTool("chat")
  priceOf(tool: ToolId): number | null;                                 // null = free (chat)
  canSend: boolean; busy: boolean; online: boolean;
  streaming: boolean; onStop(e: React.MouseEvent<HTMLButtonElement>): void;
  video: File | null; onVideoChange(file: File | null): void;          // + and a dropped video; remove = onVideoChange(null)
  evidence: File | null; onRemoveEvidence(): void;                     // the profile read's staged file, shown as a chip
  onDropFile(file: File): void;                                         // a dropped non-video file (the composer routes it to evidence)
  errors: Array<string | null>;                                         // shown under the field, nulls skipped
  /** Added in the final review: messages shown after the errors in the quiet secondary ink, not
   *  the error colour (the evidence's reject and run error, muted in the legacy box). */
  notes?: Array<string | null>;
  placeholder: string; ariaLabel: string; sendLabel: string;
  brief?: { hookLine: string } | null; onDismissBrief?(): void;         // only rendered while tool === "test"
  slashMenu?: React.ReactNode;                                          // rendered by the composer, anchored to anchorRef
  anchorRef?: React.Ref<HTMLDivElement>;                                // forwarded to the field's outer element
  moreArmed?: { label: string; price: number | null } | null;           // a skill picked from More: shown on the More button
  onOpenMore(): void;
  /** Added in review: More is open (the More button's `aria-expanded`; a tap on More while it is
   *  open only closes it). Required: the toggle depends on it. */
  moreOpen: boolean;
  /** Added in review: the text is invalid (`aria-invalid`), e.g. a non-TikTok link for Simulate. */
  invalid?: boolean;
  /** The Home layout (see the top of this file). Absent or null: the thread's layout, unchanged. */
  home?: FieldHome | null;
}

/** The four pills, in the drawn order. "Simulate" is the video test (`test`), never the General
 *  `simulate` verb (seam map §2.3). */
const FIELD_TOOLS: ReadonlyArray<{ id: FieldTool; label: string }> = [
  { id: "test", label: "Simulate" },
  { id: "hooks", label: "Hooks" },
  { id: "script", label: "Script" },
  { id: "remix", label: "Remix" },
];

/** Glass, because the field floats over the thread. Inline on purpose: Lightning CSS strips
 *  `backdrop-filter` from classes (the tab bar's recipe, `src/components/shell/tab-bar.tsx`). */
const GLASS: React.CSSProperties = {
  WebkitBackdropFilter: "blur(24px) saturate(1.6)",
  backdropFilter: "blur(24px) saturate(1.6)",
};

/** The text grows with what is typed, up to six lines (22 each, plus its 7 + 7 padding). */
const TEXT_MAX_HEIGHT = 6 * 22 + 14;

/** Pills: the card Chip at the drawn size. `gap-0` keeps the label and its price one run of text.
 *  Phone padding 7, one under the drawn 8 (review ruling, Task 3 fix round 2): the ten pixels it
 *  frees let row 2 hold "Account · 5" armed on a 393 phone without scrolling. 12 from 768 up. */
const PILL = "gap-0 px-[7px] md:px-3";

/** A dropped file the field treats as a video (then checked by `validateVideoFile`). */
function looksLikeVideo(file: File): boolean {
  return file.type.startsWith("video/") || /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(file.name);
}

/** A price as words: "1 credit", "10 credits". The pills' description and More's rows. */
export const creditsLabel = (n: number) => `${n} credit${n === 1 ? "" : "s"}`;

/** A pill's label, and its price while it is selected, as drawn: "Hooks · 1". One inline run, so
 *  the spaces around the dot survive. The drawn price is hidden from screen readers: the pill's
 *  name stays the skill's name and the price is its description. Its digits are proportional,
 *  as drawn: the look's app-wide `tabular-nums` (for figures that count) would widen the pill by
 *  3px, and this number never changes in place. */
function Priced({ label, price }: { label: string; price: number | null }) {
  return (
    <span>
      {label}
      {price != null && (
        <span aria-hidden className="font-[520] opacity-[0.72] proportional-nums">
          {` · ${price}`}
        </span>
      )}
    </span>
  );
}

function VideoTile({ file, onRemove }: { file: File; onRemove: () => void }) {
  const { durationSec, thumbnail } = useVideoMeta(file);
  // Null for a length that is not a finite number (e.g. a browser-recorded webm): no length shown.
  const length = durationSec != null ? formatLength(durationSec) : null;
  return (
    <div data-testid="field-video" className="flex px-1 pb-1.5 pt-1">
      <div className="relative h-[58px] w-11 shrink-0">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- a frame drawn in the browser (data: URL); next/image has nothing to optimise
          <img
            src={thumbnail}
            alt={file.name}
            className="block h-[58px] w-11 rounded-xl object-cover shadow-[0_0_0_1px_var(--color-border)]"
          />
        ) : (
          <div className="h-[58px] w-11 rounded-xl bg-surface-sunken shadow-[0_0_0_1px_var(--color-border)]" />
        )}
        {length && (
          // The scrim token under a light figure in both themes: the action's own text in light
          // (white), the foreground in dark (the action's text is ink there).
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-xl bg-linear-to-t from-scrim to-transparent pl-1.5 pt-1.5 text-caption font-[640] leading-4 tracking-normal text-action-foreground dark:text-foreground">
            {length}
          </span>
        )}
        {/* Positioned by a wrapper: on touch `.tap-44` sets `position: relative` from unlayered
            CSS, which would beat an `absolute` passed to the button itself. */}
        <span className="absolute -right-[7px] -top-[7px]">
          <IconButton
            aria-label="Remove video"
            onClick={onRemove}
            className="h-[22px] w-[22px] bg-action text-action-foreground shadow-[0_0_0_2px_var(--color-surface)] [&_svg]:size-[11px]"
          >
            <CloseIcon strokeWidth={2.6} aria-hidden />
          </IconButton>
        </span>
      </div>
    </div>
  );
}

export function ThreadField({
  value,
  onChange,
  onKeyDown,
  onSubmit,
  tool,
  onSelectTool,
  priceOf,
  canSend,
  busy,
  online,
  streaming,
  onStop,
  video,
  onVideoChange,
  evidence,
  onRemoveEvidence,
  onDropFile,
  errors,
  notes = [],
  placeholder,
  ariaLabel,
  sendLabel,
  brief,
  onDismissBrief,
  slashMenu,
  anchorRef,
  moreArmed,
  onOpenMore,
  moreOpen,
  invalid,
  home = null,
}: ThreadFieldProps): React.JSX.Element {
  const uid = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const simulateRef = useRef<HTMLButtonElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  // A refused file's message (wrong type, too large). The composer's own errors come in `errors`.
  const [pickError, setPickError] = useState<string | null>(null);
  // It belongs to the moment the file was refused: a change of skill (a pill, a More pick, the
  // composer's one-shot reset) clears it, as do typing and sending. Adjusted during render, React's
  // pattern for state that follows a prop, so a stale message never paints.
  const [pickTool, setPickTool] = useState(tool);
  if (pickTool !== tool) {
    setPickTool(tool);
    setPickError(null);
  }
  const [dragging, setDragging] = useState(false);
  // Counted, not read from `relatedTarget`: Safari sends none, and every child the drag crosses
  // fires its own enter and leave.
  const dragDepth = useRef(0);
  // More (or Home's audience popover) was open when this tap began: the open layer closes on that
  // pointerdown, and the click that follows must not open it again (a tap on More toggles it).
  const moreWasOpen = useRef(false);
  const audienceWasOpen = useRef(false);

  const focusText = () => textRef.current?.focus();

  // The text grows with its content. A DOM write, no state: measured before paint.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    const needed = el.scrollHeight;
    el.style.height = needed > 0 ? `${Math.min(needed, TEXT_MAX_HEIGHT)}px` : "";
  }, [value]);

  // A skill picked in More arrives as `moreArmed`: hand focus back to the text, as a pill tap does.
  const armedLabel = moreArmed?.label ?? null;
  const lastArmed = useRef(armedLabel);
  useEffect(() => {
    if (armedLabel && armedLabel !== lastArmed.current) textRef.current?.focus();
    lastArmed.current = armedLabel;
  }, [armedLabel]);

  // On Home a skill picked from a card arrives as `home.picked`: focus goes to the next step, as
  // a pill tap does. Simulate with no video: +, because the text would open the phone's keyboard.
  const pickedLabel = home?.picked?.label ?? null;
  const lastPicked = useRef(pickedLabel);
  useEffect(() => {
    if (pickedLabel && pickedLabel !== lastPicked.current) {
      if (tool === "test" && !video) plusRef.current?.focus();
      else textRef.current?.focus();
    }
    lastPicked.current = pickedLabel;
  }, [pickedLabel, tool, video]);

  /** A picked or dropped video: checked here, so a refused file never reaches the composer. */
  const takeVideo = (file: File) => {
    const problem = validateVideoFile(file);
    setPickError(problem);
    if (!problem) onVideoChange(file);
  };

  const removeVideo = () => {
    setPickError(null);
    onVideoChange(null);
    focusText();
  };

  const sendEnabled = canSend && online && !busy;
  const shown = (list: Array<string | null>) => list.filter((m): m is string => Boolean(m));
  const shownErrors = shown([pickError, ...errors]);
  const shownNotes = shown(notes);
  const hasMessages = shownErrors.length + shownNotes.length > 0;
  const errorsId = `${uid}-errors`;
  const priceId = `${uid}-price`;
  const pickedId = `${uid}-picked`;
  // The price of what is selected, a pill's or a More pick's: the pressed button's description.
  const selectedPrice = moreArmed ? moreArmed.price : FIELD_TOOLS.some((t) => t.id === tool) ? priceOf(tool) : null;

  const moreProps = {
    surface: "card" as const,
    "data-field-more": "",
    className: PILL,
    onPointerDown: () => {
      moreWasOpen.current = moreOpen;
    },
  };
  /** A pointer tap that began while the control's layer was open only closed it. A keyboard click
   *  (detail 0) never carries a stale flag. */
  const tapOnlyClosed = (wasOpen: React.RefObject<boolean>, e: React.MouseEvent) => {
    const closed = e.detail > 0 && wasOpen.current;
    wasOpen.current = false;
    return closed;
  };
  const tapOnlyClosedMore = (e: React.MouseEvent) => tapOnlyClosed(moreWasOpen, e);

  // Clicked inside the tap: iOS Safari drops a picker opened any later.
  const openPicker = () => pickerRef.current?.click();
  // Home, Simulate picked and nothing staged: "+" is the only way on, so it says so.
  const addVideoPill = Boolean(home) && tool === "test" && !video;

  // The three controls both layouts draw, written once and placed by each. They differ only in
  // size: the thread's 32 circles sit 2px in from its 36 row; Home's are 36.
  //
  // Home's "+" is one button in both of its looks, so the node, and a keyboard user's focus on it,
  // survives the change when the picker stages a video. Its round look is the icon button's card
  // surface at 36 (`IconButton surface="card"`).
  const plus = home ? (
    <button
      ref={plusRef}
      type="button"
      aria-label="Add a video"
      onClick={openPicker}
      className={cn(
        "tap-44 inline-flex h-9 shrink-0 items-center rounded-full duration-150 transition-[color,background-color,box-shadow,scale] motion-safe:active:scale-[0.98]",
        addVideoPill
          ? "gap-1.5 bg-action pl-2.5 pr-3.5 text-meta font-[560] text-action-foreground"
          : "w-9 justify-center bg-surface-sunken text-foreground hover:bg-active",
      )}
    >
      {addVideoPill ? (
        <>
          <PlusIcon size={16} strokeWidth={2.2} aria-hidden />
          Add video
        </>
      ) : (
        <PlusIcon size={18} strokeWidth={2} aria-hidden />
      )}
    </button>
  ) : (
    <IconButton
      ref={plusRef}
      surface="card"
      aria-label="Add a video"
      onClick={openPicker}
      className="my-0.5 h-8 w-8 [&_svg]:size-[17px]"
    >
      <PlusIcon strokeWidth={2} aria-hidden />
    </IconButton>
  );

  const text = (
    <textarea
      ref={textRef}
      rows={home ? 2 : 1}
      value={value}
      onChange={(e) => {
        setPickError(null);
        onChange(e.target.value);
      }}
      onKeyDown={(e) => {
        // On Home, Backspace in an empty text lets the picked skill go, as the pill's cross does.
        // A fresh press only: a key held down to clear a long text must not take the skill with it.
        if (home?.picked && e.key === "Backspace" && value === "" && !e.repeat) {
          e.preventDefault();
          home.onClearPicked();
          return;
        }
        onKeyDown(e);
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      aria-describedby={hasMessages ? errorsId : undefined}
      className={
        home
          ? "block w-full resize-none bg-transparent px-1 py-[7px] text-title leading-[22px] text-foreground placeholder:text-foreground-secondary focus:outline-none"
          : "min-w-0 flex-1 resize-none bg-transparent px-1 py-[7px] text-title leading-[22px] text-foreground placeholder:text-foreground-secondary focus:outline-none"
      }
    />
  );

  const send = (
    <Button
      // While a run streams this is Stop: a plain button whose click also cancels the
      // default action, because Stop ends the stream at once and the same node is a
      // submit again before the click's default action runs (composer.tsx, the second
      // billed run).
      type={streaming ? "button" : "submit"}
      variant="primary"
      size="sm"
      aria-label={streaming ? "Stop the run" : sendLabel}
      // Home: the picked skill and its price ("Hooks · 1 credit"), tied to no other control.
      aria-describedby={!streaming && home?.picked ? pickedId : undefined}
      disabled={!streaming && !sendEnabled}
      loading={!streaming && busy}
      onClick={
        streaming
          ? (e) => {
              e.preventDefault();
              onStop(e);
            }
          : undefined
      }
      className={cn(
        home
          ? "tap-44 h-9 min-h-0 w-9 min-w-0 shrink-0 rounded-full p-0 next:rounded-full"
          : "tap-44 my-0.5 h-8 min-h-0 w-8 min-w-0 shrink-0 rounded-full p-0 next:rounded-full",
        // Off, as drawn: a tint with a muted arrow, not the action fill at 40%.
        "disabled:bg-surface-sunken disabled:text-foreground-muted disabled:opacity-100 disabled:shadow-none",
        "next:disabled:opacity-100 next:disabled:shadow-none",
      )}
    >
      {streaming ? <StopIcon aria-hidden /> : busy ? null : <SendIcon size={17} strokeWidth={2.3} aria-hidden />}
    </Button>
  );

  return (
    <div ref={anchorRef} className="relative">
      {slashMenu}
      <form
        data-testid="thread-field"
        data-dragging={dragging || undefined}
        onSubmit={(e) => {
          setPickError(null);
          onSubmit(e);
        }}
        style={home ? undefined : GLASS}
        onDragEnter={(e) => {
          if (!Array.from(e.dataTransfer?.types ?? []).includes("Files")) return;
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer?.types ?? []).includes("Files")) e.preventDefault();
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(e) => {
          dragDepth.current = 0;
          setDragging(false);
          const files = Array.from(e.dataTransfer?.files ?? []);
          if (files.length === 0) return;
          e.preventDefault();
          // One attachment at a time: a drop that holds a video stages that video only (the first
          // one); without a video, the first other file goes to the composer (the profile read).
          // Anything else is ignored.
          const firstVideo = files.find(looksLikeVideo);
          if (firstVideo) {
            takeVideo(firstVideo);
            return;
          }
          setPickError(null);
          const firstOther = files[0];
          if (firstOther) onDropFile(firstOther);
        }}
        className={cn(
          home
            ? "rounded-4xl bg-surface px-3.5 pb-3 pt-2.5 shadow-[var(--shadow-rest)] md:px-5 md:pb-3.5 md:pt-3"
            : "rounded-4xl bg-glass px-2 pb-2.5 pt-2 shadow-[var(--shadow-float)]",
          dragging && "ring-2 ring-[color:var(--focus-ring)]",
        )}
      >
        {tool === "test" && brief && (
          <div data-testid="field-brief" className="flex items-start gap-2 px-1.5 pb-2 pt-1">
            <div className="min-w-0 flex-1">
              <p className="text-meta text-foreground-secondary">Shoot this hook, then add the video</p>
              <p className="text-ui font-[560] text-foreground">&ldquo;{brief.hookLine}&rdquo;</p>
            </div>
            {onDismissBrief && (
              <IconButton
                surface="quiet"
                aria-label="Dismiss hook brief"
                onClick={() => {
                  onDismissBrief();
                  // As a Simulate tap: with no video yet the next step is +, so the pill, not
                  // the text (which would open the phone's keyboard). Home has no pill: +.
                  if (video) focusText();
                  else (home ? plusRef : simulateRef).current?.focus();
                }}
                className="h-7 w-7 [&_svg]:size-[14px]"
              >
                <CloseIcon strokeWidth={2.2} aria-hidden />
              </IconButton>
            )}
          </div>
        )}

        {evidence && (
          <div data-testid="field-evidence" className="flex px-1 pb-1.5 pt-1">
            <span className="inline-flex h-8 min-w-0 max-w-full items-center gap-1.5 rounded-full bg-surface-sunken pl-2.5 pr-1 text-meta font-[560] text-foreground">
              <DocIcon size={16} aria-hidden className="shrink-0 text-foreground-secondary" />
              <span className="min-w-0 truncate">{evidence.name}</span>
              <IconButton
                surface="quiet"
                aria-label="Remove attachment"
                onClick={() => {
                  onRemoveEvidence();
                  focusText();
                }}
                className="h-6 w-6 [&_svg]:size-[13px]"
              >
                <CloseIcon strokeWidth={2.2} aria-hidden />
              </IconButton>
            </span>
          </div>
        )}

        {video && <VideoTile file={video} onRemove={removeVideo} />}

        {home ? (
          <>
            {home.picked && (
              <div className="flex pb-1 pt-0.5">
                <span
                  data-part="picked-skill"
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-action pl-3 pr-1 text-meta font-[560] text-action-foreground"
                >
                  {/* Also send's description, so a keyboard user hears what the send spends. */}
                  <span id={pickedId}>
                    {home.picked.label}
                    {home.picked.price != null && (
                      <span className="opacity-[0.72]">{` · ${creditsLabel(home.picked.price)}`}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${home.picked.label}`}
                    onClick={() => {
                      setPickError(null);
                      home.onClearPicked();
                      focusText();
                    }}
                    className="tap-44 flex size-6 items-center justify-center rounded-full transition-colors duration-150 hover:bg-action-foreground/15 active:bg-action-foreground/25"
                  >
                    <CloseIcon size={13} strokeWidth={2.4} aria-hidden />
                  </button>
                </span>
              </div>
            )}
            {text}
            <div className="mt-1.5 flex items-center gap-2">
              {plus}
              <button
                type="button"
                aria-label={`Audience: ${home.audience.label}`}
                aria-haspopup="dialog"
                aria-expanded={home.audience.open}
                // As More's guard: on desktop the popover closes on this pointerdown, and the click
                // that follows must not open it again.
                onPointerDown={() => {
                  audienceWasOpen.current = home.audience.open;
                }}
                onClick={(e) => {
                  if (tapOnlyClosed(audienceWasOpen, e)) return;
                  home.audience.onOpen();
                }}
                className="tap-44 inline-flex h-9 min-w-0 items-center gap-2 rounded-full bg-surface-sunken pl-3 pr-2.5 text-meta font-[560] text-foreground"
              >
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-foreground" />
                {/* The handle is what matters: on a narrow screen the prefix goes first (under 360,
                    and under 768 while the Add video pill takes the room). The name keeps it. */}
                <span className="min-w-0 truncate">
                  <span className={cn("max-[359px]:hidden", addVideoPill && "max-md:hidden")}>{"Audience: "}</span>
                  {home.audience.label}
                </span>
                <ChevronIcon size={14} strokeWidth={2.2} aria-hidden className="shrink-0 rotate-90 text-foreground-secondary" />
              </button>
              <span className="flex-1" />
              {send}
            </div>
          </>
        ) : (
          <>
            {/* Row 1: + · text · send. The circles sit 2px in from the row's 36. */}
            <div className="flex min-h-9 items-end gap-1.5">
              {plus}
              {text}
              {send}
            </div>

            {/* Row 2: the four pills and More. The scroller keeps a narrow phone usable; its 6px
                above and below (taken back by margins) leave room for the 44px hit areas and the
                focus ring, which a scroller would otherwise clip. */}
            <div className="-mx-1 -mb-1.5 mt-1 overflow-x-auto px-1 py-1.5 [scrollbar-width:none]">
              <div className="flex h-8 w-max min-w-full items-center gap-1 md:gap-1.5">
                {FIELD_TOOLS.map(({ id, label }) => {
                  const selected = tool === id;
                  return (
                    <Chip
                      key={id}
                      ref={id === "test" ? simulateRef : undefined}
                      surface="card"
                      selected={selected}
                      // The name is the skill's and never changes; the price is the description.
                      aria-label={label}
                      aria-describedby={selected && selectedPrice != null ? priceId : undefined}
                      onClick={(e) => {
                        setPickError(null);
                        onSelectTool(selected ? "chat" : id);
                        // Simulate with no video: the next step is +, so focus stays on the pill
                        // (the text would open the phone's keyboard). Every other tap: the text.
                        if (id === "test" && !selected && !video) e.currentTarget.focus();
                        else focusText();
                      }}
                      className={PILL}
                    >
                      <Priced label={label} price={selected ? priceOf(id) : null} />
                    </Chip>
                  );
                })}
                {moreArmed ? (
                  // A skill picked in More is, while selected, exactly a pill: named for the skill
                  // (as drawn, so "tap Ideas" finds it), pressed, its price the description; a tap
                  // puts it back. Not a popup button while armed.
                  <Chip
                    {...moreProps}
                    selected
                    aria-label={moreArmed.label}
                    aria-describedby={moreArmed.price != null ? priceId : undefined}
                    onClick={(e) => {
                      if (tapOnlyClosedMore(e)) return;
                      setPickError(null);
                      onSelectTool("chat");
                      focusText();
                    }}
                  >
                    <Priced label={moreArmed.label} price={moreArmed.price} />
                  </Chip>
                ) : (
                  <Chip
                    {...moreProps}
                    aria-label="More"
                    aria-haspopup="dialog"
                    aria-expanded={moreOpen}
                    onClick={(e) => {
                      if (tapOnlyClosedMore(e)) return;
                      onOpenMore();
                    }}
                  >
                    More
                  </Chip>
                )}
              </div>
            </div>

            {/* Descriptions, read with the controls that point at them (only the pills do; Home
                shows its price on the picked skill's pill). */}
            <span hidden id={priceId}>
              {selectedPrice != null ? creditsLabel(selectedPrice) : ""}
            </span>
          </>
        )}

        {hasMessages && (
          // On Home, in line with the text (its own `px-1`); the thread's block is unchanged.
          <div id={errorsId} className={home ? "px-1 pt-2" : "px-2 pt-2"}>
            {shownErrors.map((message, i) => (
              <p key={`e${i}-${message}`} role="alert" className="text-meta text-error">
                {message}
              </p>
            ))}
            {shownNotes.map((message, i) => (
              <p key={`n${i}-${message}`} role="alert" className="text-meta text-foreground-secondary">
                {message}
              </p>
            ))}
          </div>
        )}

        <input
          ref={pickerRef}
          type="file"
          accept={VIDEO_ACCEPT}
          aria-label="Choose a video file"
          tabIndex={-1}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared, so picking the same file again still fires a change.
            e.target.value = "";
            if (file) takeVideo(file);
          }}
        />
      </form>
    </div>
  );
}
