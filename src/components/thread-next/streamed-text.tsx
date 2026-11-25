"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

import { MarkdownBlockRenderer } from "@/components/thread/markdown-block";
import { IconButton } from "@/components/ui/icon-button";

import { PROSE } from "./answer-card";
import { CheckIcon, CopyIcon } from "./answer-icons";
import { useCopyText } from "./sheet-actions";

/**
 * A plain answer (thread feel §4.5; film `.txt`, `.w` and `.acts`).
 *
 * - While it streams: each word is its own `.word-in` span (`rehypeWords`, after the sanitiser), so a
 *   new word fades in over 240 ms. The whole text is parsed again on every token, but react-markdown
 *   keys an element's children by tag and place (`span-0`, `span-1`, …), so a word already shown keeps
 *   its node and is not faded again. Read politely, as the turn's text part was.
 * - Once it has ended: today's markdown markup, unchanged (no word spans), and under it, when the turn
 *   hands it the text to copy (`copyText`: its last text part only, the whole turn's text), one quiet
 *   Copy (`AnswerActions`). No "Try again": there is no way yet to replace an answer on the server.
 *
 * Both sit in the turn's wrapper for a text part: today's 15 px and 68ch measure at the drawing's
 * 22 leading, in proportional figures so a hyphen stays tight.
 */

/** The few hast fields this step reads and writes (hast's own types are not a direct dependency). */
interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** Text in these stays whole: a sample of code is copied and read as it is, not word by word. */
const WHOLE = new Set(["code", "pre"]);

function wrapWords(node: HastNode): void {
  if (!node.children || (node.type === "element" && WHOLE.has(node.tagName ?? ""))) return;
  const children: HastNode[] = [];
  for (const child of node.children) {
    if (child.type !== "text" || typeof child.value !== "string") {
      wrapWords(child);
      children.push(child);
      continue;
    }
    // Runs of spaces stay text between the words, so lines still break where they did.
    for (const piece of child.value.split(/(\s+)/)) {
      if (piece === "") continue;
      children.push(
        /^\s/.test(piece)
          ? { type: "text", value: piece }
          : { type: "element", tagName: "span", properties: { className: ["word-in"] }, children: [{ type: "text", value: piece }] },
      );
    }
  }
  node.children = children;
}

/** A rehype step: every word of the tree outside `code` and `pre` in its own `<span class="word-in">`. */
export function rehypeWords() {
  return (tree: HastNode) => {
    wrapWords(tree);
  };
}

/** The wrapper the turn gives a text part. */
const TEXT_PART = `${PROSE} [&_.md]:leading-[22px]`;

export function StreamedAnswer({
  text,
  live,
  copyText,
}: {
  text: string;
  live: boolean;
  /** What Copy takes: the turn's whole text. Given only to a turn's last text part once the turn has
   *  ended (rulings 17); without it, no Copy is drawn. Never while live. */
  copyText?: string | null;
}) {
  if (!live) {
    return (
      <>
        <div className={TEXT_PART}>
          <MarkdownBlockRenderer block={{ type: "markdown", props: { text } }} />
        </div>
        {copyText ? <AnswerActions text={copyText} /> : null}
      </>
    );
  }
  return (
    <div aria-live="polite" className={TEXT_PART}>
      {/* `MarkdownBlockRenderer`'s own box, with the word step after its sanitiser. */}
      <div className="md max-w-[68ch] text-prose">
        <ReactMarkdown rehypePlugins={[rehypeSanitize, rehypeWords]}>{text}</ReactMarkdown>
      </div>
    </div>
  );
}

/**
 * The one quiet action under an ended answer: Copy, its text; a check and "Copied" for a moment
 * (`useCopyText`, as the script's Copy). As the film draws it (`.acts`): a 34 target in the muted
 * ink, 8 to the left so the glyph lines up with the text, and 4 up into the column's rhythm, so on a
 * phone it sits 8 under the text and 10 above the chips. Its hover is the scale's 12 (the film's 10
 * is off the radius scale).
 */
export function AnswerActions({ text }: { text: string }) {
  const { copied, copy } = useCopyText(text);
  return (
    <div className="-ml-2 -mt-1 flex">
      <IconButton surface="quiet" aria-label="Copy" onClick={copy} className="h-[34px] w-[34px] rounded-lg text-foreground-muted">
        {copied ? <CheckIcon aria-hidden data-part="copied-mark" /> : <CopyIcon aria-hidden />}
      </IconButton>
      <span role="status" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </div>
  );
}
