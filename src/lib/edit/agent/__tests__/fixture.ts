/**
 * fixture.ts — the agent suites' made-up take and a two-shot edit of it, with its analysis. No word of anyone's take: the words
 * are made up. Moved out of `context.test.ts` unchanged (slice B, Task 1), so that `moment.test.ts` reads the same edit.
 */
import type { FaceSample, ShareBox, TakeAnalysis } from "../../analysis";
import { DEFAULT_CAPTIONS, NEUTRAL, STAGE, newShot, type Asset, type Edit, type Word } from "../../doc";

/* ── a made-up take and a two-shot edit of it ──────────────────────────────────────────────────── */

export const WORDS: Word[] = [
  { text: "Hi", startMs: 300, endMs: 500 },
  { text: "there", startMs: 500, endMs: 800 },
  { text: "so", startMs: 1500, endMs: 1700, hidden: true },
  { text: "this", startMs: 1700, endMs: 2100, stress: true },
  { text: "works", startMs: 3200, endMs: 3600 },
  { text: "well", startMs: 3600, endMs: 4000, hidden: true, stress: true },
];
export const take = (over: Partial<Extract<Asset, { kind: "video" }>> = {}): Extract<Asset, { kind: "video" }> => ({
  id: "t1", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: "u1/t1.mp4" }, ms: 6000, w: 720, h: 1280, sound: true, words: structuredClone(WORDS), ...over,
});
export const pop: Asset = { id: "pop", kind: "audio", origin: "kit", at: { kit: "sfx/pop.wav" }, ms: 500 };

/** Two shots of the take: its first 2.4 s fading into 3 s to its end, framed 1.2 times closer, in black and white, with a call-out and a pop on "works". */
export function twoShots(): Edit {
  return {
    v: 1, kit: "1", stage: { ...STAGE },
    assets: [take(), structuredClone(pop)],
    shots: [
      { ...newShot({ id: "s1", asset: "t1", endMs: 2400 }), out: { kind: "fade", frames: 6 } },
      {
        ...newShot({ id: "s2", asset: "t1", startMs: 3000, endMs: 6000 }),
        framing: { from: { zoom: 1.2, x: 0, y: 0 }, move: null },
        look: { preset: "mono", adjust: { ...NEUTRAL } },
        marks: [
          { id: "m1", part: "callout", atMs: 3200, lenMs: 800, props: { text: "works", font: "tiktok", look: "pop", x: 0.5, y: 0.3, size: 120, color: "#ffffff" } },
          { id: "p1", part: "sound", asset: "pop", atMs: 3200, lenMs: 400, props: { startMs: 0, volume: 0.8, fadeInMs: 0, fadeOutMs: 100 } },
        ],
      },
    ],
    items: [{ id: "bar", part: "progress", anchor: "start", at: 0, frames: null, props: { edge: "top", color: "#ffffff" } }],
    captions: { ...DEFAULT_CAPTIONS },
    look: { preset: "warm", adjust: { ...NEUTRAL, saturation: 0.2 } },
    cover: { shot: "s1", atMs: 600 },
  };
}

export const box = (x: number, y: number, w: number, h: number): ShareBox => ({ x, y, w, h });
export const MOUTH = box(0.4, 0.42, 0.2, 0.05);
/**
 * Five samples a second over 6 s: a face at x 0.25 to 0.75 and y 0.25 to 0.5 with its mouth at x 0.4
 * to 0.6 and y 0.42 to 0.47, none at 1 s and 1.2 s, and both 0.1 further right from 4 s.
 */
export function faces(): FaceSample[] {
  return Array.from({ length: 30 }, (_, i) => {
    const ms = i * 200;
    if (ms === 1000 || ms === 1200) return { ms, face: null, mouth: null };
    const right = ms < 4000 ? 0 : 0.1;
    return { ms, face: box(0.25 + right, 0.25, 0.5, 0.25), mouth: box(MOUTH.x + right, MOUTH.y, MOUTH.w, MOUTH.h) };
  });
}
export const analysis = (over: Partial<TakeAnalysis> = {}): TakeAnalysis => ({
  language: "en",
  pauses: [{ startMs: 900, endMs: 1500, cutMs: 1200 }, { startMs: 2300, endMs: 3100, cutMs: 2700 }],
  faces: faces(),
  loudness: null,
  ...over,
});
