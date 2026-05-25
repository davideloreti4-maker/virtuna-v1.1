import type { JSX } from "react";
import { GlassPanel } from "@/components/primitives/GlassPanel";

/**
 * VisionBeat (VISION-01) — founder vision quote between #pricing and #final-cta.
 *
 * Behavioral-science thesis angle (D-10), Raycast GlassPanel container (D-11),
 * plain-text attribution with NO photo (D-12, REQUIREMENTS.md VISION-01).
 *
 * Server component — fully static, no interactivity.
 */
export function VisionBeat(): JSX.Element {
  return (
    <section
      id="vision-beat"
      aria-label="Founder vision"
      className="bg-background py-16 px-6"
    >
      <div className="max-w-2xl mx-auto">
        <GlassPanel className="p-8">
          <blockquote
            className="text-xl font-normal leading-[1.6] text-foreground italic"
            style={{ letterSpacing: "0.1px" }}
          >
            Virality isn&apos;t luck &mdash; it&apos;s a behavioral signal. We built Virtuna
            to surface that signal before you bet on the post.
          </blockquote>
          <p
            className="mt-4 text-sm font-normal text-foreground-muted not-italic"
            style={{ letterSpacing: "0.2px" }}
          >
            &mdash; Davide Loreti, Founder, Virtuna
          </p>
        </GlassPanel>
      </div>
    </section>
  );
}
