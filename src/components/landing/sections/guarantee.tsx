import { Section } from "../section";
import { Reveal } from "../reveal";

/**
 * The guarantee — risk reversal in one sentence, set as a statement rather
 * than a badge. Shield icons and "100% MONEY BACK" starbursts are the visual
 * grammar of pages that expect to be doubted; a page that has just shown its
 * receipts closes the risk question in its own voice instead.
 */
export function Guarantee() {
  return (
    <Section tone="alt" align="center">
      <Reveal className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <p className="lp-eyebrow">The promise</p>
        <p className="lp-h2 mt-6">
          If the first read doesn&rsquo;t show you something you&rsquo;d have
          missed,{" "}
          <span className="lp-em text-[color:var(--lp-fg-2)]">
            the dollar comes back.
          </span>
        </p>
        <p className="lp-body mt-6 max-w-[46ch]">
          One email, no form, no call. You keep the read either way.
        </p>
      </Reveal>
    </Section>
  );
}
