"use client";

import { useState } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { Spinner } from "@/components/ui";
import { StrategyAnalysisCard } from "./strategy-analysis-card";
import { ViralDetectionCard } from "./viral-detection-card";
import { HashtagGapCard } from "./hashtag-gap-card";
import { RecommendationsCard } from "./recommendations-card";
import type {
  StrategyAnalysis,
  ViralExplanation,
  HashtagGap,
  Recommendations,
} from "@/lib/ai/types";

interface IntelligenceSectionProps {
  competitorId: string;
  competitorHandle: string;
  cachedStrategy: StrategyAnalysis | null;
  cachedViral: ViralExplanation | null;
  cachedHashtagGap: HashtagGap | null;
  cachedRecommendations: Recommendations | null;
  hasUserVideos: boolean;
}

type AnalysisType = "strategy" | "viral" | "hashtag_gap" | "recommendations";

const analysisLabels: Record<AnalysisType, string> = {
  strategy: "Strategy Analysis",
  viral: "Viral Detection",
  hashtag_gap: "Hashtag Gap",
  recommendations: "Recommendations",
};

/**
 * AI Intelligence section for the competitor detail page (INTL-05).
 *
 * Client component that manages cached data display and on-demand
 * AI generation. Renders 4 card sub-components with pre-fetched
 * or freshly generated insights.
 */
export function IntelligenceSection({
  competitorId,
  competitorHandle,
  cachedStrategy,
  cachedViral,
  cachedHashtagGap,
  cachedRecommendations,
  hasUserVideos,
}: IntelligenceSectionProps) {
  const [strategy, setStrategy] = useState<StrategyAnalysis | null>(
    cachedStrategy
  );
  const [viral, setViral] = useState<ViralExplanation | null>(cachedViral);
  const [hashtagGap, setHashtagGap] = useState<HashtagGap | null>(
    cachedHashtagGap
  );
  const [recommendations, setRecommendations] =
    useState<Recommendations | null>(cachedRecommendations);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const dataMap: Record<AnalysisType, unknown | null> = {
    strategy,
    viral,
    hashtag_gap: hashtagGap,
    recommendations,
  };

  const missingTypes = (
    Object.keys(dataMap) as AnalysisType[]
  ).filter((type) => {
    if (type === "hashtag_gap" && !hasUserVideos) return false;
    return !dataMap[type];
  });

  const allHaveData = missingTypes.length === 0;

  async function handleGenerate(analysisType: string) {
    setGenerating((prev) => ({ ...prev, [analysisType]: true }));
    setError(null);

    try {
      const res = await fetch(`/api/intelligence/${competitorId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis_type: analysisType }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error || `Analysis failed (${res.status})`
        );
      }

      const data = await res.json();

      switch (analysisType) {
        case "strategy":
          setStrategy(data);
          break;
        case "viral":
          setViral(data);
          break;
        case "hashtag_gap":
          setHashtagGap(data);
          break;
        case "recommendations":
          setRecommendations(data);
          break;
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to generate analysis"
      );
    } finally {
      setGenerating((prev) => ({ ...prev, [analysisType]: false }));
    }
  }

  async function handleGenerateAll() {
    await Promise.allSettled(
      missingTypes.map((type) => handleGenerate(type))
    );
  }

  const isAnyGenerating = Object.values(generating).some(Boolean);

  return (
    <section>
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Sparkle size={20} className="text-[var(--color-accent)]" />
          <h2 className="text-lg font-semibold text-foreground">
            AI Intelligence
          </h2>
        </div>

        {!allHaveData && missingTypes.length > 1 && (
          <button
            onClick={handleGenerateAll}
            disabled={isAnyGenerating}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isAnyGenerating ? "Generating..." : "Generate All"}
          </button>
        )}
      </div>

      <p className="text-sm text-foreground-muted mb-6">
        AI-powered insights into @{competitorHandle}&apos;s content strategy,
        viral patterns, and actionable recommendations.
      </p>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-500/20 bg-red-500/[0.05] text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Cards grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Strategy Analysis */}
        {strategy ? (
          <div className="lg:col-span-2">
            <StrategyAnalysisCard data={strategy} />
          </div>
        ) : (
          <GenerateCTA
            label={analysisLabels.strategy}
            loading={generating.strategy}
            onGenerate={() => handleGenerate("strategy")}
          />
        )}

        {/* Viral Detection */}
        {viral ? (
          <ViralDetectionCard
            data={viral}
            competitorHandle={competitorHandle}
          />
        ) : (
          <GenerateCTA
            label={analysisLabels.viral}
            loading={generating.viral}
            onGenerate={() => handleGenerate("viral")}
          />
        )}

        {/* Hashtag Gap */}
        {hashtagGap ? (
          <HashtagGapCard data={hashtagGap} />
        ) : hasUserVideos ? (
          <GenerateCTA
            label={analysisLabels.hashtag_gap}
            loading={generating.hashtag_gap}
            onGenerate={() => handleGenerate("hashtag_gap")}
          />
        ) : (
          <div className="border border-white/[0.06] rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] flex flex-col items-center justify-center text-center py-8">
            <h3 className="text-sm font-medium text-foreground mb-2">
              Hashtag Gap Analysis
            </h3>
            <p className="text-xs text-foreground-muted mb-3 max-w-[280px]">
              Track your own TikTok account to compare hashtag usage with this
              competitor.
            </p>
            <a
              href="/competitors/compare"
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/[0.06] text-foreground hover:bg-white/[0.02] transition-colors"
            >
              Set Up Self-Tracking
            </a>
          </div>
        )}

        {/* Recommendations */}
        {recommendations ? (
          <div className="lg:col-span-2">
            <RecommendationsCard data={recommendations} />
          </div>
        ) : (
          <GenerateCTA
            label={analysisLabels.recommendations}
            loading={generating.recommendations}
            onGenerate={() => handleGenerate("recommendations")}
          />
        )}
      </div>
    </section>
  );
}

/**
 * CTA card prompting user to generate a specific analysis type.
 * Shows a spinner + "Analyzing..." while generation is in progress.
 */
function GenerateCTA({
  label,
  loading,
  onGenerate,
}: {
  label: string;
  loading?: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="border border-white/[0.06] rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] flex flex-col items-center justify-center text-center py-8">
      <h3 className="text-sm font-medium text-foreground mb-2">{label}</h3>
      <p className="text-xs text-foreground-muted mb-4 max-w-[280px]">
        Generate AI-powered analysis for this competitor.
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <Spinner size="sm" className="text-[var(--color-accent)]" />
          <span>Analyzing...</span>
        </div>
      ) : (
        <button
          onClick={onGenerate}
          className="text-xs font-medium px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-foreground)] hover:opacity-90 transition-opacity"
        >
          Generate Analysis
        </button>
      )}
    </div>
  );
}
