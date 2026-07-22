"use client";

/**
 * Dev review surface for Ambient Audience v2 (build handoff 2026-07-21).
 * Surfaces ① Overview + ② Detail/Brain, built in round-4 grammar — reviewed LIVE, refined in code.
 */

import { useState } from "react";
import { AmbientOverview, AMBIENT_PANEL_HEIGHT } from "@/components/audience-lens/v2/AmbientOverview";
import { OVERVIEW_R4, OVERVIEW_R4_REST } from "@/components/audience-lens/v2/overview-fixture";
import { AmbientDetail } from "@/components/audience-lens/v2/AmbientDetail";
import { CREATOR_TEMPLATE } from "@/components/audience-lens/v2/detail-fixture";
import { PRICING_TEMPLATE } from "@/components/audience-lens/v2/pricing-template";
import { AmbientStart } from "@/components/audience-lens/v2/AmbientStart";
import { START_R4 } from "@/components/audience-lens/v2/start-fixture";
import { AmbientSimulate } from "@/components/audience-lens/v2/AmbientSimulate";
import { SIMULATE_R4 } from "@/components/audience-lens/v2/simulate-fixture";

type Surface = "start" | "simulate" | "overview" | "brain";

const TITLES: Record<Surface, string> = {
  start: "④ Start — the instrument at rest",
  simulate: "⑤ Simulate — arming an instrument",
  overview: "① Overview",
  brain: "② Detail — The brain",
};

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors"
      style={{
        border: `1px solid ${on ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.06)"}`,
        background: on ? "#262624" : "transparent",
        color: on ? "#ece7de" : "rgba(236,231,222,.5)",
      }}
    >
      {children}
    </button>
  );
}

export default function AmbientV2DevPage() {
  const [surface, setSurface] = useState<Surface>("overview");
  const [mode, setMode] = useState<"simulating" | "rest">("simulating");
  const [simMode, setSimMode] = useState<"develop" | "cold">("develop");
  const [domain, setDomain] = useState<"creator" | "pricing">("creator");
  const overviewData = mode === "simulating" ? OVERVIEW_R4 : OVERVIEW_R4_REST;
  const template = domain === "creator" ? CREATOR_TEMPLATE : PRICING_TEMPLATE;
  // ⑤ entry: develop = pre-filled from a rank (a skill / the composer); cold = the ④ door → intake
  const openSim = (m: "develop" | "cold") => {
    setSimMode(m);
    setSurface("simulate");
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center" style={{ background: "#141413", color: "#ece7de" }}>
      <div className="w-full max-w-[1240px] px-6 pt-10">
        <div className="font-mono text-[12px] uppercase tracking-[0.08em]" style={{ color: "rgba(236,231,222,.38)" }}>
          ambient audience v2 · build · round-4 grammar
        </div>
        <h1 className="mt-1.5 text-[20px] font-medium">{TITLES[surface]}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5">
            <Chip on={surface === "start"} onClick={() => setSurface("start")}>
              ④ start
            </Chip>
            <Chip on={surface === "simulate"} onClick={() => setSurface("simulate")}>
              ⑤ simulate
            </Chip>
            <Chip on={surface === "overview"} onClick={() => setSurface("overview")}>
              ① overview
            </Chip>
            <Chip on={surface === "brain"} onClick={() => setSurface("brain")}>
              ② brain
            </Chip>
          </div>
          {surface === "overview" ? (
            <>
              <span style={{ color: "rgba(236,231,222,.2)" }}>·</span>
              <div className="flex gap-1.5">
                <Chip on={mode === "simulating"} onClick={() => setMode("simulating")}>
                  simulating now
                </Chip>
                <Chip on={mode === "rest"} onClick={() => setMode("rest")}>
                  at rest
                </Chip>
              </div>
            </>
          ) : surface === "simulate" ? (
            <>
              <span style={{ color: "rgba(236,231,222,.2)" }}>·</span>
              <div className="flex gap-1.5">
                <Chip on={simMode === "develop"} onClick={() => setSimMode("develop")}>
                  develop a rank
                </Chip>
                <Chip on={simMode === "cold"} onClick={() => setSimMode("cold")}>
                  cold · the ④ door
                </Chip>
              </div>
            </>
          ) : surface === "brain" ? (
            <>
              <span style={{ color: "rgba(236,231,222,.2)" }}>·</span>
              <div className="flex gap-1.5">
                <Chip on={domain === "creator"} onClick={() => setDomain("creator")}>
                  creator template
                </Chip>
                <Chip on={domain === "pricing"} onClick={() => setDomain("pricing")}>
                  pricing template
                </Chip>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* the surface (room panels frame at the shared fixed height; start fills + centers) */}
      <div className="flex w-full flex-1 items-stretch justify-center px-6 py-12">
        {surface === "start" ? (
          <AmbientStart
            data={START_R4}
            onSkill={() => openSim("develop")}
            onTestDoor={() => openSim("cold")}
            onSubmit={() => openSim("develop")}
          />
        ) : surface === "simulate" ? (
          // a sheet, not an 800px panel — self-center so items-stretch doesn't stretch its height
          <div className="flex w-full items-center justify-center self-center">
            <AmbientSimulate
              data={SIMULATE_R4}
              mode={simMode}
              onClose={() => setSurface("start")}
              onSimulate={() => setSurface("overview")}
            />
          </div>
        ) : (
          <div className="w-[440px]" style={{ height: AMBIENT_PANEL_HEIGHT }}>
            {surface === "overview" ? (
              <AmbientOverview data={overviewData} onOpenStimulus={() => setSurface("brain")} onTestVariant={() => {}} />
            ) : (
              <AmbientDetail template={template} onBack={() => setSurface("overview")} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
