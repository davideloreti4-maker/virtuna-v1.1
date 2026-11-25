"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The content width of a padded box (its width less its side padding), followed as it resizes;
 * `fallback` until it is measured. The line on the result page is drawn to this width, so it
 * follows the card at 360, 393 and 430 wide and on desktop.
 */
export function useContentWidth<T extends HTMLElement>(fallback: number): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      const inner = el.clientWidth - parseFloat(style.paddingLeft || "0") - parseFloat(style.paddingRight || "0");
      if (inner > 0) setWidth(Math.floor(inner));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
