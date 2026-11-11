/**
 * items.ts — text, layers and sounds as film clips.
 *
 * Text is ONE kit page (`text.html`) for every text item. What a text says, how it looks, where
 * it sits and how it comes and goes all travel in the clip's `overrides`, as its words and as CSS
 * variables on the page's `#t` element. So editing a text changes film.html only, never a file,
 * and the in-page player applies it in place (spec F3, proved 2026-11-11).
 *
 * Anything that runs past the film's end is cut off there.
 */
import { frameOf, total } from "../derive";
import { FONTS } from "../kit";
import type { EditSpec, Layer, Sound, TextItem } from "../spec";
import { frameMs, sec, spanMs } from "../time";
import { H, W, attr, jsonAttr, num, type Placed } from "./html";

/** The film milliseconds an item covers, cut at the film's end; null when it is not on the film at all. */
function span(spec: EditSpec, item: { pin: string | null; at: number; len: number }): { from: number; to: number; start: number; len: number } | null {
  const start = frameOf(spec, item);
  const end = total(spec);
  if (start == null || start >= end) return null;
  const len = Math.min(item.len, end - start);
  return { from: frameMs(start), to: frameMs(start + len), start, len };
}

function textVars(text: TextItem, lenMs: number): Record<string, string> {
  const style = text.style;
  return {
    "--x": num(text.box.x),
    "--y": num(text.box.y),
    "--w": num(text.box.w),
    "--font": `'${FONTS[style.font].family}'`,
    "--weight": String(style.weight),
    "--size": `${num(style.size)}px`,
    "--color": style.color,
    "--fill": style.fill ?? "transparent",
    "--pad": style.preset === "label" ? "18px 30px" : "0",
    "--radius": style.preset === "label" ? "22px" : "0",
    "--stroke": style.stroke ? `${num(style.stroke.w)}px` : "0",
    "--stroke-color": style.stroke?.color ?? "transparent",
    "--align": style.align,
    "--case": style.uppercase ? "uppercase" : "none",
    "--rotate": `${num(text.rotate)}deg`,
    "--in": text.in ?? "none",
    "--out": text.out ?? "none",
    "--len": num(lenMs / 1000),
  };
}

export function textClips(spec: EditSpec): Placed[] {
  const out: Placed[] = [];
  for (const text of spec.texts) {
    const at = span(spec, text);
    if (!at) continue;
    const overrides = [{ at: "#t", text: text.text, style: textVars(text, at.to - at.from) }];
    out.push({
      from: at.from,
      to: at.to,
      html: `<iframe id="${attr(`txt-${text.id}`)}" src="kit/${spec.kit}/text.html#t=0,${sec(at.to - at.from)}" at="${sec(at.from)}" overrides='${jsonAttr(overrides)}'></iframe>`,
    });
  }
  return out;
}

function layerClip(spec: EditSpec, layer: Layer, file: (assetId: string) => string): Placed | null {
  const at = span(spec, layer);
  const asset = spec.assets[layer.asset];
  if (!at || !asset) return null;
  const image = asset.kind === "image";
  const style = [
    `left: ${Math.round(layer.box.x * W)}px`, `top: ${Math.round(layer.box.y * H)}px`,
    `width: ${Math.round(layer.box.w * W)}px`, `height: ${Math.round(layer.box.h * H)}px`,
    "object-fit: cover",
  ];
  if (layer.rotate) style.push(`rotate: ${num(layer.rotate)}deg`);
  if (layer.opacity !== 1) style.push(`opacity: ${num(layer.opacity)}`);
  if (layer.radius) style.push(`border-radius: ${num(layer.radius)}px`);

  const lenMs = at.to - at.from;
  const outMs = Math.min(asset.ms ?? Number.MAX_SAFE_INTEGER, layer.inMs + Math.floor(lenMs * layer.speed));
  const src = image ? `${file(layer.asset)}#t=0,${sec(lenMs)}` : `${file(layer.asset)}#t=${sec(layer.inMs)},${sec(outMs)}`;
  const parts = [`id="${attr(`lay-${layer.id}`)}"`, `src="${attr(src)}"`, `at="${sec(at.from)}"`];
  if (!image) {
    if (layer.speed !== 1) parts.push(`speed="${layer.speed}"`);
    if (layer.volume === 0) parts.push("muted");
    else if (layer.volume !== 1) parts.push(`volume="${layer.volume}"`);
  }
  parts.push(`style="${attr(style.join("; "))}"`);
  return { from: at.from, to: at.to, html: image ? `<img ${parts.join(" ")}>` : `<video ${parts.join(" ")}></video>` };
}

/**
 * Layers, the highest `z` first and at equal `z` the later in the document first: the order `stack`
 * puts them on tracks in, so of two that overlap, the higher is on the track nearer the top, and at
 * equal `z` the later (painter's order: a layer added after another is drawn over it).
 */
export function layerClips(spec: EditSpec, file: (assetId: string) => string): Placed[] {
  return [...spec.layers]
    .reverse() // the sort is stable: equal `z` keeps this order, the later layer first
    .sort((a, b) => b.z - a.z)
    .map((layer) => layerClip(spec, layer, file))
    .filter((clip): clip is Placed => clip !== null);
}

function soundClip(spec: EditSpec, sound: Sound, file: (assetId: string) => string): Placed | null {
  const at = span(spec, sound);
  const asset = spec.assets[sound.asset];
  if (!at || !asset) return null;
  /* a sound shorter than its place on the film ends when its file does */
  const outMs = Math.min(asset.ms ?? Number.MAX_SAFE_INTEGER, sound.inMs + (at.to - at.from));
  if (outMs <= sound.inMs) return null;
  const lenMs = outMs - sound.inMs;
  let fadeIn = Math.min(lenMs, spanMs(at.start, Math.min(sound.fadeIn, at.len)));
  let fadeOut = Math.min(lenMs, at.to - frameMs(at.start + at.len - Math.min(sound.fadeOut, at.len)));
  if (fadeIn + fadeOut > lenMs) {
    /* longer together than the clip: both shortened alike, in proportion to what was asked, to fill it (as the engine's `fittedFade`) */
    fadeIn = Math.floor((lenMs * sound.fadeIn) / (sound.fadeIn + sound.fadeOut));
    fadeOut = lenMs - fadeIn;
  }

  const parts = [`id="${attr(`snd-${sound.id}`)}"`, `src="${attr(`${file(sound.asset)}#t=${sec(sound.inMs)},${sec(outMs)}`)}"`, `at="${sec(at.from)}"`];
  if (sound.volume === 0) parts.push("muted");
  else if (sound.volume !== 1) parts.push(`volume="${sound.volume}"`);
  if (fadeIn || fadeOut) parts.push(`overrides='${jsonAttr([{ fade: [fadeIn / 1000, fadeOut / 1000] }])}'`);
  return { from: at.from, to: at.from + lenMs, html: `<audio ${parts.join(" ")}></audio>` };
}

export function soundClips(spec: EditSpec, file: (assetId: string) => string): Placed[] {
  return spec.sounds.map((sound) => soundClip(spec, sound, file)).filter((clip): clip is Placed => clip !== null);
}
