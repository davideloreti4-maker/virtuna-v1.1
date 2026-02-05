"use client";

type TabValue = "earnings" | "deals" | "affiliates";

interface BrandDealsHeaderProps {
  activeTab: TabValue;
}

interface StatItem {
  label: string;
  value: string;
}

const STATS_BY_TAB: Record<TabValue, StatItem[]> = {
  earnings: [
    { label: "Total Earned", value: "$12,450" },
    { label: "Pending", value: "$1,850" },
    { label: "Paid Out", value: "$10,600" },
  ],
  deals: [
    { label: "Active Deals", value: "7" },
    { label: "New This Week", value: "3" },
    { label: "Applied", value: "2" },
  ],
  affiliates: [
    { label: "Active Links", value: "4" },
    { label: "Total Clicks", value: "5,525" },
    { label: "Total Earned", value: "$2,500" },
  ],
};

export function BrandDealsHeader({ activeTab }: BrandDealsHeaderProps) {
  const stats = STATS_BY_TAB[activeTab];

  return (
    <div
      className="flex flex-col items-start justify-between gap-6 rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 sm:flex-row sm:items-center"
      style={{
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      {/* Left: Title + subtitle */}
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Brand Deals
        </h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Manage your partnerships, links, and earnings
        </p>
      </div>

      {/* Right: Tab-contextual stats */}
      <div className="flex items-center gap-0">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`flex flex-col items-center px-5 ${
              index > 0 ? "border-l border-white/[0.08]" : ""
            }`}
          >
            <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
              {stat.label}
            </span>
            <span className="mt-0.5 text-lg font-semibold text-foreground">
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
