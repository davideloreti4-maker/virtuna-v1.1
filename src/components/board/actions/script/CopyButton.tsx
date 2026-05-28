'use client';
import { Copy, CheckCircle } from '@phosphor-icons/react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

interface CopyButtonProps {
  text: string;
  ariaLabel: string;
  label?: string;       // optional visible text (Copy-all only)
  onCopy?: () => void;  // telemetry callback
}

export function CopyButton({ text, ariaLabel, label, onCopy }: CopyButtonProps) {
  // S-4: explicitly 1500ms (overrides default 2000ms) for tight feedback loop
  const { copied, copy } = useCopyToClipboard(1500);

  async function handleClick() {
    const ok = await copy(text);
    if (ok) onCopy?.();
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={handleClick}
      className="inline-flex items-center gap-1 min-h-[44px] min-w-[44px] justify-center p-2.5 text-white/55 hover:text-white/80 focus:outline-2 focus:outline-offset-2 focus:outline-white/40 transition-colors duration-150"
    >
      {copied ? (
        <>
          <CheckCircle size={14} weight="regular" className="text-coral-500" />
          <span className="text-xs text-coral-500">Copied!</span>
        </>
      ) : (
        <>
          <Copy size={14} weight="regular" />
          {label ? <span className="text-xs">{label}</span> : null}
        </>
      )}
    </button>
  );
}
