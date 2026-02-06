'use client';

import { useMemo, useState } from 'react';

import { HiveCanvas } from '@/components/hive/HiveCanvas';
import {
  countNodes,
  generateMockHiveData,
} from '@/components/hive/hive-mock-data';

// ---------------------------------------------------------------------------
// Temporary preview page for visual verification of HiveCanvas.
// This route will be removed after human approval (48-04 checkpoint).
// ---------------------------------------------------------------------------

export default function HivePreviewPage(): React.JSX.Element {
  const mockData = useMemo(() => generateMockHiveData(), []);
  const nodeCount = useMemo(() => countNodes(mockData), [mockData]);
  const [showHive, setShowHive] = useState(true);

  return (
    <div className="h-screen w-full bg-[#07080a] flex flex-col">
      {/* Controls bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <button
          type="button"
          onClick={() => setShowHive(false)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            !showHive
              ? 'bg-white/[0.1] text-white'
              : 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Show Skeleton
        </button>
        <button
          type="button"
          onClick={() => setShowHive(true)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            showHive
              ? 'bg-white/[0.1] text-white'
              : 'bg-transparent text-white/60 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Show Hive
        </button>
        <span className="ml-auto text-xs text-white/40 font-mono">
          {nodeCount.toLocaleString()} nodes
        </span>
      </div>

      {/* Canvas container */}
      <div className="flex-1 min-h-0">
        <HiveCanvas data={showHive ? mockData : null} />
      </div>
    </div>
  );
}
