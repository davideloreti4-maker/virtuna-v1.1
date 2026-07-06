"use client";

/**
 * PillarConfirmCard — the propose→confirm moment (Move 2). The clustering job auto-named the
 * creator's themes; this one-time card lets them make the vocabulary theirs (rename / remove)
 * before it settles. Renders in the /start rail above the pillar list and dismisses itself once
 * saved (the server marks the pillars confirmed → the card no longer mounts on the next load).
 *
 * Honest: nothing here fabricates a theme — it's the real clustered set, offered for review.
 */

import { useState } from "react";
import type { Pillar } from "@/lib/room-contract/mock-room";
import { savePillars } from "@/app/actions/content-pillars/save-pillars";

export function PillarConfirmCard({ pillars }: { pillars: Pillar[] }) {
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(pillars.map((p) => [p.id, p.name])),
  );
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) return null;

  const kept = pillars.filter((p) => !removed.has(p.id));

  const confirm = async () => {
    setSaving(true);
    setError(null);
    const renames = kept
      .map((p) => ({ id: p.id, name: (names[p.id] ?? "").trim() }))
      .filter((r) => r.name.length > 0 && r.name !== pillars.find((p) => p.id === r.id)?.name);
    const res = await savePillars({ renames, deletes: [...removed] });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDone(true);
  };

  return (
    <div className="elev-rest rounded-xl border border-border bg-surface-elevated px-3.5 py-[15px]">
      <div className="mb-1 flex items-baseline gap-2">
        <h3 className="m-0 flex-1 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
          Your content themes
        </h3>
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-foreground-muted">
          review · once
        </span>
      </div>
      <p className="m-0 mb-3 text-[11.5px] leading-[1.5] text-foreground-muted">
        We spotted these in your recent posts. Rename or remove any — then confirm they’re yours.
      </p>

      <div className="flex flex-col gap-1.5">
        {kept.map((p) => (
          <div key={p.id} className="flex items-center gap-1.5">
            <input
              value={names[p.id] ?? ""}
              onChange={(e) => setNames((n) => ({ ...n, [p.id]: e.target.value }))}
              maxLength={40}
              aria-label={`Rename the ${p.name} theme`}
              className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-[12.5px] text-foreground outline-none transition-colors focus:border-[color:var(--color-accent)]"
            />
            <button
              type="button"
              onClick={() => setRemoved((s) => new Set(s).add(p.id))}
              aria-label={`Remove the ${p.name} theme`}
              className="grid size-7 shrink-0 place-items-center rounded-lg border border-border text-foreground-muted transition-colors hover:border-white/10 hover:text-foreground"
            >
              <span aria-hidden className="text-[15px] leading-none">
                ×
              </span>
            </button>
          </div>
        ))}
      </div>

      {kept.length === 0 && (
        <p className="mt-2 text-[11px] text-foreground-muted">
          Removed all themes — we’ll re-learn them from your next posts.
        </p>
      )}

      {error && (
        <p className="mt-2 text-[11px] leading-[1.4] text-[color:var(--color-accent)]">{error}</p>
      )}

      <button
        type="button"
        onClick={confirm}
        disabled={saving}
        className="mt-3 w-full rounded-lg bg-[color:var(--color-accent)] py-2 text-[12.5px] font-semibold text-[#1a1714] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {saving ? "Saving…" : kept.length === 0 ? "Confirm — start over" : "Looks right"}
      </button>
    </div>
  );
}
