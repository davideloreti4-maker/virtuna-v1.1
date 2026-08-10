import { Reveal } from "../reveal";

/**
 * Logo wall — the "featured in / used by" strip, directly under the hero.
 *
 * A thin band, not a full section: logos are a credibility checkpoint the eye
 * should clear in under a second on the way to the problem statement.
 *
 * GREEKED WORDMARKS, not boxed slots. A row of bordered rectangles with icons
 * reads as six broken embeds; what a logo row actually looks like from
 * reading distance is a rhythm of grey word-shapes at varied widths. Each
 * placeholder is a mark + a bar — anonymous, but unmistakably a logo row.
 * Real logos land greyscale-cream at this same opacity (colour here would be
 * six accent violations at once). Six, not eight: eight wrapped to a 7+1
 * orphan at 1440, and a lone logo on its own row reads as a rendering bug.
 */

const MARK_WIDTHS = [96, 122, 84, 134, 102, 90] as const;

export function Logos() {
  return (
    <section className="lp-rule">
      <div className="lp-measure py-12 md:py-14">
        <Reveal>
          <p className="lp-eyebrow text-center">
            Used by creators &amp; teams featured on
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-11 gap-y-6">
            {MARK_WIDTHS.map((w, i) => (
              <span key={i} aria-hidden className="flex shrink-0 items-center gap-2.5">
                <span
                  className={
                    i % 2
                      ? "h-5 w-5 rounded-full"
                      : "h-5 w-5 rounded-md"
                  }
                  style={{ background: "rgba(236,231,222,0.13)" }}
                />
                <span
                  className="h-3.5 rounded-full"
                  style={{ width: w, background: "rgba(236,231,222,0.1)" }}
                />
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
