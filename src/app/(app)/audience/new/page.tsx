/**
 * /audience/new — the three-door create flow (P4).
 * Connect account / From a handle / From a description. Renders inside
 * (app)/layout.tsx → AppShell on the plain matte surface (the radial top-glow
 * was retired: discrete tone-zones, not diffuse light).
 */

import { AudienceCreate, type CreateDoor } from "@/components/audience/audience-create";
import { PageShell, SurfaceHeader } from "@/components/surfaces/surface-header";

export const metadata = {
  title: "New audience | Maven",
};

const DOOR_VALUES: readonly CreateDoor[] = ["connect", "handle", "describe"];

export default async function NewAudiencePage({
  searchParams,
}: {
  // Next 16 — searchParams is a Promise.
  searchParams: Promise<{
    door?: string;
    // Legacy deep-link params, still honored: ?source=account&handle=… (connect flow)
    // lands on the connect door prefilled; ?mode=general (the Build description path)
    // lands on the describe door — that is what the link always meant.
    source?: string;
    handle?: string;
    mode?: string;
  }>;
}) {
  const sp = await searchParams;

  const initialDoor: CreateDoor | undefined = DOOR_VALUES.includes(sp.door as CreateDoor)
    ? (sp.door as CreateDoor)
    : sp.source === "account"
      ? "connect"
      : sp.mode === "general"
        ? "describe"
        : undefined;

  return (
    <div className="relative min-h-full text-foreground">
      {/* The shared 880px column, so this page's header lands on the same left edge
          as /audience and /settings. The form keeps its narrow measure by capping
          ITSELF (max-w-2xl below) instead of shrinking the shell — shrinking the
          shell is what used to push this title 298px right of /settings'. */}
      <PageShell>
        <div className="rv-in max-w-2xl space-y-6">
          <SurfaceHeader title="New audience" />
          <AudienceCreate initialDoor={initialDoor} prefillHandle={sp.handle} />
        </div>
      </PageShell>
    </div>
  );
}
