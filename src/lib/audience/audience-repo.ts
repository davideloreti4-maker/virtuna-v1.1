/**
 * Phase 7 Plan 02 — Audience CRUD + virtual General/preset constants (AUD-01).
 *
 * Provides:
 *  - GENERAL_AUDIENCE: virtual constant (is_general=true, sentinel id='general')
 *    — resolves WITHOUT a DB query; absence of active_audience_id = General (D-04)
 *  - PRESET_AUDIENCES: 2 virtual presets (growth-leaning / conversion-leaning)
 *    — materialized into real rows ONLY if the creator customizes a preset (Open Q2)
 *  - listAudiences, getAudience, createAudience, updateAudience, deleteAudience
 *    — all RLS-scoped to the authenticated user (session only, never input user_id)
 *
 * Row narrowing: `.from('audiences')` returns rows typed by the generated schema
 * (database.types.ts, regenerated post-migration in #179). The DB types columns like
 * mode/platform as `string` and the JSONB fields as `Json`; the domain-union narrowing
 * happens on the boundary return via `rowToAudience` (mirrors tracked-accounts-repo).
 *
 * Security (CR-01): user_id is ALWAYS derived from the supabase session — never
 * accepted from input. The audiences table RLS (audiences_all_own policy) enforces
 * this at the DB layer too, but we also strip it on the application layer.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CalibratedPersonasSchema } from "./persona-schema";
import type { Audience, GoalIntent } from "./audience-types";
import { biasForGoalIntent } from "./goal-intent";

// ─── Virtual constants ─────────────────────────────────────────────────────────

/**
 * Virtual General audience constant. Sentinel id = 'general'.
 * No DB row needed (Open Q2 RESOLVED). Resolves to DEFAULT_PERSONA_WEIGHT_CONFIG
 * via absence of analysis_override in resolveWeights() — the regression gate is
 * free by construction (AUD-03).
 *
 * NOTE: user_id is a sentinel placeholder — General is not user-owned.
 * Any code that persists or writes a row must check is_general and skip.
 */
export const GENERAL_AUDIENCE: Audience = {
  id: "general",
  user_id: "__virtual__",
  name: "General",
  type: "target",
  // PITFALL 1 (collision trap): the locked General DEFAULT runs the SOCIALS pack
  // (is_general marks the default weight mix, NOT the domain). ONLY the new
  // analyst/hiring GENERAL_TEMPLATES below are mode:'general'. Do not conflate.
  mode: "socials",
  platform: "tiktok",
  goal_label: null,
  goal_intent: null,
  is_general: true,
  is_preset: false,
  // DEFAULT_PERSONA_WEIGHT_CONFIG (must stay in sync with persona-weights.ts)
  persona_weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
  personas: [],
  profile: null,
  calibration: null,
  created_at: "1970-01-01T00:00:00Z",
  updated_at: "1970-01-01T00:00:00Z",
} as const;

/**
 * Virtual preset audiences (D-04 — 2 ready-made templates).
 * Sentinel ids are stable strings so 07-04 (chip) and 07-05 (gate) can reference them.
 *
 * [0] growth-leaning  → goal_intent='grow' → biasForGoalIntent('grow')
 * [1] conversion-leaning → goal_intent='sell' → biasForGoalIntent('sell')
 *
 * Materialized into a real DB row only if the creator customizes the preset.
 */
export const PRESET_AUDIENCES: Audience[] = [
  {
    id: "preset-growth",
    user_id: "__virtual__",
    name: "Growth Audience",
    type: "target",
    mode: "socials", // PITFALL 1: presets run the Socials pack, never 'general'.
    platform: "tiktok",
    goal_label: "Grow my following",
    goal_intent: "grow" as GoalIntent,
    is_general: false,
    is_preset: true,
    persona_weights: biasForGoalIntent("grow"),
    personas: [],
    profile: null,
    calibration: null,
    created_at: "1970-01-01T00:00:00Z",
    updated_at: "1970-01-01T00:00:00Z",
  },
  {
    id: "preset-conversion",
    user_id: "__virtual__",
    name: "Conversion Audience",
    type: "target",
    mode: "socials", // PITFALL 1: presets run the Socials pack, never 'general'.
    platform: "tiktok",
    goal_label: "Drive sales & conversions",
    goal_intent: "sell" as GoalIntent,
    is_general: false,
    is_preset: true,
    persona_weights: biasForGoalIntent("sell"),
    personas: [],
    profile: null,
    calibration: null,
    created_at: "1970-01-01T00:00:00Z",
    updated_at: "1970-01-01T00:00:00Z",
  },
];

/**
 * General-mode template audiences (D-08) — two zero-setup virtual constants that mirror
 * PRESET_AUDIENCES so they NEVER touch the DB (no seed row, regression-gate-free).
 *
 * These are the ONLY `mode: 'general'` constants (Pitfall 1: GENERAL_AUDIENCE + presets
 * are 'socials'). `signature` stays null and personas carry NO evidence — they render
 * ungrounded-by-design (D-05 / Pitfall 5): a General template is honest about being a
 * Directional SIM with no scrape behind it. Each ships a runnable CalibratedPersona panel
 * (shares Σ≈1.0) + a representative success_criterion so it runs with zero setup.
 */
export const GENERAL_TEMPLATES: Audience[] = [
  {
    id: "template-analyst",
    user_id: "__virtual__",
    name: "Analyst Panel",
    type: "target",
    mode: "general",
    platform: "custom",
    goal_label: null,
    goal_intent: null,
    is_general: false,
    is_preset: false,
    persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    personas: [
      {
        archetype: "tough_crowd",
        repaint: "The Skeptic — pressure-tests every claim for its weakest link.",
        temperature: "warm",
        disposition: "skeptic",
        share: 0.3,
      },
      {
        archetype: "purposeful_viewer",
        repaint: "The Strategist — weighs the call against its second-order consequences.",
        temperature: "warm",
        disposition: "collector",
        share: 0.3,
      },
      {
        archetype: "cross_niche_curiosity",
        repaint: "The Contrarian — argues the strongest opposing case on principle.",
        temperature: "cold",
        disposition: "connector",
        share: 0.2,
      },
      {
        archetype: "niche_deep_scout",
        repaint: "The Researcher — hunts the missing evidence and the unstated assumption.",
        temperature: "warm",
        disposition: "scanner",
        share: 0.2,
      },
    ],
    profile: null,
    calibration: null,
    signature: null,
    success_criterion:
      "Surfaces the sharpest risk and the strongest counter-argument before a decision is made.",
    custom_context: [],
    created_at: "1970-01-01T00:00:00Z",
    updated_at: "1970-01-01T00:00:00Z",
  },
  {
    id: "template-hiring",
    user_id: "__virtual__",
    name: "Hiring Panel",
    type: "target",
    mode: "general",
    platform: "custom",
    goal_label: null,
    goal_intent: null,
    is_general: false,
    is_preset: false,
    persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    personas: [
      {
        archetype: "purposeful_viewer",
        repaint: "The Hiring Manager — maps the candidate signal to the role's bar.",
        temperature: "warm",
        disposition: "converter",
        share: 0.3,
      },
      {
        archetype: "loyalist",
        repaint: "The Future Peer — judges day-to-day collaboration fit.",
        temperature: "warm",
        disposition: "connector",
        share: 0.25,
      },
      {
        archetype: "tough_crowd",
        repaint: "The Bar-Raiser — probes for the biggest gap against the level.",
        temperature: "warm",
        disposition: "skeptic",
        share: 0.25,
      },
      {
        archetype: "niche_deep_buyer",
        repaint: "The Domain Expert — tests depth in the core competency.",
        temperature: "hot",
        disposition: "collector",
        share: 0.2,
      },
    ],
    profile: null,
    calibration: null,
    signature: null,
    success_criterion:
      "Flags the strongest signal and the biggest gap against the role's bar.",
    custom_context: [],
    created_at: "1970-01-01T00:00:00Z",
    updated_at: "1970-01-01T00:00:00Z",
  },
];

/** All virtual sentinel ids — used to short-circuit DB lookups. */
export const SENTINEL_IDS = new Set<string>([
  GENERAL_AUDIENCE.id,
  ...PRESET_AUDIENCES.map((p) => p.id),
  ...GENERAL_TEMPLATES.map((t) => t.id),
]);

/** Map from sentinel id → constant for O(1) lookup. */
const VIRTUAL_BY_ID = new Map<string, Audience>([
  [GENERAL_AUDIENCE.id, GENERAL_AUDIENCE],
  ...PRESET_AUDIENCES.map((p): [string, Audience] => [p.id, p]),
  ...GENERAL_TEMPLATES.map((t): [string, Audience] => [t.id, t]),
]);

// ─── Zod validation ────────────────────────────────────────────────────────────

/**
 * WeightsSchema — validates the four weight fields.
 * Mirrors the WeightsSchema in override/route.ts + DB CHECK constraint (±0.01).
 */
const WeightsSchema = z
  .object({
    fyp: z.number().min(0).max(1),
    niche: z.number().min(0).max(1),
    loyalist: z.number().min(0).max(1),
    cross_niche: z.number().min(0).max(1),
  })
  .refine(
    (w) => Math.abs(w.fyp + w.niche + w.loyalist + w.cross_niche - 1) < 0.01,
    { message: "Audience weights must sum to 1.0 (±0.01)" },
  );

/**
 * Writable audience shape validated on create/update.
 * name: max 80 chars; goal_label: max 120 chars.
 */
export const WritableAudienceSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["personal", "target"]),
  platform: z.enum(["tiktok", "instagram", "youtube", "custom"]),
  goal_label: z.string().max(120).nullable().optional(),
  goal_intent: z.enum(["grow", "sell", "authority", "nurture"]).nullable().optional(),
  // POP-01 — first-class domain axis (D-04). user_id is NEVER here (session-derived).
  mode: z.enum(["socials", "general"]).optional(),
  // POP-05 — editable free-text "what good means"; capped to bound stored-XSS surface (T-03-08).
  success_criterion: z.string().max(2000).nullable().optional(),
  // POP-04 — user-added grounding; note capped (T-03-08), source pinned to the "user" literal.
  custom_context: z
    .array(
      z.object({
        source: z.literal("user"),
        note: z.string().max(2000),
        persona_evidence_link: z.string().max(120).optional(),
      }),
    )
    .max(50) // mirror the route cap — the repo is the last app-layer gate, never weaker than its callers (IN-01)
    .optional(),
  is_general: z.boolean().optional().default(false),
  is_preset: z.boolean().optional().default(false),
  // Nullable FK → connected_accounts (the account this audience calibrated from).
  source_account_id: z.string().uuid().nullable().optional(),
  persona_weights: WeightsSchema.optional(),
  // The repo is the last app-layer gate and is never weaker than its callers (IN-01): the
  // element shape is validated HERE, so both POST /api/audiences and PATCH /api/audiences/[id]
  // inherit it (each also validates at its own boundary, to answer 400 rather than 500).
  personas: CalibratedPersonasSchema.optional(),
  profile: z.unknown().nullable().optional(),
  calibration: z.unknown().nullable().optional(),
  // §P real signature — opaque JSONB at the repo boundary (shape validated by enrich's Zod).
  creator_persona: z.unknown().nullable().optional(),
  signature: z.unknown().nullable().optional(),
});

// ─── Row ↔ Domain mapping ──────────────────────────────────────────────────────

/** DB row shape (flat weights, as stored in the audiences table). */
interface AudienceRow {
  id: string;
  user_id: string;
  name: string;
  type: string;
  platform: string;
  goal_label: string | null;
  goal_intent: string | null;
  mode: string;
  success_criterion: string | null;
  custom_context: unknown[];
  is_general: boolean;
  is_preset: boolean;
  source_account_id: string | null;
  fyp: number;
  niche: number;
  loyalist: number;
  cross_niche: number;
  personas: unknown[];
  profile: unknown | null;
  calibration: unknown | null;
  creator_persona: unknown | null;
  signature: unknown | null;
  created_at: string;
  updated_at: string;
}

/** Map a DB row → Audience domain object. */
export function rowToAudience(row: AudienceRow): Audience {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    type: row.type as Audience["type"],
    mode: row.mode as Audience["mode"],
    platform: row.platform as Audience["platform"],
    goal_label: row.goal_label,
    goal_intent: row.goal_intent as Audience["goal_intent"],
    success_criterion: row.success_criterion ?? null,
    custom_context: (row.custom_context as Audience["custom_context"]) ?? [],
    is_general: row.is_general,
    is_preset: row.is_preset,
    source_account_id: row.source_account_id ?? null,
    persona_weights: {
      fyp: Number(row.fyp),
      niche: Number(row.niche),
      loyalist: Number(row.loyalist),
      cross_niche: Number(row.cross_niche),
    },
    personas: (row.personas as Audience["personas"]) ?? [],
    profile: (row.profile as Audience["profile"]) ?? null,
    calibration: (row.calibration as Audience["calibration"]) ?? null,
    creator_persona: (row.creator_persona as Audience["creator_persona"]) ?? null,
    signature: (row.signature as Audience["signature"]) ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Map an Audience domain object → DB row insert/update payload (flat weights). */
export function audienceToRow(
  a: Partial<Audience>,
  sessionUserId: string,
): Partial<AudienceRow> {
  const row: Partial<AudienceRow> = {
    user_id: sessionUserId, // CR-01: always from session, never input
  };

  if (a.name !== undefined) row.name = a.name;
  if (a.type !== undefined) row.type = a.type;
  if (a.mode !== undefined) row.mode = a.mode;
  if (a.platform !== undefined) row.platform = a.platform;
  if ("goal_label" in a) row.goal_label = a.goal_label ?? null;
  if ("goal_intent" in a) row.goal_intent = a.goal_intent ?? null;
  if ("success_criterion" in a) row.success_criterion = a.success_criterion ?? null;
  if ("custom_context" in a) row.custom_context = a.custom_context ?? [];
  if (a.is_general !== undefined) row.is_general = a.is_general;
  if (a.is_preset !== undefined) row.is_preset = a.is_preset;
  if ("source_account_id" in a) row.source_account_id = a.source_account_id ?? null;
  if (a.persona_weights !== undefined) {
    row.fyp = a.persona_weights.fyp;
    row.niche = a.persona_weights.niche;
    row.loyalist = a.persona_weights.loyalist;
    row.cross_niche = a.persona_weights.cross_niche;
  }
  if (a.personas !== undefined) row.personas = a.personas;
  if ("profile" in a) row.profile = a.profile ?? null;
  if ("calibration" in a) row.calibration = a.calibration ?? null;
  if ("creator_persona" in a) row.creator_persona = a.creator_persona ?? null;
  if ("signature" in a) row.signature = a.signature ?? null;

  return row;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * List all audiences for the authenticated user.
 * Returns virtual constants first:
 *   [GENERAL_AUDIENCE, ...PRESET_AUDIENCES, ...GENERAL_TEMPLATES, ...userRows].
 * General, presets, and the General templates have no DB row — they are prepended here.
 * RLS ensures only the calling user's rows are returned.
 */
export async function listAudiences(supabase: SupabaseClient): Promise<Audience[]> {
  const { data, error } = await supabase
    .from("audiences")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`audiences list failed: ${error.message}`);
  }

  const userRows: Audience[] = ((data ?? []) as AudienceRow[])
    .filter((row) => !SENTINEL_IDS.has(row.id)) // guard against sentinel rows
    .map(rowToAudience);

  return [GENERAL_AUDIENCE, ...PRESET_AUDIENCES, ...GENERAL_TEMPLATES, ...userRows];
}

/**
 * Get a single audience by id.
 * - Sentinel ids ('general', preset ids) → return virtual constant, no DB query.
 * - Other ids → DB SELECT, RLS-scoped to the authenticated user.
 * Returns null if not found.
 */
export async function getAudience(
  supabase: SupabaseClient,
  id: string,
): Promise<Audience | null> {
  // Virtual constant short-circuit (no DB round-trip)
  const virtual = VIRTUAL_BY_ID.get(id);
  if (virtual !== undefined) return virtual;

  const { data, error } = await supabase
    .from("audiences")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // row not found
    throw new Error(`audiences get failed: ${error.message}`);
  }

  return data ? rowToAudience(data as AudienceRow) : null;
}

/**
 * Create a new audience row.
 * user_id is always derived from the session (CR-01 — never from the input object).
 * Validates the writable shape via Zod before writing.
 */
export async function createAudience(
  supabase: SupabaseClient,
  input: Partial<Audience>,
): Promise<Audience> {
  // Validate writable fields
  const parsed = WritableAudienceSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`invalid audience input: ${parsed.error.message}`);
  }

  // CR-01: derive user_id from session, NEVER from input
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const rowPayload = audienceToRow(input, user.id);

  const { data, error } = await supabase
    .from("audiences")
    .insert(rowPayload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`audiences create failed: ${error.message}`);
  }

  return rowToAudience(data as AudienceRow);
}

/**
 * Upsert a Profile-baked General SIM by subject name (refine lane — dedup).
 *
 * Re-profiling the same chat/person produces the same subjectName, which previously
 * INSERTED a fresh general audience every time (the "3× Marcus Reyes" dupes in the
 * switcher). This finds the caller's OWN general-mode audience with the same
 * (case-insensitive) name and UPDATES it in place — refreshing the re-baked
 * signature/personas — instead of duplicating it. Virtual/sentinel rows (General +
 * presets + templates, prepended by listAudiences) are excluded, so a profile can
 * never collide with a constant. Falls back to createAudience when there is no match.
 * Scope is deliberately narrow (mode:'general' + exact name) so two genuinely distinct
 * subjects never merge.
 */
export async function upsertProfileAudience(
  supabase: SupabaseClient,
  input: Partial<Audience>,
): Promise<Audience> {
  const name = (input.name ?? "").trim();
  if (name && input.mode === "general") {
    const match = (await listAudiences(supabase)).find(
      (a) =>
        !SENTINEL_IDS.has(a.id) &&
        a.mode === "general" &&
        a.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (match) return updateAudience(supabase, match.id, input);
  }
  return createAudience(supabase, input);
}

/**
 * Clone a GENERAL_TEMPLATES entry into an owned, editable General SIM (UX-04 / D-03 —
 * the Build chooser "From a template" path). Turns a select-only virtual preset into the
 * moat object: a saved `mode:'general'` audience the creator owns and can edit.
 *
 * Security: this is a thin wrapper over `createAudience` — it adds NO new insert path.
 *  - The sentinel `id` (e.g. 'template-analyst') and virtual `user_id` ('__virtual__') are
 *    destructured off and never passed on (T-07-03-02 — a sentinel id never reaches the DB).
 *  - `createAudience` re-derives `user_id` from `supabase.auth.getUser()` (CR-01), so even the
 *    stripped virtual user_id is structurally impossible to persist (T-07-03-01 / IDOR).
 *  - `createAudience` validates via `WritableAudienceSchema` (name ≤ 80, free-text caps),
 *    bounding the cloned fields (T-07-03-03).
 *
 * @param templateId one of GENERAL_TEMPLATES ('template-analyst' | 'template-hiring').
 * @param name optional override; defaults to the template name. Capped to 80 (schema limit).
 * @throws if templateId is unknown — no silent createAudience call.
 */
export async function cloneTemplateAudience(
  supabase: SupabaseClient,
  templateId: string,
  name?: string,
): Promise<Audience> {
  const tpl = GENERAL_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) throw new Error(`unknown template '${templateId}'`);

  // Drop the non-writable / sentinel fields (id + virtual user_id + timestamps) — these
  // must NEVER be forwarded to the insert. `mode:'general'` rides along in `cloneable`.
  const { id, user_id, created_at, updated_at, ...cloneable } = tpl;
  void id;
  void user_id;
  void created_at;
  void updated_at;

  const input: Partial<Audience> = {
    ...cloneable,
    name: (name ?? tpl.name).slice(0, 80),
  };

  // Reuse createAudience verbatim — Zod validation + session-derived user_id + RLS insert.
  return createAudience(supabase, input);
}

/**
 * Update an existing audience row by id.
 * user_id is stripped from input and re-derived from session (CR-01).
 * Validates the writable shape via Zod before writing.
 */
export async function updateAudience(
  supabase: SupabaseClient,
  id: string,
  input: Partial<Audience>,
): Promise<Audience> {
  // Validate writable fields (partial update — all fields optional)
  const parsed = WritableAudienceSchema.partial().safeParse(input);
  if (!parsed.success) {
    throw new Error(`invalid audience update: ${parsed.error.message}`);
  }

  // CR-01: derive user_id from session, NEVER from input
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  // Strip user_id from the update payload — RLS enforces ownership at DB layer too
  const rowPayload = audienceToRow(input, user.id);
  delete rowPayload.user_id; // do NOT overwrite user_id on update

  const { data, error } = await supabase
    .from("audiences")
    .update(rowPayload)
    .eq("id", id)
    .eq("user_id", user.id) // app-layer ownership (defense-in-depth; RLS remains the primary boundary — WR-03)
    .select("*")
    .single();

  if (error) {
    throw new Error(`audiences update failed: ${error.message}`);
  }

  return rowToAudience(data as AudienceRow);
}

/**
 * Delete an audience row by id.
 * RLS ensures only the owner can delete their own rows.
 * Virtual constants (General/presets) cannot be deleted (they have no DB row).
 */
export async function deleteAudience(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  if (SENTINEL_IDS.has(id)) {
    throw new Error(`cannot delete virtual audience '${id}'`);
  }

  const { error } = await supabase
    .from("audiences")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`audiences delete failed: ${error.message}`);
  }
}
