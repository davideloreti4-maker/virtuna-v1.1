'use client';
import { useState, type ReactNode } from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  /** Anti-virality / hero emphasis — coral border instead of the neutral 6%. */
  accent?: boolean;
  /** Extra classes on the body wrapper (e.g. `overflow-x-auto` for wide content). */
  bodyClassName?: string;
}

/**
 * Mobile counterpart to {@link GroupFrameOverlay} — same title-bar + collapse
 * chrome, but laid out as a flow-positioned Raycast card instead of a
 * camera-positioned canvas overlay. Content nodes are reused verbatim.
 */
export function MobileFrameCard({
  label,
  children,
  defaultExpanded = true,
  accent = false,
  bodyClassName,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section
      aria-label={label}
      className={cn(
        'rounded-[12px] border bg-transparent',
        accent ? 'border-accent/30' : 'border-white/[0.06]',
      )}
      style={{ boxShadow: 'rgba(255,255,255,0.05) 0 1px 0 0 inset' }}
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={expanded}
          className="text-foreground-muted hover:text-foreground"
        >
          <Icon icon={expanded ? CaretUp : CaretDown} size={16} />
        </button>
      </div>
      {expanded && <div className={cn('p-3', bodyClassName)}>{children}</div>}
    </section>
  );
}
