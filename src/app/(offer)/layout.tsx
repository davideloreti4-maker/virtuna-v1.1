import "./offer.css";

/**
 * (offer) route group — the cold-traffic conversion funnel, served (eventually)
 * at maven.numenmachines.com. Deliberately separate from (marketing): no app
 * nav, no considered-visitor chrome. Inherits the root document shell (Inter +
 * Newsreader, theme). Kept a bare pass-through so each offer page owns its
 * full-bleed surface.
 */
export default function OfferLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
