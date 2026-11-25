"use client";

import { useState } from "react";

import { BuildingView } from "@/components/audience-next/building-view";
import { NewAudienceScreen } from "@/components/audience-next/new-audience-screen";
import { initialOf } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS } from "@/lib/audience-next/audience-words";
import { buildRequestOf, type NewDoor } from "@/lib/audience-next/build-request";
import { applyEvent, startBuild, type BuildState } from "@/lib/audience-next/build-state";
import type { BuildEvent } from "@/lib/audience-next/build-stream";

/**
 * A new audience on local state, for /dev/audience (`dev-audience.tsx` hands these states here): the form,
 * and a read of @nia.tests in each of its states, made by the real reducer from made-up events in the
 * server's own step names. Nothing here sends: Build audience, Try again, Use general viewers and Try
 * another account do nothing.
 *
 * - new: the form on your own account · new-describe: the form on Describe them, a description written
 * - building: the second step running, the covers in · slow: the third step running, a picture in the
 *   middle, past three minutes · thin: too little to read · build-failed: the read failed
 */

export type DevNewAudienceState = "new" | "new-describe" | "building" | "slow" | "thin" | "build-failed";

const noop = () => {};
const NIA = buildRequestOf("own", "nia.tests")!;
const DESCRIPTION = "Busy parents who meal-prep on Sundays and want dinners that keep for the week.";
const [READ, WATCH, BUILD] = startBuild(NIA).plan as [string, string, string];

// Made-up stills standing in for video covers and an account's picture, drawn here so the preview needs no
// network. Their tones are a photograph's, not the page's.
const still = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
const cover = (tone: string) => still(`<svg xmlns="http://www.w3.org/2000/svg" width="68" height="92"><rect width="68" height="92" fill="${tone}"/></svg>`);
/** Also the covers of the read again's preview (`dev-audience.tsx`). */
export const COVERS = ["#8f877b", "#5f6b63", "#b9a58c", "#3f4a5a", "#a3988a", "#6d5f52", "#c4bba9", "#4e5a50", "#7c8794", "#9a8f80", "#5a5048", "#b0a796"].map(cover);
const PICTURE = still(
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#c9b8a3"/><circle cx="64" cy="52" r="24" fill="#8a7563"/><ellipse cx="64" cy="118" rx="44" ry="34" fill="#8a7563"/></svg>`,
);

const stage = (name: string, status: "active" | "done"): BuildEvent => ({ type: "stage", name, status });
const EVIDENCE: Extract<BuildEvent, { type: "evidence" }> = { type: "evidence", handle: "nia.tests", picture: null, covers: COVERS, count: COVERS.length };
const at = (events: BuildEvent[]): BuildState => events.reduce(applyEvent, startBuild(NIA));

/** The read a state shows, or null for the form. */
function readOf(state: DevNewAudienceState): { build: BuildState; slow: boolean } | null {
  switch (state) {
    case "building":
      return { build: at([stage(READ, "active"), EVIDENCE, stage(READ, "done"), stage(WATCH, "active")]), slow: false };
    case "slow":
      return {
        build: at([stage(READ, "active"), { ...EVIDENCE, picture: PICTURE }, stage(READ, "done"), stage(WATCH, "active"), stage(WATCH, "done"), stage(BUILD, "active")]),
        slow: true,
      };
    case "thin":
      return { build: at([stage(READ, "active"), { type: "fallback" }]), slow: false };
    case "build-failed":
      return { build: at([stage(READ, "active"), { type: "error", message: null }]), slow: false };
    default:
      return null;
  }
}

export function DevNewAudience({ state }: { state: DevNewAudienceState }) {
  const [door, setDoor] = useState<NewDoor>(state === "new-describe" ? "describe" : "own");
  const [handle, setHandle] = useState("");
  const [description, setDescription] = useState(state === "new-describe" ? DESCRIPTION : "");
  const read = readOf(state);
  return (
    <NewAudienceScreen
      door={door}
      field={door === "describe" ? description : handle}
      onDoor={setDoor}
      onField={door === "describe" ? setDescription : setHandle}
      onSubmit={noop}
      building={
        read ? (
          <BuildingView
            state={read.build}
            slow={read.slow}
            mode="new"
            whose="your"
            initial={initialOf(NIA.name)}
            onTryAgain={noop}
            onUseGeneral={noop}
            onTryAnother={noop}
            tryAnotherLabel={AUDIENCE_STRINGS.tryAnother}
          />
        ) : undefined
      }
    />
  );
}
