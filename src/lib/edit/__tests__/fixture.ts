/**
 * fixture.ts — one small valid edit every test starts from, and the files an edit may use. Each
 * call gives a fresh copy.
 *
 * A 12.7 s take cut into two shots (its first 5 s, then 8 s to 12 s). On the second shot a
 * call-out rides on the word "Virtuna" and a whoosh starts with the shot. A progress bar runs over
 * the whole film, which is 270 frames long.
 */
import { DEFAULT_CAPTIONS, NO_LOOK, STAGE, newShot, type Asset, type Edit } from "../doc";

export const picture: Asset = { id: "pic", kind: "image", origin: "uploaded", at: { bucket: "edit-media", path: "u1/pic.jpg" }, w: 1080, h: 1920 };
export const voice: Asset = { id: "voice", kind: "audio", origin: "uploaded", at: { bucket: "edit-media", path: "u1/voice.m4a" }, ms: 3000 };

export function fixture(): Edit {
  return {
    v: 1,
    kit: "1",
    stage: { ...STAGE },
    assets: [
      {
        id: "take", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: "u1/take.mp4" },
        ms: 12700, w: 720, h: 1280, sound: true,
        words: [
          { text: "Hello", startMs: 600, endMs: 900 },
          { text: "guys,", startMs: 900, endMs: 1300 },
          { text: "Virtuna", startMs: 8920, endMs: 9400 },
          { text: "App", startMs: 9400, endMs: 9660 },
        ],
      },
      { id: "broll", kind: "video", origin: "uploaded", at: { bucket: "edit-media", path: "u1/broll.mp4" }, ms: 4000, w: 1920, h: 1080, sound: false, words: null },
      { id: "whoosh", kind: "audio", origin: "kit", at: { kit: "sfx/whoosh.wav" }, ms: 677 },
    ],
    shots: [
      newShot({ id: "s1", asset: "take", endMs: 5000 }),
      {
        ...newShot({ id: "s2", asset: "take", startMs: 8000, endMs: 12000 }),
        marks: [
          { id: "m1", part: "callout", atMs: 8920, lenMs: 740, props: { text: "Virtuna", font: "tiktok", look: "pop", x: 0.5, y: 0.2, size: 120, color: "#ffffff" } },
          { id: "w1", part: "sound", asset: "whoosh", atMs: 8000, lenMs: 660, props: { startMs: 0, volume: 0.6, fadeInMs: 0, fadeOutMs: 120 } },
        ],
      },
    ],
    items: [{ id: "bar", part: "progress", anchor: "start", at: 0, frames: null, props: { edge: "top", color: "#ffffff" } }],
    captions: { ...DEFAULT_CAPTIONS },
    look: structuredClone(NO_LOOK),
    cover: null,
  };
}

/** The files the fixture's owner may put in an edit: the three it uses, a picture and a recorded voice. */
export function library(): Asset[] {
  return [...fixture().assets, structuredClone(picture), structuredClone(voice)];
}
