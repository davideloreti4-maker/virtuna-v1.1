/**
 * picking.ts — "How should it look?" (Task 13b): the four ways to say it, what each needs before the first cut can be made,
 * and the routes' own sentences as a creator reads them. The routes are the judge of everything here; this only keeps the
 * button off until a call can pass, and says why in a line. Pure.
 */
import { presetOf } from "@/lib/edit/style/presets";
import { MAX_TAKE_BYTES, TAKE_TYPES } from "@/lib/edit/worker/takes";

export type Choice = "pick" | "video" | "preset" | "words";

/** What a creator has put into the rows; `choice` is the row chosen. A `File` is one of these. */
export interface Picking {
  choice: Choice;
  link: string;
  file: { name: string; size: number; type: string } | null;
  preset: string | null;
  words: string;
}

/** As the page opens: our pick is chosen, so the first cut is one tap away. */
export const FIRST: Picking = { choice: "pick", link: "", file: null, preset: null, words: "" };

/** The longest style in words the route takes (`MOST.words` in `/api/edit/agent`). */
export const MOST_WORDS = 300;

/** A link to a TikTok video, as the route reads one: https, on tiktok.com or a subdomain of it. */
export function isTikTokLink(link: string): boolean {
  if (!URL.canParse(link)) return false;
  const { protocol, hostname } = new URL(link);
  return protocol === "https:" && (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com"));
}

/** Why the chosen row cannot be used as it is, in a line; null while it is empty or has what it needs. */
export function hintOf({ choice, link, file, words }: Picking): string | null {
  if (choice === "video" && file) {
    if (!(TAKE_TYPES as readonly string[]).includes(file.type)) return "A video is an MP4 or a QuickTime file.";
    return file.size > MAX_TAKE_BYTES ? "A video is at most 2 GB." : null;
  }
  if (choice === "video" && link.trim() !== "" && !isTikTokLink(link.trim())) return "That is not a link to a TikTok video.";
  if (choice === "words" && words.trim().length > MOST_WORDS) return `Say it in at most ${MOST_WORDS} characters.`;
  return null;
}

/** Whether the chosen row has what it needs for the first cut. */
export function ready(picking: Picking): boolean {
  if (hintOf(picking) !== null) return false;
  switch (picking.choice) {
    case "pick":
      return true;
    case "video":
      return picking.file !== null || picking.link.trim() !== "";
    case "preset":
      return picking.preset !== null && presetOf(picking.preset) !== undefined;
    case "words":
      return picking.words.trim() !== "";
  }
}

/** The style a first cut is asked in, for the rows the agent's route reads itself: none for our pick; a video's is read first. */
export function styleOf({ choice, preset, words }: Picking): { preset: string } | { words: string } | undefined {
  if (choice === "preset" && preset !== null) return { preset };
  if (choice === "words") return { words: words.trim() };
  return undefined;
}

/** A route's line as a sentence: a capital first, a full stop last. */
export function sentence(text: string): string {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  const capital = trimmed[0]!.toUpperCase() + trimmed.slice(1);
  return /[.!?…]$/.test(capital) ? capital : `${capital}.`;
}

export const UNREACHABLE = "The editor could not be reached. Check your connection.";
export const WENT_WRONG = "Something went wrong.";

/**
 * What to show for a call that was not answered ok: the route's own sentence; for a call that never got there, or an answer
 * that is no sentence (a gateway's page), a plain line. Never a code, a stack or an error's name.
 */
export function problemOf({ status, body }: { status: number; body: { error?: string } }): string {
  if (status === 0) return UNREACHABLE;
  if (!body.error || /^it answered \d+$/.test(body.error)) return WENT_WRONG;
  return sentence(body.error);
}

/** A stage in a creator's words ("reading its cuts") as the line of progress. */
export function stageLine(stage: string): string {
  return `${stage[0]?.toUpperCase() ?? ""}${stage.slice(1)}…`;
}

/** The line while the take is cut, after any reading. */
export const CUTTING = "Cutting your take…";
