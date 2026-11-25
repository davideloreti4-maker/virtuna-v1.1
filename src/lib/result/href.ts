import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

/**
 * Where a stored video simulation opens. Under the new look it is the result page
 * (`/simulation/[id]`); with the flag off it is the board it has always been (`/analyze/[id]`).
 * Every door into a result (the video card, the composer's fallback, the upload field's link)
 * goes through this one function.
 */
export function resultHref(id: string): string {
  return NEW_LOOK_ENABLED ? `/simulation/${id}` : `/analyze/${id}`;
}
