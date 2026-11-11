/**
 * compile — an EditSpec as the files of an OpenFilm film folder.
 *
 * ONE compiler for the live preview (in the browser) and the render (in Node). The only thing
 * that differs between them is which file stands for each asset, and that is the caller's:
 * `opts.file`. The compiler reads no file and looks at no clock, so the same document always
 * gives the same bytes.
 *
 * It parses what it is given and refuses a document that fails `checkEditSpec`, so nothing
 * downstream ever sees a film made from a broken edit, typed as an EditSpec or not.
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §5.
 */
import { EditSpecError, checkEditSpec } from "../check";
import { total } from "../derive";
import { EditSpecSchema, type Asset, type EditSpec, type Move } from "../spec";
import { cuesOf, vttOf } from "./captions";
import { attr, byStart, head, pack, section, stack, type Placed } from "./html";
import { layerClips, soundClips, textClips } from "./items";
import { keyframesLine, moveName } from "./keyframes";
import { mainTracks } from "./main";

export interface CompileOptions {
  /** The path, inside the film folder, of the file that stands for an asset: `assets/<name>`, directly under `assets/` (`assets/<id>.mp4`). Never asked about kit assets. */
  file: (asset: Asset) => string;
}

export interface Compiled {
  files: { "film.html": string; "captions.vtt"?: string };
  /** What has to be put in the film folder, beside the kit. */
  assets: { id: string; file: string }[];
  /** The document's kit: the film folder needs it at `kit/<kit>/`. */
  kit: EditSpec["kit"];
  /** The film's length. */
  frames: number;
}

/** What `opts.file` may give: a file directly under `assets/`, so a film references only files inside its own folder. */
const ASSET_FILE = /^assets\/[A-Za-z0-9][A-Za-z0-9_.-]*$/;

/**
 * The film of an edit. Throws, and makes no film, when `input` is not an EditSpec (the schema's ZodError,
 * whatever its TypeScript type says), when it fails `checkEditSpec` (EditSpecError), and when `opts.file`
 * gives an asset anything but a file directly under `assets/` (an Error that names the asset).
 */
export function compile(input: EditSpec, opts: CompileOptions): Compiled {
  const spec = EditSpecSchema.parse(input);
  const problems = checkEditSpec(spec);
  if (problems.length) throw new EditSpecError(problems);

  const used = new Map<string, string>();
  const file = (assetId: string): string => {
    const asset = spec.assets[assetId];
    if (!asset) throw new Error(`the edit names a missing asset "${assetId}"`);
    if ("kit" in asset.at) return `kit/${spec.kit}/${asset.at.kit}`;
    const known = used.get(assetId);
    if (known) return known;
    const path = opts.file(asset);
    if (!ASSET_FILE.test(path)) throw new Error(`opts.file gave "${path}" for the asset "${assetId}": not a file directly under assets/`);
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
    kit: spec.kit,
    frames: total(spec),
  };
}
