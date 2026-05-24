/**
 * (marketing) route group layout — slim fragment.
 *
 * Intentionally does NOT render a Header or Footer here. Each page in this group
 * manages its own navigation (e.g., /v3 renders LandingHeader directly via page.tsx).
 * Root layout (src/app/layout.tsx) owns <html>, <body>, font, and globals.css.
 *
 * Plan 01 decision: removed the shared <Header> import and duplicate html/body tags.
 * The old "Artificial Societies" Header (src/components/layout/header.tsx) is no longer
 * inserted at the route-group level — each route in this group renders its own nav if needed.
 */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
