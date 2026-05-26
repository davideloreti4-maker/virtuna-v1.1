'use client';
import { useEffect } from 'react';
import type { CameraPresetKey } from './board-types';

interface Args {
  goToPreset: (k: CameraPresetKey) => void;
  onToggleSidebar?: () => void;
  onNewAnalysis?: () => void;
  enabled?: boolean;
}

export function useBoardKeyboard({
  goToPreset, onToggleSidebar, onNewAnalysis, enabled = true,
}: Args) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === '\\') { e.preventDefault(); onToggleSidebar?.(); return; }
      if (meta && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); onNewAnalysis?.(); return; }
      switch (e.key) {
        case '0': goToPreset('overview'); break;
        case '1': goToPreset('verdict'); break;
        case '2': goToPreset('audience'); break;
        case '3': goToPreset('content-analysis'); break;
        case 'r': case 'R': goToPreset('overview'); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goToPreset, onToggleSidebar, onNewAnalysis, enabled]);
}
