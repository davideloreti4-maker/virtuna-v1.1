import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CollectionNext } from "@/components/discover-next/collection-next";
import { getDiscoverCorpus, type DiscoverCorpus } from "@/lib/discover/corpus-reads";
import { collectionPageOf } from "@/lib/discover-next/collections";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Collection | Maven",
};

type Query = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | null => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));

/**
 * /feed/collection/[slug]?shelf=<kind>: one of Maven's collections (spec 3.4). New look only: with the
 * flag off it does not exist. Signed out: nothing (the (app) layout and the middleware send the
 * visitor to log in).
 *
 * The library is read here, after the session check, through the hub's own read (its tables have no
 * row policies, so the browser cannot read them), and only the one collection goes to the page. A
 * slug is unique only within its shelf, so the shelf in the address decides between two of the same
 * slug. A collection that is not there is the page's own "gone" state, not a 404: a link can outlive
 * it, and the page says so with a way back. A read that fails is the page's failure state.
 */
export default async function CollectionRoute({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Query> }) {
  if (!NEW_LOOK_ENABLED) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ slug }, query] = await Promise.all([params, searchParams]);
  let corpus: DiscoverCorpus;
  try {
    corpus = await getDiscoverCorpus();
  } catch (error) {
    console.error("[discover] collection read failed", error);
    return <CollectionNext collection={null} failed />;
  }
  return <CollectionNext collection={collectionPageOf(corpus, slug, first(query.shelf))} />;
}
