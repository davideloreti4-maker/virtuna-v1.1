"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PlusIcon } from "./icons";
import { PLACES, activePlace, type Place } from "./nav-config";

/**
 * The phone tab bar (new look, spec §6.1): a floating glass pill with five slots — Home,
 * Discover, the new-chat button, Library, Audience. Shown below 768px; the frame mounts it on
 * the four places only and never inside a thread.
 *
 * Inline style on purpose: Lightning CSS strips `backdrop-filter` from classes, and the bottom
 * offset needs `env()`. Under prefers-reduced-transparency the app-wide rule removes the blur;
 * the 0.78 fill keeps the bar legible.
 */
const FLOATING: React.CSSProperties = {
  WebkitBackdropFilter: "blur(24px) saturate(1.6)",
  backdropFilter: "blur(24px) saturate(1.6)",
  bottom: "max(12px, calc(env(safe-area-inset-bottom) - 10px))",
};

function Tab({ place, active }: { place: Place; active: boolean }) {
  const Glyph = place.icon;
  return (
    <Link
      href={place.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // The tab's whole box is its touch target, not only the icon, on every width: 66 by 64
        // at 350px and wider; below that `min-w-0` lets it shrink instead of overflowing the
        // pill. The box stays SQUARE: rounded-off corners would take no taps. `relative z-[1]`
        // keeps it above the round button's extended touch target, so where the two meet on a
        // narrow screen the tab wins.
        "relative z-[1] flex h-16 w-[66px] min-w-0 flex-col items-center justify-center gap-[3px]",
        "text-micro font-[560] transition-colors duration-150",
        // The keyboard ring is drawn on an `::after` box 4px inside the tab, rounded, so it stays
        // inside the pill; the link's own outline is switched off. The `!` is needed: the app-wide
        // focus rule is unlayered CSS and beats a plain utility.
        "focus-visible:outline-none!",
        "after:pointer-events-none after:absolute after:inset-1 after:rounded-2xl after:content-['']",
        "focus-visible:after:outline-2 focus-visible:after:outline-[color:var(--focus-ring)]",
        // No pill, no dot, no fill change: the current tab darkens its label only.
        active ? "text-foreground" : "text-foreground-secondary",
      )}
    >
      {/* The icon stays secondary on every tab, the current one included (as in the reference). */}
      <Glyph size={23} aria-hidden className="text-foreground-secondary" />
      {/* A 21px line: icon 23 + gap 3 + line 21 = 47, centred in the 64px bar. */}
      <span className="leading-[21px]">{place.label}</span>
    </Link>
  );
}

export function TabBar({ onNewChat }: { onNewChat: () => void }) {
  const current = activePlace(usePathname());

  return (
    <>
      <div
        aria-hidden
        className="tabbar-fade pointer-events-none fixed inset-x-0 bottom-0 z-[calc(var(--z-sidebar)-1)] h-[120px] bg-background md:hidden"
      />
      <nav
        aria-label="Places"
        style={FLOATING}
        className="fixed inset-x-3 z-[var(--z-sidebar)] flex h-16 items-center justify-around rounded-4xl bg-glass px-1.5 shadow-[var(--shadow-float)] md:hidden"
      >
        {PLACES.slice(0, 2).map((place) => (
          <Tab key={place.id} place={place} active={current === place.id} />
        ))}
        {/* The round button is drawn at 50; its `::before` extends the touch target to a 64px
            circle (50 + 2 × 7). The tabs sit above that extension, so where the two meet on a
            narrow screen the tab wins (a labelled tab never loses a tap to an invisible area).
            The visible 50px circle is always tappable. */}
        <button
          type="button"
          onClick={onNewChat}
          aria-label="New chat"
          className="relative flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-action text-action-foreground shadow-[var(--shadow-button)] transition-transform duration-150 active:scale-[0.98] before:absolute before:-inset-[7px] before:rounded-full before:content-['']"
        >
          <PlusIcon size={22} aria-hidden />
        </button>
        {PLACES.slice(2).map((place) => (
          <Tab key={place.id} place={place} active={current === place.id} />
        ))}
      </nav>
    </>
  );
}
