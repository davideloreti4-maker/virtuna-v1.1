/**
 * The kit: each part's component, and the layer it is drawn on.
 *
 * What is drawn over what is decided here and nowhere else: by layer, from the back; within a
 * layer by the first frame a thing shows on, then by its id. Never by which shot holds a mark,
 * so cutting a shot in two changes nothing.
 */
import type { PartId } from "../../../lib/edit";
import { Callout } from "./Callout";
import { Cutaway } from "./Cutaway";
import { Progress } from "./Progress";
import { Sound } from "./Sound";
import { Title } from "./Title";
import type { PartProps } from "./types";

/** The layers, from the back. The footage is under all of them. */
export const LAYERS = ["sound", "cutaway", "callout", "captions", "title", "progress"] as const;
export type Layer = (typeof LAYERS)[number];

export const KIT: { [P in PartId]: { layer: Layer; Component: React.FC<PartProps<P>> } } = {
  title: { layer: "title", Component: Title },
  callout: { layer: "callout", Component: Callout },
  progress: { layer: "progress", Component: Progress },
  cutaway: { layer: "cutaway", Component: Cutaway },
  sound: { layer: "sound", Component: Sound },
};

export type { PartProps } from "./types";
