import type { Figure } from "@/lib/audience-next/audience-model";
import { cn } from "@/lib/utils";

/**
 * The account's figures (spec 3.2.4): Followers, Likes, Posts, Usual views, those known, as a `<dl>` of
 * tiles in one row, the label above the value. Fewer figures, fewer tiles.
 *
 * "Usual views" in Inter 12 is about 63 to 66 wide. Four tiles in a body of 360 are (360 - 3 × 8) / 4 = 84
 * each, 68 for the label inside 8 of padding either side: it fits. Narrower (a phone of 375 has a body of
 * 343, a 320 one 288) the four go two by two rather than cut a label or scroll sideways; a 393 phone (body
 * 361) keeps one row.
 */
const COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 @min-[360px]:grid-cols-4",
};

export function Figures({ figures }: { figures: readonly Figure[] }) {
  return (
    <dl className={cn("grid gap-2", COLUMNS[figures.length] ?? "grid-cols-4")}>
      {figures.map((figure) => (
        <div key={figure.key} className="min-w-0 rounded-[18px] bg-surface px-2 pb-[11px] pt-2.5 shadow-[var(--shadow-rest)]">
          <dt className="truncate text-[12px] leading-4 text-foreground-secondary">{figure.label}</dt>
          <dd className="mt-0.5 text-[19px] font-bold leading-6 tracking-[-0.03em] text-foreground tabular-nums">{figure.value}</dd>
        </div>
      ))}
    </dl>
  );
}
