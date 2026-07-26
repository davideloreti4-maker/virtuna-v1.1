import { notFound } from "next/navigation";
import { ShotStages } from "@/components/offer/shots/shot-stages";

/**
 * /dev-shots — the DEV-ONLY capture stage for the offer page's product screenshots.
 * (Not `_shots`: App Router treats an underscore-prefixed folder as private and
 * never routes it.)
 *
 * The offer page's below-hero sections show real product pixels, not drawings.
 * Rather than paying the JS/hydration cost of mounting heavy app surfaces on a
 * cold paid-traffic page, we mount them ONCE here, at exact framing, and
 * `scripts/capture-offer-shots.ts` photographs each stage into
 * `public/images/offer/*.webp`. The sections then render plain `<Image>` —
 * real product, zero runtime cost.
 *
 * Every stage renders a SHIPPED component (EmbeddedComposer, AmbientRoom,
 * VideoTestCardRenderer) fed the same fixtures the hero uses, so a re-capture
 * after a UI change is one command — see the script's header for the recipe.
 *
 * 404s outside development: this is a build tool, never a public route.
 */
export const dynamic = "force-static";

export default function ShotsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ShotStages />;
}
