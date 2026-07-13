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
    <div className="md">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
        {block.props.text}
      </ReactMarkdown>
    </div>
  );
}
