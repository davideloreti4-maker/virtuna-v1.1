/**
 * captions.ts — captions worked out from words.
 *
 * An edit stores no caption lines. Every source that can be heard carries its transcript (words
 * timed in the source's own milliseconds); the lines are worked out from the part of each source
 * that is on the film. So a trim moves the captions with it, with no re-transcription, and a
 * correction is kept by asset and word index, which survive trims and reorders (spec F2).
 *
 * The file is WebVTT on the film's time, as OpenFilm's caption track reads it: one STYLE block,
 * one cue per line, a timestamp before every word so the player can tell said from still to come.
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §3.4 and §5.4.
 */
import { frameOf, starts, total } from "../derive";
import { FONTS } from "../kit";
import type { EditSpec, Word } from "../spec";
import { frameMs, sourceMs, spanMs } from "../time";
import { num } from "./html";

/** Shorter than this, a line is a flicker, not a caption. */
const MIN_CUE_MS = 120;

/**
 * A word as it can stand on its cue's one line: every run of white space and control characters is
 * one space, and the ends are trimmed. A line break inside a cue's words would end the cue there
 * (WebVTT), so a stored word or fix that holds one is made safe here, whatever the document says.
 */
const oneLine = (text: string): string => text.replace(/[\s\p{Cc}]+/gu, " ").trim();

export interface Cue {
  /** film milliseconds */
  start: number;
  end: number;
  words: { at: number; text: string }[];
}

interface Heard {
  assetId: string;
  words: Word[];
  /** the part of the source on the film, in the source's milliseconds */
  inMs: number;
  usedMs: number;
  /** where that part starts and ends on the film */
  atMs: number;
  endMs: number;
  speed: number;
}

/** Every source that is heard and has words, in film order. */
function heard(spec: EditSpec): Heard[] {
  const out: Heard[] = [];
  const at = starts(spec);
  spec.main.forEach((seg, i) => {
    const asset = spec.assets[seg.asset];
    if (!asset || asset.kind !== "video" || !asset.words || seg.volume === 0) return;
    const start = at[i] ?? 0;
    out.push({
      assetId: asset.id, words: asset.words, inMs: seg.inMs, usedMs: sourceMs(start, seg.len, seg.speed),
      atMs: frameMs(start), endMs: frameMs(start + seg.len), speed: seg.speed,
    });
  });
  const end = total(spec);
  for (const sound of spec.sounds) {
    const asset = spec.assets[sound.asset];
    const start = frameOf(spec, sound);
    if (sound.role !== "voiceover" || !asset?.words || sound.volume === 0 || start == null || start >= end) continue;
    const len = Math.min(sound.len, end - start); // cut at the film's end, as its clip is
    out.push({
      assetId: asset.id, words: asset.words, inMs: sound.inMs, usedMs: spanMs(start, len),
      atMs: frameMs(start), endMs: frameMs(start + len), speed: 1,
    });
  }
  return out.sort((a, b) => a.atMs - b.atMs);
}

/** The caption lines of the edit, on the film's time. */
export function cuesOf(spec: EditSpec): Cue[] {
  const { maxWords } = spec.captions.style;
  const cues: Cue[] = [];

  for (const src of heard(spec)) {
    const fixes = spec.captions.fixes[src.assetId] ?? {};
    let group: { at: number; end: number; text: string }[] = [];
    const close = (): void => {
      const first = group[0];
      const last = group[group.length - 1];
      if (first && last) {
        const start = Math.max(src.atMs, first.at);
        const end = Math.min(src.endMs, last.end);
        if (end - start >= MIN_CUE_MS) {
          cues.push({ start, end, words: group.map((w) => ({ at: Math.min(end - 1, Math.max(start, w.at)), text: w.text })) });
        }
      }
      group = [];
    };

    src.words.forEach((word, index) => {
      const middle = (word.t0 + word.t1) / 2;
      if (middle < src.inMs || middle >= src.inMs + src.usedMs) return;
      const fixed = fixes[String(index)];
      if (fixed === null) return; // hidden
      const text = oneLine(fixed ?? word.text);
      if (!text) return; // nothing left once its white space is gone: hidden, as a word fixed to null is
      group.push({
        at: src.atMs + Math.floor((word.t0 - src.inMs) / src.speed),
        end: src.atMs + Math.floor((word.t1 - src.inMs) / src.speed),
        text,
      });
      if (group.length === maxWords || /[.!?]$/.test(text)) close();
    });
    close();
  }

  /* one line at a time: a line ends where the next begins */
  cues.sort((a, b) => a.start - b.start);
  cues.forEach((cue, i) => {
    const next = cues[i + 1];
    if (next && cue.end > next.start) cue.end = next.start;
  });
  return cues.filter((cue) => cue.end - cue.start >= MIN_CUE_MS);
}

/** `00:00:01.866` */
function stamp(ms: number): string {
  const pad = (n: number, width = 2): string => String(n).padStart(width, "0");
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
}

const vttText = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The caption track's file for those lines. */
export function vttOf(spec: EditSpec, cues: Cue[]): string {
  const style = spec.captions.style;
  const font = FONTS[style.font];
  const lines = [
    "WEBVTT",
    "",
    "STYLE",
    `@font-face { font-family: '${font.family}'; src: url('kit/${spec.kit}/${font.file}') format('woff2'); font-weight: 100 900; }`,
    `::cue { --box: ${style.fill ?? "none"}; --font: '${font.family}', sans-serif; --weight: ${style.weight}; --size: ${num((style.size / 1920) * 100)}cqh; `
      + `--color: ${style.color}; --stroke: ${style.stroke ? `${num(style.stroke.w)}px` : "0"}; --stroke-color: ${style.stroke?.color ?? "transparent"}; `
      + `text-transform: ${style.uppercase ? "uppercase" : "none"}; }`,
    `::cue(:future) { opacity: ${num(1 - style.dimAhead)}; }`,
    ...(style.highlight ? [`::cue(:past:not(:has(~ :past))) { color: ${style.highlight}; }`] : []),
    "",
  ];
  const place = `line:${num(style.y * 100)}%,center size:${num(style.width * 100)}%`;
  cues.forEach((cue, i) => {
    lines.push(`c${i + 1}`, `${stamp(cue.start)} --> ${stamp(cue.end)} ${place}`, cue.words.map((w) => `<${stamp(w.at)}>${vttText(w.text)}`).join(" "), "");
  });
  return lines.join("\n");
}
