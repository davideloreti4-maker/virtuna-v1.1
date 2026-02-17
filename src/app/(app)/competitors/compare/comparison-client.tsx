"use client";

import { useRouter } from "next/navigation";
import type { ComparisonData } from "./page";
import { ComparisonSelector } from "@/components/competitors/comparison/comparison-selector";
import { ComparisonMetricCard } from "@/components/competitors/comparison/comparison-metric-card";
import { ComparisonBarChart } from "@/components/competitors/comparison/comparison-bar-chart";
import { ComparisonGrowthChart } from "@/components/competitors/comparison/comparison-growth-chart";
import { formatCount } from "@/lib/competitors-utils";

interface ComparisonClientProps {
  dataA: ComparisonData | null;
  dataB: ComparisonData | null;
  competitors: {
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  }[];
  selectedA?: string;
  selectedB?: string;
  userHandle: string | null;
}

export function ComparisonClient({
  dataA,
  dataB,
  competitors,
  selectedA,
  selectedB,
  userHandle,
}: ComparisonClientProps) {
  const router = useRouter();

  function handleSelectA(handle: string) {
    const params = new URLSearchParams();
    if (handle) params.set("a", handle);
    if (selectedB) params.set("b", selectedB);
    router.push(`/competitors/compare?${params.toString()}`);
  }

  function handleSelectB(handle: string) {
    const params = new URLSearchParams();
    if (selectedA) params.set("a", selectedA);
    if (handle) params.set("b", handle);
    router.push(`/competitors/compare?${params.toString()}`);
  }

  const hasBothSides = dataA !== null && dataB !== null;

  // Build metric cards data
  const metrics = hasBothSides
    ? [
        {
          label: "Followers",
          valueA: formatCount(dataA.followers),
          valueB: formatCount(dataB.followers),
          rawA: dataA.followers ?? 0,
          rawB: dataB.followers ?? 0,
        },
        {
          label: "Total Likes",
          valueA: formatCount(dataA.likes),
          valueB: formatCount(dataB.likes),
          rawA: dataA.likes ?? 0,
          rawB: dataB.likes ?? 0,
        },
        {
          label: "Videos",
          valueA: formatCount(dataA.videos),
          valueB: formatCount(dataB.videos),
          rawA: dataA.videos ?? 0,
          rawB: dataB.videos ?? 0,
        },
        {
          label: "Engagement Rate",
          valueA:
            dataA.engagementRate !== null
              ? `${dataA.engagementRate}%`
              : "--",
          valueB:
            dataB.engagementRate !== null
              ? `${dataB.engagementRate}%`
              : "--",
          rawA: dataA.engagementRate ?? 0,
          rawB: dataB.engagementRate ?? 0,
        },
        {
          label: "Growth Rate",
          valueA:
            dataA.growthVelocity !== null
              ? `${dataA.growthVelocity.percentage > 0 ? "+" : ""}${dataA.growthVelocity.percentage}%`
              : "--",
          valueB:
            dataB.growthVelocity !== null
              ? `${dataB.growthVelocity.percentage > 0 ? "+" : ""}${dataB.growthVelocity.percentage}%`
              : "--",
          rawA: dataA.growthVelocity?.percentage ?? 0,
          rawB: dataB.growthVelocity?.percentage ?? 0,
        },
        {
          label: "Posting Frequency",
          valueA:
            dataA.postingCadence !== null
              ? `${dataA.postingCadence.postsPerWeek}/wk`
              : "--",
          valueB:
            dataB.postingCadence !== null
              ? `${dataB.postingCadence.postsPerWeek}/wk`
              : "--",
          rawA: dataA.postingCadence?.postsPerWeek ?? 0,
          rawB: dataB.postingCadence?.postsPerWeek ?? 0,
        },
        {
          label: "Avg Views",
          valueA: formatCount(dataA.avgViews),
          valueB: formatCount(dataB.avgViews),
          rawA: dataA.avgViews ?? 0,
          rawB: dataB.avgViews ?? 0,
        },
      ]
    : [];

  // Build bar chart data (only absolute count metrics, skip percentages)
  const barChartData = hasBothSides
    ? [
        {
          metric: "Followers",
          valueA: dataA.followers ?? 0,
          valueB: dataB.followers ?? 0,
        },
        {
          metric: "Likes",
          valueA: dataA.likes ?? 0,
          valueB: dataB.likes ?? 0,
        },
        {
          metric: "Videos",
          valueA: dataA.videos ?? 0,
          valueB: dataB.videos ?? 0,
        },
        {
          metric: "Avg Views",
          valueA: dataA.avgViews ?? 0,
          valueB: dataB.avgViews ?? 0,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-foreground">
        Compare Competitors
      </h1>

      {/* Selector row */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <ComparisonSelector
            competitors={competitors}
            value={selectedA}
            onChange={handleSelectA}
            label="Competitor A"
            showSelfOption={true}
            selfHandle={userHandle}
          />
        </div>
        <div className="flex-1">
          <ComparisonSelector
            competitors={competitors}
            value={selectedB}
            onChange={handleSelectB}
            label="Competitor B"
            showSelfOption={true}
            selfHandle={userHandle}
          />
        </div>
      </div>

      {/* Content */}
      {hasBothSides ? (
        <>
          {/* Metric cards grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <ComparisonMetricCard
                key={m.label}
                label={m.label}
                valueA={m.valueA}
                valueB={m.valueB}
                rawA={m.rawA}
                rawB={m.rawB}
                handleA={dataA.handle}
                handleB={dataB.handle}
              />
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ComparisonBarChart
              data={barChartData}
              handleA={dataA.handle}
              handleB={dataB.handle}
            />
            <ComparisonGrowthChart
              seriesA={dataA.snapshotTimeSeries}
              seriesB={dataB.snapshotTimeSeries}
              handleA={dataA.handle}
              handleB={dataB.handle}
            />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-[300px]">
          <p className="text-sm text-foreground-muted">
            Select two competitors to compare
          </p>
        </div>
      )}
    </div>
  );
}
