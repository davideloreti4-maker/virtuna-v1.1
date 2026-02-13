"use client";

import { useRef, useEffect } from "react";
import { DEMO_NODES, DEMO_LINKS, type DemoNode } from "./hive-demo-data";

const CENTER_RECT = { width: 50, height: 66, borderRadius: 6 };

// Pre-compute bounds once (static data)
const BOUNDS = (() => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of DEMO_NODES) {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
  }
  return { minX, maxX, minY, maxY };
})();

// Pre-build node lookup
const NODE_MAP = new Map<string, DemoNode>();
for (const node of DEMO_NODES) {
  NODE_MAP.set(node.id, node);
}

/**
 * Lightweight canvas-based hive demo for the landing page.
 *
 * - 50 pre-computed nodes (no physics/layout at runtime)
 * - Progressive build animation (center -> tier-1 -> tier-2)
 * - Subtle idle float animation for organic feel
 * - Touch-passive (no scroll blocking)
 * - Performant on mid-range devices
 */
export function HiveDemoCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw(timestamp: number) {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (startTimeRef.current === 0) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Fit transform
      const padding = 40;
      const contentW = BOUNDS.maxX - BOUNDS.minX || 1;
      const contentH = BOUNDS.maxY - BOUNDS.minY || 1;
      const scale = Math.min((w - padding * 2) / contentW, (h - padding * 2) / contentH);
      const offsetX = w / 2 - ((BOUNDS.minX + BOUNDS.maxX) / 2) * scale;
      const offsetY = h / 2 - ((BOUNDS.minY + BOUNDS.maxY) / 2) * scale;

      // Animation timing
      const tierDelay = [0, 200, 500];
      const tierDuration = [300, 400, 500];

      function nodeAlpha(tier: number): number {
        const delay = tierDelay[tier] ?? 500;
        const dur = tierDuration[tier] ?? 500;
        return Math.max(0, Math.min(1, (elapsed - delay) / dur));
      }

      const floatTime = elapsed * 0.0005;

      function screenPos(node: DemoNode): { sx: number; sy: number } {
        const floatX = Math.sin(floatTime + node.x * 0.01) * 1.5;
        const floatY = Math.cos(floatTime + node.y * 0.01) * 1.5;
        return {
          sx: (node.x + floatX) * scale + offsetX,
          sy: (node.y + floatY) * scale + offsetY,
        };
      }

      // Draw links
      for (const link of DEMO_LINKS) {
        const source = NODE_MAP.get(link.sourceId);
        const target = NODE_MAP.get(link.targetId);
        if (!source || !target) continue;

        const alpha = Math.min(nodeAlpha(source.tier), nodeAlpha(target.tier));
        if (alpha <= 0) continue;

        const { sx: sx1, sy: sy1 } = screenPos(source);
        const { sx: sx2, sy: sy2 } = screenPos(target);

        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${link.opacity * alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw nodes
      for (const node of DEMO_NODES) {
        const alpha = nodeAlpha(node.tier);
        if (alpha <= 0) continue;

        const { sx, sy } = screenPos(node);

        if (node.tier === 0) {
          const rw = CENTER_RECT.width * scale * 0.5;
          const rh = CENTER_RECT.height * scale * 0.5;
          const r = CENTER_RECT.borderRadius * scale * 0.3;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.roundRect(sx - rw / 2, sy - rh / 2, rw, rh, r);
          ctx.fillStyle = node.color;
          ctx.fill();
          ctx.globalAlpha = 1;
        } else {
          const r = node.radius * scale * 0.08;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(r, 1.5), 0, Math.PI * 2);
          ctx.fillStyle = node.color;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      style={{ touchAction: "auto" }}
      aria-label="Interactive hive visualization demo showing AI society nodes"
      role="img"
    />
  );
}
