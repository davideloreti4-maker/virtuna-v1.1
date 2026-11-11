/**
 * compile — an EditSpec as the files of an OpenFilm film folder.
 *
 * ONE compiler for the live preview (in the browser) and the render (in Node). The only thing
 * that differs between them is which file stands for each asset, and that is the caller's:
 * `opts.file`. The compiler reads no file and looks at no clock, so the same document always
 * gives the same bytes.
 *
 * It refuses a document that fails `checkEditSpec`, so nothing downstream ever sees a film made
 * from a broken edit.
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §5.
 */
import { EditSpecError, checkEditSpec } from "../check";
import { total } from "../derive";
import { KIT, KIT_DIR } from "../kit";
import type { Asset, EditSpec, Move } from "../spec";
import { cuesOf, vttOf } from "./captions";
import { attr, byStart, head, pack, section, stack, type Placed } from "./html";
import { layerClips, soundClips, textClips } from "./items";
import { keyframesLine, moveName } from "./keyframes";
import { mainTracks } from "./main";

export interface CompileOptions {
  /** The path, inside the film folder, of the file that stands for an asset: `assets/<id>.mp4`. Never asked about kit assets. */
  file: (asset: Asset) => string;
}

export interface Compiled {
  files: { "film.html": string; "captions.vtt"?: string };
  /** What has to be put in the film folder, beside the kit. */
  assets: { id: string; file: string }[];
  kit: typeof KIT;
  /** The film's length. */
  frames: number;
}

export function compile(spec: EditSpec, opts: CompileOptions): Compiled {
  const problems = checkEditSpec(spec);
  if (problems.length) throw new EditSpecError(problems);

  const used = new Map<string, string>();
  const file = (assetId: string): string => {
    const asset = spec.assets[assetId];
    if (!asset) throw new Error(`the edit names a missing asset "${assetId}"`);
    if ("kit" in asset.at) return `${KIT_DIR}/${asset.at.kit}`;
    const known = used.get(assetId);
    if (known) return known;
    const path = opts.file(asset);
    used.set(assetId, path);
    return path;
  };

  const sections: string[] = [];
  const add = (track: Placed[]): void => { if (track.length) sections.push(section(track)); };

  const cues = spec.captions.on ? cuesOf(spec) : [];
  if (cues.length) {
    sections.push(`<section>\n  <track kind="captions" src="captions.vtt" srclang="${attr(spec.captions.lang)}" label="Captions">\n</section>`);
  }
  const main = mainTracks(spec, file);
  for (const track of pack(textClips(spec).sort(byStart))) add(track);
  for (const track of pack(main.wipes.sort(byStart))) add(track);
  for (const track of stack(layerClips(spec, file))) add(track);
  add(main.b);
  add(main.blurB);
  add(main.a);
  add(main.blurA);
  for (const track of pack(soundClips(spec, file).sort(byStart))) add(track);

  const moves = new Map<string, Move>();
  for (const seg of spec.main) if (seg.move) moves.set(moveName(seg.move), seg.move);
  const keyframes = [...moves.keys()].sort().map((name) => keyframesLine(moves.get(name) as Move));

  const film = `${head(keyframes)}\n<body>\n${sections.join("\n")}\n</body>\n</html>\n`;
  return {
    files: cues.length ? { "film.html": film, "captions.vtt": vttOf(spec, cues) } : { "film.html": film },
    assets: [...used].map(([id, path]) => ({ id, file: path })),
    kit: KIT,
    frames: total(spec),
  };
}
