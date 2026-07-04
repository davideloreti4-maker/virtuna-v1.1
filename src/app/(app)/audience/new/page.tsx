/**
 * /audience/new — Create audience page (full page, mobile-first, not a modal).
 * Renders inside (app)/layout.tsx → AppShell. Wraps its content in the shared
 * full-bleed radial surface shell (matches /start · /audience · /grow).
 */

import { SURFACE_RADIAL_BG } from "@/components/surfaces/surface-canvas";
import { AudienceForm } from "@/components/audience/audience-form";

export const metadata = {
  title: "Create audience | Maven",
};

export default async function NewAudiencePage({
  searchParams,
}: {
  // Next 16 — searchParams is a Promise.
  searchParams: Promise<{ mode?: string }>;
}) {
  const sp = await searchParams;
  // D-08 — the description Build path lands a General SIM; any other/absent value
  // keeps the byte-identical Socials default.
  const initialMode = sp.mode === "general" ? "general" : undefined;
  return (
    <div className="relative min-h-full text-foreground" style={{ background: SURFACE_RADIAL_BG }}>
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 sm:px-6">
        <div className="rv-in space-y-6">
          <div>
            <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">Create audience</h1>
            <p className="mt-1 text-sm text-foreground-secondary">
              Name your audience, then calibrate it from your @handle or a description.
            </p>
          </div>
          <AudienceForm initialMode={initialMode} />
        </div>
      </div>
    </div>
  );
}
