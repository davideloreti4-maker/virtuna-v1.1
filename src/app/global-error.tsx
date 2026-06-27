"use client";

import { useEffect } from "react";

/**
 * Root-layout error boundary. Replaces the ENTIRE app (including the root
 * <html>/<body> and globals.css) when the root layout itself throws — so this
 * file must render its own document shell and cannot rely on Tailwind tokens
 * being applied. Flat-warm charcoal is therefore inlined here (the one place
 * hardcoded hex is correct): bg #1f1f1e, cream #ece7de, error red.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 16px",
          background: "#1f1f1e",
          color: "#ece7de",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div
            style={{
              margin: "0 auto 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 64,
              width: 64,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(217,87,87,0.12)",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 256 256"
              fill="#e06666"
              aria-hidden="true"
            >
              <path d="M236.8 188.09 149.35 36.22a24.76 24.76 0 0 0-42.7 0L19.2 188.09a23.51 23.51 0 0 0 0 23.72A24.35 24.35 0 0 0 40.55 224h174.9a24.35 24.35 0 0 0 21.33-12.19 23.51 23.51 0 0 0 .02-23.72ZM120 104a8 8 0 0 1 16 0v40a8 8 0 0 1-16 0Zm8 88a12 12 0 1 1 12-12 12 12 0 0 1-12 12Z" />
            </svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p
            style={{
              marginTop: 12,
              fontSize: 14,
              lineHeight: 1.6,
              color: "#b8b1a6",
            }}
          >
            An unexpected error occurred. Our team has been notified.
            {error.digest && (
              <span
                style={{
                  marginTop: 4,
                  display: "block",
                  fontSize: 12,
                  color: "#8a8478",
                }}
              >
                Error ID: {error.digest}
              </span>
            )}
          </p>
          <div
            style={{
              marginTop: 32,
              display: "flex",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <button
              onClick={reset}
              style={{
                cursor: "pointer",
                borderRadius: 6,
                border: "none",
                background: "#ece7de",
                color: "#1c1b19",
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Try again
            </button>
            {/* Hard nav (not next/link): global-error replaces the root layout, so a
                full document reload is the only reliable recovery. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#b8b1a6",
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
