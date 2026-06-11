import { Newsreader } from "next/font/google";
import {
  Wand2,
  Sparkles,
  Search,
  RefreshCw,
  Play,
  Settings,
  Share2,
} from "lucide-react";

import { Glass } from "@/components/numen/glass";
import { Surface } from "@/components/numen/surface";
import { PillChip } from "@/components/numen/pill-chip";
import { IconButton } from "@/components/numen/icon-button";
import { VerdictSwatch } from "@/components/numen/verdict-swatch";
import { KitStageDemo } from "./stage-demo";

/**
 * Numen Kit showcase route (D-06, Plan 04).
 *
 * Mounts EVERY Numen primitive inside `.numen-surface` so they resolve against
 * the LIVE warm-neutral tokens (Q9). This is the deployed-build verification
 * surface: the Glass blur (D-05), the warm tokens with no pure black (DS-01),
 * the muted verdict scale (DS-02), the serif specimen (D-13), the calm
 * stage-reveal (DS-07), and the keyframe-as-chroma discipline (DS-08).
 *
 * Kept SEPARATE from the old `(marketing)/primitives-showcase` route — parallel
 * kit (D-01). NO neon/gradient/beam/glow/shimmer anywhere (D-07).
 */

// Newsreader is wired as a SECOND next/font instance scoped to this page so the
// serif specimen can show Source Serif 4 (the picked --font-serif) side-by-side
// with Newsreader (the alt) for the D-13 voice pick. It does not touch the app
// layout — it exposes `--font-serif-alt` used only in the serif specimen below.
const serifAlt = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif-alt",
});

export const metadata = {
  title: "Numen Kit",
  description:
    "Kit showcase — every Numen primitive rendered under the live warm-neutral surface tokens.",
};

// A self-contained sample keyframe still (cool-toned), as an inline SVG data URI
// so the showcase carries NO real user data and depends on no external asset.
// The (cool) image carries the chroma; the warm-neutral chrome recedes (DS-08).
const SAMPLE_KEYFRAME =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="568" viewBox="0 0 320 568">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#2b6cb0"/>
          <stop offset="0.55" stop-color="#319795"/>
          <stop offset="1" stop-color="#553c9a"/>
        </linearGradient>
      </defs>
      <rect width="320" height="568" fill="url(#g)"/>
      <circle cx="160" cy="210" r="70" fill="#e6f6ff" fill-opacity="0.85"/>
      <rect x="60" y="430" width="200" height="14" rx="7" fill="#ffffff" fill-opacity="0.7"/>
      <rect x="92" y="462" width="136" height="10" rx="5" fill="#ffffff" fill-opacity="0.45"/>
    </svg>`,
  );

export default function NumenKitPage() {
  return (
    <div
      className={`numen-surface dark min-h-screen bg-bg text-text p-8 md:p-16 ${serifAlt.variable}`}
    >
      <header className="mb-16 max-w-2xl">
        <h1 className="text-3xl font-semibold text-text">Numen Kit</h1>
        <p className="mt-3 text-base text-text-muted">
          This is a kit showcase — components render below under the Numen
          surface tokens.
        </p>
      </header>

      {/* Section 1 — Tokens swatch grid (proves warm-neutral, no pure black) */}
      <section className="mb-16">
        <h2 className="mb-6 text-xl font-semibold text-text">Tokens</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {(
            [
              { label: "bg", cls: "bg-bg", hex: "#1a1714" },
              { label: "panel", cls: "bg-panel", hex: "#211e1a" },
              { label: "panel-2", cls: "bg-panel-2", hex: "#2a2622" },
              { label: "text", cls: "bg-text", hex: "#f0ebe3" },
              { label: "text-muted", cls: "bg-text-muted", hex: "#bab2a5" },
              { label: "accent", cls: "bg-accent", hex: "#d98a5e" },
            ] as const
          ).map((t) => (
            <div key={t.label} className="flex flex-col gap-2">
              <div
                className={`h-16 w-full rounded-[12px] border border-border ${t.cls}`}
              />
              <div className="text-sm font-medium text-text">{t.label}</div>
              <div className="text-sm text-text-muted">{t.hex}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2 — Verdict scale (muted peers; amber "mixed" first-class) */}
      <section className="mb-16">
        <h2 className="mb-6 text-xl font-semibold text-text">Verdict scale</h2>
        <p className="mb-6 max-w-2xl text-base text-text-muted">
          Three muted bands, peers — not a good→bad gradient. The amber “mixed”
          band is first-class, never an error tint.
        </p>
        <div className="flex flex-wrap items-end gap-8">
          {(
            [
              { verdict: "good", label: "Good" },
              { verdict: "mixed", label: "Mixed" },
              { verdict: "bad", label: "Bad" },
            ] as const
          ).map((v) => (
            <div key={v.verdict} className="flex flex-col items-center gap-2">
              <VerdictSwatch verdict={v.verdict} size="lg" />
              <span className="text-sm font-medium text-text">{v.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3 — Surface + Glass (Glass = the DEPLOYED-build blur check) */}
      <section className="mb-16">
        <h2 className="mb-6 text-xl font-semibold text-text">Surface & Glass</h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <Surface className="p-6">
            <h3 className="mb-2 text-base font-semibold text-text">Surface</h3>
            <p className="text-sm text-text-muted">
              The default hairline-border container — warm border, soft
              elevation, no blur.
            </p>
          </Surface>

          {/* The Glass blur is the deployed-build check: it MUST blur the busy
              background behind it (Lightning CSS strips the class form in prod;
              the inline-style Glass survives). */}
          <div className="relative overflow-hidden rounded-[12px]">
            <img
              src={SAMPLE_KEYFRAME}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <Glass className="relative m-6 p-6">
              <h3 className="mb-2 text-base font-semibold text-text">Glass</h3>
              <p className="text-sm text-text-muted">
                Rare blur-behind surface — confirm a real backdrop blur over the
                busy image on the deployed build, not a flat panel.
              </p>
            </Glass>
          </div>
        </div>
      </section>

      {/* Section 4 — Tool chips (instant vs agentic, visually distinct) */}
      <section className="mb-16">
        <h2 className="mb-6 text-xl font-semibold text-text">Tool chips</h2>
        <div className="flex flex-wrap items-center gap-4">
          <PillChip intent="instant" icon={<RefreshCw />}>
            Re-interpret
          </PillChip>
          <PillChip intent="instant" icon={<Sparkles />}>
            Tighten hook
          </PillChip>
          <PillChip intent="agentic" icon={<Search />}>
            Scan competitors
          </PillChip>
          <PillChip intent="agentic" icon={<Wand2 />}>
            Pull back-catalog
          </PillChip>
        </div>
        <p className="mt-4 max-w-2xl text-sm text-text-muted">
          Instant tools read quiet; agentic tools carry a faint accent ring —
          the two intents must read visually distinct.
        </p>
      </section>

      {/* Section 5 — Icon buttons (circular, 44px hit area) */}
      <section className="mb-16">
        <h2 className="mb-6 text-xl font-semibold text-text">Icon buttons</h2>
        <div className="flex flex-wrap items-center gap-4">
          <IconButton aria-label="Play Reading">
            <Play className="size-5" />
          </IconButton>
          <IconButton aria-label="Share Reading">
            <Share2 className="size-5" />
          </IconButton>
          <IconButton aria-label="Open settings">
            <Settings className="size-5" />
          </IconButton>
        </div>
        <p className="mt-4 max-w-2xl text-sm text-text-muted">
          Circular, 44px minimum touch target even when the Lucide icon is
          smaller.
        </p>
      </section>

      {/* Section 6 — Serif specimen (D-13: Source Serif 4 vs Newsreader) */}
      <section className="mb-16">
        <h2 className="mb-6 text-xl font-semibold text-text">
          Serif voice specimen
        </h2>
        <p className="mb-6 max-w-2xl text-sm text-text-muted">
          The voice serif appears ONLY on the greeting/hero line and the verdict
          one-liner — the functional UI around it stays Inter (sans-led, DS-04).
          Pick the final voice serif below.
        </p>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <Surface className="bg-[#1a1714] p-6">
            <div className="mb-4 text-sm font-medium text-text-muted">
              Source Serif 4 (current --font-serif)
            </div>
            <p
              className="font-serif text-text"
              style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.2 }}
            >
              Welcome back — let’s read your latest.
            </p>
            <p
              className="mt-4 font-serif text-text"
              style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.2 }}
            >
              This one’s mixed — strong hook, soft payoff.
            </p>
          </Surface>

          <Surface className="bg-[#1a1714] p-6">
            <div className="mb-4 text-sm font-medium text-text-muted">
              Newsreader (alt)
            </div>
            <p
              className="text-text"
              style={{
                fontFamily: "var(--font-serif-alt)",
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              Welcome back — let’s read your latest.
            </p>
            <p
              className="mt-4 text-text"
              style={{
                fontFamily: "var(--font-serif-alt)",
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              This one’s mixed — strong hook, soft payoff.
            </p>
          </Surface>
        </div>
      </section>

      {/* Section 7 — Stage-reveal demo (DS-07: calm reveal + reduced-motion) */}
      <section className="mb-16">
        <h2 className="mb-6 text-xl font-semibold text-text">Stage reveal</h2>
        <p className="mb-6 max-w-2xl text-sm text-text-muted">
          The one key motion moment — a calm opacity tween + high-damping spring
          (no bounce). Enable OS reduced-motion and the reveal degrades to a
          static appear.
        </p>
        <KitStageDemo />
      </section>

      {/* Section 8 — Keyframe as chroma (DS-08): keyframe adjacent to neutral chrome */}
      <section className="mb-16" data-testid="ds08-keyframe-chroma">
        <h2 className="mb-6 text-xl font-semibold text-text">
          Keyframe carries the chroma
        </h2>
        <p className="mb-6 max-w-2xl text-sm text-text-muted">
          The warm-neutral chrome recedes deliberately so the user’s video
          keyframe carries the color and energy (DS-08).
        </p>
        <div className="flex flex-wrap items-stretch gap-6">
          {/* The keyframe still — the (cool) image carrying the chroma */}
          <img
            src={SAMPLE_KEYFRAME}
            alt="Sample video keyframe"
            width={180}
            className="h-80 w-44 rounded-[12px] border border-border object-cover"
          />
          {/* Near-neutral chrome container, DIRECTLY ADJACENT — it visibly recedes */}
          <div className="flex flex-1 flex-col gap-3 rounded-[12px] border border-border bg-panel p-6">
            <div className="text-base font-semibold text-text">
              Reading chrome
            </div>
            <p className="text-sm text-text-muted">
              Near-neutral panel — `bg-panel` + `border-border`. It steps back so
              the keyframe beside it reads as the only chroma in the frame.
            </p>
            <div className="mt-auto flex items-center gap-3">
              <VerdictSwatch verdict="mixed" size="md" />
              <span className="text-sm font-medium text-text-muted">
                Mixed signals
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Empty-state voice baseline */}
      <section className="mb-4">
        <Surface className="p-8 text-center">
          <h3 className="text-base font-semibold text-text">Nothing here yet</h3>
          <p className="mt-2 text-sm text-text-muted">
            This is a kit showcase — components render below under the Numen
            surface tokens.
          </p>
        </Surface>
      </section>
    </div>
  );
}
