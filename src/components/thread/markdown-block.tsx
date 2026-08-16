'use client';

/**
 * MarkdownBlock — renders the markdown block type via react-markdown + rehype-sanitize.
 *
 * The `text` prop comes from a validated MarkdownBlock (validated by validateBlock
 * before this component is mounted — D-14).
 *
 * `.md` is the app's markdown layer (globals.css). It replaced `prose prose-invert
 * prose-sm`, which generated ZERO CSS — there is no @tailwindcss/typography in this repo
 * and Tailwind v4 needs an explicit `@plugin` to load one. Preflight then stripped the
 * output: headings rendered at body size/weight, paragraphs lost their gaps, and ordered-
 * list NUMBERS disappeared. This block carries the /chat + Ask payload, so that was a wall
 * of undifferentiated text on the surfaces where the model does its talking.
 */

import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import type { MarkdownBlock } from '@/lib/tools/blocks';

export interface MarkdownBlockProps {
  block: MarkdownBlock;
}

export function MarkdownBlockRenderer({ block }: MarkdownBlockProps) {
  return (
    // MEASURE + LEADING, which this block had neither of. `.md` sizes everything in `em` so the
    // host owns the scale — but the composer's chat turn set no measure at all, so a model answer
    // ran the full width of a desktop thread (well past 100 characters per line) at default
    // leading. That is the "it just outputs text" feeling: the markup was styled correctly and the
    // paragraph was still a slab. 68ch is the same measure `reading-chat.tsx` already uses for the
    // identical content, so the two chat surfaces stop disagreeing.
    //
    // `max-w` only ever CAPS: inside a 342px skill card this is a no-op, so card follow-ups and the
    // Ask payload keep rendering exactly as they did.
    //
    // `text-prose` (15/1.75), not the inherited 13px body: this block carries essay-length
    // answers, and 13px is the CHROME spec — measured live, the thread was the only long-form
    // surface still rendering at it (reading-chat already sat at 15px for identical content).
    <div className="md max-w-[68ch] text-prose">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
        {block.props.text}
      </ReactMarkdown>
    </div>
  );
}
