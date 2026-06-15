"use client";

// TEMPORARY STUB — 02-02 REPLACES (not appends to) this with the real canvas-2D
// signature "crowd → score" moment. It exists ONLY so the `ssr:false` dynamic
// import in signature-moment-client.tsx resolves at build time AND so the vitest
// collector can statically resolve the lazy `import("./signature-canvas")` (the
// 02-00 hero suites otherwise fail to COLLECT with "Failed to resolve import").
//
// Until 02-02 lands, the boundary only ever renders this on the desktop +
// motion-OK path; it re-renders the resolved still so the visual stays correct
// (the still IS the at-rest/fallback frame, D-15). Default export, as the
// dynamic() factory expects.

import { ComposedStill } from "./composed-still";

export interface SignatureCanvasProps {
  score?: number;
}

export default function SignatureCanvas({ score }: SignatureCanvasProps) {
  return <ComposedStill score={score} />;
}
