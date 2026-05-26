import type { BoardMachineState } from '@/stores/board-store';

export interface ChipDescriptor {
  id: 'stop' | 'rewrite' | 'compare' | 'variant' | 'reweight';
  label: string;
  enabled: boolean;
  destructive?: boolean;
}

/**
 * UI-SPEC §Copywriting Contract — single source of truth.
 * Accepts the board machine state string + optional streaming stage label.
 */
export function placeholderFor(state: BoardMachineState, stage: string | null): string {
  switch (state) {
    case 'idle':
      return 'Paste URL, drop file, or describe…';
    case 'streaming':
      return stage ?? 'Analyzing…';
    case 'complete':
    case 'anti-virality':
      return 'Ask about your audience or generate variant…';
    case 'edit-input':
      return '';
  }
}

/** UI-SPEC §Command Bar chip action map. */
export function chipsFor(state: BoardMachineState): ChipDescriptor[] {
  switch (state) {
    case 'idle':
      return [];
    case 'streaming':
      return [{ id: 'stop', label: 'Stop analysis', enabled: true, destructive: true }];
    case 'complete':
    case 'anti-virality':
      return [
        { id: 'rewrite',  label: 'Rewrite hook',       enabled: false },
        { id: 'compare',  label: 'Compare to last 3',  enabled: false },
        { id: 'variant',  label: 'Generate variant',   enabled: false },
        { id: 'reweight', label: 'Re-weight audience', enabled: false },
      ];
    case 'edit-input':
      return [];
  }
}

/** Whether the text input is enabled. UI-SPEC table: only idle + complete + anti-virality. */
export function inputEnabledFor(state: BoardMachineState): boolean {
  return state === 'idle' || state === 'complete' || state === 'anti-virality';
}
