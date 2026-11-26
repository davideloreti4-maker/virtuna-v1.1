"use client";

import * as React from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import type { ToolId } from "@/components/app/home/composer-controls";
import { AudienceIcon, PlusIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useVideoMeta } from "@/hooks/use-video-meta";
import { cn } from "@/lib/utils";
import { VIDEO_ACCEPT, formatLength, validateVideoFile } from "@/lib/video-file";

import { ChevronIcon, CloseIcon, DocIcon, SendIcon, SkillsIcon, StopIcon } from "./field-icons";

/**
 * The message field (new look, spec 2026-11-20 §4.1-4.3; reference
 * `.scratch/next-look/part3/design/field.html`, `.f1-field`). Presentational: every value and
 * every request lives in the composer, which passes them in. The field owns only what never
 * leaves it: its textarea ref (focus), the video picker, and the message for a refused file.
 *
 * Rebuilt 2026-11-26 on the Claude app's composer: one solid card (radius 20, padding 12, the
 * card shadow, lifted while focused), the text alone on its first row at full width, and one
 * toolbar under it, the same on Home and in a thread:
 *
 *   row 1   the text (one line in a thread, two on Home)
 *   row 2   +  ·  Skills  ·  Audience: @handle  ·  send
 *
 * No skill pills (owner, 2026-11-26: "remove all the skills buttons … audience and skills shown").
 * The toolbar shows what the next send uses instead: Skills opens the skill menu (`onOpenMore`,
 * `MoreSheet`); once one is picked the same place is a soft tag, "Hooks · 1", with a cross that
 * puts back chat. The audience control names the audience the next run reads for and opens its
 * sheet. Controls are 32 tall at radius 8 (20 − 12, concentric): `+` outlined, send an ink square
 * (faded while off). On Home the cards under the field are a second way to pick a skill.
 *
 * For an account the editor is open to (plan 2026-11-24-editor-screens-a, Task 16) a video is simulated or edited: the
 * skill menu lists Edit beside Simulate, and a staged video shows the two as a choice above the text (`bar.videoSkill`). The caller may hand in the check a video passes to be staged (`validateVideo`:
 * the editor takes files Simulate does not) and a ref to the picker, to open it inside a tap of its own (`pickerRef`).
 */

/** What the toolbar shows besides + and send: the audience and the picked skill. */
export interface FieldBar {
  audience: { label: string; open: boolean; onOpen(): void };   // "Audience: {label}", opens the audience sheet
  picked: { label: string; price: number | null } | null;       // the picked skill: a tag in Skills' place
  onClearPicked(): void;                                        // the tag's cross, and Backspace in an empty text
  /** A video staged with the editor open (plan 2026-11-24-editor-screens-a): Simulate or Edit, a choice above the text.
   *  `simulate` false: Simulate cannot take this file (past its 200 MB). */
  videoSkill?: { picked: "test" | "edit"; simulate: boolean; onPick(id: "test" | "edit"): void } | null;
}

/** The field on Home: the same toolbar; the text starts two lines tall. */
export type FieldHome = FieldBar;

export interface ThreadFieldProps {
  value: string; onChange(value: string): void;
  onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void;
  onSubmit(e: React.FormEvent<HTMLFormElement>): void;                  // the form's submit; send is type="submit"
  tool: ToolId;
  /** Not read by the field since 2026-11-26 (picks come through the skill menu, the tag's cross and
   *  `bar.videoSkill`); optional so callers that still pass it compile. */
  onSelectTool?(tool: ToolId): void;
  priceOf(tool: ToolId): number | null;                                 // null = free (chat)
  canSend: boolean; busy: boolean; online: boolean;
  streaming: boolean; onStop(e: React.MouseEvent<HTMLButtonElement>): void;
  /** Thread feel §4.6: the answer is in while its stream is still open (billing, a closing line
   *  this look does not draw). The send arrow again, off until the stream closes. `streaming` wins. */
  finishing?: boolean;
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
  onOpenMore(): void;                                                   // opens the skill menu
  /** The skill menu is open (the Skills control's `aria-expanded`; a tap on it while the menu is
   *  open only closes it). Required: the toggle depends on it. */
  moreOpen: boolean;
  /** The toolbar's audience and picked skill, in a thread. On Home `home` carries the same. */
  bar?: FieldBar | null;
  /** Added in review: the text is invalid (`aria-invalid`), e.g. a non-TikTok link for Simulate. */
  invalid?: boolean;
  /** Home (see the top of this file): the toolbar's audience and skill, and two lines of text. */
  home?: FieldHome | null;
  /** The editor is open to this account (plan 2026-11-24-editor-screens-a). The menu lists Edit; kept for callers. */
  editOpen?: boolean;
  /** The video picker's input, for a caller that opens it inside its own tap (Home's Edit card). */
  pickerRef?: React.RefObject<HTMLInputElement | null>;
  /** The check a picked or dropped video passes before it is staged; Simulate's (`validateVideoFile`) unless given. */
  validateVideo?(file: File): string | null;
}

/** The text grows with what is typed, up to eight lines (24 each, plus its 4 + 4 padding). */
const TEXT_MAX_HEIGHT = 8 * 24 + 8;

/** The card. Solid in both places, as the Claude app draws its composer: the thread's content
 *  passes behind it and is hidden, not blurred. The card shadow (its own 6% hairline); focused,
 *  the lifted shadow (a 12% hairline, a deeper fall). */
const CARD =
  "rounded-2xl bg-surface p-3 transition-shadow duration-200 " +
  "shadow-[var(--shadow-rest)] focus-within:shadow-[var(--shadow-lift)]";

/** A 32-tall control on the toolbar (a square with `w-8`), radius 8 (the card's 20 less its 12 padding). */
const SQUARE =
  "tap-44 inline-flex h-8 shrink-0 items-center justify-center rounded-md duration-150 " +
  "transition-[color,background-color,box-shadow,scale] motion-safe:active:scale-[0.96]";

/** The quiet outline every unpressed toolbar control wears: a 12% inset hairline. */
const OUTLINE = "shadow-[inset_0_0_0_1px_var(--color-border-hover)]";

/** The video choice's two buttons (Simulate · Edit): 32 tall, radius 8, 14px. Unpressed, a ghost
 *  in the secondary ink; pressed, a soft tint with the hairline, full ink at label weight. */
const TOOL_BASE =
  "tap-44 inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md px-2 text-reading leading-none " +
  "duration-150 transition-[color,background-color,box-shadow,scale] motion-safe:active:scale-[0.97] " +
  "disabled:pointer-events-none disabled:opacity-40";
const toolClass = (selected: boolean) =>
  selected
    ? `${TOOL_BASE} bg-active font-[560] text-foreground ${OUTLINE}`
    : `${TOOL_BASE} font-[480] text-foreground-secondary hover:bg-hover hover:text-foreground`;

/** The two things a staged video can be sent to, as Home's choice lists them (`FieldHome.videoSkill`). */
const VIDEO_SKILLS = [
  { id: "test", label: "Simulate" },
  { id: "edit", label: "Edit" },
] as const;

/** A dropped file the field treats as a video (then checked by `validateVideo`). */
function looksLikeVideo(file: File): boolean {
  return file.type.startsWith("video/") || /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(file.name);
}

/** A price as words: "1 credit", "10 credits". The picked skill's description and the menu's rows. */
export const creditsLabel = (n: number) => `${n} credit${n === 1 ? "" : "s"}`;

function VideoTile({ file, onRemove }: { file: File; onRemove: () => void }) {
  const { durationSec, thumbnail } = useVideoMeta(file);
  // Null for a length that is not a finite number (e.g. a browser-recorded webm): no length shown.
  const length = durationSec != null ? formatLength(durationSec) : null;
  return (
    <div data-testid="field-video" className="flex pb-2.5 pt-1">
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
  priceOf,
  canSend,
  busy,
  online,
  streaming,
  onStop,
  finishing = false,
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
  onOpenMore,
  moreOpen,
  invalid,
  bar: threadBar = null,
  home = null,
  pickerRef: givenPicker,
  validateVideo = validateVideoFile,
}: ThreadFieldProps): React.JSX.Element {
  const uid = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const ownPicker = useRef<HTMLInputElement>(null);
  const pickerRef = givenPicker ?? ownPicker;
  const plusRef = useRef<HTMLButtonElement>(null);
  // What the toolbar shows besides + and send. Home's and a thread's are the same shape.
  const bar = home ?? threadBar;
  // A refused file's message (wrong type, too large). The composer's own errors come in `errors`.
  const [pickError, setPickError] = useState<string | null>(null);
  // It belongs to the moment the file was refused: a change of skill (a menu pick, the tag's
  // cross, the composer's one-shot reset) clears it, as do typing and sending. Adjusted during
  // render, React's pattern for state that follows a prop, so a stale message never paints.
  const [pickTool, setPickTool] = useState(tool);
  if (pickTool !== tool) {
    setPickTool(tool);
    setPickError(null);
  }
  const [dragging, setDragging] = useState(false);
  // Counted, not read from `relatedTarget`: Safari sends none, and every child the drag crosses
  // fires its own enter and leave.
  const dragDepth = useRef(0);
  // The skill menu (or the audience popover) was open when this tap began: the open layer closes
  // on that pointerdown, and the click that follows must not open it again (a tap toggles it).
  const skillsWasOpen = useRef(false);
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

  // A skill picked (the menu, a Home card) arrives as `bar.picked`: focus goes to the next step.
  // Simulate or Edit with no video: +, because the text would open the phone's keyboard.
  const pickedLabel = bar?.picked?.label ?? null;
  const lastPicked = useRef(pickedLabel);
  useEffect(() => {
    if (pickedLabel && pickedLabel !== lastPicked.current) {
      if ((tool === "test" || tool === "edit") && !video) plusRef.current?.focus();
      else textRef.current?.focus();
    }
    lastPicked.current = pickedLabel;
  }, [pickedLabel, tool, video]);

  /** A picked or dropped video: checked here, so a refused file never reaches the composer. */
  const takeVideo = (file: File) => {
    const problem = validateVideo(file);
    setPickError(problem);
    if (!problem) onVideoChange(file);
  };

  const removeVideo = () => {
    setPickError(null);
    onVideoChange(null);
    focusText();
  };

  const sendEnabled = canSend && online && !busy && !finishing;
  // While a run finishes the arrow shows, off: never the spinner a busy send shows in its place.
  const sendBusy = busy && !finishing;
  const shown = (list: Array<string | null>) => list.filter((m): m is string => Boolean(m));
  const shownErrors = shown([pickError, ...errors]);
  const shownNotes = shown(notes);
  const hasMessages = shownErrors.length + shownNotes.length > 0;
  const errorsId = `${uid}-errors`;
  const priceId = `${uid}-price`;
  const pickedId = `${uid}-picked`;

  /** A pointer tap that began while the control's layer was open only closed it. A keyboard click
   *  (detail 0) never carries a stale flag. */
  const tapOnlyClosed = (wasOpen: React.RefObject<boolean>, e: React.MouseEvent) => {
    const closed = e.detail > 0 && wasOpen.current;
    wasOpen.current = false;
    return closed;
  };

  // Clicked inside the tap: iOS Safari drops a picker opened any later.
  const openPicker = () => pickerRef.current?.click();
  // Simulate or Edit picked and nothing staged: "+" is the only way on, so it says so.
  const addVideoPill = (tool === "test" || tool === "edit") && !video;
  // A video staged with the editor open: Simulate or Edit, a choice above the text. While it shows,
  // it is what the send does, so the toolbar's tag steps back to Skills.
  const videoChoice = video ? (bar?.videoSkill ?? null) : null;
  const choicePrice = videoChoice ? priceOf(videoChoice.picked) : null;
  const picked = videoChoice ? null : (bar?.picked ?? null);

  // "+" is one button in both of its looks ("Add video" is the same node, widened), so a keyboard
  // user's focus on it survives the change when the picker stages a video.
  const plus = (
    <button
      ref={plusRef}
      type="button"
      aria-label="Add a video"
      onClick={openPicker}
      className={
        addVideoPill
          ? `${SQUARE} gap-1.5 bg-action pl-2 pr-3 text-meta font-[560] text-action-foreground hover:bg-action/90`
          : `${SQUARE} w-8 ${OUTLINE} text-foreground-secondary hover:bg-hover hover:text-foreground`
      }
    >
      <PlusIcon size={addVideoPill ? 15 : 17} strokeWidth={2} aria-hidden />
      {addVideoPill && "Add video"}
    </button>
  );

  // The skill menu's trigger props, on the Skills control and on the picked tag's label alike.
  const skillsTrigger = {
    type: "button" as const,
    "data-field-skills": "",
    "aria-haspopup": "dialog" as const,
    "aria-expanded": moreOpen,
    onPointerDown: () => {
      skillsWasOpen.current = moreOpen;
    },
    onClick: (e: React.MouseEvent) => {
      if (tapOnlyClosed(skillsWasOpen, e)) return;
      onOpenMore();
    },
  };

  const skills = picked ? (
    // The picked skill in Skills' place: a soft tag. Its label reopens the menu (to change it);
    // its cross puts back chat. Named for the skill alone; its price is the description.
    <span
      data-part="picked-skill"
      // Never shrinks: the skill and its price are what the send spends. The audience's handle
      // truncates instead when a phone's row is crowded.
      className={`inline-flex h-8 shrink-0 items-center rounded-md bg-active text-foreground ${OUTLINE}`}
    >
      <button
        {...skillsTrigger}
        aria-label={picked.label}
        aria-describedby={picked.price != null ? priceId : undefined}
        className="tap-44 flex h-8 items-center whitespace-nowrap rounded-l-md pl-2.5 pr-1 text-reading font-[560] leading-none"
      >
        <span>
          {picked.label}
          {picked.price != null && (
            <span aria-hidden className="font-[430] opacity-60 proportional-nums">{` · ${picked.price}`}</span>
          )}
        </span>
      </button>
      <button
        type="button"
        aria-label={`Remove ${picked.label}`}
        onClick={() => {
          setPickError(null);
          bar?.onClearPicked();
          focusText();
        }}
        className="tap-44 mr-1 flex size-6 shrink-0 items-center justify-center rounded-sm text-foreground-secondary transition-colors duration-150 hover:bg-active hover:text-foreground"
      >
        <CloseIcon size={13} strokeWidth={2.4} aria-hidden />
      </button>
      {/* Send's description too, so a keyboard user hears what the send spends. */}
      <span hidden id={pickedId}>
        {picked.price != null ? `${picked.label} · ${creditsLabel(picked.price)}` : picked.label}
      </span>
    </span>
  ) : (
    <button
      {...skillsTrigger}
      aria-label="Skills"
      className={`${SQUARE} gap-1.5 px-2.5 ${OUTLINE} text-reading font-[480] text-foreground-secondary hover:bg-hover hover:text-foreground aria-expanded:bg-active aria-expanded:text-foreground`}
    >
      <SkillsIcon size={16} strokeWidth={1.9} aria-hidden />
      Skills
    </button>
  );

  const audience = bar ? (
    <button
      type="button"
      aria-label={`Audience: ${bar.audience.label}`}
      aria-haspopup="dialog"
      aria-expanded={bar.audience.open}
      // As the skill menu's guard: on desktop the popover closes on this pointerdown, and the
      // click that follows must not open it again.
      onPointerDown={() => {
        audienceWasOpen.current = bar.audience.open;
      }}
      onClick={(e) => {
        if (tapOnlyClosed(audienceWasOpen, e)) return;
        bar.audience.onOpen();
      }}
      // A quiet text button, as the Claude app's model picker: no fill until hovered or open.
      className="tap-44 inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-reading font-[480] leading-none text-foreground-secondary transition-colors duration-150 hover:bg-hover hover:text-foreground aria-expanded:bg-active aria-expanded:text-foreground"
    >
      <AudienceIcon size={16} strokeWidth={1.9} aria-hidden className="shrink-0" />
      {/* The handle is what matters: the prefix shows from 768 up only. On a phone whose row also
          holds "Add video" and the picked skill there is no room for a readable handle, so the
          icon stands alone there. The name keeps all of it. */}
      <span className={cn("min-w-0 truncate", addVideoPill && picked && "max-md:hidden")}>
        <span className="max-md:hidden">{"Audience: "}</span>
        {bar.audience.label}
      </span>
      <ChevronIcon size={13} strokeWidth={2.2} aria-hidden className="shrink-0 rotate-90 opacity-70" />
    </button>
  ) : null;

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
        // Backspace in an empty text lets the picked skill go, as the tag's cross does. A fresh
        // press only: a key held down to clear a long text must not take the skill with it.
        if (picked && e.key === "Backspace" && value === "" && !e.repeat) {
          e.preventDefault();
          bar?.onClearPicked();
          return;
        }
        onKeyDown(e);
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      aria-describedby={hasMessages ? errorsId : undefined}
      // Full width on its own row, inset 6 so the text starts just inside the toolbar's "+".
      className="block w-full resize-none bg-transparent px-1.5 py-1 text-title font-[430] leading-6 text-foreground placeholder:text-foreground-muted focus:outline-none"
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
      // The picked skill and its price ("Hooks · 1 credit"), or the video choice's.
      aria-describedby={!streaming && (picked || videoChoice) ? pickedId : undefined}
      disabled={!streaming && !sendEnabled}
      loading={!streaming && sendBusy}
      onClick={
        streaming
          ? (e) => {
              e.preventDefault();
              onStop(e);
            }
          : undefined
      }
      className={cn(
        "tap-44 h-8 min-h-0 w-8 min-w-0 shrink-0 rounded-md p-0 next:rounded-md next:shadow-none",
        // Off: still the ink square, faded, so the eye finds the send whether or not it can fire
        // (the Claude app's way). Never the grey tint the other controls wear.
        "disabled:opacity-25 disabled:shadow-none next:disabled:opacity-25",
      )}
    >
      {streaming ? <StopIcon aria-hidden /> : sendBusy ? null : <SendIcon size={16} strokeWidth={2.4} aria-hidden />}
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
        className={cn(CARD, dragging && "ring-2 ring-[color:var(--focus-ring)]")}
      >
        {tool === "test" && brief && (
          <div data-testid="field-brief" className="flex items-start gap-2 px-1.5 pb-2">
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
                  // With no video yet the next step is +, not the text (which would open the
                  // phone's keyboard).
                  if (video) focusText();
                  else plusRef.current?.focus();
                }}
                className="h-7 w-7 [&_svg]:size-[14px]"
              >
                <CloseIcon strokeWidth={2.2} aria-hidden />
              </IconButton>
            )}
          </div>
        )}

        {evidence && (
          <div data-testid="field-evidence" className="flex pb-2.5">
            <span className="inline-flex h-8 min-w-0 max-w-full items-center gap-1.5 rounded-md bg-surface-sunken pl-2.5 pr-1 text-meta font-[560] text-foreground">
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

        {videoChoice && (
          // What the staged video is sent to: the pressed one is what the send does. Each is named
          // for its skill alone; the pressed one's words, its price in them, are also send's
          // description. The video itself is let go by its tile's cross.
          <div role="group" aria-label="What to do with this video" className="flex gap-1.5 pb-2">
            {VIDEO_SKILLS.map(({ id, label }) => {
              const selected = videoChoice.picked === id;
              const price = selected ? choicePrice : null;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  aria-label={label}
                  aria-describedby={price != null ? priceId : undefined}
                  disabled={id === "test" && !videoChoice.simulate}
                  onClick={() => {
                    setPickError(null);
                    videoChoice.onPick(id);
                  }}
                  className={toolClass(selected)}
                >
                  <span id={selected ? pickedId : undefined}>
                    {label}
                    {price != null && <span className="opacity-60">{` · ${creditsLabel(price)}`}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Row 1: the text, alone and full width. */}
        {text}

        {/* Row 2, the toolbar: + · Skills (or the picked skill) · the audience · send. */}
        <div className="mt-2.5 flex items-center gap-1.5">
          {plus}
          {skills}
          {audience}
          <span className="flex-1" />
          {send}
        </div>

        {/* The price of what is picked (the tag's, the video choice's): the description its
            control points at. */}
        <span hidden id={priceId}>
          {picked?.price != null ? creditsLabel(picked.price) : choicePrice != null ? creditsLabel(choicePrice) : ""}
        </span>

        {hasMessages && (
          // In line with the text (its own `px-1.5`).
          <div id={errorsId} className="px-1.5 pt-2">
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
