'use client';

/**
 * ThreadShell — shared conversation container for home skill thread views (P0).
 *
 * Owns the 760px column rhythm (matches Reading) and turn framing:
 *  - User turn: right-aligned echo of the submitted composer draft (optimistic).
 *  - Assistant turn: quiet Maven label + children slot.
 *
 * Flat-warm + matte; zero accent in shell chrome (dosage LOCKED).
 */

import { cn } from '@/lib/utils';

export interface ThreadShellProps {
  /** Optimistic echo of the user's submitted prompt (presentation-only). */
  userTurn?: string | null;
  /** Pre-turn content (idle states, empty copy, quick-action cards). */
  before?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function ThreadShell({ userTurn, before, children, className }: ThreadShellProps) {
  const trimmed = userTurn?.trim();

  return (
    <div
      className={cn(
        'w-full max-w-[760px] mx-auto flex flex-col gap-5 px-4 py-6',
        className,
      )}
    >
      {before}
      {trimmed ? <ThreadUserTurn text={trimmed} /> : null}
      {children}
    </div>
  );
}

export function ThreadUserTurn({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-white/[0.055] px-3.5 py-2 text-[15px] leading-relaxed text-foreground">
        {text}
      </p>
    </div>
  );
}

export function ThreadAssistantTurn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted">
        Maven
      </span>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
