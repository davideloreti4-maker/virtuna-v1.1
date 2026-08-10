"use client";

/**
 * Example chips under the composer (spec §2 v6: "examples, never a registry") — 2–3
 * contextual doors that ARM a skill (tag in field + instruction placeholder), plus
 * More ▸ into the skills panel. Ids are composer ToolIds, validated by the registry
 * import — never a cast (F-017).
 */
import { Ico, SKILL_ICON, type ToolId } from "@/components/app/home/composer-controls";

// v8 copy — owner reviews before launch (handoff §5).
const CHIPS: { id: ToolId; label: string }[] = [
  { id: "remix", label: "Remix a proven video" },
  { id: "test", label: "Test a draft" },
  { id: "explore", label: "Find outliers" },
];

export function ChipsRow({
  onArm,
  onMore,
}: {
  onArm: (id: ToolId) => void;
  onMore: () => void;
}) {
  return (
    <div
      data-testid="composer-chips-row"
      className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {CHIPS.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onArm(c.id)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.06] bg-surface-elevated px-3 py-1.5 text-label text-foreground-secondary transition-colors hover:border-white/[0.10] hover:text-foreground"
        >
          <Ico name={SKILL_ICON[c.id]} size={13} className="text-foreground-muted" />
          {c.label}
        </button>
      ))}
      <button
        type="button"
        onClick={onMore}
        className="inline-flex shrink-0 items-center rounded-xl border border-white/[0.06] bg-surface-elevated px-3 py-1.5 text-label text-foreground-muted transition-colors hover:text-foreground"
      >
        More ▸
      </button>
    </div>
  );
}
