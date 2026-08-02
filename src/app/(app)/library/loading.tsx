import { PageShell } from "@/components/surfaces/surface-header";
import { ShelfSkeleton } from "@/components/saved/saved-shelf";

/**
 * /library route loading skeleton.
 *
 * ⚠️ This file was wrong twice over until 2026-08-02, and its own comment asserted the opposite —
 * it claimed to match the page "verbatim" while wrapping everything in `max-w-5xl` (1024px)
 * against the page's 880px `PageShell`, so the skeleton sat 144px wider than the content that
 * replaced it. That stopped being true when PR #407 (`658e7f23`) swapped the page to PageShell,
 * and the comment was never revisited. It also mirrored the masonry CARD grid, which the rev-5
 * shelf replaced with rows.
 *
 * Both are now correct BY CONSTRUCTION rather than by assertion: this renders the same
 * `PageShell` the page renders and the same `ShelfSkeleton` the shelf renders in its own loading
 * state. There is no second set of numbers left to drift.
 */
export default function LibraryLoading() {
  return (
    <div className="relative min-h-full text-foreground">
      <PageShell>
        <ShelfSkeleton />
      </PageShell>
    </div>
  );
}
