"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import type { ShellIcon } from "@/components/shell/icons";
import { CloseIcon } from "@/components/thread-next/field-icons";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { lookName } from "@/lib/edit/said";
import { HOUSE_STYLE } from "@/lib/edit/style/house";
import { PRESETS } from "@/lib/edit/style/presets";
import type { StyleProfile } from "@/lib/edit/style/profile";
import { cn } from "@/lib/utils";
import type { CutStyle } from "./edit-session";
import { ChevronRightIcon, LinkIcon, QuoteIcon } from "./editor-icons";
import { LookSample } from "./look-sample";
import type { Source } from "./read-style";
import type { StyleRead } from "./use-edit";

/**
 * look-sheet.tsx — the look (spec §3 screens 2 and 9, E5, E9, E22; plan 2026-11-24-editor-screens-a, Task 13; drawing `.sheet2`,
 * `.grid4`, `.looks`, `.opt`): the eight looks (ours, then the seven presets in `PRESET_IDS` order), each drawn on the take's own
 * frame, the one in use pressed; picked, the take is cut again in it (after changes the sheet says so, and Undo brings them
 * back). The look in use picked again with nothing changed is no new cut: the sheet only closes. Two more ways: "Like a video"
 * (a TikTok link or an upload) is read in the background, the edit staying usable, and offered as a chip when ready; "Describe
 * it" (at most 300 characters) is cut at once. A read that is going is said here with "Stop"; it is stopped too, and what it
 * said put away, when another look is picked (`onStopReading`). While the take gets ready the same looks are a row under the
 * video, and the one picked is sent with the first cut.
 *
 * The sheet opens fresh each time: a way left open and its words go with the sheet's content when it closes.
 */

export interface Look {
  key: string;
  name: string;
  style: StyleProfile;
}

export const LOOKS: readonly Look[] = [
  { key: "house", name: lookName("house"), style: HOUSE_STYLE },
  ...PRESETS.map((preset) => ({ key: preset.id, name: preset.name, style: preset.profile })),
];

export const lookStyleOf = (key: string): CutStyle => (key === "house" ? { kind: "house" } : { kind: "preset", id: key });

/** The longest style in words the route takes (`MOST.words`). */
export const MOST_WORDS = 300;
/** What a creator reads when a look is picked after changes (E9). */
export const STARTS_AGAIN = "Picking a look starts again from your take. Undo brings your changes back.";

/** Each look's height in the sheet's grid and in the row (the drawing's `.grid4 .th` and `.lk .th`): the take's 9:16 at a tile's width. */
const SHEET_TALL = 146;
const ROW_TALL = 107;

function Tile({ look, picked, poster, words, tall, ground, disabled, onPick }: { look: Look; picked: boolean; poster: string | null; words: readonly string[]; tall: number; ground: "page" | "sheet"; disabled?: boolean; onPick(): void }) {
  return (
    <button type="button" aria-pressed={picked} disabled={disabled} onClick={onPick} className="flex w-full flex-col items-center gap-2 rounded-lg disabled:opacity-40">
      {/* The look in use: an ink ring 2 out from the tile, the ground between (`.lk.on .th`). */}
      <span
        className={cn(
          "block w-full rounded-lg ring-offset-2",
          ground === "page" ? "ring-offset-[color:var(--color-background)]" : "ring-offset-[color:var(--color-surface)]",
          picked && "ring-2 ring-[color:var(--color-action)]",
        )}
      >
        <LookSample style={look.style} poster={poster} words={words} tall={tall} />
      </span>
      <span data-part="look-name" className={cn("whitespace-nowrap text-label", picked ? "font-[640] text-foreground" : "text-foreground-secondary")}>{look.name}</span>
    </button>
  );
}

/** The looks in a row under the video while the take gets ready (screen 2). */
export function LookRow({ picked, poster, words, onPick, disabled }: { picked: string; poster: string | null; words: readonly string[]; onPick(look: CutStyle): void; disabled?: boolean }) {
  const heading = useId();
  return (
    <section aria-labelledby={heading} data-part="look-row">
      <h2 id={heading} className="mb-2.5 px-0.5 text-ui font-[640] text-foreground">
        Pick a look while you wait
      </h2>
      {/* It runs to the screen's right edge and scrolls; 4 above and below so the ring of the look in use is not cut. */}
      <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 py-1 [scrollbar-width:none]">
        {LOOKS.map((look) => (
          <div key={look.key} className="w-[60px] shrink-0">
            <Tile look={look} picked={picked === look.key} poster={poster} words={words} tall={ROW_TALL} ground="page" disabled={disabled} onPick={() => onPick(lookStyleOf(look.key))} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** One more way, a row that opens what it needs under it (`.opt`). */
function Way({ icon: Icon, name, line, open, onToggle, children }: { icon: ShellIcon; name: string; line: string; open: boolean; onToggle(): void; children: ReactNode }) {
  const body = useId();
  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls={body} onClick={onToggle} className="flex w-full items-center gap-3 px-0.5 py-[13px] text-left">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-foreground">
          <Icon size={18} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-ui font-[640] text-foreground">{name}</span>
          <span className="block text-meta text-foreground-secondary">{line}</span>
        </span>
        <ChevronRightIcon size={16} aria-hidden className={cn("shrink-0 text-foreground-muted transition-transform duration-150", open && "rotate-90")} />
      </button>
      {open && <div id={body}>{children}</div>}
    </div>
  );
}

export interface LookSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The key of the look in use (`EditView.look`): `house`, a preset's id, `words` or `video`; null before any cut. */
  picked: string | null;
  poster: string | null;
  /** The take's first words, drawn in each look; none before they are heard. */
  words: readonly string[];
  /** There are changes since the last cut: picking a look starts again from the take. */
  changed: boolean;
  disabled: boolean;
  onPick(look: CutStyle): void;
  reading: StyleRead;
  onReadVideo(source: Source): void;
  /** Stops the read of a video's style and puts what it said away (`EditApi.stopReading`). */
  onStopReading(): void;
}

const FIELD = "rounded-xl bg-surface-sunken px-3 text-ui text-foreground placeholder:text-foreground-muted focus:outline-none focus-visible:shadow-[0_0_0_1.7px_var(--focus-ring)]";

/** What the sheet holds while it is open: gone with the sheet's content when it closes, so it opens fresh. */
function LookBody({ onOpenChange, picked, poster, words, changed, disabled, onPick, reading, onReadVideo, onStopReading }: Omit<LookSheetProps, "open">) {
  const [way, setWay] = useState<"video" | "words" | null>(null);
  const [link, setLink] = useState("");
  const [said, setSaid] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  const close = () => onOpenChange(false);
  const pick = (look: CutStyle) => {
    if (reading.status !== "idle") onStopReading(); // another look: the read and what it said go
    onPick(look);
    close();
  };
  // The look in use with nothing changed since its cut would be the same cut again: nothing is asked for.
  const pickTile = (key: string) => (key === picked && !changed ? close() : pick(lookStyleOf(key)));
  const read = (source: Source) => {
    onReadVideo(source);
    close();
  };
  return (
    <>
      <div className="flex h-11 items-center justify-between px-0.5">
        <SheetTitle className="text-subhead font-[640]">Look</SheetTitle>
        <IconButton surface="card" aria-label="Close" onClick={close} className="h-9 w-9 [&_svg]:size-4">
          <CloseIcon strokeWidth={2.6} aria-hidden />
        </IconButton>
      </div>
      <div role="group" aria-label="Looks" className="mt-2 grid grid-cols-4 gap-x-2.5 gap-y-3.5">
        {LOOKS.map((look) => (
          <Tile key={look.key} look={look} picked={picked === look.key} poster={poster} words={words} tall={SHEET_TALL} ground="sheet" disabled={disabled} onPick={() => pickTile(look.key)} />
        ))}
      </div>
      {changed && <p className="mt-3 px-0.5 text-meta text-foreground-secondary">{STARTS_AGAIN}</p>}
      <div className={cn("divide-y divide-border border-t border-border", changed ? "mt-3" : "mt-3.5")}>
        <Way icon={LinkIcon} name="Like a video" line="Paste a TikTok link or upload one" open={way === "video"} onToggle={() => setWay(way === "video" ? null : "video")}>
          <form
            className="flex flex-col gap-2 pb-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!disabled && link.trim() !== "") read({ link: link.trim() });
            }}
          >
            <input
              aria-label="A TikTok link" value={link} onChange={(event) => setLink(event.target.value)} inputMode="url" enterKeyHint="go"
              autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="https://www.tiktok.com/…" className={cn("h-11", FIELD)}
            />
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={disabled || link.trim() === ""}>
                Read its style
              </Button>
              <Button type="button" variant="secondary" disabled={disabled} onClick={() => upload.current?.click()}>
                Upload a video
              </Button>
            </div>
            <input
              ref={upload} type="file" accept="video/mp4,video/quicktime" aria-label="A video to read the style of" tabIndex={-1} className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) read({ file });
              }}
            />
          </form>
        </Way>
        <Way icon={QuoteIcon} name="Describe it" line="Say it the way you would to an editor" open={way === "words"} onToggle={() => setWay(way === "words" ? null : "words")}>
          <form
            className="flex flex-col gap-2 pb-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!disabled && said.trim() !== "") pick({ kind: "words", words: said.trim() });
            }}
          >
            <textarea
              aria-label="The look in your words" value={said} maxLength={MOST_WORDS} rows={3} onChange={(event) => setSaid(event.target.value)}
              className={cn("resize-none py-2.5", FIELD)}
            />
            <Button type="submit" variant="primary" className="self-start" disabled={disabled || said.trim() === ""}>
              Use it
            </Button>
          </form>
        </Way>
      </div>
      {reading.status === "reading" && (
        <div className="mt-3 flex items-center gap-3 px-0.5">
          <p role="status" className="min-w-0 flex-1 text-meta text-foreground-secondary">{reading.line}</p>
          <button type="button" onClick={onStopReading} className="tap-44 shrink-0 text-meta font-[600] text-foreground">
            Stop
          </button>
        </div>
      )}
      {reading.status === "failed" && <p role="alert" className="mt-3 px-0.5 text-meta text-foreground-secondary">{reading.problem}</p>}
    </>
  );
}

export function LookSheet({ open, ...props }: LookSheetProps) {
  return (
    <Sheet open={open} onOpenChange={props.onOpenChange}>
      {/* The phone's width at most, on any screen: each look stays drawn at the take's 9:16 (the drawing's 82 × 146 tile). */}
      <SheetContent
        side="bottom" showCloseButton={false} aria-describedby={undefined} onHandleDismiss={() => props.onOpenChange(false)}
        className="mx-auto max-h-[92dvh] max-w-[430px] gap-0 overflow-y-auto px-4 pb-[max(34px,env(safe-area-inset-bottom))]"
      >
        <LookBody {...props} />
      </SheetContent>
    </Sheet>
  );
}
