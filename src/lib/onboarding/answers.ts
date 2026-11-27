/**
 * answers.ts — what a visitor answers on /start before their account exists (funnel spec §3.2): where they
 * post (and their handles), what their videos are about, their 90-day goal.
 *
 * Pure, apart from the three storage calls, which are handed the storage. The answers live in local storage
 * under START_STORAGE_KEY until the account exists; then `POST /api/onboarding/start` writes them to
 * `creator_profiles`. The type is shared by the funnel's five parts (master plan, "Answers type").
 *
 * Two readings of a value: `answersOf` keeps what it can (local storage, a half-done visit), and
 * `completeAnswersOf` refuses anything it would have to drop (the server's check, before a write).
 */
import { HANDLE_PATTERN } from "@/lib/posted/posted";
import { normalizeHandle } from "@/lib/schemas/competitor";

export type Platform = "tiktok" | "instagram";
// The app's existing primary_goal set (src/lib/schemas/creator-profile.ts), stored as is.
export type Goal = "growth" | "engagement" | "brand_deals" | "conversion";
export type NicheSource = "typed" | "account";
export interface StartAnswers {
  platforms: Platform[];            // at least one
  tiktokHandle?: string;            // without "@", lowercased
  instagramHandle?: string;
  niche?: string;                   // 2–60 chars when nicheSource === "typed"
  nicheSource: NicheSource;         // "account" only when tiktokHandle is set
  goal?: Goal;
}

/** Answers with every question answered: what the account step saves. */
export type CompleteAnswers = StartAnswers & { goal: Goal };

export const START_STEPS = ["platform", "niche", "goal", "account"] as const;
export type StartStep = (typeof START_STEPS)[number];
export type StoredStart = StartAnswers & { step: StartStep };

export const START_STORAGE_KEY = "maven.start.v1";
export const PLATFORMS: readonly Platform[] = ["tiktok", "instagram"];
export const GOALS: readonly Goal[] = ["growth", "engagement", "brand_deals", "conversion"];
export const NICHE_MIN = 2;
export const NICHE_MAX = 60;

/** Instagram's own rule: letters, digits, dots and underscores, at most 30. */
const INSTAGRAM_HANDLE = /^[a-z0-9._]{1,30}$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isGoal = (value: unknown): value is Goal => typeof value === "string" && (GOALS as readonly string[]).includes(value);

export function isStartStep(value: unknown): value is StartStep {
  return typeof value === "string" && (START_STEPS as readonly string[]).includes(value);
}

/**
 * A handle as Maven keeps it: without "@", lower case, taken out of a profile link when one is pasted; null
 * when it cannot be one. TikTok's rule is the app's (`HANDLE_PATTERN`, the one the audience build takes).
 */
export function cleanHandle(platform: Platform, raw: string): string | null {
  if (platform === "tiktok") {
    const handle = normalizeHandle(raw);
    return HANDLE_PATTERN.test(handle) ? handle : null;
  }
  const trimmed = raw.trim();
  const fromLink = trimmed.match(/instagram\.com\/@?([a-zA-Z0-9_.]+)/)?.[1];
  const handle = (fromLink ?? trimmed.replace(/^@/, "")).toLowerCase();
  return INSTAGRAM_HANDLE.test(handle) ? handle : null;
}

/** The niche in the creator's words, spaces collapsed; null unless 2 to 60 characters. */
export function cleanNiche(raw: string): string | null {
  const niche = raw.replace(/\s+/g, " ").trim();
  return niche.length >= NICHE_MIN && niche.length <= NICHE_MAX ? niche : null;
}

/**
 * What can be kept of a value: known platforms once, in a fixed order; a handle only when it is valid and its
 * platform is picked; "account" only with a TikTok handle (else "typed"), and then no niche; a typed niche only
 * when valid; a goal only when known.
 */
export function answersOf(value: unknown): StartAnswers {
  if (!isObject(value)) return { platforms: [], nicheSource: "typed" };
  const listed: unknown[] = Array.isArray(value.platforms) ? value.platforms : [];
  const platforms = PLATFORMS.filter((p) => listed.includes(p));
  const handleFor = (platform: Platform, raw: unknown): string | undefined =>
    platforms.includes(platform) && typeof raw === "string" ? (cleanHandle(platform, raw) ?? undefined) : undefined;
  const tiktokHandle = handleFor("tiktok", value.tiktokHandle);
  const instagramHandle = handleFor("instagram", value.instagramHandle);
  const nicheSource: NicheSource = value.nicheSource === "account" && tiktokHandle ? "account" : "typed";
  const niche =
    nicheSource === "typed" && typeof value.niche === "string" ? (cleanNiche(value.niche) ?? undefined) : undefined;

  const answers: StartAnswers = { platforms, nicheSource };
  if (tiktokHandle) answers.tiktokHandle = tiktokHandle;
  if (instagramHandle) answers.instagramHandle = instagramHandle;
  if (niche) answers.niche = niche;
  if (isGoal(value.goal)) answers.goal = value.goal;
  return answers;
}

/** Whether the niche question is answered: a typed niche, or "work it out" with a TikTok handle. */
export function nicheAnswered(a: StartAnswers): boolean {
  return a.nicheSource === "account" ? Boolean(a.tiktokHandle) : a.niche !== undefined && cleanNiche(a.niche) !== null;
}

/**
 * Every question answered, and nothing in the value that would have to be dropped (a handle that cannot be
 * one, or for a platform not picked; "account" without a TikTok handle). Null otherwise.
 */
export function completeAnswersOf(value: unknown): CompleteAnswers | null {
  if (!isObject(value)) return null;
  const answers = answersOf(value);
  const given = (raw: unknown) => typeof raw === "string" && raw.trim() !== "";
  if (given(value.tiktokHandle) && !answers.tiktokHandle) return null;
  if (given(value.instagramHandle) && !answers.instagramHandle) return null;
  if (value.nicheSource === "account" && answers.nicheSource !== "account") return null;
  if (answers.platforms.length === 0 || !nicheAnswered(answers) || !answers.goal) return null;
  return { ...answers, goal: answers.goal };
}

/** A stored visit: what can be kept of it, and its step (the first one when unknown). */
export function storedStartOf(raw: string | null): StoredStart {
  let value: unknown = null;
  try {
    value = raw ? JSON.parse(raw) : null;
  } catch {
    value = null;
  }
  const step: StartStep = isObject(value) && isStartStep(value.step) ? value.step : "platform";
  return { ...answersOf(value), step };
}

/** The visit in local storage. A storage that refuses (private mode, blocked) reads as nothing stored. */
export function readStart(storage: Pick<Storage, "getItem"> | null): StoredStart {
  try {
    return storedStartOf(storage?.getItem(START_STORAGE_KEY) ?? null);
  } catch {
    return storedStartOf(null);
  }
}

/** Keeps the visit. A storage that refuses keeps nothing, and the flow goes on. */
export function writeStart(storage: Pick<Storage, "setItem"> | null, value: StoredStart): void {
  try {
    storage?.setItem(START_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Full or blocked: a refresh then starts over, nothing else is lost.
  }
}

export function clearStart(storage: Pick<Storage, "removeItem"> | null): void {
  try {
    storage?.removeItem(START_STORAGE_KEY);
  } catch {
    // Blocked: nothing to clear.
  }
}
