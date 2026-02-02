'use client'

import { useState } from 'react'
import { VisualizationCanvas } from '@/components/visualization/VisualizationCanvas'

function TestSphere() {
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color="#FF6B35" />
    </mesh>
  )
}

export default function VizTestPage() {
  const [forceReducedMotion, setForceReducedMotion] = useState(false)

  return (
    <main className="min-h-screen bg-background-base">
      {/* Controls overlay */}
      <div className="absolute top-4 left-4 z-10 p-4 rounded-lg bg-surface-elevated/80 backdrop-blur-sm space-y-3">
        <div className="text-text-primary text-sm font-medium">
          R3F Setup Test
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

        <div className="text-text-tertiary text-xs mt-2">
          Test:
          <ul className="list-disc list-inside mt-1">
            <li>Orange sphere visible</li>
            <li>Drag to pan the view</li>
            <li>Scroll to zoom in/out</li>
            <li>Reset View button works</li>
          </ul>
        </div>
      </div>

      {/* Canvas */}
      <div className="h-screen w-full">
        <VisualizationCanvas
          className="h-full w-full"
          forceReducedMotion={forceReducedMotion}
        >
          <TestSphere />
        </VisualizationCanvas>
      </div>
    </main>
  )
}
