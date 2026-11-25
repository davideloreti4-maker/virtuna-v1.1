/**
 * piece-words.ts — how a Library row says what a chat holds and what its number measures: "3 hooks",
 * "Script", "would stop to watch". Strings only, and a leaf: nothing is imported at run time (the
 * types below are erased), so Library's rows and Home's Recent can say these words without taking
 * the block registry that `chat-summary.ts` reads chats with into their bundle. `chat-summary.ts`
 * re-exports both.
 */

import type { ChatSummary, SimSummary } from "./chat-summary";

/** "3 hooks", "1 hook", "5 ideas", "Script", "2 scripts", "Remix", "Video", "2 videos", "Text", "Chat". */
export function insideLabel(summary: Pick<ChatSummary, "counts" | "lead">): string {
  const { counts } = summary;
  const one = (n: number, single: string, plural: string) => (n === 1 ? single : `${n} ${plural}`);
  switch (summary.lead) {
    case "hooks":
      return one(counts.hooks, "1 hook", "hooks");
    case "ideas":
      return one(counts.ideas, "1 idea", "ideas");
    case "script":
      return one(counts.scripts, "Script", "scripts");
    case "remix":
      return one(counts.remixes, "Remix", "remixes");
    case "video":
      return one(counts.videos, "Video", "videos");
    case "text":
      return one(counts.texts, "Text", "texts");
    case "edit":
      return "Edit";
    case "chat":
      return "Chat";
  }
}

/** "would stop to watch" | "watch to the end" */
export function measureWords(measure: SimSummary["measure"]): string {
  return measure === "stop" ? "would stop to watch" : "watch to the end";
}
