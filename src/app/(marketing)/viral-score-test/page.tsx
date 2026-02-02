"use client";

import { ViralScoreRing } from "@/components/viral-results";
import { getTierFromScore } from "@/types/viral-results";

export default function ViralScoreTestPage() {
  // Test scores representing each tier
  const testScores = [95, 75, 60, 45, 30, 15];

  return (
    <div className="min-h-screen bg-bg-base p-8">
      <h1 className="text-2xl font-bold text-text-primary mb-8">
        Viral Score Ring Test
      </h1>

      {/* Test each tier threshold */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-text-secondary mb-6">
          Tier Variants
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testScores.map((score) => (
            <div
              key={score}
              className="flex flex-col items-center gap-4 p-6 bg-surface rounded-xl"
            >
              <ViralScoreRing score={score} tier={getTierFromScore(score)} />
              <span className="text-text-tertiary text-sm">Score: {score}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Size variants */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-text-secondary mb-6">
          Size Variants
        </h2>
        <div className="flex flex-wrap justify-center gap-8 p-6 bg-surface rounded-xl">
          <div className="flex flex-col items-center gap-2">
            <ViralScoreRing score={78} tier="High Potential" size="sm" />
            <span className="text-text-tertiary text-xs">Small (120px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ViralScoreRing score={78} tier="High Potential" size="md" />
            <span className="text-text-tertiary text-xs">Medium (180px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ViralScoreRing score={78} tier="High Potential" size="lg" />
            <span className="text-text-tertiary text-xs">Large (240px)</span>
          </div>
        </div>
      </section>

      {/* Animation disabled test */}
      <section>
        <h2 className="text-lg font-semibold text-text-secondary mb-6">
          Animation Disabled
        </h2>
        <div className="flex justify-center p-6 bg-surface rounded-xl">
          <ViralScoreRing
            score={85}
            tier="Viral Ready"
            animated={false}
          />
        </div>
      </section>
    </div>
  );
}
