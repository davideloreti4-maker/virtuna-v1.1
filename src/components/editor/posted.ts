/**
 * posted.ts — the video as it will be posted (spec 2026-11-24-editor-screens-design.md E17; plan 2026-11-25-editor-screens-b,
 * Task 6, ruling S10; the numbers from `.scratch/editor/slice-b/safe-zones.md`, measured on captures of both apps in 2026): a
 * phone drawn to scale, and the app's buttons drawn over its video.
 *
 * Each app has one screen on the tall phone of those captures, 393 × 852 points (`phoneOf`). The apps fit a 9:16 video
 * differently there: TikTok shows it whole at the screen's width under its top strip, its bottom bar under it; Reels zooms it to
 * cover the screen down to its bottom bar and cuts its sides. Off is the video alone, whole. That screen is fitted whole inside
 * the browser's visible area, centred (`postedLayout`), and everything on it scales with it, so the video and every piece of
 * furniture keep their places relative to each other at every size, and nothing of them is ever under a bar or cut off.
 *
 * The creator's own controls are no furniture: the top row (close, the switch, the sound) and the scrubber sit outside the
 * phone where there is room, above and below it, and over its top and bottom edge where there is none, where the app draws
 * nothing of the post: TikTok's top strip and bottom bar, Reels' status bar and bottom bar. They keep their own size.
 *
 * Pure, but `readApp` and `keepApp`, which keep the choice on the device. The furniture is our own drawing: plain shapes and
 * made-up names and counts, no logo, no mark, no app's own icons. The apps' names are on the switch alone.
 */

export type App = "tiktok" | "reels" | "off";
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}
/** An app's screen and what is on it. */
export interface Phone {
  /** The phone's screen: the app's top strip where it has one, the video, the app's bottom bar. */
  screen: Box;
  /** The whole 9:16 frame of the video, also where it lies beyond what is seen (Reels' cut sides). */
  video: Box;
  /** What of the video is seen. */
  clip: Box;
  /** The app's bottom bar; none with Off. */
  band: Box | null;
}
/** The phone placed in the browser's area, in px, and the creator's controls around it. */
export interface PostedLayout extends Phone {
  /** One of the phone's points in px: the scale it is drawn at. */
  pt: number;
  controls: {
    /** The row of close, the switch and the sound. */
    top: Box;
    /** The scrubber, 16 in from the phone's sides. */
    bottom: Box;
  };
}

/** The tall phone of the captures, in points. */
const PHONE = { w: 393, h: 852 };
const VIDEO_H = (PHONE.w * 16) / 9;
/** TikTok's top strip and bottom bar, Reels' bottom bar, in points (safe-zones §3). */
const TIKTOK_TOP = 50;
const TIKTOK_BAR = 103;
const REELS_BAR = 82;

/** An app's screen on the tall phone, in its points, its top-left corner at 0, 0. */
export function phoneOf(app: App): Phone {
  if (app === "off") {
    const video = { left: 0, top: 0, width: PHONE.w, height: VIDEO_H };
    return { screen: video, video, clip: video, band: null };
  }
  const screen = { left: 0, top: 0, width: PHONE.w, height: PHONE.h };
  if (app === "tiktok") {
    const video = { left: 0, top: TIKTOK_TOP, width: PHONE.w, height: VIDEO_H };
    return { screen, video, clip: video, band: { left: 0, top: PHONE.h - TIKTOK_BAR, width: PHONE.w, height: TIKTOK_BAR } };
  }
  const clip = { left: 0, top: 0, width: PHONE.w, height: PHONE.h - REELS_BAR };
  const width = (clip.height * 9) / 16;
  return { screen, video: { left: (PHONE.w - width) / 2, top: 0, width, height: clip.height }, clip, band: { left: 0, top: clip.height, width: PHONE.w, height: REELS_BAR } };
}

/** The creator's controls: the row's height, the scrubber's, the space they keep from the phone, the row's least width. */
const ROW = 36;
const BAR = 44;
const GAP = 8;
const ROW_MIN = 300;

/** An app's phone fitted whole in an area of the browser (`w` × `h` px, from 0, 0), centred, and the controls around it. */
export function postedLayout(app: App, area: { w: number; h: number }): PostedLayout {
  const phone = phoneOf(app);
  const pt = Math.min(area.w / phone.screen.width, area.h / phone.screen.height);
  const x = (area.w - phone.screen.width * pt) / 2;
  const y = (area.h - phone.screen.height * pt) / 2;
  const at = (box: Box): Box => ({ left: x + box.left * pt, top: y + box.top * pt, width: box.width * pt, height: box.height * pt });
  const screen = at(phone.screen);
  const end = screen.top + screen.height;
  const rowWidth = Math.min(area.w, Math.max(screen.width, ROW_MIN));
  const top = {
    left: screen.left + (screen.width - rowWidth) / 2,
    top: screen.top >= ROW + 2 * GAP ? screen.top - GAP - ROW : screen.top + GAP,
    width: rowWidth,
    height: ROW,
  };
  const bottom = { left: screen.left + 16, top: area.h - end >= BAR ? end : end - BAR, width: screen.width - 32, height: BAR };
  return { pt, screen, video: at(phone.video), clip: at(phone.clip), band: phone.band && at(phone.band), controls: { top, bottom } };
}

/** The CSS `clip-path` that cuts the video's frame to what is seen of it: `inset(top right bottom left)`, each at least 0. */
export function clipOf({ video, clip }: Pick<Phone, "video" | "clip">): string {
  const sides = [clip.top - video.top, video.left + video.width - (clip.left + clip.width), video.top + video.height - (clip.top + clip.height), clip.left - video.left];
  return `inset(${sides.map((side) => `${Math.round(Math.max(0, side) * 100) / 100}px`).join(" ")})`;
}

/** Where the device keeps the app last chosen. */
export const POSTED_KEY = "maven.editor.posted";
const isApp = (kept: string | null): kept is App => kept === "tiktok" || kept === "reels" || kept === "off";

/** The app last chosen on this device; TikTok when none was, when what is kept is no app, or when the storage cannot be read. */
export function readApp(): App {
  try {
    const kept = window.localStorage.getItem(POSTED_KEY);
    return isApp(kept) ? kept : "tiktok";
  } catch {
    return "tiktok";
  }
}

/** Keeps the app chosen on this device; a storage that refuses it (full, private, blocked) leaves it unkept. */
export function keepApp(app: App): void {
  try {
    window.localStorage.setItem(POSTED_KEY, app);
  } catch {
    // Nothing to do: the next preview opens on TikTok.
  }
}

/** A shape of an app's furniture, its box in percent of the video's frame: left, top, width, height. */
export interface Shape {
  kind: "avatar" | "glyph" | "count" | "text" | "disc" | "tile" | "mark" | "follow";
  icon?: "heart" | "chat" | "save" | "share" | "repost" | "more";
  /** The words drawn; a `text` with none is the post's caption, which the edit's title stands for. */
  text?: string;
  box: readonly [number, number, number, number];
}

/** The account's made-up name. */
export const NAME = "yourname";

/**
 * Each app's buttons and words at rest, for a 393 × 852 phone (safe-zones §5.1). TikTok's name, caption and sound line are
 * moved up together by 2.9 so the sound line fits under the caption. A `mark` left of the middle is Reels' back chevron, one
 * right of it the square across from it.
 */
export const FURNITURE: Record<"tiktok" | "reels", readonly Shape[]> = {
  tiktok: [
    { kind: "avatar", box: [87.2, 43.2, 10.0, 6.4] }, // a circle with a small plus under it
    { kind: "glyph", icon: "heart", text: "12.4K", box: [88.6, 54.8, 7.5, 5.7] },
    { kind: "glyph", icon: "chat", text: "318", box: [88.7, 64.1, 7.3, 6.1] },
    { kind: "glyph", icon: "save", text: "902", box: [89.6, 73.8, 5.5, 6.0] },
    { kind: "glyph", icon: "share", text: "211", box: [88.7, 83.1, 7.0, 6.3] },
    { kind: "disc", box: [88.6, 94.9, 7.4, 4.2] },
    { kind: "text", text: NAME, box: [3.0, 87.1, 20, 2.1] },
    { kind: "text", box: [3.0, 90.5, 70, 4.8] }, // the caption: the edit's title, two lines
    { kind: "text", text: "♫ original sound", box: [3.0, 96.3, 60, 1.9] },
  ],
  reels: [
    { kind: "glyph", icon: "heart", text: "8,915", box: [85.1, 53.6, 6.1, 6.0] },
    { kind: "glyph", icon: "chat", text: "112", box: [85.5, 62.7, 5.6, 5.5] },
    { kind: "glyph", icon: "repost", text: "47", box: [85.7, 68.6, 5.1, 6.8] },
    { kind: "glyph", icon: "share", text: "260", box: [85.5, 78.8, 5.6, 5.7] },
    { kind: "glyph", icon: "more", box: [85.9, 88.6, 4.7, 1.3] },
    { kind: "tile", box: [84.7, 93.4, 7.1, 4.0] },
    { kind: "avatar", box: [8.4, 88.9, 8.1, 4.5] },
    { kind: "follow", text: NAME, box: [18.4, 89.2, 28.8, 1.8] }, // the name and a "Follow" outline
    { kind: "text", text: "♫ Original audio", box: [18.6, 92.1, 15.8, 1.5] },
    { kind: "text", box: [8.3, 95.2, 70, 1.8] }, // the caption: the edit's title, one line
    { kind: "mark", box: [12.0, 9.5, 2.6, 2.9] }, // the top row: a back chevron, a square on the right
    { kind: "mark", box: [85.0, 9.5, 5.2, 2.9] },
  ],
};
