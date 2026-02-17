"use client";

import { useState } from "react";
import { ViralScoreRing, FactorsList } from "@/components/viral-results";
import { getTierFromScore, type ViralFactor } from "@/types/viral-results";

// Mock factors for testing
const mockFactors: ViralFactor[] = [
  {
    id: "hook",
    name: "Hook Strength",
    score: 8,
    maxScore: 10,
    description: "First 3 seconds grab attention effectively",
    details:
      "Your opening uses pattern interrupt and curiosity gap techniques. The hook creates immediate intrigue without revealing the payoff.",
    tips: [
      "Consider adding a visual hook alongside verbal",
      "Test shorter variations (1-2 second hooks)",
    ],
  },
  {
    id: "emotion",
    name: "Emotional Triggers",
    score: 6,
    maxScore: 10,
    description: "Content evokes moderate emotional response",
    details:
      "The content touches on aspiration and curiosity but lacks strong emotional peaks. Consider adding moments of surprise or relatability.",
    tips: ["Add a relatable struggle moment", "Include an unexpected twist"],
  },
  {
    id: "shareability",
    name: "Shareability",
    score: 9,
    maxScore: 10,
    description: "Highly likely to be shared with others",
    details:
      "Strong social currency and practical value. Content gives viewers a reason to share - either to look knowledgeable or to help others.",
    tips: ["Add a clear call-to-action for sharing"],
  },
  {
    id: "retention",
    name: "Watch Retention",
    score: 4,
    maxScore: 10,
    description: "Viewers may drop off before the end",
    details:
      "The pacing slows significantly in the middle section. The payoff takes too long to arrive, which can cause viewers to swipe away.",
    tips: [
      "Tighten the middle section by 15-20%",
      "Add a re-hook at the midpoint",
      "Move the most satisfying moment earlier",
    ],
  },
  {
    id: "trending",
    name: "Trend Alignment",
    score: 2,
    maxScore: 10,
    description: "Not aligned with current trends",
    details:
      "The content topic and format don't match any currently trending patterns. Consider incorporating trending sounds, formats, or topics.",
  },
];

export default function ViralScoreTestPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-text-secondary mb-6">
          Animation Disabled
        </h2>
        <div className="flex justify-center p-6 bg-surface rounded-xl">
          <ViralScoreRing score={85} tier="Viral Ready" animated={false} />
        </div>
      </section>

      {/* Factor breakdown list */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-text-secondary mb-6">
          Factor Breakdown (Accordion)
        </h2>
        <div className="max-w-2xl mx-auto p-6 bg-surface rounded-xl">
          <FactorsList factors={mockFactors} />
        </div>
      </section>

      {/* Factor list with selection */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-text-secondary mb-6">
          Factor List with Selection
        </h2>
        <div className="max-w-2xl mx-auto p-6 bg-surface rounded-xl">
          <p className="text-text-tertiary text-sm mb-4">
            Selected: {selectedIds.size === 0 ? "None" : Array.from(selectedIds).join(", ")}
          </p>
          <FactorsList
            factors={mockFactors}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </div>
      </section>
    </div>
  );
}
