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
 * Cast convention: `(supabase as any).from('audiences')` until database.types.ts
 * is regenerated after the migration push in 07-05. Types are added via Task 3 of this plan.
 *
 * Security (CR-01): user_id is ALWAYS derived from the supabase session — never
 * accepted from input. The audiences table RLS (audiences_all_own policy) enforces
 * this at the DB layer too, but we also strip it on the application layer.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
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

/** All virtual sentinel ids — used to short-circuit DB lookups. */
const SENTINEL_IDS = new Set<string>([
  GENERAL_AUDIENCE.id,
  ...PRESET_AUDIENCES.map((p) => p.id),
]);

/** Map from sentinel id → constant for O(1) lookup. */
const VIRTUAL_BY_ID = new Map<string, Audience>([
  [GENERAL_AUDIENCE.id, GENERAL_AUDIENCE],
  ...PRESET_AUDIENCES.map((p): [string, Audience] => [p.id, p]),
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
const WritableAudienceSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["personal", "target"]),
  platform: z.enum(["tiktok", "instagram", "youtube", "custom"]),
  goal_label: z.string().max(120).nullable().optional(),
  goal_intent: z.enum(["grow", "sell", "authority", "nurture"]).nullable().optional(),
  is_general: z.boolean().optional().default(false),
  is_preset: z.boolean().optional().default(false),
  persona_weights: WeightsSchema.optional(),
  personas: z.array(z.unknown()).optional(),
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
  is_general: boolean;
  is_preset: boolean;
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
function rowToAudience(row: AudienceRow): Audience {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    type: row.type as Audience["type"],
    platform: row.platform as Audience["platform"],
    goal_label: row.goal_label,
    goal_intent: row.goal_intent as Audience["goal_intent"],
    is_general: row.is_general,
    is_preset: row.is_preset,
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
function audienceToRow(
  a: Partial<Audience>,
  sessionUserId: string,
): Partial<AudienceRow> {
  const row: Partial<AudienceRow> = {
    user_id: sessionUserId, // CR-01: always from session, never input
  };

  if (a.name !== undefined) row.name = a.name;
  if (a.type !== undefined) row.type = a.type;
  if (a.platform !== undefined) row.platform = a.platform;
  if ("goal_label" in a) row.goal_label = a.goal_label ?? null;
  if ("goal_intent" in a) row.goal_intent = a.goal_intent ?? null;
  if (a.is_general !== undefined) row.is_general = a.is_general;
  if (a.is_preset !== undefined) row.is_preset = a.is_preset;
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
 * Returns virtual constants first: [GENERAL_AUDIENCE, ...PRESET_AUDIENCES, ...userRows].
 * General and presets have no DB row — they are prepended here.
 * RLS ensures only the calling user's rows are returned.
 */
export async function listAudiences(supabase: SupabaseClient): Promise<Audience[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("audiences")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`audiences list failed: ${error.message}`);
  }

  const userRows: Audience[] = ((data ?? []) as AudienceRow[])
    .filter((row) => !SENTINEL_IDS.has(row.id)) // guard against sentinel rows
    .map(rowToAudience);

  return [GENERAL_AUDIENCE, ...PRESET_AUDIENCES, ...userRows];
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("audiences")
    .update(rowPayload)
    .eq("id", id)
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("audiences")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`audiences delete failed: ${error.message}`);
  }
}
