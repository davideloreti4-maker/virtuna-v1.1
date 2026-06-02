"use client";

// TEMPORARY DEBUG COMPONENT — forwards uncaught client errors + unhandled
// promise rejections to the dev-server terminal via /api/__debug/client-error.
// Remove after the Develop-click WSOD is root-caused (Phase 05 UAT).
import { useEffect } from "react";

function report(kind: string, payload: { message?: string; name?: string; stack?: string }) {
  try {
    void fetch("/api/__debug/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        kind,
        message: payload.message,
        name: payload.name,
        stack: payload.stack,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      }),
    });
  } catch {
    /* best-effort */
  }
}

export function DebugErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      report("window.onerror", {
        message: e.message,
        name: e.error?.name,
        stack: e.error?.stack ?? `${e.filename}:${e.lineno}:${e.colno}`,
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      report("unhandledrejection", {
        message: typeof r === "string" ? r : r?.message,
        name: r?.name,
        stack: r?.stack,
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
