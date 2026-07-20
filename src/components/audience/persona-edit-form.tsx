"use client";

/**
 * PersonaEditForm — per-persona edit (AUD-EDIT-01 / D-06).
 *
 * Edits one calibrated persona's Name · Disposition · Temperature · Description and
 * writes the result to the audience's PER-AUDIENCE override slot (the `personas` JSONB
 * via the shipped `PATCH /api/audiences/[id]`) — NEVER the General baseline.
 *
 * Gate-safety by construction:
 *  - The immutable engine key + the audience-mix fraction stay byte-stable; only the four
 *    presentation/prompt-fold fields (`label` / `disposition` / `temperature` / `repaint`) change.
 *  - `Name` writes the presentation-only `label` field. Runners read `[archetype, repaint]`
 *    only and NEVER `label`, so the edit cannot move any SIM output.
 *  - There is NO numeric mix / proportion field (D-06 rejected — gate risk).
 *  - General + preset audiences are STRUCTURALLY refused (renders nothing) as
 *    defense-in-depth, even though Task 2's affordance already hides the control.
 *
 * Form chrome mirrors the shipped `audience-form.tsx` idiom (Input / Select / Button).
 */

import { useState } from "react";
import type {
  Audience,
  CalibratedPersona,
  Disposition,
  Temperature,
} from "@/lib/audience/audience-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { READING_CARD } from "@/components/reading/reading-section";
import { archetypeDerivedName } from "./audience-display";
import { cn } from "@/lib/utils";

// ─── Presentation option lists (UI-SPEC §Persona editing) ─────────────────────

const DISPOSITION_OPTIONS: { value: Disposition; label: string }[] = [
  { value: "scanner", label: "Scanner" },
  { value: "skeptic", label: "Skeptic" },
  { value: "collector", label: "Collector" },
  { value: "connector", label: "Connector" },
  { value: "converter", label: "Converter" },
  { value: "lurker", label: "Lurker" },
];

const TEMPERATURE_OPTIONS: { value: Temperature; label: string }[] = [
  { value: "cold", label: "Cold" },
  { value: "warm", label: "Warm" },
  { value: "hot", label: "Hot" },
];

/** Derive the default display name from the immutable archetype slug.
 *  Moved to `audience-display` (2026-07-20) — the manager derives the same name, and a
 *  client dialog is the wrong home for a string every surface needs. Re-exported so
 *  existing importers keep working. */
export { archetypeDerivedName };

interface PersonaEditFormProps {
  /** The audience that owns the persona (its `personas` JSONB is the write target). */
  audience: Audience;
  /** The persona being edited. */
  persona: CalibratedPersona;
  /** Index of the persona in `audience.personas` (the slot to replace). */
  index: number;
  /** Close without writing. */
  onClose: () => void;
  /** Called with the updated audience after a successful PATCH. */
  onSaved: (audience: Audience) => void;
  className?: string;
}

export function PersonaEditForm({
  audience,
  persona,
  index,
  onClose,
  onSaved,
  className,
}: PersonaEditFormProps) {
  // GUARD (defense-in-depth, D-06): NEVER write the protected baseline. The Task 2
  // affordance already hides Edit on General/preset; this is the structural backstop.
  // Hooks must run before this early return is irrelevant — this guard precedes them.
  const blocked = audience.is_general || audience.is_preset;

  const [name, setName] = useState(
    persona.label ?? archetypeDerivedName(persona.archetype),
  );
  const [disposition, setDisposition] = useState<Disposition>(persona.disposition);
  const [temperature, setTemperature] = useState<Temperature>(persona.temperature);
  const [description, setDescription] = useState(persona.repaint);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  if (blocked) return null;

  async function handleSave() {
    setSaving(true);
    setStatus("idle");

    // Build the updated personas override: replace ONLY the edited persona at its index.
    // The `...p` spread carries the immutable engine key + the audience-mix fraction through
    // unchanged (byte-stable) — this form edits ONLY the four presentation/prompt-fold fields
    // below (Name writes the presentation-only `label`). There is NO numeric-mix editor (D-06).
    const updatedPersonas: CalibratedPersona[] = audience.personas.map((p, i) =>
      i === index
        ? {
            ...p,
            label: name.trim() || archetypeDerivedName(persona.archetype),
            disposition,
            temperature,
            repaint: description,
          }
        : p,
    );

    try {
      const res = await fetch(`/api/audiences/${audience.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personas: updatedPersonas }),
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      const data = (await res.json()) as { audience: Audience };
      setStatus("success");
      onSaved(data.audience);
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={cn(
        READING_CARD,
        "flex flex-col gap-4 px-5 py-4",
        className,
      )}
    >
      <p className="text-sm font-medium text-foreground">Edit persona</p>

      {/* Name → label (archetype slug stays immutable) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-foreground-secondary" htmlFor="persona-name">
          Name
        </label>
        <Input
          id="persona-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={archetypeDerivedName(persona.archetype)}
          maxLength={60}
        />
      </div>

      {/* Disposition (Select trigger is a combobox button; label is a sibling span) */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-foreground-secondary">Disposition</span>
        <Select
          options={DISPOSITION_OPTIONS}
          value={disposition}
          onChange={(v) => setDisposition(v as Disposition)}
          placeholder="Select disposition"
        />
      </div>

      {/* Temperature (Select trigger is a combobox button; label is a sibling span) */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-foreground-secondary">Temperature</span>
        <Select
          options={TEMPERATURE_OPTIONS}
          value={temperature}
          onChange={(v) => setTemperature(v as Temperature)}
          placeholder="Select temperature"
        />
      </div>

      {/* Description → repaint */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-foreground-secondary" htmlFor="persona-description">
          Description
        </label>
        <Textarea
          id="persona-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          minRows={3}
          placeholder="How this persona reacts to your content."
        />
        <p className="text-xs text-foreground-muted">
          How this persona reacts in a Read — shapes who judges your ideas, not what Maven writes.
        </p>
      </div>

      {/* Honesty footnote (D-06) */}
      <p className="text-xs text-foreground-muted">
        This adjusts this audience only — it never changes your scores or the General audience.
      </p>

      {/* Status copy */}
      {status === "success" && (
        <p className="text-xs text-foreground-secondary">
          Persona updated. Future threads use the edited audience.
        </p>
      )}
      {status === "error" && (
        <p className="text-xs text-warning">Couldn&apos;t save this persona. Try again.</p>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
