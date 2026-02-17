"use client";

/**
 * LiquidGlassFilters - SVG filter definitions for iOS 26-style liquid glass effects.
 *
 * Provides three intensity levels of refraction/displacement:
 * - liquid-glass-sm: Subtle refraction for small elements (buttons, pills)
 * - liquid-glass-md: Medium refraction for cards and panels
 * - liquid-glass-lg: Strong refraction for hero elements
 *
 * Also includes specular highlight filters for rim lighting effects.
 *
 * @usage
 * 1. Include <LiquidGlassFilters /> once in your layout (usually in RootLayout)
 * 2. Apply filter: url(#liquid-glass-md) to elements
 *
 * @example
 * // In layout.tsx
 * <body>
 *   <LiquidGlassFilters />
 *   {children}
 * </body>
 *
 * // In component
 * <div style={{ filter: 'url(#liquid-glass-md)' }}>
 *   Liquid glass content
 * </div>
 */
export function LiquidGlassFilters() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute", pointerEvents: "none" }}
      aria-hidden="true"
    >
      <defs>
        {/* ============================================
            LIQUID GLASS FILTERS
            Subtle displacement for organic glass feel
            ============================================ */}

        {/* Small - for buttons, pills, badges */}
        <filter id="liquid-glass-sm" x="-10%" y="-10%" width="120%" height="120%">
          {/* Turbulence creates organic noise pattern */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015"
            numOctaves="3"
            seed="1"
            result="noise"
          />
          {/* Displacement map distorts based on noise */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="2"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced"
          />
          {/* Slight blur for softness */}
          <feGaussianBlur in="displaced" stdDeviation="0.3" result="blurred" />
          {/* Composite back to original for subtle effect */}
          <feBlend in="blurred" in2="SourceGraphic" mode="normal" />
        </filter>

        {/* Medium - for cards, panels, modals */}
        <filter id="liquid-glass-md" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.01"
            numOctaves="4"
            seed="2"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="4"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced"
          />
          <feGaussianBlur in="displaced" stdDeviation="0.5" result="blurred" />
          <feBlend in="blurred" in2="SourceGraphic" mode="normal" />
        </filter>

        {/* Large - for hero elements, backgrounds */}
        <filter id="liquid-glass-lg" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008"
            numOctaves="5"
            seed="3"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="8"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced"
          />
          <feGaussianBlur in="displaced" stdDeviation="0.8" result="blurred" />
          <feBlend in="blurred" in2="SourceGraphic" mode="normal" />
        </filter>

        {/* ============================================
            SPECULAR HIGHLIGHT FILTERS
            Rim lighting and surface highlights
            ============================================ */}

        {/* Specular - top-left light source */}
        <filter id="specular-highlight" x="-20%" y="-20%" width="140%" height="140%">
          {/* Create lighting effect */}
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
          <feSpecularLighting
            in="blur"
            surfaceScale="5"
            specularConstant="0.75"
            specularExponent="20"
            lightingColor="white"
            result="specular"
          >
            <fePointLight x="-100" y="-100" z="200" />
          </feSpecularLighting>
          <feComposite
            in="specular"
            in2="SourceAlpha"
            operator="in"
            result="specularComposite"
          />
          {/* Blend with original */}
          <feComposite
            in="SourceGraphic"
            in2="specularComposite"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="1"
            k4="0"
          />
        </filter>

        {/* Rim light - edge highlight */}
        <filter id="rim-light" x="-10%" y="-10%" width="120%" height="120%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="dilated" />
          <feGaussianBlur in="dilated" stdDeviation="2" result="blurred" />
          <feComposite in="blurred" in2="SourceAlpha" operator="out" result="rim" />
          <feColorMatrix
            in="rim"
            type="matrix"
            values="1 0 0 0 1
                    0 1 0 0 1
                    0 0 1 0 1
                    0 0 0 0.3 0"
            result="coloredRim"
          />
          <feComposite in="SourceGraphic" in2="coloredRim" operator="over" />
        </filter>

        {/* ============================================
            COMBINED EFFECTS
            Liquid glass + specular for premium look
            ============================================ */}

        {/* Premium liquid glass with rim highlight */}
        <filter id="liquid-glass-premium" x="-15%" y="-15%" width="130%" height="130%">
          {/* Liquid distortion */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012"
            numOctaves="4"
            seed="5"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="3"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced"
          />
          {/* Specular highlight */}
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
          <feSpecularLighting
            in="blur"
            surfaceScale="3"
            specularConstant="0.6"
            specularExponent="25"
            lightingColor="white"
            result="specular"
          >
            <fePointLight x="-50" y="-50" z="150" />
          </feSpecularLighting>
          <feComposite
            in="specular"
            in2="SourceAlpha"
            operator="in"
            result="specularComposite"
          />
          {/* Combine */}
          <feComposite
            in="displaced"
            in2="specularComposite"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="0.15"
            k4="0"
          />
        </filter>

        {/* ============================================
            GLOW FILTERS
            Colored glow effects
            ============================================ */}

        <filter id="glow-coral" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1.2 0 0 0 0.3
                    0 0.5 0 0 0.1
                    0 0 0.3 0 0.05
                    0 0 0 0.8 0"
            result="coloredBlur"
          />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="glow-purple" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0.8 0 0 0 0.2
                    0 0.3 0 0 0.1
                    0 0 1.2 0 0.3
                    0 0 0 0.8 0"
            result="coloredBlur"
          />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

export type LiquidGlassFilter =
  | "liquid-glass-sm"
  | "liquid-glass-md"
  | "liquid-glass-lg"
  | "liquid-glass-premium"
  | "specular-highlight"
  | "rim-light"
  | "glow-coral"
  | "glow-purple";

/**
 * Helper to get CSS filter string
 */
export function getLiquidGlassFilter(filter: LiquidGlassFilter): string {
  return `url(#${filter})`;
}
