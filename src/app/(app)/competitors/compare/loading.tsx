/**
 * Loading skeleton for the comparison page.
 *
 * Shows selector placeholders and a grid of metric card skeletons.
 */
export default function CompareLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="h-8 w-48 rounded-lg bg-white/[0.03] animate-pulse" />

      {/* Selector skeletons */}
      <div className="flex gap-4">
        <div className="h-[42px] flex-1 rounded-lg bg-white/[0.03] animate-pulse" />
        <div className="h-[42px] flex-1 rounded-lg bg-white/[0.03] animate-pulse" />
      </div>

      {/* Metric card skeletons */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-white/[0.03] animate-pulse"
          />
        ))}
      </div>

      {/* Chart skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-[350px] rounded-xl bg-white/[0.03] animate-pulse" />
        <div className="h-[350px] rounded-xl bg-white/[0.03] animate-pulse" />
      </div>
    </div>
  );
}
