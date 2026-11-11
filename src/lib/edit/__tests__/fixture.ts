/**
 * fixture.ts — one edit for the edit tests. It holds the five segments below (a punch-in, a dissolve, a
 * blurred fill, a coloured wipe, a still with a move and a filter), one sticker layer, two texts (a label
 * pinned to s1 with motions, an outline without), captions with two fixes, a kit sound pinned to s2 and
 * music with a fade-out, and a cover frame. It does NOT hold a dip to black, a clip layer, a voiceover,
 * the `rise` motion, the `plain` preset, a look filter, a speed change, a generated asset or a `ref`:
 * tests that need those add them.
 *
 * The words are the real Whisper (base) transcript of a 12.7 s phone take, mishearings included:
 * "Cloud" for Claude and "Bertuna" for Virtuna. The fixture corrects both through `captions.fixes`.
 *
 *   s1  take   frames   0-56    punched in                       → cut
 *   s2  take   frames  56-103                                    → dissolve, 12 frames
 *   s3  broll  frames 103-163   landscape, blurred fill          → shutter wipe, coral
 *   s4  photo  frames 163-208   still, push-in, mono             → cut
 *   s5  take   frames 208-298   "Virtuna App will soon be ..."
 */
import { DEFAULT_CAPTION_STYLE, STAGE, newSegment, newText, type EditSpec, type Word } from "../spec";

const W = (t0: number, t1: number, text: string): Word => ({ t0, t1, text });

export const WORDS: Word[] = [
  W(0, 420, "Hello"), W(420, 930, "guys,"), W(930, 1100, "we"), W(1100, 1350, "are"), W(1350, 1690, "back"),
  W(1690, 1860, "in"), W(1860, 2110, "the"), W(2110, 2520, "booth"), W(2520, 4000, "again."), W(4000, 4190, "We"),
  W(4190, 4470, "can"), W(4470, 4750, "see"), W(4750, 5160, "here"), W(5160, 5710, "working"), W(5710, 5880, "on"),
  W(5880, 6100, "some"), W(6100, 6670, "Cloud"), W(6670, 7070, "Code"), W(7070, 8280, "projects."), W(8280, 9050, "Bertuna"),
  W(9050, 9410, "App"), W(9410, 9820, "will"), W(9820, 10260, "soon"), W(10260, 10520, "be"), W(10520, 11340, "available."),
  W(11340, 11630, "Stay"), W(11630, 12700, "tuned."),
];

export function fixture(): EditSpec {
  return {
    v: 1,
    stage: { ...STAGE },
    kit: "v1",
    assets: {
      take: { id: "take", kind: "video", origin: "filmed", at: { bucket: "takes", path: "u1/take.mov" }, ms: 12700, w: 1080, h: 1920, sound: true, words: WORDS },
      broll: { id: "broll", kind: "video", origin: "uploaded", at: { bucket: "takes", path: "u1/broll.mp4" }, ms: 8000, w: 1280, h: 720, sound: true, words: null },
      photo: { id: "photo", kind: "image", origin: "uploaded", at: { bucket: "takes", path: "u1/photo.jpg" }, w: 1280, h: 720, sound: false, words: null },
      kick: { id: "kick", kind: "audio", origin: "kit", at: { kit: "sfx/kick.m4a" }, ms: 450, sound: true, words: null },
      song: { id: "song", kind: "audio", origin: "uploaded", at: { bucket: "takes", path: "u1/song.mp3" }, ms: 30000, sound: true, words: null },
    },
    main: [
      { ...newSegment({ id: "s1", asset: "take", len: 56, beat: 0 }), framing: { zoom: 1.3, x: 0, y: -0.24 } },
      { ...newSegment({ id: "s2", asset: "take", len: 47, inMs: 1866, beat: 0 }), cutOut: { kind: "fade", style: "dissolve", len: 12 } },
      { ...newSegment({ id: "s3", asset: "broll", len: 60, inMs: 1000, beat: 1 }), fit: "blur", cutOut: { kind: "wipe", id: "shutter", color: "#ff6363" } },
      { ...newSegment({ id: "s4", asset: "photo", len: 45, beat: 2 }), move: { kind: "push-in", amount: 0.5 }, filter: "mono" },
      newSegment({ id: "s5", asset: "take", len: 90, inMs: 8280, beat: 3 }),
    ],
    layers: [
      { id: "l1", pin: null, at: 120, len: 30, kind: "sticker", asset: "photo", inMs: 0, speed: 1, volume: 1, box: { x: 0.6, y: 0.1, w: 0.3, h: 0.17 }, rotate: 8, opacity: 1, radius: 24, z: 1 },
    ],
    texts: [
      newText({ id: "t1", text: "POV: back in the booth", at: 0, len: 56, pin: "s1" }),
      { ...newText({ id: "t2", text: "Stay tuned", at: 250, len: 48 }), style: { preset: "outline", font: "inter", weight: 800, size: 96, color: "#ffe14a", fill: null, stroke: { color: "#000000", w: 12 }, align: "center", uppercase: true }, box: { x: 0.5, y: 0.5, w: 0.8 }, in: null, out: null },
    ],
    captions: { on: true, lang: "en", style: { ...DEFAULT_CAPTION_STYLE }, fixes: { take: { "16": "Claude", "19": "Virtuna" } } },
    sounds: [
      { id: "k1", pin: "s2", at: 0, len: 14, role: "sfx", asset: "kick", inMs: 0, volume: 0.6, fadeIn: 0, fadeOut: 0 },
      { id: "m1", pin: null, at: 0, len: 298, role: "music", asset: "song", inMs: 0, volume: 0.4, fadeIn: 0, fadeOut: 30 },
    ],
    look: { filter: null },
    cover: { frame: 20 },
    ref: null,
  };
}

/** Where a test's assets live inside the film folder. */
export const file = (asset: { id: string; kind: string }): string =>
  `assets/${asset.id}.${asset.kind === "image" ? "jpg" : asset.kind === "audio" ? "mp3" : "mp4"}`;
