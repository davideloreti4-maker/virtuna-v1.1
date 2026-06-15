"use client";

import { scan } from "react-scan";

// React-Scan injects a full-document overlay canvas as a direct child of <html>
// (outside <body>), which makes the document itself scrollable on top of the app's
// own `main` scroll container — a confusing double-scroll — and blocks screenshot
// capture. It's a render-perf debug tool, not part of the product, so it's OPT-IN:
// set NEXT_PUBLIC_REACT_SCAN=1 to re-enable. Off by default for a clean single-scroll UX.
if (
  typeof window !== "undefined" &&
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_REACT_SCAN === "1"
) {
  scan({ enabled: true, showToolbar: true });
}

export function DevLocator() {
  return null;
}
