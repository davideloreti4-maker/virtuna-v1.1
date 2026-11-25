"use client";

/**
 * Findings.tsx — "Things to check" (Task 13b), shown only when the edit has findings: a closed row, "2 things to check"; open,
 * each finding as its plain sentence with "Show", which moves the Player to its frame. And `Fold`, the closed row both this
 * and the details use: a disclosure, its panel under it.
 */
import { CaretDown } from "@phosphor-icons/react";
import { useId, useState, type ReactNode } from "react";
import type { Finding } from "@/lib/edit/review";
import { sentence } from "./picking";

/** A closed row that opens what is under it. `quiet` is the dev's: muted. */
export function Fold({ title, quiet = false, part, children }: { title: string; quiet?: boolean; part: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  return (
    <div data-part={part}>
      <button
        type="button" aria-expanded={open} aria-controls={panel}
        onClick={() => setOpen(!open)}
        className={`flex h-9 w-full items-center justify-between gap-3 rounded-sm text-left text-[13px] hover:text-foreground ${quiet ? "text-foreground-muted" : "text-foreground-secondary"}`}
      >
        {title}
        <CaretDown aria-hidden size={12} className={`flex-none ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={panel} hidden={!open} className="pb-2">
        {children}
      </div>
    </div>
  );
}

export function Findings({ findings, onShow }: { findings: readonly Finding[]; onShow: (frame: number) => void }) {
  if (findings.length === 0) return null;
  return (
    <Fold part="findings" title={findings.length === 1 ? "1 thing to check" : `${findings.length} things to check`}>
      {/* At most four are seen at once; the rest scroll. */}
      <ul className="grid max-h-[184px] gap-2 overflow-y-auto">
        {findings.map((finding, i) => (
          <li key={i} className="flex items-start justify-between gap-4">
            <p className="text-[13px] leading-[18px] text-foreground-secondary">{sentence(finding.says)}</p>
            <button type="button" onClick={() => onShow(finding.where.frame)} className="flex-none text-[13px] leading-[18px] text-foreground underline underline-offset-4">
              Show
            </button>
          </li>
        ))}
      </ul>
    </Fold>
  );
}
