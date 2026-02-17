"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { useOutcome } from "@/hooks/queries/use-outcomes";

interface OutcomeFormProps {
  analysisId: string;
  predictedScore: number;
  onSubmitted?: () => void;
}

/**
 * TRACK-01: Outcome submission form
 * Allows reporting actual performance metrics after publishing content.
 */
export function OutcomeForm({
  analysisId,
  predictedScore,
  onSubmitted,
}: OutcomeFormProps) {
  const [views, setViews] = useState("");
  const [likes, setLikes] = useState("");
  const [shares, setShares] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [postUrl, setPostUrl] = useState("");
  const [actualScore, setActualScore] = useState("");

  const { mutate, isPending, isSuccess } = useOutcome();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    mutate(
      {
        analysis_id: analysisId,
        actual_views: views ? parseInt(views, 10) : undefined,
        actual_likes: likes ? parseInt(likes, 10) : undefined,
        actual_shares: shares ? parseInt(shares, 10) : undefined,
        actual_score: actualScore ? parseFloat(actualScore) : undefined,
        platform,
        platform_post_url: postUrl || undefined,
      },
      { onSuccess: onSubmitted }
    );
  };

  if (isSuccess) {
    // TRACK-02/03: Show predicted vs actual comparison
    const actual = actualScore ? parseFloat(actualScore) : null;
    const delta = actual != null ? actual - predictedScore : null;

    return (
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <Text size="sm" className="font-medium text-green-400">
          Outcome reported successfully
        </Text>
        {delta != null && (
          <div className="flex items-center gap-3">
            <div className="text-center">
              <Text size="sm" muted>Predicted</Text>
              <Text className="text-lg font-bold">{predictedScore}</Text>
            </div>
            <Text size="sm" muted>vs</Text>
            <div className="text-center">
              <Text size="sm" muted>Actual</Text>
              <Text className="text-lg font-bold">{actual}</Text>
            </div>
            <div className="text-center">
              <Text size="sm" muted>Delta</Text>
              <Text
                className={`text-lg font-bold ${
                  delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-yellow-400"
                }`}
              >
                {delta > 0 ? "+" : ""}{delta.toFixed(1)}
              </Text>
            </div>
          </div>
        )}
      </div>
    );
  }

  const inputClasses =
    "w-full rounded-lg border border-white/[0.05] bg-white/[0.05] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-white/[0.1] focus:outline-none";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-surface p-4 space-y-3"
    >
      <Text size="sm" className="font-medium">
        Report Outcome
      </Text>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-gray-500">Views</label>
          <input
            type="number"
            value={views}
            onChange={(e) => setViews(e.target.value)}
            placeholder="0"
            className={inputClasses}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Likes</label>
          <input
            type="number"
            value={likes}
            onChange={(e) => setLikes(e.target.value)}
            placeholder="0"
            className={inputClasses}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Shares</label>
          <input
            type="number"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="0"
            className={inputClasses}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className={inputClasses}
          >
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
            <option value="youtube">YouTube</option>
            <option value="twitter">X / Twitter</option>
            <option value="linkedin">LinkedIn</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Actual Score (0-100)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={actualScore}
            onChange={(e) => setActualScore(e.target.value)}
            placeholder="Optional"
            className={inputClasses}
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500">Post URL (optional)</label>
        <input
          type="url"
          value={postUrl}
          onChange={(e) => setPostUrl(e.target.value)}
          placeholder="https://..."
          className={inputClasses}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isPending}
      >
        {isPending ? "Submitting..." : "Submit Outcome"}
      </Button>
    </form>
  );
}
