import { archetypeDisplayName } from "@/lib/audience/archetype-names";
import type { Archetype } from "@/lib/engine/wave3/persona-registry";

/** Seconds as `m:ss`, rounded to the whole second. */
export function timecode(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A viewer group's name in sentence case ("Tough crowd"), as the new look writes it. */
export function groupName(group: Archetype): string {
  return archetypeDisplayName(group)
    .split(" ")
    .map((word, i) => (i === 0 ? word : word.toLowerCase()))
    .join(" ");
}
