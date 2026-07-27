"use client";

/**
 * The top bar — a real navigation, not a floating pill with a burger.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────────────────────
 * `FloatingNav` (which `/go` still uses, untouched) is a centred detached pill carrying the
 * wordmark and a hamburger — at EVERY width, including 1440. Hiding three links behind a
 * burger on a desktop marketing page is a mobile pattern applied where it does not belong,
 * and side by side with the references it is the single loudest "this page is unfinished"
 * signal on the surface:
 *
 *   Linear  logo · Product · Resources · Customers · Pricing · Now · Contact │ Log in · [Sign up]
 *   Attio   logo · Platform · Resources · Customers · Pricing │ Sign in · [Start for free]
 *   /go     [ ☰ Maven ]
 *
 * Both references run a full-width bar, inline links, a text sign-in and ONE filled CTA on the
 * right. That shape is doing real work: it says the product has a surface area worth
 * navigating, and it puts a second, low-commitment entry point on screen at all times.
 *
 * ── WHAT IS DELIBERATELY NOT COPIED ───────────────────────────────────────────────────────
 * Attio's two-CTA fold. A second competing button splits the click on a 90-second self-serve
 * product (rejected concept #9). The nav's CTA is the SAME free entry as the fold's — one ask,
 * two placements — not a second offer.
 *
 * Links are in-page anchors, because that is what this page honestly has. Inventing a
 * /customers or /resources route to match the reference's link count would be six dead links
 * on the page whose entire argument is credibility.
 */

import { useEffect, useRef, useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { MavenLogo } from "@/components/brand/maven-logo";
import { useFreeEntry } from "@/components/offer/free-entry-cta";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "The read", href: "#the-read" },
  { label: "The room", href: "#the-room" },
  { label: "The brain", href: "#the-brain" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { linkProps, label } = useFreeEntry();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-colors duration-300"
      style={{
        // Transparent over the fold, solidifying on scroll — Linear's behaviour. The border
        // only appears once there is content behind it to separate from.
        background: scrolled ? "rgba(13,13,12,0.82)" : "transparent",
        borderBottom: `1px solid ${scrolled ? "var(--mk-hairline)" : "transparent"}`,
        // Inline, because Lightning CSS strips the class form (CLAUDE.md).
        backdropFilter: scrolled ? "blur(12px)" : undefined,
      }}
    >
      <nav className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-8 px-5 md:px-8">
        <a href="#top" className="flex shrink-0 items-center" aria-label="Maven — home">
          <MavenLogo size={22} wordmark="maven" />
        </a>

        {/* Inline from md up. This is the half that was missing. */}
        <ul className="hidden flex-1 items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-[14px] text-[#8a857c] transition-colors hover:text-[#ece7de]"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {/* The low-commitment entry. Text, never a second filled button — see the header. */}
          <a
            {...linkProps}
            className="hidden rounded-lg px-3 py-2 text-[14px] text-[#c2bdb4] transition-colors hover:text-[#ece7de] sm:block"
          >
            Log in
          </a>
          <a
            {...linkProps}
            className="rounded-lg bg-[#FF6363] px-4 py-2 text-[14px] font-semibold text-[#2a1212] transition-colors hover:bg-[#ff7d7d]"
          >
            {label}
          </a>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="ml-1 grid h-9 w-9 place-items-center rounded-lg text-[#c2bdb4] md:hidden"
            style={{ border: "1px solid var(--mk-hairline)" }}
          >
            {open ? <X size={17} /> : <List size={17} />}
          </button>
        </div>
      </nav>

      {/* Burger panel — phones only, which is the only place a burger belongs. */}
      {open && (
        <div
          ref={panelRef}
          className="md:hidden"
          style={{ background: "rgba(13,13,12,0.96)", borderTop: "1px solid var(--mk-hairline)" }}
        >
          <ul className="mx-auto flex max-w-[1400px] flex-col px-5 py-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-[15px] text-[#c2bdb4]"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}

/**
 * The announcement slot — Linear runs "New · Coding Sessions →", Attio runs a top bar AND a
 * pill. Both are a freshness signal: the product is being worked on.
 *
 * ⚠️ DELIBERATELY EMPTY. There is no true announcement yet — that is an open owner decision
 * (handoff §12.4), and inventing "New · Simulate 2.0" to fill the shape would be exactly the
 * fabrication the placeholder policy forbids, in the most prominent position on the page.
 *
 * It renders nothing until `ANNOUNCEMENT` is filled in, so the structure is here without a
 * dashed box sitting in the fold being judged for its looks. Fill it with something true and
 * it appears above the headline.
 */
const ANNOUNCEMENT: { label: string; href: string } | null = null;

export function AnnouncementPill() {
  if (!ANNOUNCEMENT) return null;
  return (
    <div className="mb-7 flex justify-center">
      <a
        href={ANNOUNCEMENT.href}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] text-[#c2bdb4]",
          "transition-colors hover:text-[#ece7de]",
        )}
        style={{ border: "1px solid var(--mk-hairline-strong)", background: "var(--mk-s1)" }}
      >
        <span className="mk-brandmark-pulse h-1.5 w-1.5 rounded-full" style={{ background: "#FF6363" }} />
        {ANNOUNCEMENT.label}
        <span aria-hidden>→</span>
      </a>
    </div>
  );
}
