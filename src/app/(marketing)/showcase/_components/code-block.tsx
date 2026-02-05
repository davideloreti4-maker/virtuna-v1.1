import { highlight } from "sugar-high";

import { CopyButton } from "./copy-button";

interface CodeBlockProps {
  code: string;
  title?: string;
}

export function CodeBlock({ code, title }: CodeBlockProps) {
  const trimmed = code.trim();
  const html = highlight(trimmed);

  return (
    <div className="overflow-hidden rounded-lg border border-border-glass bg-surface/50">
      {title ? (
        <div className="flex items-center justify-between border-b border-border-glass px-4 py-2">
          <span className="font-mono text-xs text-foreground-muted">
            {title}
          </span>
          <CopyButton code={trimmed} />
        </div>
      ) : (
        <div className="flex justify-end px-4 pt-2">
          <CopyButton code={trimmed} />
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-sm font-mono leading-relaxed">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}
