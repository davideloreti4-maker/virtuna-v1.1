import { GlassPanel, TrafficLights } from "@/components/primitives";

export const metadata = {
  title: "Primitives Showcase | Virtuna",
  description: "Visual showcase of glassmorphism design primitives",
};

export default function PrimitivesShowcasePage() {
  return (
    <div className="min-h-screen bg-bg-base p-8 md:p-16">
      <h1 className="text-4xl font-bold text-text-primary mb-12">
        Primitives Showcase
      </h1>

      {/* Section 1: TrafficLights */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold text-text-primary mb-6">
          TrafficLights
        </h2>
        <div className="flex items-center gap-12">
          <div className="flex flex-col items-center gap-2">
            <TrafficLights size="sm" />
            <span className="text-text-secondary text-sm">Small (10px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <TrafficLights size="md" />
            <span className="text-text-secondary text-sm">Medium (12px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <TrafficLights size="lg" />
            <span className="text-text-secondary text-sm">Large (14px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <TrafficLights disabled />
            <span className="text-text-secondary text-sm">Disabled</span>
          </div>
        </div>
      </section>

      {/* Section 2: GlassPanel */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold text-text-primary mb-6">
          GlassPanel
        </h2>
        <p className="text-text-secondary text-sm mb-6">
          Zero-config Raycast-style frosted glass. Fixed 5px blur, 12px radius, neutral gradient.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <GlassPanel className="p-6">
            <h3 className="text-text-primary font-semibold mb-2">Default</h3>
            <p className="text-text-secondary text-sm">
              No props needed -- Raycast glass out of the box.
            </p>
          </GlassPanel>

          <GlassPanel className="p-6" as="section">
            <h3 className="text-text-primary font-semibold mb-2">As Section</h3>
            <p className="text-text-secondary text-sm">
              Renders as &lt;section&gt; for semantic HTML.
            </p>
          </GlassPanel>
        </div>
      </section>

      {/* Section 3: Composed Example - macOS Window */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold text-text-primary mb-6">
          Composed: macOS Window Mockup
        </h2>
        <div className="max-w-2xl">
          <GlassPanel className="overflow-hidden">
            {/* Window Chrome */}
            <div className="flex items-center gap-4 p-4 border-b border-white/10">
              <TrafficLights size="md" />
              <span className="text-text-secondary text-sm flex-1 text-center">
                Virtuna Dashboard
              </span>
              <div className="w-12" /> {/* Spacer for symmetry */}
            </div>

            {/* Window Content */}
            <div className="p-8">
              <h3 className="text-text-primary text-xl font-semibold mb-4">
                Premium Glass Effect
              </h3>
              <p className="text-text-secondary">
                This demonstrates GlassPanel and TrafficLights composed
                together: GlassPanel for the frosted container and
                TrafficLights for macOS window chrome.
              </p>
            </div>
          </GlassPanel>
        </div>
      </section>

      {/* Section 4: Elevation Shadows */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold text-text-primary mb-6">
          Elevation Shadows
        </h2>
        <div className="flex flex-wrap gap-8">
          {(["shadow-sm", "shadow-md", "shadow-lg", "shadow-elevated", "shadow-float"] as const).map((shadow) => (
            <div
              key={shadow}
              className={`bg-surface rounded-xl p-6 ${shadow}`}
            >
              <span className="text-text-primary text-sm">{shadow}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
