import { Inter, JetBrains_Mono, Newsreader, Schibsted_Grotesk } from "next/font/google";
import "./landing.css";

/**
 * (landing) route group — the cold-traffic trial funnel.
 *
 * Deliberately isolated from BOTH existing marketing surfaces: `(marketing)` is
 * the considered-visitor site and `(offer)` is the older /go funnel. This group
 * shares no components with either, so a change made for paid social can never
 * regress a page someone arrived at from a Google search.
 *
 * FONTS. The root layout loads Inter + Newsreader for the app; this group loads
 * its own display and mono faces on top. next/font emits CSS custom properties,
 * and custom properties inherit, so scoping them to a wrapper `<div>` here keeps
 * Schibsted Grotesk and JetBrains Mono entirely off every app route — they cost
 * nothing to a user who never sees this page. Inter and Newsreader are declared
 * again with the SAME variable names the root layout uses: next/font dedupes to
 * one file per family, and it makes this group renderable on its own.
 */

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/** Display face — editorial grotesque. Confident at 76px, and not Inter. */
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-schibsted",
  weight: ["400", "500", "600", "700"],
});

/** Data face — figures, eyebrows, slot labels. The instrument's own voice. */
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
  weight: ["400", "500"],
});

/** The scarce serif — four emphasis phrases on the entire page. */
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
  style: ["italic"],
  weight: ["400"],
});

export default function LandingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={`lp ${inter.variable} ${schibsted.variable} ${jetbrains.variable} ${newsreader.variable}`}
    >
      {/*
        Scroll-reveal safety net. `.lp-reveal` only hides itself once the client
        observer has armed it, so a JS failure already leaves the page readable —
        this covers the narrower case where the arming class lands but the
        observer never fires (an old browser without IntersectionObserver).
        Four lines to rule out "the ad landed and the page was blank".
      */}
      <noscript>
        <style>{`.lp-reveal{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      {children}
    </div>
  );
}
