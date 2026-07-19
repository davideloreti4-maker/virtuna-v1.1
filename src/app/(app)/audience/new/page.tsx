/**
 * /audience/new — the three-door create flow (P4).
 * Connect account / From a handle / From a description. Renders inside
 * (app)/layout.tsx → AppShell on the plain matte surface (the radial top-glow
 * was retired: discrete tone-zones, not diffuse light).
 */

import { AudienceCreate, type CreateDoor } from "@/components/audience/audience-create";

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
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 sm:px-6">
        <div className="rv-in space-y-6">
          <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">
            New audience
          </h1>
          <AudienceCreate initialDoor={initialDoor} prefillHandle={sp.handle} />
        </div>
      </div>
    </div>
  );
}
