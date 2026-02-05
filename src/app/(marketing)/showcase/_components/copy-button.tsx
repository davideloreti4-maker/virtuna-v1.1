"use client";

import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

interface CopyButtonProps {
  code: string;
  className?: string;
}

export function CopyButton({ code, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available in all contexts
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "text-foreground-muted transition-colors hover:text-foreground",
        className
      )}
      aria-label={copied ? "Copied" : "Copy code"}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}
