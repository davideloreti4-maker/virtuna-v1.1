"use client";

import { scan } from "react-scan";

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  scan({ enabled: true, showToolbar: true });
}

export function DevLocator() {
  return null;
}
