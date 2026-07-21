"use client";

/**
 * AudienceTab — Ambient Audience v2, Detail tab ② "The audience" (out-AS Artificial Societies).
 *
 * Round-4 anatomy: terrain map (ONE connected society — nodes = people, knit by commuter edges) ·
 * outcome tri-state · who-stopped-by-segment · why-coded-from-1,000 (a reason speaks for N, the
 * persona is its exemplar) · "how to read" footer.
 *
 * Reuse decision (build handoff §5): the terrain is the explicit P3 rework target (NOT locked), and
 * `PopulationSwarm` scatters dots around anchors with no connecting edges — so the terrain is built
 * LEAN here as r4's deterministic connected graph (seeded → stable across runs & SSR, design law 8).
 *
 * Owner P3 marks (LIVE-refine backlog, built faithful to r4 first): make the terrain ONE
 * interactive cloud (less hard-category), and declutter the outcome/who-stopped section. Coded
 * reasons + the terrain layout are NEW data contracts (§6) — fixture-backed here, degrade later.
 */

import { useMemo } from "react";
import { TONE, Kick, HowToRead, type AudienceData } from "./AmbientDetail";

// ── terrain: one connected society ───────────────────────────────────────────

const TVW = 380;
const TVH = 210;
const GCX = 188; // gravity centre — commuter nodes drift toward it, knitting the clusters
const GCY = 118;
const MAXD2 = 92 * 92; // edge distance² threshold

function useTerrain(data: AudienceData) {
  return useMemo(() => {
    const { clusters, lossClusterIndex } = data.terrain;
    // Deterministic LCG (seed 42) — same seed ⇒ byte-identical layout on server & client (no
    // hydration drift) and stable across runs (design law: content lights the map, never moves it).
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const nodes: { x: number; y: number; c: number; u: number }[] = [];
    clusters.forEach((c, ci) => {
      for (let i = 0; i < c.n; i++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * c.spread;
        let x = c.cx + Math.cos(a) * r;
        let y = c.cy + Math.sin(a) * r * 0.72;
        if (rand() < 0.2) {
          x += (GCX - x) * 0.5;
          y += (GCY - y) * 0.5;
        }
        nodes.push({ x, y, c: ci, u: rand() });
      }
    });
    const edges: [number, number][] = [];
    nodes.forEach((n, i) => {
      const near = nodes
        .map((m, j) => ({ j, d: (m.x - n.x) ** 2 + (m.y - n.y) ** 2 }))
        .filter((o) => o.j !== i && o.d < MAXD2)
        .sort((p, q) => p.d - q.d)
        .slice(0, 3);
      near.forEach((o) => {
        if (i < o.j) edges.push([i, o.j]);
      });
    });
    return { nodes, edges, clusters, lossClusterIndex };
  }, [data]);
}

function TerrainMap({ data }: { data: AudienceData }) {
  const { nodes, edges, clusters, lossClusterIndex } = useTerrain(data);
  return (
    <div className="-mx-[26px] mt-3.5" style={{ borderTop: `1px solid ${TONE.border}`, borderBottom: `1px solid ${TONE.border}`, background: "#1b1b1a" }}>
      <svg viewBox={`0 0 ${TVW} ${TVH}`} className="block h-auto w-full">
        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a]!.x.toFixed(1)}
            y1={nodes[a]!.y.toFixed(1)}
            x2={nodes[b]!.x.toFixed(1)}
            y2={nodes[b]!.y.toFixed(1)}
            stroke="rgba(255,255,255,.07)"
            strokeWidth={1}
          />
        ))}
        {nodes.map((n, i) => {
          const lit = n.u < clusters[n.c]!.lit;
          const isLoss = n.c === lossClusterIndex;
          const fill = !lit && isLoss ? TONE.coral : TONE.cream;
          const op = lit ? 0.92 : isLoss ? 0.5 : 0.15;
          return <circle key={i} cx={n.x.toFixed(1)} cy={n.y.toFixed(1)} r={3} fill={fill} opacity={op} />;
        })}
        {clusters.map((c, ci) => (
          <text
            key={c.name}
            x={c.cx}
            y={c.cy - c.spread * 0.72 - 8}
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
            fontSize={11}
            fill={`rgba(236,231,222,${ci === lossClusterIndex ? ".5" : ".3"})`}
          >
            {c.name}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── outcome tri-state ────────────────────────────────────────────────────────

function Outcome({ data }: { data: AudienceData }) {
  const cols = [
    { n: data.tri.stopped, t: "stopped", s: "strong", loss: false },
    { n: data.tri.skimmed, t: "skimmed", s: "okay", loss: false },
    { n: data.tri.scrolled, t: "scrolled past", s: "low", loss: true },
  ];
  return (
    <div className="mt-8">
      <Kick tag="simulated">Outcome · {data.percentileLine}</Kick>
      <div className="mt-[18px] flex">
        {cols.map((c, i) => (
          <div
            key={c.t}
            className="flex-1 pt-0.5"
            style={{
              paddingLeft: i === 0 ? 0 : 12,
              paddingRight: 12,
              borderLeft: i === 0 ? undefined : `1px solid ${TONE.border}`,
            }}
          >
            <div className="text-[22px] font-normal" style={{ color: c.loss ? TONE.coral : TONE.cream }}>
              {c.n}%
            </div>
            <div className="mt-0.5 text-[12px]" style={{ color: TONE.faint }}>
              {c.t}
            </div>
            <div
              className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.06em]"
              style={{ color: c.loss ? "rgba(255,99,99,.6)" : "rgba(236,231,222,.3)" }}
            >
              {c.s}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── who stopped · by segment ─────────────────────────────────────────────────

function Segments({ segments }: { segments: AudienceData["segments"] }) {
  return (
    <div className="mt-8">
      <Kick>Who stopped · by segment</Kick>
      <div className="mt-1">
        {segments.map((s, i) => (
          <div
            key={s.label}
            className="flex items-center gap-3 py-[11px]"
            style={{ borderBottom: i < segments.length - 1 ? `1px solid ${TONE.border}` : undefined }}
          >
            <span className="w-[84px] flex-none text-[14px]" style={{ color: TONE.dim }}>
              {s.label}
            </span>
            <span className="relative h-[3px] flex-1 overflow-hidden rounded-full" style={{ background: TONE.ghost }}>
              <span
                className="absolute inset-0 block origin-left"
                style={{ transform: `scaleX(${Math.min(1, s.pct / 100)})`, background: s.loss ? TONE.coral : "rgba(236,231,222,.6)", opacity: s.loss ? 0.8 : 1 }}
              />
            </span>
            <span className="w-[34px] flex-none text-right text-[13px] font-medium" style={{ color: s.loss ? TONE.coral : TONE.cream }}>
              {s.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── why · coded from 1,000 ───────────────────────────────────────────────────

function Reasons({ reasons, onInterview }: { reasons: AudienceData["reasons"]; onInterview?: (who: string) => void }) {
  return (
    <div className="mt-8">
      <Kick tag="from this run">Why · coded from 1,000</Kick>
      <div className="mt-1">
        {reasons.map((r, i) => (
          <div key={r.label} className="py-3.5" style={{ borderBottom: i < reasons.length - 1 ? `1px solid ${TONE.border}` : undefined }}>
            <div className="flex items-baseline justify-between gap-2.5">
              <span className="text-[14px] font-medium" style={{ color: TONE.cream }}>
                {r.label}
              </span>
              <span className="flex-none text-[13px]" style={{ color: TONE.faint }}>
                <b className="font-medium" style={{ color: r.loss ? TONE.coral : TONE.dim }}>
                  ×{r.count}
                </b>
              </span>
            </div>
            <p className="mt-1.5 font-serif text-[15px] italic leading-[1.45]" style={{ color: TONE.dim }}>
              &ldquo;{r.quote}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => onInterview?.(r.who)}
              className="mt-1 text-[12px] transition-colors"
              style={{ color: TONE.faint }}
              onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
              onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
            >
              {r.who} · interview ›
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── the tab ──────────────────────────────────────────────────────────────────

export function AudienceTab({
  data,
  onInterview,
}: {
  data: AudienceData;
  reducedMotion?: boolean;
  onInterview?: (who: string) => void;
}) {
  return (
    <div>
      <TerrainMap data={data} />
      <Outcome data={data} />
      <Segments segments={data.segments} />
      <Reasons reasons={data.reasons} onInterview={onInterview} />
      <HowToRead />
    </div>
  );
}
