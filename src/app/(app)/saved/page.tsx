import { redirect } from "next/navigation";

/**
 * /saved — deep-link preservation redirect (Phase 12, Plan 02 — LIB-01, D-03).
 *
 * The Saved shelf was relabeled Library and repointed to /library over the SAME
 * saved_items store. This route is retained ONLY as a redirect so existing
 * bookmarks / deep links to /saved keep resolving — there is no second store
 * and no duplicate shelf mount here. The redirect IS the route.
 */
export default function SavedPage() {
  redirect("/library");
}
