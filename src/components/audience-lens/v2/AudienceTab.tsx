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
import { TONE, Kick, HowToRead, VerdictChip, type CodedReason, type SegmentStop, type TerrainCluster, type TriState } from "./AmbientDetail";
import type { DemandCurveData, DomainTemplate, PopulationFrameData, PopulationMain } from "./domain-template";

/** The shared society terrain spec — clusters knit into one connected graph. */
type TerrainSpec = { clusters: TerrainCluster[]; lossClusterIndex: number };

// ── terrain: one connected society ───────────────────────────────────────────

const TVW = 380;
const TVH = 210;
const GCX = 188; // gravity centre — commuter nodes drift toward it, knitting the clusters
const GCY = 118;
const MAXD2 = 92 * 92; // edge distance² threshold

function useTerrain(terrain: TerrainSpec) {
  return useMemo(() => {
    const { clusters, lossClusterIndex } = terrain;
    // Deterministic LCG (seed 42) — same seed ⇒ byte-identical layout on server & client (no
    // hydration drift) and stable across runs (design law: content lights the map, never moves it).
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const nodes: { x: number; y: number; c: number; u: number }[] = [];
    const byCluster: number[][] = clusters.map(() => []);
    clusters.forEach((c, ci) => {
      for (let i = 0; i < c.n; i++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * c.spread;
        let x = c.cx + Math.cos(a) * r;
        let y = c.cy + Math.sin(a) * r * 0.72;
        if (rand() < 0.28) {
          x += (GCX - x) * 0.5;
          y += (GCY - y) * 0.5;
        }
        byCluster[ci]!.push(nodes.length);
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
    // Commuter ties — a few deliberate long-range links knit the neighborhoods into ONE society
    // (the mechanism the owner named: "commuter nodes knit clusters"), so the map reads as one cloud
    // with districts, not 4 islands. Deterministic: the 2 nearest cross-cluster node pairs per pair
    // of clusters. (This does the knit via edges, NOT r5's rejected collapse-to-centre rebuild.)
    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        const pairs: { i: number; j: number; d: number }[] = [];
        byCluster[a]!.forEach((i) =>
          byCluster[b]!.forEach((j) =>
            pairs.push({ i, j, d: (nodes[i]!.x - nodes[j]!.x) ** 2 + (nodes[i]!.y - nodes[j]!.y) ** 2 }),
          ),
        );
        pairs.sort((p, q) => p.d - q.d);
        pairs.slice(0, 2).forEach((p) => edges.push([p.i, p.j]));
      }
    }
    return { nodes, edges, clusters, lossClusterIndex };
  }, [terrain]);
}

/** The terrain is now a HERO CARD matched to the cortex card (same rounded-[14px] border, #131210
 *  field, ~208px) so the two heroes read as one system. The society is ALIVE: the stopped nodes pulse
 *  (breathing with activity), the whole map reveals on open — motion is INTENSITY only, positions
 *  stay stable (design law). Coral loss nodes hold still (the ones who didn't react). */
function TerrainMap({
  terrain,
  verdict,
  reducedMotion = false,
}: {
  terrain: TerrainSpec;
  verdict?: DomainTemplate["verdict"];
  reducedMotion?: boolean;
}) {
  const { nodes, edges, clusters, lossClusterIndex } = useTerrain(terrain);
  return (
    <div
      className="relative overflow-hidden rounded-[14px]"
      style={{ height: 208, border: `1px solid ${TONE.border}`, background: "#131210" }}
    >
      <svg viewBox={`0 0 ${TVW} ${TVH}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
        {/* the society reveals on open (once) — degrades to visible if SMIL is unavailable */}
        <g opacity={1}>
          {!reducedMotion ? <animate attributeName="opacity" values="0;1" dur="0.7s" begin="0s" fill="freeze" /> : null}
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
            return (
              <circle key={i} cx={n.x.toFixed(1)} cy={n.y.toFixed(1)} r={lit ? 3.2 : isLoss ? 3 : 2.6} fill={fill} opacity={op}>
                {/* the stopped audience breathes — a gentle, staggered opacity pulse (intensity, not motion) */}
                {lit && !reducedMotion ? (
                  <animate
                    attributeName="opacity"
                    values={`${op};${Math.min(1, op * 1.35).toFixed(2)};${op}`}
                    dur="3.2s"
                    begin={`${(n.u * 3.2).toFixed(2)}s`}
                    repeatCount="indefinite"
                  />
                ) : null}
              </circle>
            );
          })}
          {clusters.map((c, ci) => (
            // neighborhood labels now carry the district's rate (lit share) — this MERGES the old
            // "who stopped · by segment" bar list ONTO the terrain, so the map self-reads (where + how
            // much at once) and a whole redundant section drops.
            <text
              key={c.name}
              x={c.cx}
              y={c.cy - c.spread * 0.72 - 8}
              textAnchor="middle"
              fontFamily="Inter, sans-serif"
              fontSize={10.5}
              fill={ci === lossClusterIndex ? "rgba(255,99,99,.7)" : "rgba(236,231,222,.4)"}
            >
              {c.name} {Math.round(c.lit * 100)}%
            </text>
          ))}
        </g>
      </svg>
      {verdict ? <VerdictChip verdict={verdict} /> : null}
    </div>
  );
}

// ── main figure slot (◇ swap — the distribution the headline summarizes) ──────

/** The Population's main figure. Creator = the stop/skim/scroll tri-state; pricing = the demand
 *  curve. A new domain adds a `kind` (overlay · answer-distribution) here without touching terrain/
 *  segments/voices. */
function PopulationMainSlot({ main }: { main: PopulationMain }) {
  switch (main.kind) {
    case "tri-state":
      return <TriStateOutcome tri={main.data} percentileLine={main.percentileLine} />;
    case "demand-curve":
      return <DemandCurve data={main.data} />;
  }
}

/** Demand curve — would-pay share falls as price rises; a cream dashed marker flags the revenue-
 *  optimal price (cream = the good default; coral stays reserved for the loss, per the room law). */
function DemandCurve({ data }: { data: DemandCurveData }) {
  const W = 380;
  const H = 66;
  const PAD = 5;
  const { points, optimalAt, optimalLabel, loLabel, hiLabel, caption, kicker } = data;
  const n = points.length;
  const px = (i: number) => PAD + (i / (n - 1)) * (W - 2 * PAD);
  const py = (v: number) => H - PAD - (v / 100) * (H - 2 * PAD);
  const linePath = "M" + points.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" L");
  const ox = PAD + optimalAt * (W - 2 * PAD);
  return (
    <div className="mt-8">
      <Kick tag="simulated">{kicker}</Kick>
      <div className="mt-3.5">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
          <path d={linePath} fill="none" stroke="rgba(236,231,222,.6)" strokeWidth={1.5} />
          <line x1={ox} y1={0} x2={ox} y2={H} stroke="rgba(236,231,222,.55)" strokeWidth={1} strokeDasharray="3 3" />
        </svg>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between text-[12px]">
        <span className="font-mono" style={{ color: TONE.dim }}>
          {optimalLabel}
        </span>
        <span style={{ color: TONE.faint }}>{caption}</span>
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px]" style={{ color: TONE.faint }}>
        <span>{loLabel}</span>
        <span>{hiLabel}</span>
      </div>
    </div>
  );
}

function TriStateOutcome({ tri, percentileLine }: { tri: TriState; percentileLine: string }) {
  const cols = [
    { n: tri.stopped, t: "stopped", loss: false },
    { n: tri.skimmed, t: "skimmed", loss: false },
    { n: tri.scrolled, t: "scrolled past", loss: true },
  ];
  // Decluttered (as-06): the % + label + coral-on-loss carries the read; the strong/okay/low band
  // word row was noise restating what the colour already says — dropped.
  return (
    <div className="mt-8">
      <Kick tag="simulated">Outcome · {percentileLine}</Kick>
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
          </div>
        ))}
      </div>
    </div>
  );
}

// ── who stopped · by segment ─────────────────────────────────────────────────

function Segments({ title, rows }: { title: string; rows: SegmentStop[] }) {
  return (
    <div className="mt-8">
      <Kick>{title}</Kick>
      <div className="mt-1">
        {rows.map((s, i) => (
          <div
            key={s.label}
            className="flex items-center gap-3 py-[11px]"
            style={{ borderBottom: i < rows.length - 1 ? `1px solid ${TONE.border}` : undefined }}
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

// ── voices · coded reasons + interviewable cast (● shared) ────────────────────

function Voices({
  kicker,
  reasons,
  onInterview,
}: {
  kicker: string;
  reasons: CodedReason[];
  onInterview?: (who: string) => void;
}) {
  return (
    <div className="mt-8">
      <Kick tag="from this run">{kicker}</Kick>
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

// ── the population role-frame ──────────────────────────────────────────────────

/** PopulationFrame — the invariant *who / how many* role (2026-07-21 owner restructure). The NODES
 *  are the hero: terrain card (matched to the cortex card) + verdict chip + a one-line read → the
 *  distribution → segments (domain-optional) → voices → calibration → footer. The UNLOCK is NOT here
 *  — a timing/price lever belongs on the brain tab, not the "who" page. A new domain supplies figures
 *  — it never edits this frame. */
export function PopulationFrame({
  population,
  verdict,
  reducedMotion = false,
  onInterview,
}: {
  population: PopulationFrameData;
  verdict: DomainTemplate["verdict"];
  reducedMotion?: boolean;
  onInterview?: (who: string) => void;
}) {
  return (
    <div className="mt-4">
      <TerrainMap terrain={population.terrain} verdict={verdict} reducedMotion={reducedMotion} />
      {population.heroRead ? (
        <p className="mt-3 text-[14px] leading-[1.5]" style={{ color: TONE.dim }}>
          {population.heroRead}
        </p>
      ) : null}
      <PopulationMainSlot main={population.main} />
      {population.segments ? <Segments title={population.segments.title} rows={population.segments.rows} /> : null}
      <Voices kicker={population.voices.kicker} reasons={population.voices.reasons} onInterview={onInterview} />
      {/* calibration honesty — generalization is bounded by what the audience was calibrated for */}
      {population.calibration ? (
        <div className="mt-6 font-mono text-[11px] uppercase tracking-[0.06em]" style={{ color: TONE.faint }}>
          {population.calibration.note}
        </div>
      ) : null}
      <HowToRead />
    </div>
  );
}
