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
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/*
        Scroll-reveal safety net. Every reveal on this page (both the shared
        `blur-fade` and the offer's own `offer-reveal`) renders `opacity: 0` in
        the server HTML and depends on JS to animate in. That's fine when JS
        runs — and a blank page when it doesn't. On a route we're paying for
        traffic to, "the ad landed and the page was empty" is the one failure
        worth spending four lines to rule out.
      */}
      <noscript>
        <style>{`[data-slot="offer-reveal"],[data-slot="blur-fade"]{opacity:1!important;filter:none!important;transform:none!important;clip-path:none!important}`}</style>
      </noscript>
      {children}
    </div>
  );
}
