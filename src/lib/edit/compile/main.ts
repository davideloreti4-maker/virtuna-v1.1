/**
 * main.ts — the main sequence as film clips, and how one segment hands over to the next.
 *
 * Segments play in order with no gaps, on "main A". A dissolve needs both pictures at once, so
 * the two segments overlap around the cut and sit on different tracks: each dissolve switches
 * between main A (below) and main B (above). ONLY THE UPPER CLIP FADES; the lower one is whole
 * beneath it. Two half-transparent pictures over black would dip in brightness at the middle.
 *
 * The cut itself never moves: the outgoing clip runs a few frames past it and the incoming one
 * starts a few frames before it, each only as far as its source file allows.
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §5.2 and §5.3.
 */
import { starts, total } from "../derive";
import { FILTERS, WIPES } from "../kit";
import type { Asset, EditSpec, Framing, Segment } from "../spec";
import { FPS, frameMs, sec, sourceMs } from "../time";
import { H, W, attr, jsonAttr, type Placed } from "./html";
import { moveName } from "./keyframes";

interface MainClip {
  seg: Segment;
  asset: Asset;
  /** 0: main A, below. 1: main B, above. */
  track: 0 | 1;
  /** the frames it covers on the film, after any dissolve */
  fromF: number;
  toF: number;
  /** frames it starts before its own first frame (a dissolve's lead-in) */
  leadF: number;
  fadeInF: number;
  fadeOutF: number;
}

/** The clip's box in stage pixels (spec §5.2). `whole`: show the whole picture instead of filling the stage. */
export function boxOf(asset: Asset, framing: Framing, whole: boolean): { left: number; top: number; width: number; height: number } {
  const w = asset.w ?? W;
  const h = asset.h ?? H;
  const fit = whole ? Math.min(W / w, H / h) : Math.max(W / w, H / h);
  const width = Math.round(w * fit * framing.zoom);
  const height = Math.round(h * fit * framing.zoom);
  return {
    width,
    height,
    /* `+ 0`: a centred box would otherwise be -0 */
    left: Math.round((-(width - W) * (1 + framing.x)) / 2) + 0,
    top: Math.round((-(height - H) * (1 + framing.y)) / 2) + 0,
  };
}

/** Whole frames of source that lie before a segment's in-point, or after its out-point. */
function spare(seg: Segment, asset: Asset, start: number, side: "before" | "after"): number {
  if (asset.kind === "image") return Number.MAX_SAFE_INTEGER;
  const perFrame = (1000 / FPS) * seg.speed;
  if (side === "before") return Math.floor(seg.inMs / perFrame);
  const left = (asset.ms ?? 0) - seg.inMs - sourceMs(start, seg.len, seg.speed);
  return Math.max(0, Math.floor(left / perFrame));
}

function plan(spec: EditSpec): { clips: MainClip[]; wipes: Placed[] } {
  const at = starts(spec);
  const end = total(spec);
  const clips: MainClip[] = spec.main.map((seg, i) => {
    const asset = spec.assets[seg.asset];
    if (!asset) throw new Error(`segment "${seg.id}" names a missing asset`);
    return { seg, asset, track: 0, fromF: at[i] ?? 0, toF: at[i + 1] ?? 0, leadF: 0, fadeInF: 0, fadeOutF: 0 };
  });
  const wipes: Placed[] = [];

  for (let i = 0; i + 1 < clips.length; i++) {
    const a = clips[i];
    const b = clips[i + 1];
    if (!a || !b) continue;
    const cut = a.seg.cutOut;
    b.track = a.track;

    if (cut.kind === "wipe") {
      const frames = WIPES[cut.id].frames;
      const fromF = Math.max(0, (at[i + 1] ?? 0) - Math.floor(frames / 2));
      const toF = Math.min(end, fromF + frames);
      const tint = cut.color && WIPES[cut.id].tint ? ` overrides='${jsonAttr([{ at: "html", style: { "--color": cut.color } }])}'` : "";
      wipes.push({
        from: frameMs(fromF),
        to: frameMs(toF),
        html: `<iframe id="${attr(`wipe-${a.seg.id}`)}" src="kit/${spec.kit}/wipes/${cut.id}.html#t=0,${sec(frameMs(toF) - frameMs(fromF))}" at="${sec(frameMs(fromF))}"${tint}></iframe>`,
      });
      continue;
    }
    if (cut.kind !== "fade") continue;

    const half = Math.floor(cut.len / 2);
    if (cut.style === "dip-black") {
      a.fadeOutF = Math.min(half, Math.floor(a.seg.len / 2));
      b.fadeInF = Math.min(cut.len - half, Math.floor(b.seg.len / 2));
      continue;
    }
    /* a dissolve: each side as far as its source allows, and never past the middle of its neighbour */
    const tail = Math.min(half, Math.floor(b.seg.len / 2), spare(a.seg, a.asset, at[i] ?? 0, "after"));
    const lead = Math.min(cut.len - half, Math.floor(a.seg.len / 2), spare(b.seg, b.asset, at[i + 1] ?? 0, "before"));
    if (tail + lead === 0) continue; // no spare source on either side: a cut
    a.toF += tail;
    b.fromF -= lead;
    b.leadF = lead;
    b.track = a.track === 0 ? 1 : 0;
    if (b.track === 1) b.fadeInF = tail + lead;
    else a.fadeOutF = tail + lead;
  }
  return { clips, wipes };
}

/** A clip's place on the film and in its source, in milliseconds. */
function windowOf(clip: MainClip): { fromMs: number; toMs: number; inMs: number; outMs: number; fadeIn: number; fadeOut: number } {
  const fromMs = frameMs(clip.fromF);
  const toMs = frameMs(clip.toF);
  let inMs = 0;
  let outMs = toMs - fromMs;
  /* the clip's own length: flooring its source (R3) can leave a slowed clip a few ms short of its frames */
  let lenMs = toMs - fromMs;
  if (clip.asset.kind !== "image") {
    const ownStart = frameMs(clip.fromF + clip.leadF);
    inMs = Math.max(0, clip.seg.inMs - Math.floor((ownStart - fromMs) * clip.seg.speed));
    outMs = Math.min(clip.asset.ms ?? Number.MAX_SAFE_INTEGER, inMs + Math.floor((toMs - fromMs) * clip.seg.speed));
    lenMs = Math.floor((outMs - inMs) / clip.seg.speed);
  }
  let fadeIn = frameMs(clip.fromF + clip.fadeInF) - fromMs;
  let fadeOut = toMs - frameMs(clip.toF - clip.fadeOutF);
  if (fadeIn + fadeOut > lenMs) fadeOut = Math.max(0, lenMs - fadeIn);
  if (fadeIn > lenMs) fadeIn = lenMs;
  return { fromMs, toMs, inMs, outMs, fadeIn, fadeOut };
}

function clipHtml(clip: MainClip, file: string, look: EditSpec["look"], blur: boolean): Placed {
  const { seg, asset } = clip;
  const win = windowOf(clip);
  const image = asset.kind === "image";
  const box = blur ? boxOf(asset, { zoom: 1, x: 0, y: 0 }, false) : boxOf(asset, seg.framing, seg.fit === "blur");
  const style = [`left: ${box.left}px`, `top: ${box.top}px`, `width: ${box.width}px`, `height: ${box.height}px`];
  const filter = seg.filter ?? look.filter;
  const own = filter ? FILTERS[filter] : null;
  /* the fill is the same picture: its filters, as on its clip, then the blur and the dimming */
  if (blur) style.push(`filter: ${own ? `${own} ` : ""}blur(40px) brightness(.7)`);
  else if (own) style.push(`filter: ${own}`);
  if (!blur && seg.move) style.push(`animation: ${moveName(seg.move)} var(--clip-length) linear both`);

  const src = image ? `${file}#t=0,${sec(win.toMs - win.fromMs)}` : `${file}#t=${sec(win.inMs)},${sec(win.outMs)}`;
  const parts = [`id="${attr(`${blur ? "blur" : "seg"}-${seg.id}`)}"`, `src="${attr(src)}"`, `at="${sec(win.fromMs)}"`];
  if (!image) {
    if (seg.speed !== 1) parts.push(`speed="${seg.speed}"`);
    if (blur || seg.volume === 0) parts.push("muted");
    else if (seg.volume !== 1) parts.push(`volume="${seg.volume}"`);
  }
  parts.push(`style="${attr(style.join("; "))}"`);
  if (win.fadeIn || win.fadeOut) parts.push(`overrides='${jsonAttr([{ fade: [win.fadeIn / 1000, win.fadeOut / 1000] }])}'`);
  return { from: win.fromMs, to: win.toMs, html: image ? `<img ${parts.join(" ")}>` : `<video ${parts.join(" ")}></video>` };
}

export interface MainTracks {
  /** main B: the upper track, used only when the edit has a dissolve */
  b: Placed[];
  /** the blurred copies behind main B's segments with `fit: "blur"`: directly beneath them, so they dissolve together */
  blurB: Placed[];
  a: Placed[];
  blurA: Placed[];
  wipes: Placed[];
}

/** The main sequence as film clips. `file` gives the path of an asset inside the film folder. */
export function mainTracks(spec: EditSpec, file: (assetId: string) => string): MainTracks {
  const { clips, wipes } = plan(spec);
  const out: MainTracks = { a: [], blurA: [], b: [], blurB: [], wipes };
  for (const clip of clips) {
    const path = file(clip.seg.asset);
    (clip.track === 0 ? out.a : out.b).push(clipHtml(clip, path, spec.look, false));
    if (clip.seg.fit === "blur") (clip.track === 0 ? out.blurA : out.blurB).push(clipHtml(clip, path, spec.look, true));
  }
  return out;
}
