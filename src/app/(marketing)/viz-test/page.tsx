'use client'

import { useState } from 'react'
import { VisualizationCanvas } from '@/components/visualization/VisualizationCanvas'
import { GlassOrb } from '@/components/visualization/GlassOrb'

export default function VizTestPage() {
  const [forceReducedMotion, setForceReducedMotion] = useState(false)
  const [tapCount, setTapCount] = useState(0)

  return (
    <main className="min-h-screen bg-background-base">
      {/* Controls overlay */}
      <div className="absolute top-4 left-4 z-10 p-4 rounded-lg bg-surface-elevated/80 backdrop-blur-sm space-y-3 max-w-xs">
        <div className="text-text-primary text-sm font-medium">
          Glass Orb Test
        </div>

        <label className="flex items-center gap-2 text-text-secondary text-xs">
          <input
            type="checkbox"
            checked={forceReducedMotion}
            onChange={(e) => setForceReducedMotion(e.target.checked)}
            className="rounded"
          />
          Force reduced motion
        </label>

        <div className="text-text-tertiary text-xs">
          Tap count: {tapCount}
        </div>

        <div className="border-t border-border-subtle pt-2 mt-2">
          <div className="text-text-tertiary text-xs">
            <strong>Verify:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Dramatic blob morphing visible</li>
              <li>Orange center to magenta rim gradient</li>
              <li>Inner depth visible (look closely)</li>
              <li>Slow ~4s breathing pulse</li>
              <li>Hover brightens edge glow</li>
              <li>Click triggers scale pulse</li>
              <li>Reduced motion = static</li>
              <li>Pan/zoom with Reset button</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="h-screen w-full">
        <VisualizationCanvas
          className="h-full w-full"
          forceReducedMotion={forceReducedMotion}
        >
          <GlassOrb onTap={() => setTapCount((c) => c + 1)} />
        </VisualizationCanvas>
      </div>
    </main>
  )
}
