/**
 * props.ts — what the film is given: an edit, where the kit's own files are, and the address of
 * each other file the edit uses.
 *
 * An edit names its files by where they are kept. Where they can be fetched from is another
 * matter: a signed address in the app, a local one in a test. So the addresses come beside the
 * edit. A file kept in the kit (a sound, a typeface) is found under the kit's folder; any other
 * needs an address of its own, by file id. The renderer passes all of this as JSON, so it is
 * parsed here.
 */
import { z } from "zod";
import { EditSchema, layout, type Asset, type Edit } from "../../lib/edit";

export const FilmPropsSchema = z
  .strictObject({
    edit: EditSchema,
    /** Where the kit's folder is served from, without a slash at the end: "/edit" in the app. */
    kit: z.string().regex(/[^/]$|^$/, "ends in a slash"),
    /** The address of each file that is not kept in the kit, by its id. */
    urls: z.record(z.string(), z.string().min(1)),
  })
  .superRefine((props, ctx) => {
    for (const asset of props.edit.assets) {
      if (!("kit" in asset.at) && !Object.hasOwn(props.urls, asset.id)) ctx.addIssue({ code: "custom", path: ["urls", asset.id], message: `the file "${asset.id}" has no address` });
    }
  });

export type FilmProps = z.infer<typeof FilmPropsSchema>;

/** Where to fetch a file of the edit from. */
export function addressOf(props: Pick<FilmProps, "kit" | "urls">, asset: Asset): string {
  return "kit" in asset.at ? `${props.kit}/${asset.at.kit}` : (props.urls[asset.id] ?? "");
}

/** The film's length in frames, its frames a second and its size, as a player and a renderer ask for them. */
export function filmSize(edit: Edit): { durationInFrames: number; fps: number; width: number; height: number } {
  return { durationInFrames: layout(edit).frames, fps: edit.stage.fps, width: edit.stage.w, height: edit.stage.h };
}
