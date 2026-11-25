/**
 * You's words and the pure helpers behind its rows (plan 2026-11-24-you). The copy is the spec's
 * and the drawing's (`docs/superpowers/specs/2026-11-24-you-design.md` §3), or reused from the
 * screens it replaces; the plan's open point C1 lists the lines this part had to choose, and the
 * controller's rulings (`.superpowers/sdd/2026-11-24-you/rulings.md`) the ones they changed.
 */
import type { Platform } from "@/lib/connected-accounts/connected-accounts-repo";
import { NICHE_TREE } from "@/lib/niches/taxonomy";
import { YOU_FACT_LIMITS, type YouFactKey } from "@/lib/you/facts";

export const SAVE_FAILED = "Couldn't save. Try again.";
export const READ_HINT = "Something off? Say it below. Your words win.";
export const CONNECT_LINE = "Connect your account. Maven reads what you make and writes like it.";
export const VOICE_HINT = "Describe it. Don't paste a post: Maven would copy its topic.";
// Chosen by this plan (open point C1):
export const LOAD_FAILED = "Couldn't load this page.";
export const ACCOUNTS_FAILED = "Couldn't load your accounts.";
export const SIGN_UP_LINE = "Create an account to tell Maven about you.";
export const NO_NICHE = "No niche matches.";
export const NAME_LABEL = "Name";
export const CHANGE_PHOTO = "Change photo";
/** Read before the name on the Who button, by a screen reader only. */
export const WHO_EDIT = "Edit name and photo: ";
export const SEARCH_NICHES = "Search niches";
/** The existing Settings warning, without its dash and its "frozen personas". */
export const DISCONNECT_LINE = "This removes its analytics history. Audiences you calibrated from it stay, unlinked. This can't be undone.";
// Ruling 5: an account is connected but Maven has not read it yet (the read comes from setting up
// that account's audience). The card says this in place of the read, with one link to `/audience/new`.
export const SET_UP_AUDIENCE = "Set up audience";
export const notReadLine = (handle: string): string =>
  `Maven hasn't read @${handle} yet. It reads an account when you set up its audience.`;
/** A connect whose request never came back (a dropped request): the existing dialog's sentence. */
export const CONNECT_OFFLINE = "Couldn't connect. Check your connection and try again.";

export interface FactSpec {
  key: YouFactKey;
  label: string;
  placeholder: string;
  hint: string | null;
  limit: number;
}

/** The free-text rows of "In your words", in the page's order (Niche comes before them, Goal after). */
export const FACTS: readonly FactSpec[] = [
  { key: "about", label: "About you", placeholder: "Nurse, mum of two, started posting last year.", hint: null, limit: YOU_FACT_LIMITS.about },
  { key: "sells", label: "What you sell", placeholder: "A 12-week meal plan, $49. Affiliate for two blender brands.", hint: null, limit: YOU_FACT_LIMITS.sells },
  { key: "writing_voice_description", label: "How you sound", placeholder: "Dry, short sentences, a bit of swearing. Never say 'guys'.", hint: VOICE_HINT, limit: YOU_FACT_LIMITS.writing_voice_description },
  { key: "can_film", label: "What you can film", placeholder: "Phone only, my kitchen, on camera. No b-roll, no editing beyond cuts.", hint: null, limit: YOU_FACT_LIMITS.can_film },
  { key: "never_do", label: "Never", placeholder: "No before/after bodies. No giveaways. Never name a competitor.", hint: null, limit: YOU_FACT_LIMITS.never_do },
];

/** The four goal chips and the existing `primary_goal` values they save. */
export const GOALS = [
  { value: "growth", label: "Grow" },
  { value: "engagement", label: "Engage" },
  { value: "brand_deals", label: "Brand deals" },
  { value: "conversion", label: "Sell" },
] as const;
export type GoalValue = (typeof GOALS)[number]["value"];

export function goalLabel(value: string | null | undefined): string | null {
  return GOALS.find((g) => g.value === value)?.label ?? null;
}

export function isGoal(value: unknown): value is GoalValue {
  return GOALS.some((g) => g.value === value);
}

export interface NicheOption {
  primary: string;
  sub: string | null;
  /** "Food & Cooking" or "Food & Cooking · Meal Prep": the option's full name. */
  label: string;
  /** "Meal Prep" for a sub, drawn under its primary when there is no search. */
  subLabel: string | null;
}

const ALL_NICHES: readonly NicheOption[] = NICHE_TREE.flatMap((p) => [
  { primary: p.slug, sub: null, label: p.label, subLabel: null },
  ...p.subs.map((s) => ({ primary: p.slug, sub: s.slug, label: `${p.label} · ${s.label}`, subLabel: s.label })),
]);

/** Every niche of the existing list, each primary followed by its subs, narrowed by a case-blind search. */
export function nicheOptions(query: string): NicheOption[] {
  const q = query.trim().toLowerCase();
  return q ? ALL_NICHES.filter((o) => o.label.toLowerCase().includes(q)) : [...ALL_NICHES];
}

const fromSlug = (slug: string) => {
  const words = slug.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** "Food & Cooking · Meal Prep" for a saved niche; a slug the list no longer has reads as itself. */
export function nicheLabel(primary: string | null | undefined, sub: string | null | undefined): string | null {
  if (!primary) return null;
  const node = NICHE_TREE.find((p) => p.slug === primary);
  const primaryLabel = node?.label ?? fromSlug(primary);
  if (!sub) return primaryLabel;
  return `${primaryLabel} · ${node?.subs.find((s) => s.slug === sub)?.label ?? fromSlug(sub)}`;
}

export const countLabel = (length: number, limit: number): string => `${length} / ${limit}`;

export const PLATFORMS: readonly Platform[] = ["tiktok", "instagram", "youtube"];
export const PLATFORM_NAMES: Record<Platform, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };
/** The letters in an account row's tile (drawn, not read: the row's line names the platform). */
export const PLATFORM_MARKS: Record<Platform, string> = { tiktok: "TT", instagram: "IG", youtube: "YT" };
/** As the existing connect dialog words them (`connect-account-dialog.tsx`). */
export const HANDLE_LABELS: Record<Platform, string> = { tiktok: "TikTok @handle", instagram: "Instagram @handle", youtube: "YouTube @handle" };
export const HANDLE_PLACEHOLDERS: Record<Platform, string> = { tiktok: "@yourhandle", instagram: "@yourhandle", youtube: "@yourchannel" };

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function followersLabel(count: number | null, platform: Platform): string | null {
  if (count === null || !Number.isFinite(count)) return null;
  return `${compact.format(count)} ${platform === "youtube" ? "subscribers" : "followers"}`;
}

export function whoLine(primary: { handle: string; platform: Platform } | null, followers: number | null): string {
  if (!primary) return "No account connected";
  const count = followersLabel(followers, primary.platform);
  return count ? `@${primary.handle} · ${count}` : `@${primary.handle}`;
}

/**
 * The read's one line, made readable. The account read is stored as a single line of parts ("audience …;
 * voice …; formats …; AVOID …"): shown as sentences, the model's "AVOID" as a word. Display only; what the
 * writers are given is the stored line.
 */
export function readHow(context: string | null): string | null {
  if (context === null || context.trim() === "") return null;
  return context
    .split(/\s*(?:;|·)\s*/)
    .map((part) => part.trim().replace(/\.+$/, ""))
    .filter(Boolean)
    .map((part) => {
      const said = part.replace(/^AVOID\b:?\s*/i, "Avoids ").replace(/\bAVOID\b/g, "avoid");
      return `${said.charAt(0).toUpperCase()}${said.slice(1)}.`;
    })
    .join(" ");
}

/**
 * An account row's second line: the platform's name alone (rulings 4 and 10). No "synced …" time:
 * nothing refreshes an account's snapshot on a schedule, so a sync time would stand still.
 */
export function accountLine(platform: Platform): string {
  return PLATFORM_NAMES[platform];
}

/**
 * How an account is named in its menu, its question and what is said about it: the handle, with its
 * platform when another listed account shares that handle (the same name on TikTok and Instagram).
 */
export function accountName(account: { handle: string; platform: Platform }, all: ReadonlyArray<{ handle: string }>): string {
  const shared = all.filter((other) => other.handle === account.handle).length > 1;
  return shared ? `@${account.handle} on ${PLATFORM_NAMES[account.platform]}` : `@${account.handle}`;
}

export function disconnectFailed(name: string): string {
  return `Couldn't disconnect ${name}. Try again.`;
}

export function primaryFailed(name: string): string {
  return `Couldn't make ${name} primary. Try again.`;
}

const DAY = 86_400_000;

export function daysAgo(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const days = Math.floor(ms / DAY);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export function readFoot(handle: string | null, readAt: string | null): string | null {
  if (!handle) return null;
  const when = daysAgo(readAt);
  return when ? `Read from @${handle}, ${when}` : `Read from @${handle}`;
}
