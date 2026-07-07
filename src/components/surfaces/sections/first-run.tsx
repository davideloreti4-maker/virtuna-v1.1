"use client";

/**
 * FirstRun — the no-audience state. Honest: Maven hasn't met your followers yet, so it
 * never fakes a reaction. Connect once → every card arrives pre-tested. The composer
 * stays live below (owned by the shell); this is just the empty-state body + the 3-step loop.
 */

import { MavenMark } from "@/components/brand/maven-logo";

export function FirstRun({ onConnect }: { onConnect: () => void }) {
  const steps = [
    "Connect — Maven builds your room from your real followers.",
    "Ideas, outliers, and calendar slots all arrive scored for your people.",
    "Publish → Maven checks its call against what happened → the model sharpens.",
  ];
  return (
    <div className="flex flex-col px-1.5 py-4">
      <span className="mb-4 text-foreground" aria-hidden>
        <MavenMark size={34} />
      </span>
      <h2 className="m-0 mb-2.5 font-serif text-[24px] font-normal leading-[1.24] text-foreground">
        Let’s build your room.
      </h2>
      <p className="m-0 mb-2 text-[13px] leading-[1.55] text-foreground-muted">
        Maven hasn’t met your audience yet. <b className="font-semibold text-foreground-secondary">Connect your account</b> — it
        models ~10 named people from your real followers, then every card here comes pre-tested on them.
      </p>
      <button
        type="button"
        onClick={onConnect}
        className="mt-3.5 rounded-[11px] bg-[color:var(--color-action)] px-3 py-3 text-center text-[13px] font-semibold text-[color:var(--color-action-foreground)] transition-colors hover:brightness-105"
      >
        Connect your account →
      </button>
      <div className="mt-3 text-center text-[11.5px] text-foreground-muted">or just make something now ↓</div>
      <div className="mt-5 flex flex-col">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`flex items-start gap-2.5 px-1 py-2.5 text-[12px] leading-[1.45] text-foreground-secondary ${i > 0 ? "border-t border-border" : ""}`}
          >
            <span className="mt-0.5 w-3.5 shrink-0 font-mono text-[10px] text-foreground-muted">{i + 1}</span>
            <div>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
