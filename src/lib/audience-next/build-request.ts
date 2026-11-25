/**
 * build-request.ts — what `/audience/new` and Read again send to `POST /api/audiences/calibrate`.
 *
 * Pure. Three doors: your own TikTok account (`personal`), another creator's (`target`), or a description
 * (`target` on the `custom` platform, read as a niche). A door and its field make a request, or none when the
 * field could not be read: the screen then sends nothing. The route takes a handle of at most 50 characters,
 * a name of 1 to 80 and a description of at most 500, so nothing made here is one it would refuse.
 */
import type { GoalIntent } from "@/lib/audience/audience-types";
import { HANDLE_PATTERN } from "@/lib/posted/posted";
import { normalizeHandle } from "@/lib/schemas/competitor";

import type { AudiencePage } from "./audience-model";

export type NewDoor = "own" | "other" | "describe";

export type BuildRequest =
  | { handle: string; type: "personal" | "target"; platform: "tiktok"; goalIntent: GoalIntent; name: string; audienceId?: string }
  | { description: string; type: "target"; platform: "custom"; goalIntent: "grow"; name: string };

/** The longest description the route takes. */
export const DESCRIPTION_MAX = 500;

// A Map, not an object: an address can say `?door=constructor`, and an object would answer with what it inherits.
const DOORS: ReadonlyMap<string, NewDoor> = new Map([
  ["connect", "own"],
  ["handle", "other"],
  ["describe", "describe"],
]);

/**
 * The row an address chooses. The old addresses keep working: `?door=connect|handle|describe`, the connect
 * flow's `?source=account&handle=…` (your own account) and `?mode=general` (a description); anything else is
 * your own account.
 */
export function doorOf(p: { door?: string; source?: string; mode?: string }): NewDoor {
  const door = typeof p.door === "string" ? DOORS.get(p.door) : undefined;
  if (door) return door;
  if (p.source === "account") return "own";
  if (p.mode === "general") return "describe";
  return "own";
}

/** A name from a description: its first words, on one line (the old screen's rule, `audience-create.tsx`). */
export function nameFromDescription(description: string): string {
  const trimmed = description.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 60) return trimmed;
  const cut = trimmed.slice(0, 60);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * The request a door and its field make, or null. A handle may be typed with its "@" or pasted as a TikTok
 * link; it is read lower case and must look like a TikTok handle. A description is read with its spaces
 * collapsed and must keep 1 to 500 characters.
 */
export function buildRequestOf(door: NewDoor, field: string): BuildRequest | null {
  if (door === "describe") {
    const description = field.replace(/\s+/g, " ").trim();
    if (description.length === 0 || description.length > DESCRIPTION_MAX) return null;
    return { description, type: "target", platform: "custom", goalIntent: "grow", name: nameFromDescription(description) };
  }
  const handle = normalizeHandle(field);
  if (!HANDLE_PATTERN.test(handle)) return null;
  return { handle, type: door === "own" ? "personal" : "target", platform: "tiktok", goalIntent: "grow", name: `@${handle}` };
}

/** Read again: the audience's account read once more, into the same audience (`audienceId`). */
export function readAgainRequestOf(r: NonNullable<AudiencePage["readAgain"]>): BuildRequest {
  return { handle: r.handle, type: r.type, platform: "tiktok", goalIntent: r.goalIntent, name: r.name, audienceId: r.audienceId };
}
