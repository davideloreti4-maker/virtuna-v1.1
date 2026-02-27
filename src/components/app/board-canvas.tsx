"use client";

import { useCallback, useRef } from "react";

/**
 * BoardCanvas — Infinite pannable canvas with dotted grid background.
 * Foundation for future board features (draggable cards, content nodes).
 *
 * Uses ref-based DOM updates for zero re-renders during drag.
 */
export function BoardCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const updateBackground = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.backgroundPosition = `${offsetRef.current.x}px ${offsetRef.current.y}px`;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragStartRef.current = {
        x: e.clientX - offsetRef.current.x,
        y: e.clientY - offsetRef.current.y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.style.cursor = "grabbing";
    },
    []
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStartRef.current) return;
      offsetRef.current = {
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      };
      updateBackground();
    },
    [updateBackground]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragStartRef.current = null;
      e.currentTarget.style.cursor = "grab";
    },
    []
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 select-none"
      style={{
        cursor: "grab",
        overflow: "hidden",
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        backgroundPosition: "0px 0px",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}
