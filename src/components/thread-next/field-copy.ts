import { getSkill, type ToolId } from "@/components/app/home/composer-controls";

/**
 * The field's placeholders under the new look, in one place: the composer and /dev/field both
 * read them, so the page used for looking at the field cannot drift from the one that ships.
 */

/** The short placeholders (spec 2026-11-20 §4.1 "copy shortened"; review ruling B: each fits
 *  one line of the field's text on a 393 phone). Simulate (`test`) has its own pair below; a
 *  tool missing here falls back to the composer's PLACEHOLDER_BY_TOOL. */
export const NEXT_PLACEHOLDER_BY_TOOL: Partial<Record<ToolId, string>> & { chat: string } = {
  chat: "Message Maven",
  hooks: "A topic for your hooks",
  idea: "A topic for ideas",
  explore: "A niche to explore",
  account: "Read your account",
  script: "What the script is about",
  remix: "Paste a TikTok link",
};

/** Simulate's placeholder: waiting for a video or a link, and with a video staged. */
export const NEXT_SIMULATE_PLACEHOLDER = {
  empty: "Add a video or paste a link",
  video: "Send to simulate this video",
} as const;

/** The field on Home (spec 2026-11-23): its placeholder at rest, and once a skill that takes
 *  words is picked. A tool missing here keeps the thread's placeholder. */
export const HOME_PLACEHOLDER_BY_TOOL: Partial<Record<ToolId, string>> = {
  chat: "Ask anything, or pick a skill",
  hooks: "What's the video about?",
  script: "What's the video about?",
  idea: "What do you want ideas about?",
};

/** A skill's name in the field: the pills' names, "Account" for the account read, else the skill's label. */
export function fieldSkillLabel(tool: ToolId): string {
  if (tool === "test") return "Simulate";
  if (tool === "account") return "Account";
  return getSkill(tool).label;
}
