"use client";

import { useCallback, useRef } from "react";

/**
 * DottedGrid — Pannable dotted grid background with optional children that move with it.
 * Shared across Analysis and Board views as a base layer.
 *
 * Uses ref-based DOM updates for zero re-renders during drag.
 */
export function DottedGrid({ children }: { children?: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const updatePosition = useCallback(() => {
    const { x, y } = offsetRef.current;
    const el = containerRef.current;
    if (el) el.style.backgroundPosition = `${x}px ${y}px`;
    const content = contentRef.current;
    if (content) content.style.transform = `translate(${x}px, ${y}px)`;
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
      updatePosition();
    },
    [updatePosition]
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
      className="absolute inset-0 select-none"
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
    >
      {children && (
        <div ref={contentRef} className="pointer-events-none h-full w-full">
          {children}
        </div>
      )}
    </div>
  );
}
