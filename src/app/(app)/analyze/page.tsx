import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalyzeClient } from "./analyze-client";

export const metadata: Metadata = {
  title: "Analyze | Virtuna",
  description: "Analyze your TikTok content with Virtuna's prediction engine.",
};

/**
 * /analyze — form page where users submit content for analysis.
 *
 * Server component shell for metadata. Auth gating inherited from
 * (app)/layout.tsx middleware — no per-page check needed.
 *
 * Suspense boundary required by Next.js 15 for hooks that call
 * useSearchParams inside client subtree.
 */
export default function AnalyzePage() {
  return (
    <Suspense fallback={null}>
      <AnalyzeClient />
    </Suspense>
  );
}
