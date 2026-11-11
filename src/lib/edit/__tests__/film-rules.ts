/**
 * film-rules.ts — the rules a compiled film keeps that OpenFilm's reader does not check.
 *
 * `readFilmFile` checks a film's form. It has no files and no timeline, so it cannot see the rules
 * below (spec R2, R3, R6). The edit tests hold every film they compile to them with `filmFaults`;
 * it works on any valid document, not only the fixture. A guard, not a second compiler: each rule
 * reads the film as the engine does and compares.
 */
import { clipSpan, readFilmFile } from "openfilm/film-doc";
import type { Compiled } from "../compile";
import type { Asset, EditSpec } from "../spec";
import { frameMs } from "../time";

/**
 * Floating-point noise, and nothing more: clips on a track must be disjoint and nothing may end after
 * the film. OpenFilm's own overlap check (`checkOverlaps` in node_modules/openfilm/src/look.mjs) lets
 * a clip start 1 ms early, but it only warns at render time, and 1 ms is drawn: frame 56 is sampled at
 * 1.8667 s, inside [1.866, 1.867). Our times are whole milliseconds, so they need no grace (as for file ends below).
 */
const NOISE_S = 1e-6;

/**
 * What is wrong with a compiled film, one readable line per fault; empty when it keeps every rule:
 * the reader finds no problem; every `at` is a frame's floored millisecond; every file is in the
 * folder (`assets/...` that the compile lists, or `kit/v1/...`); no clip plays past its file's end
 * or the film's end; no two clips on one track overlap.
 */
export function filmFaults(spec: EditSpec, out: Compiled): string[] {
  const html = out.files["film.html"];
  const read = readFilmFile(html);
  if (!read.value) return read.problems.map((p) => `reader: ${p}`);
  const faults: string[] = [];
  const filmEnd = frameMs(out.frames);

  /* times as film.html writes them (the reader rounds them to the millisecond as it reads) */
  for (const [, at = ""] of html.matchAll(/ at="([^"]*)"/g)) {
    const ms = Math.round(Number(at) * 1000);
    if (!/^\d+(\.\d{1,3})?$/.test(at) || frameMs(Math.ceil((ms * 30) / 1000)) !== ms) faults.push(`at="${at}" is not the floored millisecond of a frame`);
  }

  /* the files the folder will hold: what the compile lists, and the kit */
  const files = new Map<string, Asset>();
  for (const { id, file } of out.assets) {
    const asset = spec.assets[id];
    if (asset) files.set(file, asset);
  }
  for (const asset of Object.values(spec.assets)) if ("kit" in asset.at) files.set(`kit/${spec.kit}/${asset.at.kit}`, asset);
  const inFolder = (src: string): boolean => /^(assets|kit\/v1)\//.test(src) && !src.split("/").includes("..");

  read.value.tracks.forEach((track, t) => {
    if (track.captions && (track.captions.src !== "captions.vtt" || out.files["captions.vtt"] == null)) {
      faults.push(`track ${t}: its captions read "${track.captions.src}", which the compile does not write`);
    }
    const spans: { id: string; at: number; end: number }[] = [];
    for (const clip of track.clips) {
      const where = `${clip.id} (track ${t})`;
      if (!inFolder(clip.src)) faults.push(`${where}: src "${clip.src}" is not under assets/ or kit/v1/`);
      const asset = files.get(clip.src);
      if (clip.src.startsWith("assets/") && !asset) faults.push(`${where}: "${clip.src}" is not one of the files the compile lists`);
      const fileMs = asset && asset.kind !== "image" ? asset.ms : undefined;
      let span: ReturnType<typeof clipSpan>;
      try {
        span = clipSpan(clip, fileMs == null ? undefined : fileMs / 1000, where);
      } catch (error) {
        faults.push(String((error as Error).message).split("\n")[0] ?? "");
        continue;
      }
      /* the engine lets a window end up to 1 ms past its file; windows are whole milliseconds, so none may (R3) */
      if (fileMs != null && Math.round(span.to * 1000) > fileMs) faults.push(`${where}: plays its file to ${span.to} s, past its end at ${fileMs / 1000} s`);
      const at = clip.at ?? 0;
      const end = at + span.length;
      if (end > filmEnd / 1000 + NOISE_S) faults.push(`${where}: ends at ${end} s, after the film's end at ${filmEnd / 1000} s`);
      spans.push({ id: clip.id, at, end });
    }
    spans.sort((a, b) => a.at - b.at);
    spans.forEach((clip, i) => {
      const before = spans[i - 1];
      if (before && clip.at < before.end - NOISE_S) faults.push(`track ${t}: ${clip.id} starts at ${clip.at} s, before ${before.id} ends at ${before.end} s`);
    });
  });
  return faults;
}
