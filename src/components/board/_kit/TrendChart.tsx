'use client';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * TrendChart — the one calm chart. Current series = coral line + soft area;
 * optional previous/comparison series = dotted muted line. Minimal axes/grid.
 */
export interface TrendPoint {
  x: number | string;
  current: number;
  previous?: number;
}

export interface TrendChartProps {
  data: TrendPoint[];
  height?: number;
  yDomain?: [number | 'auto', number | 'auto'];
  yFormat?: (v: number) => string;
  xFormat?: (v: number | string) => string;
  fill?: boolean;
  currentLabel?: string;
  previousLabel?: string;
  className?: string;
}

export function TrendChart({
  data,
  height = 180,
  yDomain,
  yFormat,
  xFormat,
  fill = true,
  currentLabel = 'Current',
  previousLabel = 'Previous',
  className,
}: TrendChartProps) {
  const hasPrev = data.some((d) => d.previous != null);
  return (
    <div className={className} style={{ width: '100%', height }} data-testid="trend-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id="trend-current-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="x"
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickFormatter={xFormat as (v: unknown) => string}
          />
          <YAxis
            domain={yDomain ?? ['auto', 'auto']}
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={yFormat as (v: unknown) => string}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(255,255,255,0.12)' }}
            content={({ active, payload, label }) =>
              active && payload && payload.length ? (
                <div className="rounded-md border border-white/10 bg-[#18191a] px-2 py-1 text-[11px] shadow-lg">
                  <div className="text-white/40">
                    {xFormat && label != null ? xFormat(label) : label}
                  </div>
                  {payload.map((p) => (
                    <div key={String(p.dataKey)} className="tabular-nums text-white/80">
                      {p.name}:{' '}
                      {yFormat ? yFormat(Number(p.value)) : (p.value as number)}
                    </div>
                  ))}
                </div>
              ) : null
            }
          />
          {hasPrev && (
            <Area
              type="monotone"
              dataKey="previous"
              name={previousLabel}
              stroke="rgba(255,255,255,0.25)"
              strokeDasharray="3 3"
              strokeWidth={1.25}
              fill="none"
              dot={false}
              isAnimationActive={false}
            />
          )}
          <Area
            type="monotone"
            dataKey="current"
            name={currentLabel}
            stroke="var(--color-accent)"
            strokeWidth={2}
            fill={fill ? 'url(#trend-current-fill)' : 'none'}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
