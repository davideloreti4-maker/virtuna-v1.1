/**
 * check.ts — the rules of an EditSpec that zod cannot say.
 *
 * zod checks each field alone. These rules are about fields that have to agree: an asset that
 * exists and is the right kind, a source window that fits its file, a pin that names a segment.
 * The compiler and `applyOps` both refuse a document that fails any of them.
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §4.
 */
import { frameOf, total } from "./derive";
import type { Asset, EditSpec } from "./spec";
import { MAX_FRAMES, minSourceMs } from "./time";

export type ProblemCode =
  | "asset-key" | "generator-missing" | "asset-facts" | "asset-missing" | "asset-kind"
  | "source-overrun" | "pin-missing" | "fix-missing" | "dup-id" | "too-long";

export interface Problem {
  code: ProblemCode;
  /** where in the document, e.g. `main[2]` */
  at: string;
  message: string;
}

/** Thrown by the compiler for a document that fails `checkEditSpec`. */
export class EditSpecError extends Error {
  constructor(readonly problems: Problem[]) {
    super(problems.map((p) => `${p.at}: ${p.message}`).join("; "));
    this.name = "EditSpecError";
  }
}

export function checkEditSpec(spec: EditSpec): Problem[] {
  const out: Problem[] = [];
  const say = (code: ProblemCode, at: string, message: string): void => { out.push({ code, at, message }); };

  for (const [key, asset] of Object.entries(spec.assets)) {
    const at = `assets.${key}`;
    if (asset.id !== key) say("asset-key", at, `is stored under "${key}" but its id is "${asset.id}"`);
    if (asset.origin === "generated" && !asset.generator) say("generator-missing", at, "is generated and names no generator");
    if (asset.kind !== "audio" && (!asset.w || !asset.h)) say("asset-facts", at, "is a picture with no size");
    if (asset.kind !== "image" && asset.ms == null) say("asset-facts", at, "has no length");
  }

  /** The asset `id` names when it is one of `kinds`; otherwise the problem is said and null returned. */
  const assetOf = (id: string, kinds: Asset["kind"][], at: string): Asset | null => {
    const asset = spec.assets[id];
    if (!asset) { say("asset-missing", at, `names the asset "${id}", which is not in the edit`); return null; }
    if (!kinds.includes(asset.kind)) { say("asset-kind", at, `needs ${kinds.join(" or ")}, and "${id}" is ${asset.kind}`); return null; }
    return asset;
  };
  const unique = (ids: string[], list: string): void => {
    const seen = new Set<string>();
    ids.forEach((id, i) => {
      if (seen.has(id)) say("dup-id", `${list}[${i}]`, `the id "${id}" is used twice in ${list}`);
      seen.add(id);
    });
  };

  /* a clip fits its file by the least source it takes at any start (time.ts), so where it sits never decides it */
  spec.main.forEach((seg, i) => {
    const asset = assetOf(seg.asset, ["video", "image"], `main[${i}]`);
    if (asset?.kind === "video" && seg.inMs + minSourceMs(seg.len, seg.speed) > (asset.ms ?? 0)) {
      say("source-overrun", `main[${i}]`, `takes more of "${seg.asset}" than the file holds`);
    }
  });
  unique(spec.main.map((s) => s.id), "main");
  if (total(spec) > MAX_FRAMES) say("too-long", "main", `the film is ${total(spec)} frames; the most is ${MAX_FRAMES}`);

  spec.layers.forEach((layer, i) => {
    const where = `layers[${i}]`;
    const frame = frameOf(spec, layer);
    if (frame == null) say("pin-missing", where, `is pinned to "${layer.pin}", which is not a segment`);
    const asset = assetOf(layer.asset, ["video", "image"], where);
    if (asset?.kind === "video" && layer.inMs + minSourceMs(layer.len, layer.speed) > (asset.ms ?? 0)) {
      say("source-overrun", where, `takes more of "${layer.asset}" than the file holds`);
    }
  });
  unique(spec.layers.map((l) => l.id), "layers");

  spec.texts.forEach((text, i) => {
    if (frameOf(spec, text) == null) say("pin-missing", `texts[${i}]`, `is pinned to "${text.pin}", which is not a segment`);
  });
  unique(spec.texts.map((t) => t.id), "texts");

  spec.sounds.forEach((sound, i) => {
    const where = `sounds[${i}]`;
    if (frameOf(spec, sound) == null) say("pin-missing", where, `is pinned to "${sound.pin}", which is not a segment`);
    const asset = assetOf(sound.asset, ["audio"], where);
    if (asset && sound.inMs >= (asset.ms ?? 0)) say("source-overrun", where, `starts after the end of "${sound.asset}"`);
  });
  unique(spec.sounds.map((s) => s.id), "sounds");

  for (const [assetId, fixes] of Object.entries(spec.captions.fixes)) {
    const words = spec.assets[assetId]?.words;
    for (const index of Object.keys(fixes)) {
      if (!words || Number(index) >= words.length) {
        say("fix-missing", `captions.fixes.${assetId}.${index}`, `corrects word ${index} of "${assetId}", which has no such word`);
      }
    }
  }

  return out;
}
