/**
 * Design Tokens - Extracted from societies.io
 *
 * These values are reverse-engineered from the societies.io website
 * to ensure pixel-perfect visual fidelity.
 *
 * Last updated: 2026-01-27
 */

// ===========================================
// COLORS
// ===========================================

export const colors = {
  // Background colors
  bg: {
    primary: "#0d0d0d", // Main page background
    secondary: "#141414", // Alt sections
    card: "#1a1a1a", // Card backgrounds
  },

  // Text colors
  text: {
    primary: "#ffffff", // Main text
    muted: "#f5f5f5", // Slightly dimmed text
    dim: "#9CA3AF", // Gray text (descriptions, footnotes)
  },

  // Accent colors
  accent: {
    primary: "#E57850", // CTA buttons, highlights
    primaryHover: "#d46a45", // CTA hover state
  },

  // Border colors
  border: {
    default: "#262626",
    light: "#333333",
  },
} as const

// ===========================================
// TYPOGRAPHY
// ===========================================

export const typography = {
  fonts: {
    display: "'Funnel Display', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
    body: "Satoshi, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  },

  // Font weights (Satoshi Variable supports 100-900)
  weights: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // Font sizes (rem)
  sizes: {
    xs: "0.75rem", // 12px
    sm: "0.875rem", // 14px
    base: "1rem", // 16px
    lg: "1.125rem", // 18px
    xl: "1.25rem", // 20px
    "2xl": "1.5rem", // 24px
    "3xl": "1.875rem", // 30px
    "4xl": "2.25rem", // 36px
    "5xl": "3rem", // 48px
    "6xl": "3.75rem", // 60px
    "7xl": "4.5rem", // 72px
  },

  // Line heights
  lineHeights: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
} as const

// ===========================================
// SPACING
// ===========================================

export const spacing = {
  // Container max-width
  container: {
    maxWidth: "1280px", // 80rem
    padding: {
      mobile: "1rem", // 16px
      tablet: "1.5rem", // 24px
      desktop: "2rem", // 32px
    },
  },

  // Section padding
  section: {
    paddingY: {
      mobile: "3rem", // 48px
      tablet: "4rem", // 64px
      desktop: "6rem", // 96px
    },
  },

  // Header dimensions
  header: {
    height: "60px",
    heightScrolled: "60px",
  },
} as const

// ===========================================
// BREAKPOINTS
// ===========================================

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const

// ===========================================
// ANIMATION / EASING
// ===========================================

export const animation = {
  // Easing curves from societies.io CSS
  easing: {
    outQuad: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    outCubic: "cubic-bezier(0.215, 0.61, 0.355, 1)",
    outQuart: "cubic-bezier(0.165, 0.84, 0.44, 1)",
    outQuint: "cubic-bezier(0.23, 1, 0.32, 1)",
    outExpo: "cubic-bezier(0.19, 1, 0.22, 1)",
    outCirc: "cubic-bezier(0.075, 0.82, 0.165, 1)",
    inOutQuad: "cubic-bezier(0.455, 0.03, 0.515, 0.955)",
    inOutCubic: "cubic-bezier(0.645, 0.045, 0.355, 1)",
    inOutQuart: "cubic-bezier(0.77, 0, 0.175, 1)",
    inOutQuint: "cubic-bezier(0.86, 0, 0.07, 1)",
    inOutExpo: "cubic-bezier(1, 0, 0, 1)",
    inOutCirc: "cubic-bezier(0.785, 0.135, 0.15, 0.86)",
  },

  // Duration values
  duration: {
    fast: "150ms",
    normal: "250ms",
    slow: "350ms",
    slower: "500ms",
  },

  // Header hide/show transition
  header: {
    duration: 0.35,
    ease: "easeInOut",
  },

  // Scroll reveal defaults
  scrollReveal: {
    duration: 0.6,
    ease: [0.22, 1, 0.36, 1], // ease-out-expo
    yOffset: 40,
    viewportAmount: 0.3,
  },
} as const

// ===========================================
// SHADOWS
// ===========================================

export const shadows = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
} as const

// ===========================================
// Z-INDEX SCALE
// ===========================================

export const zIndex = {
  backdrop: 40,
  mobileMenu: 50,
  header: 50,
  modal: 60,
  tooltip: 70,
} as const
