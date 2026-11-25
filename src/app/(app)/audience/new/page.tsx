/**
 * /audience/new — the three-door create flow (P4).
 * Connect account / From a handle / From a description. Renders inside
 * (app)/layout.tsx → AppShell on the plain matte surface (the radial top-glow
 * was retired: discrete tone-zones, not diffuse light).
 */

import { AudienceCreate, type CreateDoor } from "@/components/audience/audience-create";
import { NewAudienceNext } from "@/components/audience-next/new-audience-next";
import { PageShell, SurfaceHeader } from "@/components/surfaces/surface-header";
import { resolveUserAudience } from "@/lib/audience/resolve-user-audience";
import { ownAudiences } from "@/lib/audience-next/audience-model";
import { doorOf } from "@/lib/audience-next/build-request";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { createClient } from "@/lib/supabase/server";

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
  // The new look's page: the old addresses keep choosing a row, and may bring the handle. A name repeated in
  // the address comes as an array whatever the type says: no handle then.
  if (NEW_LOOK_ENABLED) {
    return <NewAudienceNext initialDoor={doorOf(sp)} prefill={typeof sp.handle === "string" ? sp.handle : ""} inUse={await audienceInUse()} />;
  }

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

/**
 * The new look's page: whether the creator already has an audience of their own in use. Then a read with too
 * little to read offers only another try: general viewers is not what they use. Signed out, or a read that
 * fails: no.
 */
async function audienceInUse(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    return ownAudiences([await resolveUserAudience(supabase, user.id)]).length > 0;
  } catch {
    return false;
  }
}
