import Image from "next/image";

import { Surface } from "@/components/numen/surface";
import { VerdictThrone } from "@/components/numen-landing/verdict-throne";
import heroKeyframe from "@/../public/images/landing/hero/keyframe.webp";

/**
 * HowItWorks — READ-01 / READ-02, the 3-step Reading explainer.
 *
 * Renders the honest upload → reads → verdict story as three `Surface` cards in
 * a responsive grid (mobile single stack, desktop 3-up) under the
 * `#how-it-works` `<h2>` owned by SectionShell. Each step title is an `<h3>` —
 * correct level under the section heading, no skip — and this component emits NO
 * `<h1>`/`<h2>` of its own (D-10 single-h1 invariant).
 *
 * READ-02 (HARD): every step demonstrates REAL content, never an icon-only card
 * or an abstract diagram:
 *   1 "Upload"        — the SAME real creator keyframe (next/image, blur).
 *   2 "Numen reads it" — a real stage-read excerpt line (VOICE-clean).
 *   3 "Your verdict"  — the SAME `<VerdictThrone />` band + label + why.
 *
 * VOICE.md Rules 1-3: no engine jargon (Apollo/fold/Omni/model/pipeline), no
 * hype/fake precision (%, viral, guaranteed, accuracy, predict), and the verdict
 * is ALWAYS the band + why (VerdictThrone), never a naked number. Static RSC
 * (D-06 clickable-to-hero deferred). Color by token NAME only — no hex in JSX.
 */
export function HowItWorks() {
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-3 md:gap-8">
      {/* 1 — Upload: the real keyframe, not an icon. */}
      <Surface className="flex flex-col gap-4 p-4 md:p-6">
        <div>
          <h3 className="text-base font-medium text-text md:text-lg">Upload</h3>
          <p className="mt-2 text-base leading-relaxed text-text-muted">
            Drop in your video — that&apos;s all it needs.
          </p>
        </div>
        <div className="overflow-hidden rounded-[12px] border border-border">
          <Image
            src={heroKeyframe}
            alt="A real creator video ready for its Reading."
            placeholder="blur"
            className="h-auto w-full"
            sizes="(min-width: 768px) 320px, 100vw"
          />
        </div>
      </Surface>

      {/* 2 — Numen reads it: a real stage-read excerpt, not a diagram. */}
      <Surface className="flex flex-col gap-4 p-4 md:p-6">
        <div>
          <h3 className="text-base font-medium text-text md:text-lg">
            Numen reads it
          </h3>
          <p className="mt-2 text-base leading-relaxed text-text-muted">
            It watches your video the way your sharpest audience would.
          </p>
        </div>
        <div className="rounded-[12px] border border-border bg-panel p-4">
          <p className="text-sm leading-relaxed text-text-muted md:text-base">
            Watching how the first seconds land for your audience…
          </p>
        </div>
      </Surface>

      {/* 3 — Your verdict: the SAME real verdict band + why (VerdictThrone). */}
      <Surface className="flex flex-col gap-4 p-4 md:p-6">
        <div>
          <h3 className="text-base font-medium text-text md:text-lg">
            Your verdict
          </h3>
          <p className="mt-2 text-base leading-relaxed text-text-muted">
            An honest call on whether it&apos;ll land — and the one thing to fix.
          </p>
        </div>
        <VerdictThrone />
      </Surface>
    </div>
  );
}
