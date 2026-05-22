import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { addCompetitor } from "@/app/actions/competitors/add";
import { normalizeHandle } from "@/lib/schemas/competitor";
import type { PlatformId } from "@/components/app/cards/platform-picker";
import type { TargetAudience } from "@/components/app/cards/audience-picker";
import type {
  CreatorGoal,
  CreatorStage,
} from "@/components/app/cards/goal-stage-picker";
import type {
  ContentStyle,
  CutsPerSecond,
} from "@/components/app/cards/content-style-picker";
import type { ReferenceCreatorEntry } from "@/components/app/cards/reference-creators-input";
import type { UrlEntry } from "@/components/app/cards/wins-flops-input";
import type { PostingFrequency } from "@/components/app/cards/cadence-picker";

/**
 * Draft shape mirroring the prop contracts of all 9 card pickers.
 * One field (or composite) per card. Initial values follow the picker
 * components' "empty/null = unset" convention.
 */
export interface InterviewDraft {
  platforms: PlatformId[]; // Card 0
  niche_primary: string | null; // Card 1
  niche_sub: string | null; // Card 1
  audience: TargetAudience; // Card 2
  goal: CreatorGoal | null; // Card 3
  stage: CreatorStage | null; // Card 3
  style: ContentStyle | null; // Card 4
  cuts: CutsPerSecond | null; // Card 4
  references: ReferenceCreatorEntry[]; // Card 5
  wins: UrlEntry[]; // Card 6
  flops: UrlEntry[]; // Card 6
  cadence: PostingFrequency | null; // Card 7
  todAware: boolean; // Card 7
  pain: string; // Card 8
}

export interface ProfileInterviewState {
  currentCard: number;
  draft: InterviewDraft;
  isClosing: boolean;
  lastError: string | null;
  /**
   * WR-04: sentinel marking that `fireReferenceCreatorAdds(draft.references)`
   * has already fired this session — either from `advanceCard` (Card 5
   * continue) or from a prior `finalize`. Prevents the at-most-once side
   * effect from re-firing when the user navigates Card 5 -> Continue and
   * then back-edits before reaching Card 8.
   */
  referencesFired: boolean;
  setDraftField: <K extends keyof InterviewDraft>(
    key: K,
    value: InterviewDraft[K]
  ) => void;
  advanceCard: () => Promise<void>;
  skipCard: () => void;
  goBack: () => void;
  skipInterview: () => Promise<void>;
  finalize: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const INITIAL_DRAFT: InterviewDraft = {
  platforms: [],
  niche_primary: null,
  niche_sub: null,
  audience: {
    age_range: null,
    gender_skew: null,
    geo: null,
    language: null,
  },
  goal: null,
  stage: null,
  style: null,
  cuts: null,
  references: [{ handle_or_url: "" }],
  wins: [],
  flops: [],
  cadence: null,
  todAware: false,
  pain: "",
};

/**
 * Persist a partial creator_profiles row for the authenticated user.
 *
 * Mirrors the `persistToSupabase` helper in `onboarding-store.ts` exactly —
 * browser Supabase client, `auth.getUser()` for the user_id, then
 * `.from('creator_profiles').update(updates).eq('user_id', user.id)`.
 *
 * T-02-02a mitigation: the user_id is ALWAYS derived from `auth.getUser()`
 * inside this helper — callers can never inject a foreign user_id. Combined
 * with the existing RLS policy on `creator_profiles`, this closes the IDOR
 * vector.
 */
async function persistCardData(
  updates: Record<string, unknown>
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthenticated");
  }

  // Cast: the 9-card columns (target_platforms, niche_primary, creator_stage,
  // profile_interview_seen_at, etc.) were added to creator_profiles by the
  // Plan 02-01 migration (20260517210000_creator_profile_9card_columns.sql)
  // but src/types/database.types.ts has not been regenerated. The columns
  // exist at runtime; the typed schema is stale. Plan 02-06 (DB-types regen)
  // cleans this up.
  const { error } = await supabase
    .from("creator_profiles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updates as any)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Profile update failed");
  }
}

/**
 * Map a card index (0..8) to the `creator_profiles` columns it owns.
 *
 * Empty-string filtering on Cards 5 and 6 matches the picker's synthesized
 * empty row convention — an untouched row produces an empty handle_or_url
 * and should not be persisted as a real entry.
 *
 * T-02-01b (partial mitigation): Card 8 trims whitespace and coerces empty
 * strings to NULL, but does NOT strip control characters. Full sanitation
 * lands at the Plan 02-05 API boundary (zod + control-char strip).
 */
function serializeCard(
  cardIdx: number,
  draft: InterviewDraft
): Record<string, unknown> {
  switch (cardIdx) {
    case 0:
      return { target_platforms: draft.platforms };
    case 1:
      return {
        niche_primary: draft.niche_primary,
        niche_sub: draft.niche_sub,
      };
    case 2:
      return { target_audience: draft.audience };
    case 3:
      return {
        primary_goal: draft.goal,
        creator_stage: draft.stage,
      };
    case 4:
      return {
        content_style: draft.style,
        cuts_per_second: draft.cuts,
      };
    case 5:
      return {
        reference_creators: draft.references.filter(
          (r) => r.handle_or_url.trim().length > 0
        ),
      };
    case 6:
      return {
        past_wins: draft.wins.filter((w) => w.url.trim().length > 0),
        past_flops: draft.flops.filter((f) => f.url.trim().length > 0),
      };
    case 7:
      return {
        posting_frequency: draft.cadence,
        time_of_day_aware: draft.todAware,
      };
    case 8:
      return { pain_points: draft.pain.trim() || null };
    default:
      return {};
  }
}

/**
 * Combine all 9 per-card serializations into a single payload for `finalize`.
 */
function serializeAllCards(
  draft: InterviewDraft
): Record<string, unknown> {
  return Object.assign(
    {},
    serializeCard(0, draft),
    serializeCard(1, draft),
    serializeCard(2, draft),
    serializeCard(3, draft),
    serializeCard(4, draft),
    serializeCard(5, draft),
    serializeCard(6, draft),
    serializeCard(7, draft),
    serializeCard(8, draft)
  );
}

/**
 * Card 5 side-effect — fire `addCompetitor` once per non-empty reference handle
 * with `source='profile_reference'`. Fire-and-forget per D-07: a bad handle or
 * scrape failure MUST NOT block the profile save flow.
 *
 * WR-03: `addCompetitor` returns `{ error?: string }` instead of throwing, so a
 * `.catch()` only sees framework/network failures — not documented error
 * returns ("TikTok handle not found", "Failed to track competitor", etc.). We
 * inspect the resolved value and `console.warn` on anything that is not the
 * benign "already tracking" branch so genuine scrape failures are observable.
 *
 * Normalization mirrors the manual-add path so the junction's
 * UNIQUE(user_id, competitor_id) constraint sees the same key in both flows.
 */
function fireReferenceCreatorAdds(
  entries: Array<{ handle_or_url: string }>
): void {
  for (const entry of entries) {
    const raw = entry.handle_or_url?.trim();
    if (!raw) continue;
    const normalized = normalizeHandle(raw);
    if (!normalized || normalized.length < 2) continue;
    // Fire-and-forget per D-07; mirror /api/profile/route.ts:132 pattern.
    void addCompetitor(normalized, "profile_reference")
      .then((result) => {
        if (
          result.error &&
          result.error !== "You are already tracking this competitor"
        ) {
          console.warn(
            "[profile-interview] reference creator add failed:",
            result.error
          );
        }
      })
      .catch((err) => {
        // Network / framework-level failures only — documented error returns
        // are handled in the `.then` above.
        console.warn(
          "[profile-interview] reference creator add threw:",
          err
        );
      });
  }
}

export const useProfileInterviewStore = create<ProfileInterviewState>(
  (set, get) => ({
    currentCard: 0,
    draft: INITIAL_DRAFT,
    isClosing: false,
    lastError: null,
    referencesFired: false,

    setDraftField: (key, value) => {
      set((state) => ({ draft: { ...state.draft, [key]: value } }));
    },

    // CR-02: only advance currentCard AFTER the per-card persist succeeds.
    // On failure, store the message on `lastError` so the modal can surface
    // an inline alert, and re-throw so the caller's loading state clears.
    // WR-04: Card 5 reference creators are fired here (post-persist) and
    // marked `referencesFired = true` so `finalize` does not double-fire.
    advanceCard: async () => {
      const { currentCard, draft, referencesFired } = get();
      try {
        await persistCardData(serializeCard(currentCard, draft));
        if (currentCard === 5 && !referencesFired) {
          fireReferenceCreatorAdds(draft.references);
          set({ referencesFired: true });
        }
        set({ currentCard: currentCard + 1, lastError: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        set({ lastError: message });
        throw err;
      }
    },

    skipCard: () => {
      set((state) => ({ currentCard: Math.min(state.currentCard + 1, 8) }));
    },

    goBack: () => {
      set((state) => ({
        currentCard: Math.max(0, state.currentCard - 1),
      }));
    },

    skipInterview: async () => {
      try {
        await persistCardData({
          profile_interview_seen_at: new Date().toISOString(),
        });
        set({ isClosing: true, lastError: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        set({ lastError: message });
        throw err;
      }
    },

    finalize: async () => {
      const { draft, referencesFired } = get();
      try {
        await persistCardData({
          ...serializeAllCards(draft),
          profile_interview_seen_at: new Date().toISOString(),
        });
        // WR-04 safety-net: only fire reference adds if `advanceCard` from
        // Card 5 did NOT already fire them this session. The 23505
        // idempotency on user_competitors still protects against a worst-
        // case double-fire, but this sentinel avoids the redundant call.
        if (!referencesFired) {
          fireReferenceCreatorAdds(draft.references);
          set({ referencesFired: true });
        }
        set({ isClosing: true, lastError: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        set({ lastError: message });
        throw err;
      }
    },

    clearError: () => {
      set({ lastError: null });
    },

    reset: () => {
      set({
        currentCard: 0,
        draft: INITIAL_DRAFT,
        isClosing: false,
        lastError: null,
        referencesFired: false,
      });
    },
  })
);
