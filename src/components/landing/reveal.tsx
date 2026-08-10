"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Reveal — scroll-triggered entrance for a section.
 *
 * THE ORDER MATTERS AND IT IS THE WHOLE POINT. The server renders the child
 * with no hiding class at all, so the page is fully readable in the raw HTML.
 * Only after mount does the effect ARM the element (`data-reveal="armed"`,
 * which is what `opacity: 0` is keyed off) and hand it to an
 * IntersectionObserver. So the failure modes all land on "visible":
 *
 *   · JS never runs            → never armed → visible
 *   · IntersectionObserver missing → armed then immediately released → visible
 *   · prefers-reduced-motion   → the CSS media query overrides both states
 *
 * The naive version — ship `opacity: 0`, animate in on intersect — is a blank
 * page for every one of those, on a route that is paid for by the click.
 *
 * Arming happens in a layout-effect-like position (a mount effect before paint
 * is not guaranteed, so anything already on screen is released on the observer's
 * first synchronous callback, which fires immediately for intersecting targets).
 */

interface RevealProps {
  children: React.ReactNode;
  /** Stagger, in ms, applied as a transition-delay once visible. */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}

export function Reveal({ children, delay = 0, className, as = "div" }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<"idle" | "armed" | "in">("idle");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // No observer support — leave the element exactly as the server drew it.
    if (typeof IntersectionObserver === "undefined") return;

    setState("armed");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setState("in");
            observer.disconnect();
          }
        }
      },
      // Fire slightly before the element reaches the viewport so the motion has
      // finished by the time it is properly in view — an entrance the reader
      // watches complete is an entrance that slowed them down.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Tag = as as "div";

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      className={cn("lp-reveal", className)}
      data-reveal={state === "idle" ? undefined : state}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
