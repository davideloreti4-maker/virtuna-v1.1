"use client";

import { ViralResultsCard } from "@/components/viral-results";
import type { ViralResult } from "@/types/viral-results";

/**
 * Viral Results Showcase Page
 *
 * Visual showcase for the complete viral results card system.
 * Demonstrates high/low score examples and mobile view.
 */

// Mock data: High score viral result
const mockHighResult: ViralResult = {
  id: "1",
  overallScore: 87,
  tier: "Viral Ready",
  confidence: "High",
  confidenceReason: "Based on 15+ similar viral videos analyzed",
  factors: [
    {
      id: "hook",
      name: "Hook Strength",
      score: 9,
      maxScore: 10,
      description: "Exceptional opening that stops the scroll",
      details:
        "Your hook uses the 'pattern interrupt' technique - starting mid-action creates immediate curiosity. The first frame is visually striking and the audio hook reinforces the visual.",
      tips: [
        "Consider A/B testing a question-based hook",
        "The current hook works great for entertainment niches",
      ],
    },
    {
      id: "emotional",
      name: "Emotional Triggers",
      score: 8,
      maxScore: 10,
      description: "Strong emotional resonance detected",
      details:
        "Content hits aspiration and curiosity triggers effectively. The transformation element creates investment in the outcome.",
      tips: [
        "Adding a relatable struggle moment could boost engagement",
        "Consider showing the 'before' state longer",
      ],
    },
    {
      id: "shareability",
      name: "Shareability Factor",
      score: 9,
      maxScore: 10,
      description: "High likelihood of shares and saves",
      details:
        "The content has clear 'I need to show this to someone' moments. The surprise element and practical value drive share behavior.",
    },
    {
      id: "format",
      name: "Format Optimization",
      score: 8,
      maxScore: 10,
      description: "Well-suited for platform algorithms",
      details:
        "Video length, aspect ratio, and pacing align with current TikTok algorithm preferences. Caption placement doesn't obstruct key visuals.",
      tips: [
        "Current length (47s) is optimal",
        "Consider adding on-screen text for sound-off viewing",
      ],
    },
    {
      id: "trend",
      name: "Trend Alignment",
      score: 7,
      maxScore: 10,
      description: "Moderate alignment with current trends",
      details:
        "Content taps into the transformation trend but could leverage current sounds or challenges for additional reach.",
      tips: [
        "Trending sound could boost discovery 20-40%",
        "Consider the 'POV:' format for broader appeal",
      ],
    },
    {
      id: "cta",
      name: "Call-to-Action",
      score: 8,
      maxScore: 10,
      description: "Effective engagement prompts",
      details:
        "Natural CTA integration that doesn't feel forced. Comment-driving question at end encourages interaction.",
    },
  ],
  generatedAt: new Date(),
};

// Mock data: Low score result
const mockLowResult: ViralResult = {
  id: "2",
  overallScore: 34,
  tier: "Low Potential",
  confidence: "Medium",
  confidenceReason: "Limited comparison data for this niche",
  factors: [
    {
      id: "hook",
      name: "Hook Strength",
      score: 3,
      maxScore: 10,
      description: "Hook doesn't stop the scroll effectively",
      details:
        "Opening takes 4+ seconds before anything interesting happens. Users typically decide within 1-2 seconds.",
      tips: [
        "Start with the most interesting moment",
        "Add a verbal hook in first second",
        "Use pattern interrupt technique",
      ],
    },
    {
      id: "emotional",
      name: "Emotional Triggers",
      score: 4,
      maxScore: 10,
      description: "Weak emotional connection",
      details:
        "Content is informative but doesn't evoke strong emotions. Consider adding personal story elements.",
      tips: ["Share a personal failure/success story", "Add humor or surprise elements"],
    },
    {
      id: "shareability",
      name: "Shareability Factor",
      score: 3,
      maxScore: 10,
      description: "Low share motivation",
      details:
        "Content doesn't give viewers a compelling reason to share. Missing the 'I need to show someone this' moment.",
      tips: ["Add a surprising statistic", "Include a controversial opinion"],
    },
    {
      id: "format",
      name: "Format Optimization",
      score: 4,
      maxScore: 10,
      description: "Suboptimal format choices",
      details: "Video length may be too long for the content type. Pacing is uneven.",
      tips: ["Cut to 30-45 seconds", "Speed up slower sections"],
    },
  ],
  generatedAt: new Date(),
};

export default function ViralResultsShowcasePage() {
  const handleRemix = (factorIds: string[]) => {
    console.log("Remix with factors:", factorIds);
    alert(`Remixing with ${factorIds.length} factors selected:\n\n${factorIds.join(", ")}`);
  };

  return (
    <div className="min-h-screen bg-bg-base p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Viral Results Card Showcase
          </h1>
          <p className="text-text-secondary">
            The &quot;wow moment&quot; analysis breakdown - screenshot-worthy viral
            prediction display
          </p>
        </div>

        {/* High score example */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">
              High Score (Viral Ready)
            </h2>
            <p className="text-sm text-text-tertiary">
              Score: 87/100 - Top tier with strong factors
            </p>
          </div>
          <ViralResultsCard
            result={mockHighResult}
            showRemixCTA
            onRemix={handleRemix}
          />
        </section>

        {/* Low score example */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">
              Low Score (Low Potential)
            </h2>
            <p className="text-sm text-text-tertiary">
              Score: 34/100 - Needs improvement with actionable tips
            </p>
          </div>
          <ViralResultsCard
            result={mockLowResult}
            showRemixCTA
            onRemix={handleRemix}
          />
        </section>

        {/* Mobile simulation */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">
              Mobile View (375px)
            </h2>
            <p className="text-sm text-text-tertiary">
              Simulated mobile viewport width
            </p>
          </div>
          <div className="max-w-[375px] mx-auto border border-white/10 rounded-xl overflow-hidden">
            <ViralResultsCard
              result={mockHighResult}
              showRemixCTA
              onRemix={handleRemix}
            />
          </div>
        </section>

        {/* Testing notes */}
        <section className="space-y-4 pb-8">
          <h2 className="text-xl font-semibold text-text-primary">
            Testing Checklist
          </h2>
          <ul className="text-sm text-text-secondary space-y-2 list-disc list-inside">
            <li>Score ring animates with gradient fill (1.5-2s)</li>
            <li>Score number counts up from 0</li>
            <li>Tier label appears with correct color after animation</li>
            <li>Factor cards stagger in after score settles</li>
            <li>Progress bars animate fill with color coding</li>
            <li>Clicking factor card expands accordion with details</li>
            <li>Checkboxes select factors for remix</li>
            <li>CTA shows selection count dynamically</li>
            <li>CTA button triggers alert with selected factors</li>
            <li>Scroll within card to test sticky CTA</li>
            <li>Test with &quot;Reduce motion&quot; system preference</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
