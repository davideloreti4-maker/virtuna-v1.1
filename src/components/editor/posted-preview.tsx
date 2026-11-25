"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { BackIcon } from "@/components/shell/icons";
import { MoreIcon } from "@/components/thread-next/field-icons";
import { cn } from "@/lib/utils";
import { BookmarkIcon, ChatIcon, CloseIcon, DiscIcon, HeartIcon, MutedIcon, RepostIcon, ShareIcon, SoundIcon } from "./editor-icons";
import { FURNITURE, NAME, clipOf, phoneOf, type App, type Box, type PostedLayout, type Shape } from "./posted";

/**
 * posted-preview.tsx — the video as it will be posted (spec 2026-11-24-editor-screens-design.md E17; plan
 * 2026-11-25-editor-screens-b, Task 6; drawing screen 7): full screen on black, under our own drawing of the app's buttons and
 * caption, so the creator sees whether a caption of theirs sits under the app's furniture. TikTok, Reels, or nothing.
 *
 * It draws everything but the video. The video is the page's own stage, promoted by the page (`frame`) between this overlay's
 * black ground and the rest of it; there is never a second Player. So the dialog has no box of its own: its ground and its
 * layer over the video are each placed on the whole window. The layer lets a tap through to the video (which plays and pauses
 * it) but on its controls.
 *
 * The phone is a phone drawn to scale (ruling S10): its furniture and its bottom bar are drawn at the tall phone's own size, in
 * its points (`phoneOf`), and the whole is scaled to the place the layout gives it, so glyphs, counts, type and the bar scale
 * with it and lie over the stage exactly. The creator's controls keep their own size, where the layout puts them: the row of
 * close, the switch and the sound (the stage's own mute button is hidden here), and the scrubber the page hands in.
 *
 * Not `aria-modal`: the stage's own Play stays reachable, and the page makes the rest of itself inert while this is open. The
 * close button takes the focus; Escape closes it wherever the focus is.
 */

export interface PostedPreviewProps {
  app: App;
  onApp(app: App): void;
  onClose(): void;
  layout: PostedLayout;
  /** The edit's title stands for the post's caption. */
  title: string;
  /** The page's Scrubber with `onFootage`. */
  scrubber: ReactNode;
  closeRef: RefObject<HTMLButtonElement | null>;
  /** The video has no sound: the stage's, told by it. */
  muted: boolean;
  /** Turns the stage's sound off or back on. */
  onMute(): void;
}

const APPS: readonly { app: App; name: string }[] = [
  { app: "tiktok", name: "TikTok" },
  { app: "reels", name: "Reels" },
  { app: "off", name: "Off" },
];

/** A glyph over footage: light in both themes (the stage's `OVER_FOOTAGE` without its scrim). */
const ON_FOOTAGE = "text-action-foreground dark:text-foreground";
/** What is drawn there but quieter: the switch's other choices, the band's marks. */
const QUIET_ON_FOOTAGE = "text-action-foreground/75 dark:text-foreground/75";
/** A control of the creator's over the black or the footage: 36 drawn, 44 to tap, on the scrim. */
const CONTROL = "pointer-events-auto tap-44 flex size-9 shrink-0 items-center justify-center rounded-full bg-scrim [&_svg]:size-4";

const ICONS = { heart: HeartIcon, chat: ChatIcon, save: BookmarkIcon, share: ShareIcon, repost: RepostIcon, more: MoreIcon };
/** The glyph's size in each app, as drawn. */
const GLYPH: Record<"tiktok" | "reels", number> = { tiktok: 32, reels: 28 };
/** The band's marks, the middle one a pill with no word under it. */
const NAV = ["Home", "Friends", "", "Inbox", "Profile"];

const placed = (box: Box): CSSProperties => ({ left: box.left, top: box.top, width: box.width, height: box.height });

export function PostedPreview({ app, onApp, onClose, layout, title, scrubber, closeRef, muted, onMute }: PostedPreviewProps) {
  const { controls } = layout;
  // Escape closes it wherever the focus is, the stage's Play included: listened to on the document, the latest `onClose` read
  // from a ref (R26).
  const closing = useRef(onClose);
  useLayoutEffect(() => {
    closing.current = onClose;
  });
  useEffect(() => {
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      closing.current();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, [closeRef]);

  // The switch: one choice of three, the chosen one reached by Tab, the arrow keys moving the choice and the focus with it.
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const step = (event: KeyboardEvent, index: number) => {
    const by = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (by === 0) return;
    event.preventDefault();
    const next = (index + by + APPS.length) % APPS.length;
    onApp(APPS[next]!.app);
    radios.current[next]?.focus();
  };

  return (
    <div role="dialog" aria-label="Preview as posted" data-part="posted">
      {/* The black the video is shown on, under the stage. */}
      <div data-part="posted-ground" className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-black" />
      <div data-part="posted-over" className="pointer-events-none fixed inset-0 z-[calc(var(--z-modal)+1)]">
        {app !== "off" && <Drawing app={app} title={title} layout={layout} />}
        <div data-part="controls" className="absolute flex items-center justify-between gap-2" style={placed(controls.top)}>
          <button ref={closeRef} type="button" aria-label="Close preview" onClick={onClose} className={cn(CONTROL, ON_FOOTAGE)}>
            <CloseIcon aria-hidden />
          </button>
          <div role="radiogroup" aria-label="App" className="pointer-events-auto flex h-9 shrink-0 items-center rounded-full bg-scrim p-[3px]">
            {APPS.map(({ app: each, name }, index) => (
              <button
                key={each} type="button" role="radio" aria-checked={each === app} tabIndex={each === app ? 0 : -1}
                ref={(element) => {
                  radios.current[index] = element;
                }}
                onClick={() => onApp(each)} onKeyDown={(event) => step(event, index)}
                className={cn("tap-44 flex h-full items-center whitespace-nowrap rounded-full px-[13px] text-meta font-[600]", each === app ? "bg-surface text-foreground" : QUIET_ON_FOOTAGE)}
              >
                {name}
              </button>
            ))}
          </div>
          {/* The stage's sound, its own button being hidden under the app's: Mute, or Unmute when it has none, as there. */}
          <button type="button" aria-label={muted ? "Unmute" : "Mute"} onClick={onMute} className={cn(CONTROL, ON_FOOTAGE)}>
            {muted ? <MutedIcon aria-hidden /> : <SoundIcon aria-hidden />}
          </button>
        </div>
        {/* Over the phone's bottom edge or under it, and clear of the device's own bottom edge. */}
        <div data-part="scrubber-place" className="pointer-events-auto absolute -mt-[env(safe-area-inset-bottom)]" style={placed(controls.bottom)}>
          {scrubber}
        </div>
      </div>
    </div>
  );
}

/**
 * The app's furniture and bottom bar, drawn on the tall phone in its points and scaled whole to the screen's place: the
 * furniture in the video's box, cut as the stage is; the bar's five plain marks, words under them on TikTok only.
 */
function Drawing({ app, title, layout }: { app: "tiktok" | "reels"; title: string; layout: PostedLayout }) {
  const phone = phoneOf(app);
  const { screen, pt } = layout;
  return (
    <div
      data-part="phone" aria-hidden className="absolute origin-top-left"
      style={{ left: screen.left, top: screen.top, width: phone.screen.width, height: phone.screen.height, transform: `scale(${pt})` }}
    >
      <div data-part="furniture" className={cn("absolute drop-shadow-sm/50", ON_FOOTAGE)} style={{ ...placed(phone.video), clipPath: clipOf(phone) }}>
        {FURNITURE[app].map((shape, index) => (
          <Drawn key={index} shape={shape} app={app} title={title} />
        ))}
      </div>
      {phone.band !== null && (
        <div data-part="band" className="absolute flex justify-around bg-black pt-3.5" style={placed(phone.band)}>
          {NAV.map((word, index) => (
            <span key={index} data-part="nav-mark" className={cn("flex flex-col items-center gap-1 text-micro", QUIET_ON_FOOTAGE)}>
              {word === "" ? (
                <span className="h-[26px] w-10 rounded-[9px] bg-action-foreground dark:bg-foreground" />
              ) : (
                <span className="size-[22px] rounded-[7px] border-[1.8px] border-current" />
              )}
              {app === "tiktok" && word}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** One shape of an app's furniture, in percent of the video's frame. */
function Drawn({ shape, app, title }: { shape: Shape; app: "tiktok" | "reels"; title: string }) {
  const [left, top, width, height] = shape.box;
  const box: CSSProperties = { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` };
  switch (shape.kind) {
    case "avatar":
      return (
        <span className="absolute flex flex-col items-center" style={box}>
          <span className="aspect-square w-full rounded-full border-2 border-current bg-current/25" />
          {/* TikTok's follow: a small plus under the circle, cut out of a disc. */}
          {app === "tiktok" && (
            <svg viewBox="0 0 16 16" className="-mt-2 size-4 shrink-0">
              <path fill="currentColor" fillRule="evenodd" d="M8 0a8 8 0 1 1 0 16A8 8 0 1 1 8 0zM7 4h2v3h3v2H9v3H7V9H4V7h3z" />
            </svg>
          )}
        </span>
      );
    case "glyph":
    case "count": {
      const Icon = shape.icon ? ICONS[shape.icon] : null;
      return (
        <span className="absolute flex flex-col items-center justify-center" style={box}>
          {Icon && <Icon size={GLYPH[app]} className="shrink-0" aria-hidden />}
          {shape.text !== undefined && <span className="whitespace-nowrap text-caption font-[600] leading-none">{shape.text}</span>}
        </span>
      );
    }
    case "disc":
      return (
        <span className="absolute flex items-center justify-center" style={box}>
          <DiscIcon className="size-full" aria-hidden />
        </span>
      );
    case "tile":
      return <span className="absolute rounded-[7px] border-2 border-current bg-current/25" style={box} />;
    case "mark":
      // Reels' top row: a back chevron on the left, a square across from it.
      return left < 50 ? (
        <span className="absolute flex items-center justify-center" style={box}>
          <BackIcon strokeWidth={2.2} className="h-full w-auto shrink-0" aria-hidden />
        </span>
      ) : (
        <span className="absolute flex items-center justify-center" style={box}>
          <span className="aspect-square h-full rounded-[6px] border-2 border-current" />
        </span>
      );
    case "follow":
      return (
        <span className="absolute flex items-center gap-1.5 whitespace-nowrap" style={{ left: box.left, top: box.top, height: box.height }}>
          <span className="text-ui font-[640]">{shape.text}</span>
          <span className="rounded-md border border-current px-1.5 text-caption font-[600] leading-[18px]">Follow</span>
        </span>
      );
    case "text": {
      const line: CSSProperties = { left: box.left, top: box.top, width: box.width };
      // The post's caption: the edit's title, cut to two lines on TikTok and one on Reels.
      if (shape.text === undefined) return <span className={cn("absolute break-words text-meta", app === "tiktok" ? "line-clamp-2" : "truncate")} style={line}>{title}</span>;
      return <span className={cn("absolute truncate", shape.text === NAME ? "text-ui font-[640]" : "text-label")} style={line}>{shape.text}</span>;
    }
  }
}
