import { notFound } from "next/navigation";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import type { ResultRow } from "@/lib/result/types";
import { DevResult } from "./dev-result";

/**
 * /dev/result — the result page on a recorded run, for looking at it (and for
 * `scripts/result-shots.cjs`). Dev-only: the /dev layout 404s it in production.
 *
 *   /dev/result?fixture=<name>[&frames=<base>][&video=<url>][&processing=1][&t=<seconds>][&again=1]
 *
 * - fixture: early (default), middle, opening, leak, holds, ending, no-groups, no-audience
 * - frames: every scene gets the frame `<base>/<index>.jpg` (the stored frames expire)
 * - video: plays this address as the run's video
 * - processing=1: the run is still in flight
 * - again=1: shows "Simulate again" on a run without an audience (dormant in the app; do not press it on a real file)
 * - t: the playhead starts there instead of at rest
 */
const FIXTURES = {
  early: () => import("@/lib/result/__tests__/fixtures/early.json"),
  middle: () => import("@/lib/result/__tests__/fixtures/middle.json"),
  opening: () => import("@/lib/result/__tests__/fixtures/opening.json"),
  leak: () => import("@/lib/result/__tests__/fixtures/leak.json"),
  holds: () => import("@/lib/result/__tests__/fixtures/holds.json"),
  ending: () => import("@/lib/result/__tests__/fixtures/ending.json"),
  "no-groups": () => import("@/lib/result/__tests__/fixtures/no-groups.json"),
  "no-audience": () => import("@/lib/result/__tests__/fixtures/no-audience.json"),
} as const;

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

export default async function DevResultPage({ searchParams }: { searchParams: Promise<Params> }) {
  // The result page exists in the new look only; with the flag off this page does not exist either.
  if (!NEW_LOOK_ENABLED) notFound();
  const params = await searchParams;
  const name = one(params.fixture) ?? "early";
  if (!(name in FIXTURES)) notFound();
  const loaded = await FIXTURES[name as keyof typeof FIXTURES]();
  const row = JSON.parse(JSON.stringify(loaded.default)) as ResultRow;
  const t = one(params.t);

  return (
    <DevResult
      row={row}
      frames={one(params.frames) ?? null}
      video={one(params.video) ?? null}
      processing={one(params.processing) === "1"}
      simulateAgain={one(params.again) === "1"}
      t={t != null && Number.isFinite(Number(t)) ? Number(t) : undefined}
    />
  );
}
