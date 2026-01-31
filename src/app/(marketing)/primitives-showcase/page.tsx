import { GlassPanel, GradientGlow, TrafficLights } from "@/components/primitives";

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

      {/* Section 2: GradientGlow Colors */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold text-text-primary mb-6">
          GradientGlow Colors
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          {(["purple", "blue", "pink", "cyan", "green", "orange"] as const).map((color) => (
            <div key={color} className="relative h-32 rounded-xl overflow-hidden bg-surface">
              <GradientGlow color={color} intensity="strong" size={120} position="center" blur={40} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-text-primary font-medium capitalize">{color}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: GradientGlow Intensities */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold text-text-primary mb-6">
          GradientGlow Intensities
        </h2>
        <div className="flex gap-8">
          {(["subtle", "medium", "strong"] as const).map((intensity) => (
            <div key={intensity} className="relative h-32 w-48 rounded-xl overflow-hidden bg-surface">
              <GradientGlow color="purple" intensity={intensity} size={150} position="center" blur={50} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-text-primary font-medium capitalize">{intensity}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: GlassPanel Variants */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold text-text-primary mb-6">
          GlassPanel Variants
        </h2>
        <div className="relative">
          {/* Background glow for glass effect visibility */}
          <GradientGlow color="blue" intensity="medium" size={600} position="center" blur={120} />

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
            <GlassPanel blur="sm" className="p-6">
              <h3 className="text-text-primary font-semibold mb-2">Blur: Small</h3>
              <p className="text-text-secondary text-sm">8px blur, 60% opacity</p>
            </GlassPanel>

            <GlassPanel blur="md" className="p-6">
              <h3 className="text-text-primary font-semibold mb-2">Blur: Medium</h3>
              <p className="text-text-secondary text-sm">12px blur, 60% opacity</p>
            </GlassPanel>

            <GlassPanel blur="lg" borderGlow className="p-6">
              <h3 className="text-text-primary font-semibold mb-2">Blur: Large + Glow</h3>
              <p className="text-text-secondary text-sm">20px blur with border glow</p>
            </GlassPanel>
          </div>
        </div>
      </section>

      {/* Section 5: Composed Example - macOS Window */}
      <section className="mb-16">
        <h2 className="text-2xl font-semibold text-text-primary mb-6">
          Composed: macOS Window Mockup
        </h2>
        <div className="relative max-w-2xl">
          <GradientGlow color="purple" intensity="medium" size={400} position="top-left" blur={100} />
          <GradientGlow color="cyan" intensity="subtle" size={300} position="bottom-right" blur={80} />

          <GlassPanel blur="md" className="relative overflow-hidden">
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
                This demonstrates all three primitives composed together:
                GlassPanel for the frosted container, GradientGlow for ambient
                lighting, and TrafficLights for macOS window chrome.
              </p>
            </div>
          </GlassPanel>
        </div>
      </section>

      {/* Section 6: Elevation Shadows */}
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
