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
    /* NO top hairline: the strip belongs to the hero's act. A rule cutting
       right under the floating stage read as an arbitrary line (owner call,
       2026-08-10) — the first full-bleed rule now lands where the argument
       actually turns, at the problem statement. */
    <section>
      <div className="lp-measure pb-12 pt-14 md:pb-14 md:pt-16">
        <Reveal>
          <p className="lp-eyebrow text-center">
            Used by creators &amp; teams featured on
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-11 gap-y-6">
            {MARK_WIDTHS.map((w, i) => (
              <span key={i} aria-hidden className="flex shrink-0 items-center gap-2.5">
                {/* three mark silhouettes cycling — real logo rows never repeat
                    one glyph shape six times */}
                <span
                  className={
                    ["h-5 w-5 rounded-md", "h-5 w-5 rounded-full", "h-4 w-4 rotate-45 rounded-[5px]"][
                      i % 3
                    ]
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
