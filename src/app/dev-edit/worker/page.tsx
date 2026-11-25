import { notFound } from "next/navigation";
import { creator } from "@/app/api/edit/creator";
import { isId } from "@/lib/edit/worker/jobs";
import { WorkerPage } from "./worker";

/**
 * /dev-edit/worker — a DEV-ONLY page that proves part 2 of the edit tool (worker plan, Task 7), signed in as
 * a creator: a take uploaded straight to R2, its analysis watched, the take played in the Player with its own
 * captions, its first edit rendered on the worker with a progress bar, and the film downloaded. What it
 * watches is in its address (`?take=<id>&analysis=<id>&render=<id>`), so a reload goes on with the same jobs.
 * With `?bare=1&take=<id>` it shows the take's first edit alone at its full size, for comparing the Player
 * with the posted film. 404s outside development. Shown only to a creator the routes let in (A1: signed in and
 * named in EDIT_CREATORS); anyone else is told why, and its routes refuse them all the same.
 */
export const dynamic = "force-dynamic";

type Asked = { take?: string; analysis?: string; render?: string; bare?: string };

export default async function DevEditWorkerPage({ searchParams }: { searchParams: Promise<Asked> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const who = await creator();
  if (who instanceof Response) {
    const { error } = (await who.json()) as { error: string };
    return (
      <main className="min-h-screen bg-background p-4 text-foreground">
        <p className="mx-auto max-w-[420px] text-sm text-foreground-secondary">The edit worker: {error}.</p>
      </main>
    );
  }
  const asked = await searchParams;
  const id = (value: string | undefined) => (value && isId(value) ? value : null); // an id, never a path
  return <WorkerPage ids={{ take: id(asked.take), analysis: id(asked.analysis), render: id(asked.render) }} bare={asked.bare === "1"} />;
}
