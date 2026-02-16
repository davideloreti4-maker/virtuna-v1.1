"use client";

interface ChartTooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string;
  formatter?: (value: number) => string;
}

/**
 * Shared dark theme tooltip for all Recharts charts.
 *
 * Uses surface background (#18191a) with subtle border and shadow
 * to match the Raycast dark theme.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter = (v) => v.toLocaleString(),
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-lg border border-white/[0.06] px-3 py-2 text-sm"
      style={{
        background: "#18191a",
        boxShadow: "rgba(0,0,0,0.5) 0px 4px 12px",
      }}
    >
      {label && (
        <p className="text-foreground-muted text-xs mb-1">{label}</p>
      )}
      {payload.map((entry, i) => (
        <p key={i} className="text-foreground">
          <span
            className="inline-block w-2 h-2 rounded-full mr-2"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {formatter(entry.value)}
        </p>
      ))}
    </div>
  );
}
