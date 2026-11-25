import { notFound } from "next/navigation";
import { creator } from "@/app/api/edit/creator";
import { AgentPage } from "./agent";

/**
 * /dev-edit/agent — where a creator tries the edit agent (part 3, Task 13b): they say how the video should look, get their
 * take back cut, and ask for changes in their own words. The first real version of this surface, behind the gates of
 * `/dev-edit/worker`: 404 outside development, and shown only to a creator the routes let in (A1: signed in and named in
 * EDIT_CREATORS); anyone else is told why, and its routes refuse them all the same. Its state is the page's own: a reload
 * starts over.
 */
export const dynamic = "force-dynamic";

export default async function DevEditAgentPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const who = await creator();
  if (who instanceof Response) {
    const { error } = (await who.json()) as { error: string };
    return (
      <main className="min-h-dvh bg-background p-4 text-foreground">
        <p className="mx-auto max-w-[420px] text-sm text-foreground-secondary">The editor: {error}.</p>
      </main>
    );
  }
  return <AgentPage />;
}
