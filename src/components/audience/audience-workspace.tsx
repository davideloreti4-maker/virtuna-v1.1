"use client";

/**
 * AudienceWorkspace — the console (SPEC-2026-07-13 §5).
 *
 * Replaces `AudienceProfileView`, whose largest element was a decorative dot cloud and
 * whose most valuable data (`repaint` — the sentence the model actually scores with)
 * was never rendered at all.
 *
 * Every control on this page is one the engine honours:
 *  - The mix   → `persona_weights`, passed to the engine as `analysis_override`
 *                (resolve-audience-weights.ts:63). Moving a slider moves a prediction.
 *  - The cast  → each persona's `repaint` feeds the reaction panel → the SIM
 *                (ideas-runner.ts:383). A persona's `label` never reaches a runner,
 *                and the UI says so rather than letting the user believe otherwise.
 *  - Grounding → `custom_context`, tagged `source: "user"` — strengthens provenance,
 *                never passed off as scraped data.
 *
 * General and presets render read-only: General is the protected baseline, and preset
 * ids are virtual (not UUIDs), so they cannot be PATCHed.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Audience,
  CalibratedPersona,
  PersonaWeights,
} from "@/lib/audience/audience-types";
import { AudienceCompositionBar } from "./audience-composition-bar";
import { AudienceReads } from "./audience-reads";
import { PersonaEditForm, archetypeDerivedName } from "./persona-edit-form";
import {
  getBuiltFrom,
  getPersonaCount,
  getPlatformLabel,
  getRung,
  isCustomAudience,
  isPersonaGrounded,
  type SourceRung,
} from "./audience-display";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const CARD = "rounded-xl border border-white/[0.06] bg-surface";

/** Slider track paint. Cream, not accent — the accent budget on this surface is the default radio. */
const FILL = "rgba(236,231,222,0.55)";
const TRACK = "rgba(255,255,255,0.08)";

/** The four dials the engine scores with, in human language. */
const DIALS: { key: keyof PersonaWeights; label: string; sub: string }[] = [
  { key: "fyp", label: "New viewers", sub: "For You page, don't follow you" },
  { key: "niche", label: "Niche regulars", sub: "In your world, not yet yours" },
  { key: "loyalist", label: "Loyalists", sub: "Watch everything you post" },
  { key: "cross_niche", label: "Cross-niche", sub: "Outsiders who wander in" },
];

const RUNGS: { id: SourceRung; label: string }[] = [
  { id: "described", label: "Described" },
  { id: "read", label: "Read from @handle" },
  { id: "proven", label: "Proven by outcomes" },
];

/** Percent ints (summing to 100) are the editing unit; the API wants fractions summing to 1.0. */
type WeightPercents = Record<keyof PersonaWeights, number>;

function toPercents(w: PersonaWeights): WeightPercents {
  return {
    fyp: Math.round(w.fyp * 100),
    niche: Math.round(w.niche * 100),
    loyalist: Math.round(w.loyalist * 100),
    cross_niche: Math.round(w.cross_niche * 100),
  };
}

function toFractions(p: WeightPercents): PersonaWeights {
  return {
    fyp: p.fyp / 100,
    niche: p.niche / 100,
    loyalist: p.loyalist / 100,
    cross_niche: p.cross_niche / 100,
  };
}

function sumOf(p: WeightPercents): number {
  return p.fyp + p.niche + p.loyalist + p.cross_niche;
}

function Ladder({ current }: { current: SourceRung }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {RUNGS.map((rung, i) => (
        <span key={rung.id} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-[10px] text-white/20">→</span>}
          <span
            className={cn(
              "text-[10px] uppercase tracking-[0.1em]",
              rung.id === current
                ? "rounded-md border border-white/[0.10] bg-white/[0.05] px-2 py-1 font-semibold text-foreground"
                : "text-foreground-muted",
            )}
          >
            {rung.label}
          </span>
        </span>
      ))}
    </div>
  );
}

function SectionHeading({
  title,
  note,
  description,
}: {
  title: string;
  note?: string;
  description: string;
}) {
  return (
    <div className="mb-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        {note && <span className="text-[11px] text-foreground-muted">{note}</span>}
      </div>
      <p className="mt-1 text-[12.5px] text-foreground-secondary">{description}</p>
    </div>
  );
}

export interface AudienceWorkspaceProps {
  audience: Audience;
  /** The user-level default that seeds new threads (null = General). */
  defaultAudienceId: string | null;
  onSetDefault: () => void;
  onEditDetails: () => void;
  className?: string;
}

export function AudienceWorkspace({
  audience: audienceProp,
  defaultAudienceId,
  onSetDefault,
  onEditDetails,
  className,
}: AudienceWorkspaceProps) {
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>(audienceProp);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [percents, setPercents] = useState<WeightPercents>(() =>
    toPercents(audienceProp.persona_weights),
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const editable = !audience.is_general && !audience.is_preset;
  const custom = isCustomAudience(audience);
  const built = getBuiltFrom(audience);
  const rung = getRung(audience);
  const personas = audience.personas;
  const count = getPersonaCount(audience);

  /**
   * archetype → the engagement receipt behind that persona (TRUST: the honesty spine).
   *
   * The editable `personas` column carries no `evidence` — only the FROZEN `signature` reactors
   * do, and only when the audience was built from a real scrape. So a receipt appears iff the
   * scrape actually produced one; a described/authored audience shows none and claims none.
   * (`isPersonaGrounded` was written for exactly this and had zero callers until 2026-07-14 —
   * because until the first real calibration ran, no audience in prod had any evidence to show.)
   */
  const receipts = useMemo(() => {
    const reactors = audience.signature?.audience.personas;
    if (!reactors?.length) return null;
    const byArchetype = new Map<string, string>();
    for (const r of reactors) {
      if (isPersonaGrounded(r)) byArchetype.set(r.archetype, r.evidence.trim());
    }
    return byArchetype.size > 0 ? byArchetype : null;
  }, [audience.signature]);
  const isDefault = audience.is_general
    ? defaultAudienceId === null
    : defaultAudienceId === audience.id;

  const saved = useMemo(() => toPercents(audience.persona_weights), [audience.persona_weights]);
  const mixDirty = useMemo(
    () => DIALS.some((d) => percents[d.key] !== saved[d.key]),
    [percents, saved],
  );
  const total = sumOf(percents);
  const canSaveMix = mixDirty && total === 100;

  const handle = audience.signature?.provenance.handle ?? audience.calibration?.handle ?? null;

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/audiences/${audience.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setSaveError("Couldn't save. Try again.");
        return false;
      }
      const data = (await res.json()) as { audience?: Audience };
      if (data.audience) setAudience(data.audience);
      return true;
    } catch {
      setSaveError("Couldn't save. Try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveMix() {
    if (!canSaveMix) return;
    await patch({ persona_weights: toFractions(percents) });
  }

  async function saveNote() {
    const text = note.trim();
    if (text.length === 0) return;
    const existing = audience.custom_context ?? [];
    const ok = await patch({
      custom_context: [...existing, { source: "user" as const, note: text }],
    });
    if (ok) setNote("");
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/audiences/${audience.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("delete failed");
      router.push("/audience");
    } catch {
      setSaveError("Couldn't delete this audience.");
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-7", className)}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-white/[0.06] pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <h1 className="truncate text-[20px] font-semibold tracking-[-0.01em] text-foreground">
                {audience.name}
              </h1>
              {editable && (
                <button
                  type="button"
                  onClick={onEditDetails}
                  className="shrink-0 rounded-md border border-white/[0.06] px-2 py-1 text-[11px] text-foreground-muted transition-colors hover:border-white/[0.10] hover:text-foreground-secondary"
                >
                  Edit details
                </button>
              )}
            </div>
            <p className="mt-1 text-[13px] text-foreground-secondary">
              Built from <span className="text-foreground">{built.label}</span>
              {built.sub ? ` · ${built.sub}` : ""}
              {" · "}
              {getPlatformLabel(audience)}
            </p>
            {editable && <Ladder current={rung} />}
          </div>

          {editable && rung === "described" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push("/audience/new")}
              className="shrink-0 pointer-coarse:h-11"
            >
              {handle ? `Read from @${handle}` : "Read from your @handle"}
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_296px] lg:items-start">
        <div className="min-w-0">
          {/* ── The mix ──────────────────────────────────────────────────── */}
          <section className="mb-8">
            <SectionHeading
              title="The mix"
              note={editable ? "changes what Maven predicts" : "read-only"}
              description="How much of the room is each kind of viewer. This is the dial the engine scores with."
            />
            <div className={cn(CARD, "px-5 py-1")}>
              {DIALS.map((dial) => (
                <div
                  key={dial.key}
                  className="grid grid-cols-[1fr_52px] items-center gap-4 border-b border-white/[0.06] py-3.5 last:border-b-0 sm:grid-cols-[150px_1fr_52px]"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] text-foreground">{dial.label}</p>
                    <p className="mt-0.5 text-[11px] text-foreground-muted">{dial.sub}</p>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={percents[dial.key]}
                    disabled={!editable}
                    aria-label={dial.label}
                    onChange={(e) =>
                      setPercents((p) => ({ ...p, [dial.key]: Number(e.target.value) }))
                    }
                    // The filled portion is painted on the track itself — a native range has no
                    // fill, and without one the dial reads as an empty line at every value.
                    style={{
                      background: `linear-gradient(to right, ${FILL} 0%, ${FILL} ${percents[dial.key]}%, ${TRACK} ${percents[dial.key]}%, ${TRACK} 100%)`,
                    }}
                    className={cn(
                      "col-span-2 h-1 w-full cursor-pointer appearance-none rounded-full sm:col-span-1",
                      "disabled:cursor-default disabled:opacity-60",
                      // `bg-cream` is NOT a token in this design system — it compiled to
                      // transparent and the thumb was invisible. Paint from the real variable.
                      "[&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none",
                      "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[color:var(--color-foreground)]",
                      "[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full",
                      "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[color:var(--color-foreground)]",
                    )}
                  />
                  <span className="text-right text-[13px] tabular-nums text-foreground-secondary">
                    {percents[dial.key]}%
                  </span>
                </div>
              ))}
            </div>

            {editable && (
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
                <p
                  className={cn(
                    "text-[12px]",
                    total === 100
                      ? "text-foreground-muted"
                      : "text-[color:var(--color-warning-raw)]",
                  )}
                >
                  {total === 100
                    ? "Totals 100%"
                    : `Must total 100% — currently ${total}%`}
                </p>
                {mixDirty && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPercents(saved)}
                      disabled={saving}
                    >
                      Discard
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={saveMix}
                      disabled={!canSaveMix || saving}
                    >
                      {saving ? <Spinner size="sm" /> : "Save the mix"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── The cast ─────────────────────────────────────────────────── */}
          <section className="mb-8">
            <SectionHeading
              title="The cast"
              note={count > 0 ? `${count} persona${count === 1 ? "" : "s"}` : undefined}
              description="Who reacts when you run a Read. Their description is what the model reads — edit it and their verdicts change."
            />

            {personas.length === 0 ? (
              <div className={cn(CARD, "px-5 py-8 text-center")}>
                <p className="text-[13px] text-foreground-secondary">
                  {audience.is_general
                    ? "General carries 10 universal personas — Maven's protected baseline."
                    : "Nothing modelled yet. Read your @handle and Maven builds the cast from the people who actually watch you."}
                </p>
                {editable && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push("/audience/new")}
                    className="mt-4"
                  >
                    Build this audience
                  </Button>
                )}
              </div>
            ) : (
              <div className={cn(CARD, "px-5 py-1")}>
                {personas.map((p: CalibratedPersona, i) => (
                  <div
                    key={`${p.archetype}-${i}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-white/[0.06] py-3.5 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-foreground">
                        {p.label ?? archetypeDerivedName(p.archetype)}
                      </p>
                      {p.repaint && (
                        <p className="mt-1 text-[12.5px] leading-relaxed text-foreground-secondary">
                          {p.repaint}
                        </p>
                      )}
                      {/* The receipt — the engagement pattern in the scrape that put this persona
                          in the room. Absent (and never faked) for a described audience. */}
                      {receipts?.get(p.archetype) && (
                        <p className="mt-1.5 border-l-2 border-white/[0.10] pl-2.5 text-[11.5px] leading-relaxed text-foreground-muted">
                          <span className="text-foreground-secondary">Evidence · </span>
                          {receipts.get(p.archetype)}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                      <span className="hidden rounded-md border border-white/[0.06] px-2 py-0.5 text-[11px] text-foreground-muted sm:inline">
                        {p.temperature}
                      </span>
                      <span className="hidden rounded-md border border-white/[0.06] px-2 py-0.5 text-[11px] text-foreground-muted sm:inline">
                        {p.disposition}
                      </span>
                      <span className="w-9 text-right text-[13px] tabular-nums text-foreground-secondary">
                        {Math.round(p.share * 100)}%
                      </span>
                      {editable && (
                        <button
                          type="button"
                          onClick={() => setEditingIndex(i)}
                          aria-label={`Edit ${p.label ?? archetypeDerivedName(p.archetype)}`}
                          className="rounded-md px-2 py-1 text-[12px] text-foreground-muted transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {personas.length > 0 && editable && (
              <p className="mt-2.5 text-[11.5px] text-foreground-muted">
                <span className="text-foreground-secondary">Naming only:</span> a persona&apos;s
                display name never reaches the model — the description does.
              </p>
            )}

            {receipts && (
              <p className="mt-1.5 text-[11.5px] text-foreground-muted">
                <span className="text-foreground-secondary">Evidence</span> is the engagement
                pattern in your account that put this persona in the room. Only an audience read
                from a real handle has it.
              </p>
            )}
          </section>

          {/* ── What they've said + where they split (P2) ─────────────────── */}
          {/* Fetches its own rollup: it is the only thing on this page that depends on the
              user's Reads rather than the audience row, and a slow scan must not block the
              mix or the cast from rendering. */}
          <AudienceReads audience={audience} className="mb-8" />

          {/* ── Grounding ────────────────────────────────────────────────── */}
          {editable && (
            <section>
              <SectionHeading
                title="What Maven should know"
                note="optional · changes predictions"
                description="Facts about your people a scrape can't see. Added as grounding, tagged as yours — never passed off as data."
              />
              <div className={cn(CARD, "p-4")}>
                {(audience.custom_context ?? []).length > 0 && (
                  <ul className="mb-3 flex flex-col gap-2">
                    {(audience.custom_context ?? []).map((c, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px] text-foreground-secondary"
                      >
                        {c.note}
                      </li>
                    ))}
                  </ul>
                )}
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="e.g. Most of them lift fasted before work — morning posts land better."
                />
                <div className="mt-2.5 flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={saveNote}
                    disabled={note.trim().length === 0 || saving}
                  >
                    {saving ? <Spinner size="sm" /> : "Add grounding"}
                  </Button>
                </div>
              </div>
            </section>
          )}

          {saveError && <p className="mt-3 text-[12.5px] text-error">{saveError}</p>}
        </div>

        {/* ── Rail ───────────────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-3">
          <div className={cn(CARD, "p-4")}>
            <h3 className="mb-3 text-[10px] font-medium uppercase tracking-[0.12em] text-foreground-muted">
              Source
            </h3>
            <dl className="text-[12.5px]">
              <div className="flex justify-between gap-3 border-b border-white/[0.06] py-1.5">
                <dt className="text-foreground-secondary">Built from</dt>
                <dd className="text-right font-medium text-foreground">{built.label}</dd>
              </div>
              <div className="flex justify-between gap-3 py-1.5">
                <dt className="text-foreground-secondary">Account data</dt>
                <dd
                  className={cn(
                    "text-right font-medium",
                    rung === "read" ? "text-foreground" : "text-foreground-muted",
                  )}
                >
                  {rung === "read" ? "Yes" : "None"}
                </dd>
              </div>
            </dl>
            {editable && rung === "described" && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push("/audience/new")}
                  className="mt-3 w-full pointer-coarse:h-11"
                >
                  {handle ? `Read from @${handle}` : "Read from your @handle"}
                </Button>
                <p className="mt-2 text-[11.5px] leading-relaxed text-foreground-muted">
                  Replaces these guesses with the real shares from your account.
                </p>
              </>
            )}
          </div>

          <div className={cn(CARD, "p-4")}>
            <h3 className="mb-3 text-[10px] font-medium uppercase tracking-[0.12em] text-foreground-muted">
              Where it&apos;s used
            </h3>
            <dl className="text-[12.5px]">
              <div className="flex justify-between gap-3 border-b border-white/[0.06] py-1.5">
                <dt className="text-foreground-secondary">New threads</dt>
                <dd className="text-right font-medium text-foreground">
                  {isDefault ? "Default" : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-1.5">
                <dt className="text-foreground-secondary">Compared against</dt>
                <dd className="text-right font-medium text-foreground">
                  {custom ? "Nothing" : "General"}
                </dd>
              </div>
            </dl>
            {!isDefault && !audience.is_preset && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onSetDefault}
                className="mt-3 w-full pointer-coarse:h-11"
              >
                Make it the default
              </Button>
            )}
            <p className="mt-2 text-[11.5px] leading-relaxed text-foreground-muted">
              {custom
                ? "A custom audience has no social control to compare against — it's judged on its own."
                : "Any thread can pin a different audience from the composer."}
            </p>
          </div>

          <div className={cn(CARD, "p-4")}>
            <h3 className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-foreground-muted">
              Composition
            </h3>
            <AudienceCompositionBar audience={audience} />
            <p className="mt-2 text-[11.5px] text-foreground-muted">
              {count === 0 ? "Nothing modelled yet." : "Segment width is that persona's share."}
            </p>
          </div>

          {editable && (
            <div className={cn(CARD, "p-4")}>
              <h3 className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-foreground-muted">
                Danger
              </h3>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="text-[12.5px] text-error transition-opacity hover:opacity-80"
              >
                Delete this audience
              </button>
            </div>
          )}

          {!editable && (
            <p className="px-1 text-[11.5px] leading-relaxed text-foreground-muted">
              {audience.is_general
                ? "General is Maven's protected baseline — read-only, and the control every social Read is scored against."
                : "A preset is a ready-made mix. Calibrate your own audience to tune it."}
            </p>
          )}
        </aside>
      </div>

      {editable && editingIndex !== null && personas[editingIndex] && (
        <PersonaEditForm
          audience={audience}
          persona={personas[editingIndex]}
          index={editingIndex}
          onClose={() => setEditingIndex(null)}
          onSaved={(updated) => {
            setAudience(updated);
            setEditingIndex(null);
          }}
        />
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {audience.name}?</DialogTitle>
            <DialogDescription>
              Threads pinned to this audience fall back to General. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" size="sm" disabled={deleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Spinner size="sm" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
