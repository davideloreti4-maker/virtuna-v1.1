"use client";

/**
 * Composer — the slim universal home composer (SHELL-02/03/04, D-18/D-21/D-22/D-24).
 *
 * Deliberately NOT ContentForm (RESEARCH Pitfall 5): no Score/Remix intent
 * selector, no Apollo model-tier picker, no 3-mode tab set, no Instagram URL
 * acceptance. It reuses the validated sub-parts only:
 *   - VideoUpload (bare) for the `+` upload (its existing MP4/MOV + 200MB
 *     validation is the trust-boundary-adjacent UX check; the server re-validates).
 *   - A TikTok-only client URL check (D-21) mirroring the server regex at
 *     /api/analyze (route L465). Client = fast UX reject; server = trust boundary.
 *   - The proven submit -> create -> navigate loop lifted from Board.tsx
 *     (L300-345) — the home is NOT the Konva board, so this replicates that
 *     flow instead of importing Board.
 *
 * Two layouts (D-24), one component: centered when no Simulation exists
 * (the empty home), bottom-pinned once a Simulation exists (the permalink
 * route). The position is exposed via `data-layout` and read off the route id
 * (mirroring ContentForm's isOnResultRoute = !!params.id). What renders ABOVE
 * the pinned composer is Phase 2; the active follow-up BEHAVIOR is Phase 5 —
 * here it is just the input + the active placeholder.
 *
 * IDEAS ROUTING (Plan 04, D-12/D-07, Pitfall 5):
 *   When activeTool === "idea", submit routes to the Ideas pipeline via
 *   useIdeasStream.start() instead of stream.start. CRITICAL: the Idea path
 *   MUST NOT set pendingNavRef.current = true and MUST NOT call stream.start —
 *   those are exclusive to the Test upload/URL paths so an Idea send never
 *   navigates to /analyze/[id] (T-03-13, WR-05).
 *   The platform chip (D-07) sets the first-class platform param on the Ideas request.
 *   Client-side URL relax for the idea tool is UX-only; the server route independently
 *   validates the ask (WARNING-5, T-03-15).
 *
 *   useIdeasStream drives IdeasThreadView rendered above the composer when active.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { reportCredit402 } from "@/lib/billing/credit-wall";
import { createPortal } from "react-dom";
import { OpenRoomContext } from "@/lib/hook-test-context";
import { InThreadInputContext } from "@/lib/in-thread-input-context";
import { FollowupContext } from "@/lib/followup-context";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Plus } from "lucide-react";
import { Paperclip, X as XIcon } from "@phosphor-icons/react";
import { nanoid } from "nanoid";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { HORIZONTAL_ENABLED } from "@/lib/flags/horizontal";
import { AMBIENT_V2_ENABLED } from "@/lib/flags/ambient-v2";
import type { SimSealMap } from "@/lib/threads/sim-seals";
import { queryKeys } from "@/lib/queries/query-keys";
import {
  setActiveThreadCookie,
  getActiveThreadCookie,
  NEW_THREAD_SENTINEL,
} from "@/lib/threads/active-thread-cookie";
import { Button } from "@/components/ui/button";
import { VideoUpload } from "@/components/app/video-upload";
import { MessageBlocks } from "@/components/thread/message-blocks";
import { useAnalysisStream } from "@/hooks/queries/use-analysis-stream";
import { useSubscription } from "@/hooks/use-subscription";
import { isPaidPlanId, creditsRemainingLabel } from "@/lib/pricing";
import { useBoardStore } from "@/stores/board-store";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { createClient } from "@/lib/supabase/client";
import {
  ComposerControls,
  SimModelSelector,
  SkillRows,
  SKILLS,
  getSkill,
  isSkillVisible,
  type ToolId,
  type Intent,
  type SkillModel,
} from "./composer-controls";
import type { Platform } from "./platform-chip";
import type { Audience, AudiencePlatform } from "@/lib/audience/audience-types";
import { goalIntentToLens } from "@/lib/audience/intent-lens";
import { useIdeasStream } from "@/hooks/queries/use-ideas-stream";
import { IdeasThreadView } from "@/components/thread/ideas-thread-view";
import { useHooksStream } from "@/hooks/queries/use-hooks-stream";
import { HooksThreadView } from "@/components/thread/hooks-thread-view";
import { useChatStream } from "@/hooks/queries/use-chat-stream";
import { ChatThreadView } from "@/components/thread/chat-thread-view";
import { isChatAgentThread, orderedAssistantBlocks, orderedTurns } from "@/components/app/home/rehydrate-thread";
import type { RehydrateTurn } from "@/components/app/home/rehydrate-thread";
import { useScriptStream } from "@/hooks/queries/use-script-stream";
import { ScriptThreadView } from "@/components/thread/script-thread-view";
import { useRemixStream } from "@/hooks/queries/use-remix-stream";
import { RemixThreadView } from "@/components/thread/remix-thread-view";
import { useExploreStream } from "@/hooks/queries/use-explore-stream";
import { ExploreThreadView } from "@/components/thread/explore-thread-view";
import { useAccountReadStream } from "@/hooks/queries/use-account-read-stream";
import { AccountReadThreadView } from "@/components/thread/account-read-thread-view";
import { ThreadLoadingSkeleton } from "@/components/thread/thread-loading";
import { ThreadShell, ThreadAssistantTurn } from "@/components/thread/thread-shell";
import { Spinner } from "@/components/ui/spinner";
import { AudiencePresence, type AudienceAsk, type AudiencePresenceProps } from "@/components/audience-lens/audience-presence";
import { AmbientOverviewRail } from "@/components/audience-lens/v2/AmbientOverviewRail";
import { AmbientStartHome } from "@/components/audience-lens/v2/AmbientStartHome";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { BuildChooser } from "./build-chooser";
import { HomeStarter, HomeFirstRunDemo } from "./home-starter";
import { useAmbientFocus, type AmbientCardDescriptor } from "./use-ambient-focus";
import { buildAmbientDescriptors, resolveFocusDescriptor } from "./ambient-descriptors";
import { detectRefineIntent } from "@/lib/tools/refine";
// TikTok-only client check (D-21, WR-01). The pattern is the SHARED trust-
// boundary regex (src/lib/tiktok-url.ts) imported by BOTH the composer and the
// server /api/analyze route, so the fast UX reject can never drift from the
// server check. ContentForm's SOCIAL_URL_PATTERN ALSO allows Instagram — the
// slim composer must NOT (TikTok-only for v1).
import { TIKTOK_URL_PATTERN } from "@/lib/tiktok-url";
import type { Verb } from "@/lib/room-contract/types";
import { LAUNCH_PARAM } from "@/lib/room-contract/thread-launch";

// Matches a canonical v1–v5 UUID. Used to gate the per-thread audience pin: only a
// real audience-row UUID (or null=General) may PATCH threads.active_audience_id (uuid
// column); virtual preset ids like "preset-growth" must never reach it (would 500).
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Seam 4 (THE-CONTRACT.md §3) — the verb a surface launch carries → the /home skill it lands
// on. Make defaults to Hooks (the first Make skill), Test to the real-video Read, Ask to the
// room chat. One default per verb; the full verb↔skill SSOT is VERB_BY_TOOL (composer-controls).
const LAUNCH_VERB_TOOL: Record<Verb, ToolId> = {
  Make: "hooks",
  Test: "test",
  Ask: "chat",
};

// Copy — UI-SPEC § Copywriting (all [UAT], lock at THEME-06).
/**
 * The quota wall, loaded ONLY when someone actually hits it.
 *
 * Statically imported, this pulls `CheckoutModal` → `@whop/checkout/react` (a 328KB package)
 * into the bundle of /home — the app's hottest route — to render a dialog that appears when a
 * customer runs out of credits, i.e. almost never, and today literally never (enforcement is
 * off). Every visitor was paying to download a checkout embed they will not see.
 */
const ReadingLimitDialog = dynamic(
  () => import("@/components/app/reading-limit-dialog").then((m) => m.ReadingLimitDialog),
  { ssr: false }
);

const PLACEHOLDER_EMPTY = "Paste a TikTok link or drop a video…";
const PLACEHOLDER_ACTIVE = "Ask about this simulation…";
const ERROR_NON_TIKTOK =
  "Maven reads TikTok videos for now. Paste a TikTok link or upload the file.";
// WR-04 — Test upload pre-flight failures. These branches return BEFORE stream.start,
// so stream.phase never owns the error; without these the button just went dead-quiet.
const ERROR_SESSION_EXPIRED =
  "Your session expired. Refresh the page and sign in again to run this.";
const ERROR_UPLOAD_FAILED =
  "That upload didn't go through. Check your connection and try again.";

/**
 * The front door. The app used to open on `test`, so a brand-new thread greeted the creator
 * with "Paste a TikTok link or drop a video…" — a demand for an asset before they had said a
 * word, and the narrowest of the eight skills. Chat is the one skill that takes a plain
 * sentence, so it is the honest default; every other skill is one pick away.
 *
 * This is the fallback for a thread with nothing to restore from, too (see the rehydration
 * restore) — a new thread lands here, never on whatever the last thread happened to be.
 */
const DEFAULT_TOOL: ToolId = "chat";

// Placeholder copy per tool.
//
// ⚠️ THE PLACEHOLDER IS NOW THE PER-SKILL INSTRUCTION. The starter grid is the same six
// cards under every skill (THE STARTER CONTRACT), so it no longer teaches what the ARMED
// skill wants from you — this map is the only thing that does. Each line must therefore
// answer "what do I type here, and what happens if I don't?" in the creator's words. A
// vague placeholder ("Ask anything…") is now a dead end, not a small blemish.
const PLACEHOLDER_BY_TOOL: Record<ToolId, string> = {
  test: PLACEHOLDER_EMPTY,
  // Account takes NO input — the read resolves your own handle. Send runs it.
  account: "No input needed — press send and I'll read your latest posts…",
  idea: "A topic to build ideas around — or leave empty and I'll pick the angles…",
  hooks: "A topic to write hooks for — or leave empty and I'll pick the angles…",
  chat: "Ask about your niche, your audience, or an idea you're weighing…",
  // Ask the room (replaces the old `audienceOpen` "Ask your audience…" mode placeholder).
  // Placement-neutral: the room is a rail (≥xl) / header (<xl), never literally "below".
  ask: "Type a thought and watch the whole room react…",
  script: "A topic to script — or leave empty to carry in the hook you picked…",
  remix: "Paste a TikTok URL — I'll decode why it worked, then rebuild it as yours…",
  explore: "A niche or competitor to scan — or leave empty and I'll pull your niche…",
  // Not-yet-shipped skills (P11/P16) — render as disabled rows in the selector,
  // so these placeholders are never actually reached (kept for the Record contract).
  offer: "Describe a product, price, or positioning to validate…",
  ad: "Paste an ad concept to pre-flight, ROAS-framed…",
  // General verbs (P7 / UX-02) — surfaced only when a General audience is active.
  // The host wiring + per-skill submit semantics land in 07-04; until then the
  // default mode is "socials" so these placeholders are never reached, but the
  // widened ToolId Record contract requires them.
  profile: "Drop a chat or screenshot to build a SIM…",
  simulate: "Type a draft to run through your audience…",
  predict: "Describe a scenario for the analyst panel to read…",
};

// Map an audience's platform to the composer Platform union (custom → tiktok).
function audienceToPlatform(p?: AudiencePlatform | null): Platform {
  return p === "instagram" || p === "youtube" ? p : "tiktok";
}

// ── Evidence-drop affordance (D-07 / 05-UI-SPEC Surface 3) ───────────────────
// A MINIMAL, ADDITIVE "drop a chat / screenshot" control on the existing composer.
// It stages a single file (.txt/.md / image / short video — D-09) and POSTs it as
// the evidence stimulus to /api/tools/profile (built in 05-04). The creator (Socials)
// path stays byte-identical — this is a sibling flow, never a rewrite of the field
// /tool selector / submit handlers. Copy is verbatim from the UI-SPEC copywriting contract.
const EVIDENCE_ACCEPT = ".txt,.md,text/plain,text/markdown,image/*,video/*";
const EVIDENCE_ATTACH_LABEL = "Attach a chat or screenshot";
const EVIDENCE_DROP_HINT = "Drop a chat export, screenshot, or short clip";
const EVIDENCE_UNSUPPORTED =
  "That file type isn't supported yet — use a .txt/.md export, an image, or a short video.";
const EVIDENCE_RUN_FAILED =
  "That read didn't come through. Try again, or share a bit more of the conversation.";

type EvidenceKind = "file_text" | "image" | "video";

// Map a staged file to its /api/tools/profile evidence kind. .docx/.pdf (and any
// other type) → null (the inline-rejected, D-09). The server re-validates — this
// client check is convenience UX, never the trust boundary (T-05-18).
function classifyEvidence(file: File): EvidenceKind | null {
  const name = file.name.toLowerCase();
  const type = file.type;
  if (name.endsWith(".txt") || name.endsWith(".md") || type === "text/plain" || type === "text/markdown") {
    return "file_text";
  }
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  return null;
}

// Read a file to a bare base64 string (strip the data: URL prefix) so file_text/image
// evidence rides the application/json profile body (mirrors the route's base64 contract).
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("read failed"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export interface ComposerProps {
  className?: string;
  /** Called whenever the thread-content presence changes (ideas or hooks cards exist/disappear).
   *  Parent (HomePageLayout) uses this to switch between centered and full-height layout. */
  onThreadChange?: (hasThread: boolean) => void;
  /** Called when conversation content exists (blocks, streaming, or a submitted turn).
   *  Parent uses this to hide the empty-state welcome hero. */
  onConversationChange?: (hasConversation: boolean) => void;
  /** Called while a thread-switch is rehydrating (A1). Parent keeps the thread shell
   *  mounted + suppresses the welcome hero during the load gap so the layout never
   *  collapses to the centered serif hero between threads. */
  onRehydratingChange?: (rehydrating: boolean) => void;
  /** P2 (A2a) — the desktop RIGHT-RAIL host owned by HomePageLayout. When present (≥xl, thread
   *  mode) the audience room re-parents OUT of the bottom dock and is PORTALED here (state stays
   *  in the composer; only the DOM owner changes). Null/absent ⇒ the dock keeps the room (the
   *  <xl header path lands in A2b). Exactly one AmbientRoom mounts either way. */
  railHost?: HTMLElement | null;
}

export function Composer({ className, onThreadChange, onConversationChange, onRehydratingChange, railHost = null }: ComposerProps) {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  // P2 (A2a): ≥xl the room lives in HomePageLayout's rail, not the dock. useMediaQuery is SSR-safe
  // (false until mounted) + railHost is null until the aside mounts, so the portal only engages
  // post-mount on a wide thread view; every other state keeps the dock room byte-identical.
  const isXl = useMediaQuery("(min-width: 1280px)");
  const useRail = isXl && railHost != null;
  // The audience presence docks above the composer as a peek→bloom card — EXCEPT ≥xl in thread
  // mode, where P2 (A2a) re-parents it into HomePageLayout's persistent right rail (portaled; see
  // `useRail`). The dock room and the rail room are mutually exclusive on the same `useRail` flag,
  // so exactly ONE AmbientRoom ever mounts — never a hidden second one running its timers.
  // (The <xl header path lands in A2b; until then <xl keeps the dock peek unchanged.)

  // Layout signal: does a Simulation exist? Mirrors ContentForm L158.
  const params = useParams();
  const hasSimulation =
    !!params && typeof (params as { id?: unknown }).id === "string";
  const layout = hasSimulation ? "pinned" : "centered";

  const stream = useAnalysisStream();

  // ── The Reading balance (billing) ───────────────────────────────────────────
  // A Reading is the unit the plans are sold on, so the count belongs where a Reading is
  // actually spent. Refetched when a run completes, so the number under the composer is what
  // they have LEFT, not what they had before pressing the button.
  const { usage, isTrial, tier: billingTier, refetch: refetchBalance } = useSubscription();

  useEffect(() => {
    if (stream.phase === "complete") void refetchBalance();
  }, [stream.phase, refetchBalance]);

  // Shown only when there is a countable balance to show: a paid plan or a trial pool. `free`
  // has an allowance of 0 by design (no free plan), and "0 of 0 credits left" under the
  // composer would read as a bug rather than a price. Studio's unlimited has no number worth
  // printing on every screen either.
  const readingsBalanceLabel =
    usage && usage.limit !== null && (isPaidPlanId(billingTier) || isTrial)
      ? creditsRemainingLabel(usage)
      : null;

  // A footnote until it starts to bite — then it earns a semantic tone (the dosage rule: a
  // balance is not a place for brand colour).
  const remainingReadings = usage?.remaining ?? 0;
  const readingsBalanceTone =
    usage?.limit && remainingReadings === 0
      ? "text-error"
      : usage?.limit && remainingReadings <= Math.max(1, usage.limit * 0.2)
        ? "text-warning"
        : "text-foreground-muted";

  // ── Tool chip state (D-06/D-07) ─────────────────────────────────────────────
  // activeTool drives the placeholder + active-model field (D-09).
  // Default: "test" — the only live tool in P1 (D-08). Idea live in P3 (D-12).
  // NOTE: chip selection is NOT a submit; it MUST NEVER arm pendingNavRef (Pitfall #5).
  const [activeTool, setActiveTool] = useState<ToolId>(DEFAULT_TOOL);
  // SIM-1 tier picker — defaults from the armed skill; creator override persists until
  // the skill changes. UI-only for now (routing still skill-driven).
  const [selectedModel, setSelectedModel] = useState<SkillModel>("Flash");
  // Tracks whether the creator has manually picked a tool this mount. Guards the
  // open-thread rehydration's activeTool RESTORE (below) so it never overrides a
  // deliberate pick made while the GET /api/threads/open fetch was in flight.
  const hasUserSelectedToolRef = useRef(false);
  // Tracks whether the creator has picked an audience this mount. Guards the mount-time
  // seed of selectedAudienceId from the user-level last-used audience (the audiences fetch
  // below) so a deliberate pick made while that fetch was in flight always wins.
  const hasUserSelectedAudienceRef = useRef(false);
  // Seam 4 — one-shot guard for the launch-seed inlet (below): a surface handoff
  // (/home?v=…&seed=…&run=1) is consumed exactly once per mount.
  const seedConsumedRef = useRef(false);
  // Armed by the seed inlet when the launched verb is runnable + run=1; a separate effect
  // fires the skill once the seeded field + tool have committed (so handleSubmit reads them).
  const [pendingAutoRun, setPendingAutoRun] = useState(false);
  // Evidence-drop file input (D-07) — declared here (ahead of the rest of the
  // evidence state) so handleUserSelectTool can open the Profile evidence picker
  // within the user-gesture call stack (a file input .click() must ride a real
  // user gesture; an effect can't open it). The input itself is rendered below.
  const evidenceInputRef = useRef<HTMLInputElement | null>(null);
  // Whether the Test upload drop zone is revealed. Test ABSORBS upload (v6 — §3.5): the
  // zone shows when the creator INTENTIONALLY enters Test (picks the verb, or a hook /
  // script "Test full →" handoff) — NOT on the bare default, so the empty home stays a
  // clean topic composer (the prototype's default). A staged file also forces it visible.
  const [showUpload, setShowUpload] = useState(false);
  // Wrap every USER-initiated tool pick (slash menu + chip picker) so the restore
  // guard above flips. Programmatic switches (handoffs, refine) intentionally do NOT
  // flip it — they are not the creator choosing where to land on reload.
  const handleUserSelectTool = useCallback((id: ToolId) => {
    hasUserSelectedToolRef.current = true;
    setActiveTool(id);
    // Test absorbs upload (v6): reveal the drop zone when Test is explicitly chosen;
    // hide it for any other verb so the clean field-only composer returns.
    setShowUpload(id === "test");
    // ── Profile (07-04 / D-07): General "Profile" is NOT a topic submit ─────────
    // Selecting Profile opens the existing evidence-drop affordance (drop a chat /
    // screenshot / clip → POST /api/tools/profile) instead of arming the topic field.
    // This runs inside the menu/slash click gesture, so the file picker is allowed.
    if (id === "profile") {
      evidenceInputRef.current?.click();
    }
  }, []);

  // Ambient v2 Start (④) home: its own composer row seeds the field + arms the one-shot auto-run,
  // so a Start submit fires the armed skill through the SAME handleSubmit path as the legacy field.
  const seedAndRun = useCallback((text: string) => {
    const t = text.trim();
    if (t.length === 0) return;
    setUrl(t);
    setPendingAutoRun(true);
  }, []);

  // Ambient v2 Start (④, option B): picking a skill from the default grid ARMS the tool AND drops the
  // creator into the thread composer to write the topic — `startEngaged` swaps the grid → the field.
  const [startEngaged, setStartEngaged] = useState(false);
  // Ambient v2 Phase D/C: sealed-sim results for the open thread (trimmed concept text → the full
  // seal: measured would-stop % + the Phase-C population/personas depth), rehydrated from
  // `threads.sim_seals` so BOTH the v2 Overview seal AND the audience-depth drill survive a reload.
  const [persistedSimSeals, setPersistedSimSeals] = useState<SimSealMap>({});
  const pickStartSkill = useCallback(
    (id: string) => {
      handleUserSelectTool(id as ToolId);
      setStartEngaged(true);
    },
    [handleUserSelectTool],
  );

  // Reset model tier when the armed skill changes (skill is SSOT for default).
  useEffect(() => {
    setSelectedModel(getSkill(activeTool).model);
  }, [activeTool]);

  // ── Audience + intent state (UX-01) ────────────────────────────────────────
  // Audience is the shared substrate across skills (the moat). Platform is no
  // longer a separate control — it is DERIVED from the selected audience
  // (each audience carries its platform); General → tiktok default (D-07).
  // Intent (grow ⇄ sell) is the per-run reaction LENS (GAP-C2 / §P.10): defaulted from the
  // active audience's goal_intent (4→2) and sent to the skill routes, where it re-frames the
  // SIM verdict (sell → buying lens) for a calibrated audience. General → no-op.
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [selectedAudienceId, setSelectedAudienceId] = useState<string | null>(null); // null = General
  // ── Build-an-audience chooser (UX-04 / D-03 / D-08) ─────────────────────────
  // The picker's `+ Build an audience` row (07-02 onBuildAudience) opens this S3 chooser.
  const [buildOpen, setBuildOpen] = useState(false);

  // ── Audience PRESENCE panel state (P13, redesigned 2026-06-21; mode killed 2026-07-18) ─────
  // `roomExpanded` is now PURELY VISUAL: it blooms the dock peek (empty/permalink) and expands
  // the <xl header sheet — nothing more. It used to be `audienceOpen`, a fused flag that ALSO
  // put the composer field into a hidden "ask the room" input MODE. That mode is dead: after P2
  // the room is always present, so a permanently-open rail made handleSubmit unreachable. Asking
  // the room is now the explicit `ask` VERB (activeTool === "ask" → askAudience). The rail (≥xl)
  // ignores this flag entirely (persistent, in-flow), so it's only the dock + header that read it.
  const [roomExpanded, setRoomExpanded] = useState(false);
  // Asking the room is a composer VERB now, not a panel mode: when the `ask` skill is armed, the
  // field's submit/keydown route to askAudience and the placeholder/send-button say "ask", while
  // the room stays visually wherever P2 placed it. One boolean, read everywhere the old mode was.
  const isAsk = activeTool === "ask";
  // True while the presence was opened by a card's "See the room →" (a targeted single-card
  // entry) → the Room drills straight into that card instead of the ranked overview. Reset on
  // close so the next plain tab-tap opens the overview (the default bloom).
  const [roomDrill, setRoomDrill] = useState(false);
  // Wrap the expand/collapse setter so collapsing always clears the drill intent.
  const handleRoomExpandedChange = useCallback((next: boolean) => {
    setRoomExpanded(next);
    if (!next) setRoomDrill(false);
  }, []);
  const [audienceAsks, setAudienceAsks] = useState<AudienceAsk[]>([]);
  const [asking, setAsking] = useState(false);

  const selectedAudience = audiences.find((a) => a.id === selectedAudienceId) ?? null;
  // The RESOLVED audience: `selectedAudienceId === null` means the General default (a virtual
  // constant absent from the `audiences` rows), so `selectedAudience` is null there. Fall back to
  // GENERAL_AUDIENCE so surfaces that need a concrete audience (the Ambient v2 Start/Overview) always
  // have one — mirrors how AudiencePresence treats a null audience as General internally.
  const effectiveAudience = selectedAudience ?? GENERAL_AUDIENCE;
  // Sent as the first-class platform param to the skill routes (derived, not picked).
  const platform: Platform = audienceToPlatform(selectedAudience?.platform);

  // Task C (v6): intent is a PROPERTY OF THE AUDIENCE's goal (goal_intent → grow/sell lens),
  // never a per-run composer toggle (the Grow/Sell control retired — THE-ROOM-HANDOFF §3.5).
  // Switching audience swaps the lens automatically. Still sent to the skill routes + askAudience
  // (a calibrated audience re-frames the SIM verdict; General → no-op).
  const intent: Intent = goalIntentToLens(selectedAudience?.goal_intent ?? null);

  // ── Open thread id (07-05 — D-04 per-thread pin for AudienceChip) ───────────
  // Captured on mount from GET /api/threads/open (returns threadId).
  // Null before first thread is created (first Ideas/Hooks send creates it).
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);

  // ── Active-thread switch signal (multi-thread chat history) ─────────────────
  // Bumped by the sidebar when the user opens a new thread or re-opens a past
  // one. The rehydration effect below watches it to clear the current thread's
  // rendered content (live + persisted) and reload the now-active open thread —
  // the in-memory equivalent of a remount when navigating /home → /home.
  const activeThreadSignal = useBoardStore((s) => s.activeThreadSignal);
  const setActiveThreadId = useBoardStore((s) => s.setActiveThreadId);
  const queryClient = useQueryClient();
  const isFirstThreadLoadRef = useRef(true);

  // ── Persisted open-thread blocks (Task 3 — D-14/THREAD-07 rehydration) ─────
  // Loaded on mount from GET /api/threads/open. Declared before the view gates
  // below so showIdeasView/showHooksView can include them (no TDZ reference).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [persistedIdeaBlocks, setPersistedIdeaBlocks] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [persistedHookBlocks, setPersistedHookBlocks] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [persistedChatBlocks, setPersistedChatBlocks] = useState<any[]>([]);
  // Chat-as-agent unified reload (CHAT_AGENT_DISPATCH): the thread's ordered TURNS (each question + the
  // cards/co-pilot line it produced), from rehydrate-thread.ts. Non-empty ONLY for chat-agent threads →
  // the chat view renders each question above only its own answer (multi-turn reload fidelity) instead
  // of segregating cards into per-tool views.
  const [persistedChatTurns, setPersistedChatTurns] = useState<RehydrateTurn[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [persistedScriptBlocks, setPersistedScriptBlocks] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [persistedRemixBlocks, setPersistedRemixBlocks] = useState<any[]>([]);
  // Explore persisted grids (Plan 11-07 — filter b.type === 'outlier-grid' on mount).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [persistedExploreBlocks, setPersistedExploreBlocks] = useState<any[]>([]);
  // Profile-read + reaction-distribution blocks (05-06 — D-07). Rendered in-thread by
  // MessageBlocks regardless of activeTool; declared here (before hasThread) so the
  // thread-presence signal can include them without a TDZ reference.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [persistedProfileBlocks, setPersistedProfileBlocks] = useState<any[]>([]);

  // ── Thread-switch rehydration flag (A1 — premium-thread Chunk 1) ───────────
  // True for the window between a thread SWITCH and the persisted blocks landing.
  // Set synchronously at the top of the [activeThreadSignal] effect (before the
  // wipes) and cleared when loadPersistedBlocks settles. Keeps the thread shell
  // mounted + suppresses the welcome hero across the gap so the layout never snaps
  // to the centered serif hero between threads (the worst pre-fix flash).
  const [rehydrating, setRehydrating] = useState(false);

  // ── Ideas stream (Plan 04, Task 2) ────────────────────────────────────────
  // Provides SSE cards rendered above the composer in IdeasThreadView.
  // CRITICAL: ideas.start() NEVER arms pendingNavRef/stream.start (T-03-13).
  const ideas = useIdeasStream();
  const ideasBlocks = ideas.toBlocks();
  const showIdeasView =
    activeTool === "idea" &&
    (ideas.isStreaming || ideasBlocks.length > 0 || ideas.error !== null || persistedIdeaBlocks.length > 0);

  // ── Hooks stream (Plan 04-03, Task 1 — D-09) ──────────────────────────────
  // Provides SSE hook-card blocks rendered above the composer in HooksThreadView.
  // CRITICAL: hooks.start() NEVER arms pendingNavRef/stream.start (T-03-13/T-04-13).
  const hooks = useHooksStream();
  const hooksBlocks = hooks.toBlocks();
  const showHooksView =
    activeTool === "hooks" &&
    (hooks.isStreaming || hooksBlocks.length > 0 || hooks.error !== null || persistedHookBlocks.length > 0);

  // ── Chat stream (Plan 05-03, Task 2 — D-05/D-08) ─────────────────────────
  // Provides SSE markdown turns rendered above the composer in ChatThreadView.
  // CRITICAL: chat.start() NEVER arms pendingNavRef/stream.start — chat send
  // NEVER navigates to /analyze (D-05, no silent auto-fire).
  const chat = useChatStream();
  const chatBlocks = chat.toBlocks();
  // Chat view shows when the chat chip is active AND there is (or will be) something to
  // paint — a live stream, streamed/persisted turns, or an error. It used to mount
  // unconditionally "for its own empty state", but its empty state is 48px of ThreadShell
  // padding rendering as a dead band between the hero and the composer (measured
  // live 2026-07-20). The starter owns the empty home; this view owns turns.
  const showChatView =
    activeTool === "chat" &&
    (chat.isStreaming ||
      chatBlocks.length > 0 ||
      chat.error !== null ||
      persistedChatBlocks.length > 0 ||
      persistedChatTurns.length > 0);

  // ── Script stream (Plan 06-05 — D-09) ─────────────────────────────────────
  // Provides SSE script-card blocks rendered above the composer in ScriptThreadView.
  // CRITICAL: script.start() NEVER arms pendingNavRef/stream.start (T-03-13/T-06-20).
  const script = useScriptStream();
  const scriptBlocks = script.toBlocks();
  const showScriptView =
    activeTool === "script" &&
    (script.isStreaming || scriptBlocks.length > 0 || script.error !== null || persistedScriptBlocks.length > 0);

  // ── Remix stream (Plan 06-05 — REMIX-01) ──────────────────────────────────
  // Provides SSE remix-card blocks rendered above the composer in RemixThreadView.
  // CRITICAL: remix.start() NEVER arms pendingNavRef/stream.start (T-03-13/T-06-20).
  const remix = useRemixStream();
  const remixBlocks = remix.toBlocks();
  const showRemixView =
    activeTool === "remix" &&
    (remix.isStreaming || remixBlocks.length > 0 || remix.error !== null || persistedRemixBlocks.length > 0);

  // ── Explore stream (Plan 11-07 — EXPLORE-01/02/04) ─────────────────────────
  // Provides the SSE outlier-grid block rendered above the composer in
  // ExploreThreadView. CRITICAL: explore.start() NEVER arms pendingNavRef/stream.start
  // (Pitfall 1 — Explore renders in-thread in /home, NEVER navigates to /analyze/[id]).
  const explore = useExploreStream();
  const exploreBlocks = explore.toBlocks();
  // Account Read (A5) — one-tap self-Read; owns its idle CTA + profile-shaped skeleton.
  const account = useAccountReadStream();
  // Explore view ALWAYS shows when the explore chip is active (it owns its idle
  // quick-actions, exactly like ChatThreadView — D-07/EXPLORE-04, unconditional gate).
  const showExploreView = activeTool === "explore";
  const showAccountView = activeTool === "account";
  // Account content = streaming or a result block (does NOT flip on tool selection alone).
  const hasAccountContent = account.isStreaming || account.block !== null;

  // The Account starter card ARMS the skill and RUNS it in one tap. The other five cards arm
  // and stop, because the other five skills need the field; Account takes no input, so arming
  // alone would leave the creator in front of a composer with nothing to type. Declared here
  // (after `account`, not up beside handleUserSelectTool) so it closes over a live binding
  // rather than a TDZ one. It spends a Reading — so it fires from the creator's tap, never a
  // render (D-05).
  const handleStarterAccountRun = useCallback(() => {
    handleUserSelectTool("account");
    void account.start();
  }, [handleUserSelectTool, account]);


  // ── Thread-presence signal (UX-pin fix, post-UAT) ─────────────────────────
  // True when any idea/hook thread content exists to show (streaming or persisted).
  // Used by page-level layout (HomePageLayout) to switch to the full-height
  // chat-app layout (thread scrolls above, form pinned at bottom).
  // Declared AFTER all stream/block/persisted state is live (no TDZ).
  const hasThread =
    ideas.isStreaming ||
    hooks.isStreaming ||
    chat.isStreaming ||
    script.isStreaming ||
    remix.isStreaming ||
    explore.isStreaming ||
    ideasBlocks.length > 0 ||
    hooksBlocks.length > 0 ||
    chatBlocks.length > 0 ||
    chat.streamingBlocks.length > 0 || // chat-as-agent dispatched skill cards (CHAT_AGENT_DISPATCH)
    scriptBlocks.length > 0 ||
    remixBlocks.length > 0 ||
    exploreBlocks.length > 0 ||
    persistedIdeaBlocks.length > 0 ||
    persistedHookBlocks.length > 0 ||
    persistedChatBlocks.length > 0 ||
    persistedScriptBlocks.length > 0 ||
    persistedRemixBlocks.length > 0 ||
    persistedExploreBlocks.length > 0 ||
    persistedProfileBlocks.length > 0 || // profile-read / reaction-distribution (05-06)
    hasAccountContent;
  // ⚠️ DO NOT re-add `showChatView || showExploreView || showAccountView` here.
  // Arming a skill is not a thread. Those three lines used to flip hasThread on TOOL
  // SELECTION ALONE (they were the only skills owning an idle view), which tore the empty
  // home in half: HomePageLayout reads hasThread and hasConversation SEPARATELY, so
  // threadMode dropped the `justify-center` and stretched the composer to the bottom while
  // emptyHome kept rendering the greeting — greeting pinned top, composer pinned bottom, a
  // dead gap between, and Ask/Explore/Account each looked like a different app from Make.
  // hasThread now means what it says: real content exists (streaming or persisted).
  // The idle offer for those three skills is the starter (THE STARTER CONTRACT), which the
  // composer renders in BOTH branches — so nothing is lost by not lying here.

  // Notify parent whenever thread presence changes (HomePageLayout uses this).
  useEffect(() => {
    onThreadChange?.(hasThread);
  }, [hasThread, onThreadChange]);

  // ── Test brief state (Task 2 — D-05/D-06 handoff) ─────────────────────────
  // When "Test full →" is clicked on a hook card, we switch to the Test tool
  // and store the chosen hook as a visible brief above the upload affordance.
  const [testBrief, setTestBrief] = useState<{ hookLine: string; audienceArchetype: string } | null>(null);

  // ── Script anchor hook (PR-2 — conversational intro) ───────────────────────
  // The hook carried into a script run via the hooks→script handoff. Surfaced to the
  // ScriptThreadView so the intro can honestly cite the input hook ("Writing a script
  // from \"…\""). Null for a direct topic send (no anchor hook) → thinner intro.
  const [scriptAnchorHook, setScriptAnchorHook] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // WR-04 — Test upload pre-flight error (session-expired / storage-upload failure).
  // The URL path uses showUrlError; the analysis stream owns post-start errors. This
  // covers the gap where the upload path returns before stream.start (was a silent no-op).
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Evidence-drop affordance state (D-07 — additive Profile inbox) ──────────
  // evidenceFile = the staged chat/screenshot/clip; evidenceError = the inline
  // muted reject (D-09 unsupported type); dragOver = the drag overlay; profiling =
  // the /api/tools/profile POST in flight. persistedProfileBlocks = the profile-read
  // + reaction-distribution blocks rendered in the thread (loaded from the open thread).
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [profiling, setProfiling] = useState(false);
  // (evidenceInputRef is declared above, near activeTool, so handleUserSelectTool
  //  can open the Profile evidence picker within the user-gesture call stack.)
  /** Optimistic echo of the last submitted composer draft (presentation-only). */
  const [lastUserTurn, setLastUserTurn] = useState<string | null>(null);

  // True when the user has sent or the model has generated thread content.
  // Unlike hasThread, does NOT flip on tool selection alone (Explore/Chat idle views).
  const hasConversationContent =
    ideas.isStreaming ||
    hooks.isStreaming ||
    chat.isStreaming ||
    script.isStreaming ||
    remix.isStreaming ||
    explore.isStreaming ||
    ideasBlocks.length > 0 ||
    hooksBlocks.length > 0 ||
    chatBlocks.length > 0 ||
    chat.streamingBlocks.length > 0 || // chat-as-agent dispatched skill cards (CHAT_AGENT_DISPATCH)
    scriptBlocks.length > 0 ||
    remixBlocks.length > 0 ||
    exploreBlocks.length > 0 ||
    persistedIdeaBlocks.length > 0 ||
    persistedHookBlocks.length > 0 ||
    persistedChatBlocks.length > 0 ||
    persistedScriptBlocks.length > 0 ||
    persistedRemixBlocks.length > 0 ||
    persistedExploreBlocks.length > 0 ||
    persistedProfileBlocks.length > 0 || // profile-read / reaction-distribution (05-06)
    hasAccountContent ||
    !!lastUserTurn;

  // Notify parent whenever conversation content changes (welcome hero visibility).
  useEffect(() => {
    onConversationChange?.(hasConversationContent);
  }, [hasConversationContent, onConversationChange]);

  // A1: notify parent of the rehydrate window so HomePageLayout keeps the thread
  // shell mounted + suppresses the welcome hero during a thread switch (the gate is
  // `!hasConversation && !rehydrating` for the hero, `hasThread || rehydrating` for
  // the layout). Both this and the conversation flip batch into one parent render.
  useEffect(() => {
    onRehydratingChange?.(rehydrating);
  }, [rehydrating, onRehydratingChange]);

  // URL validity: empty is "neutral" (no error, just disabled); non-empty +
  // non-TikTok shows the D-21 reject; a valid TikTok URL enables submit.
  const trimmedUrl = url.trim();
  const hasUrl = trimmedUrl.length > 0;
  const isValidTikTok = hasUrl && TIKTOK_URL_PATTERN.test(trimmedUrl);
  const showUrlError = hasUrl && !isValidTikTok && activeTool === "test";

  // Submit is enabled:
  //  - Test tool: valid TikTok URL OR staged upload, not mid-submit.
  //  - Idea tool: always (empty = Auto; typed = seeded). Not mid-submit/streaming.
  //  - Hooks tool: always (empty = Auto/anchored; typed = seeded — D-09).
  //    VALIDATION: server independently caps ask length (WARNING-5, T-03-15).
  const canSubmit = activeTool === "idea"
    ? !submitting && !ideas.isStreaming
    : activeTool === "hooks"
      ? !submitting && !hooks.isStreaming
      : activeTool === "chat"
        ? !submitting && !chat.isStreaming && trimmedUrl.length > 0
        // Script: empty ask allowed when an anchor is carried (hooks→script card-POST seam)
        : activeTool === "script"
          ? !submitting && !script.isStreaming
          // Remix: URL required (canSubmit gates on trimmedUrl.length > 0 per plan spec)
          : activeTool === "remix"
            ? !submitting && !remix.isStreaming && trimmedUrl.length > 0
            // Explore: field-send optional (empty = un-niched pull); gate only on stream state.
            : activeTool === "explore"
              ? !submitting && !explore.isStreaming
              // Simulate / Predict (07-04): a non-empty draft is required to enable the
              // button; the SELECTED-GENERAL-AUDIENCE requirement is the handleSubmit gate
              // (fire vs route-to-Build) so the button can still redirect to Build rather
              // than dead-ending. The server is the real trust boundary (T-07-04-01).
              : activeTool === "simulate" || activeTool === "predict"
                ? !submitting && trimmedUrl.length > 0
                // Account: takes NO input — the read resolves your own handle server-side.
                // It used to be unsubmittable (`false`), which made an in-view CTA its only
                // door; that CTA was the thing forcing the starter to carry a bespoke
                // per-skill card. Send now RUNS it, so the skill has a door in every state
                // (fresh home, live thread, keyboard) and the starter needs no exception.
                // The empty field is not a missing input — there is no input.
                : activeTool === "account"
                  ? !submitting && !account.isStreaming
                  // Profile (07-04): never depends on the topic field — the evidence-drop
                  // affordance is the entry (handled in onSubmitForm via evidenceFile). The
                  // bare topic submit is inert for Profile.
                  : activeTool === "profile"
                    ? false
                    : (isValidTikTok || file !== null) && !submitting;

  // ── Open-thread rehydration (Task 3 — D-14/THREAD-07) ─────────────────────
  // On mount, fetch the user's open-thread messages from GET /api/threads/open
  // and split into idea-card + hook-card blocks for their respective thread views.
  // Guard: unauthenticated → 401 → silent (no crash; views render nothing extra).
  // Does NOT block the composer render (views already no-op when idle).
  useEffect(() => {
    let cancelled = false;

    // On a thread SWITCH (not the initial mount), wipe the current thread's
    // rendered content first so the previous conversation never bleeds into the
    // new/re-opened one. The fetch below repopulates persisted blocks for a
    // re-opened thread, or leaves everything blank for a brand-new thread.
    if (!isFirstThreadLoadRef.current) {
      // A1: flag the rehydrate FIRST — in the SAME render batch as the wipes — so the
      // thread shell stays mounted and the hero is suppressed before any block array
      // empties. Without this, hasThread/hasConversationContent flip false for the
      // fetch duration and the layout collapses to the centered serif welcome-hero.
      setRehydrating(true);
      chat.reset();
      ideas.reset();
      hooks.reset();
      script.reset();
      remix.reset();
      explore.reset();
      account.reset();
      setLastUserTurn(null);
      setPersistedIdeaBlocks([]);
      setPersistedHookBlocks([]);
      setPersistedChatBlocks([]);
      // Clear the chat-agent turns too — without this, "New Thread" kept the prior chat-agent thread's
      // turns rendering under the fresh thread until the reload fetch resolved.
      setPersistedChatTurns([]);
      setPersistedScriptBlocks([]);
      setPersistedRemixBlocks([]);
      setPersistedExploreBlocks([]);
      setScriptAnchorHook(null);
      setOpenThreadId(null);
      // The ambient room's typed-thought focus, ask ledger, and drill flag are PER-THREAD
      // state — without this wipe the previous thread's read (thought + score) stays in
      // focus over the fresh/re-opened thread, and the idle "meet your room" cast never
      // shows on a new thread. Card focuses need no wipe (descriptors empty themselves).
      focusByThought(null);
      setAudienceAsks([]);
      setRoomDrill(false);
      // Ambient v2 (AMBIENT_V2_ENABLED): a thread switch to a brand-new/empty thread must land
      // back on the Start grid, not the post-pick fresh-chat home. `startEngaged` is per-session
      // UI state, so clear it here alongside the other per-thread wipes — the rehydration below
      // repopulates content for a re-opened thread (which then renders thread mode, not Start).
      setStartEngaged(false);
      // Ambient v2 Phase D: clear the prior thread's sealed verdicts; the rehydration below
      // repopulates them from the re-opened thread's `sim_seals` (or leaves them empty for a new one).
      setPersistedSimSeals({});
      // Let the rehydration below restore the right tool for the loaded thread.
      hasUserSelectedToolRef.current = false;
    }
    isFirstThreadLoadRef.current = false;

    async function loadPersistedBlocks() {
      try {
        const res = await fetch('/api/threads/open');
        if (!res.ok) return; // 401 or other error — silent (user not logged in yet)
        const data = await res.json() as {
          threadId?: string;
          messages?: Array<{ role?: string; blocks?: Array<{ type?: string; props?: unknown }> }>;
          // Ambient v2 Phase D/C: server-validated sealed sims (trimmed concept text → the full seal,
          // incl. the population/personas depth). `readSimSeals` already dropped malformed entries.
          simSeals?: SimSealMap;
        };
        if (cancelled) return;
        // Ambient v2: re-seal the v2 Overview rows AND repopulate the depth drill from the persisted
        // seals — trimmed concept text → the sealed sim, so both survive reload (AMBIENT_V2 only).
        setPersistedSimSeals(data.simSeals ?? {});
        // Capture thread id for AudienceChip per-thread pin (07-05 / D-04) and sync
        // the sidebar active-row highlight (survives refresh: the pointer cookie
        // drives the server, this drives the client highlight). null → blank/new.
        if (data.threadId) {
          setOpenThreadId(data.threadId);
          setActiveThreadId(data.threadId);
        } else {
          setActiveThreadId(null);
        }
        const messages = data.messages ?? [];
        // ── Restore the user's turn (issue 3 — "the user's message is missing") ──
        // User turns persist as role:"user" markdown. Restore the LAST one as
        // lastUserTurn so the top "you asked" bubble reappears (matches the live
        // single-turn presentation). Role-aware: user markdown must NOT fall into
        // the assistant markdown bucket (that rendered the question as a chat reply).
        const userTurns = messages
          .filter((m) => m.role === 'user')
          .map((m) => (m.blocks ?? []).find((b) => b.type === 'markdown'))
          .map((b) => (b?.props as { text?: string } | undefined)?.text)
          .filter((t): t is string => typeof t === 'string' && t.length > 0);
        if (userTurns.length > 0) setLastUserTurn(userTurns[userTurns.length - 1] ?? null);
        // Flatten ASSISTANT/tool blocks across messages, split by type (user turns
        // are surfaced via lastUserTurn above, never as assistant cards/bubbles).
        const allBlocks = orderedAssistantBlocks(messages);
        // Chat-as-agent unified reload (CHAT_AGENT_DISPATCH): a thread stamped chat-agent renders as ONE
        // ordered stream in the chat view rather than split by tool. Reads the server-set marker
        // (rehydrate-thread.ts); absent (every existing/flag-off thread) → false → reload is unchanged.
        const chatAgentThread = isChatAgentThread(messages);
        const ideaBlocks = allBlocks.filter((b) => b.type === 'idea-card');
        const hookBlocks = allBlocks.filter((b) => b.type === 'hook-card');
        const markdownBlocks = allBlocks.filter((b) => b.type === 'markdown');
        const scriptBlocks = allBlocks.filter((b) => b.type === 'script-card');
        const remixBlocks = allBlocks.filter((b) => b.type === 'remix-card');
        const outlierGridBlocks = allBlocks.filter((b) => b.type === 'outlier-grid');
        // Profile-read + reaction-distribution (05-06) — rendered in-thread regardless
        // of activeTool (there is no "profile" tool; the evidence-drop affordance is the entry).
        const profileBlocks = allBlocks.filter(
          (b) =>
            b.type === 'profile-read' ||
            b.type === 'reaction-distribution' ||
            b.type === 'prediction-gauge' || // 07-04: the Predict (analyst-panel) result block
            // The Read (P3 follow-up): also tool-agnostic — no composer tool owns it, and
            // before this line a persisted Read NEVER re-rendered on the thread surface.
            b.type === 'multi-audience-read',
        );
        setPersistedIdeaBlocks(ideaBlocks);
        setPersistedHookBlocks(hookBlocks);
        setPersistedChatBlocks(markdownBlocks);
        setPersistedScriptBlocks(scriptBlocks);
        setPersistedRemixBlocks(remixBlocks);
        setPersistedExploreBlocks(outlierGridBlocks);
        setPersistedProfileBlocks(profileBlocks);
        // The ordered TURNS power the unified chat-view render — each question above only its own
        // answer (multi-turn fidelity). Populated for EVERY thread (cheap; only rendered when the chat
        // view is active — selector threads restore to their own tool view and never read this), so a
        // pure plain-chat thread also rehydrates per-turn, not flattened. `chatAgentThread` still only
        // gates the restore-to-chat decision below (regression-safe for selector threads).
        setPersistedChatTurns(orderedTurns(messages));

        // ── RESTORE activeTool on rehydration (render-after-reload fix) ──────────
        // activeTool defaults to "test", but every thread-view gate (showHooksView,
        // showIdeasView, …) requires activeTool === its matching tool. On a reload of
        // a thread that already holds idea/hook/script/remix/explore cards, hasThread
        // flips to thread-layout but NO view renders — a blank home with a pinned
        // composer. Restore the tool of the MOST RECENT persisted card so the creator
        // lands back where they left off. Guarded by hasUserSelectedToolRef so a pick
        // made while this fetch was in flight always wins.
        if (!hasUserSelectedToolRef.current) {
          const TYPE_TO_TOOL: Record<string, ToolId> = {
            'idea-card': 'idea',
            'hook-card': 'hooks',
            'script-card': 'script',
            'remix-card': 'remix',
            'outlier-grid': 'explore',
          };
          let restored: ToolId | null = null;
          for (let i = messages.length - 1; i >= 0 && !restored; i--) {
            const blocks = messages[i]?.blocks ?? [];
            for (let j = blocks.length - 1; j >= 0; j--) {
              const t = blocks[j]?.type;
              if (t && TYPE_TO_TOOL[t]) { restored = TYPE_TO_TOOL[t]; break; }
            }
          }
          // A chat-agent thread lands back in the unified chat view regardless of its last card type —
          // that view renders the whole thread as ordered turns (persistedChatTurns), so the cards show there.
          if (chatAgentThread) restored = 'chat';
          // A thread with cards restores ITS tool. A thread with none — a brand-new thread —
          // resets to the DEFAULT. Without the else, "New Thread" silently inherited the last
          // thread's skill: open a hooks thread, hit New Thread, and you got a blank page
          // still armed with Hooks. The empty thread has nothing to restore, so it must fall
          // back to the front door rather than to whatever you happened to do last.
          if (!hasUserSelectedToolRef.current) {
            setActiveTool(restored ?? DEFAULT_TOOL);
          }
        }
      } catch {
        // Network error or parse error — silent (no crash, views stay idle)
      } finally {
        // A1: clear the rehydrate flag once the load settles (success, 401, or error).
        // Guarded by `cancelled` so a stale fetch from a superseded switch never clears
        // the flag the newer switch just set (that newer fetch owns the clear).
        if (!cancelled) setRehydrating(false);
      }
    }
    void loadPersistedBlocks();
    return () => { cancelled = true; };
  // Re-runs on thread switch (activeThreadSignal); other refs are stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadSignal]);

  // ── Audience list fetch (UX-01 — lifted from AudienceChip) ─────────────────
  // Populates the audience popover. Silent on 401 (not logged in yet).
  useEffect(() => {
    let cancelled = false;
    async function fetchAudiences() {
      try {
        const res = await fetch("/api/audiences");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          audiences?: Audience[];
          lastAudienceId?: string | null;
        };
        if (cancelled) return;
        const list = data.audiences ?? [];
        setAudiences(list);
        // Seed the active audience from the user-level last-used pin (resolveUserAudience)
        // so a page reload restores the calibrated audience instead of resetting to General.
        // Guarded so a deliberate pick made while this fetch was in flight always wins; and
        // only seed an id that is actually in the loaded list (a stale/deleted id → General).
        if (
          !hasUserSelectedAudienceRef.current &&
          data.lastAudienceId &&
          list.some((a) => a.id === data.lastAudienceId)
        ) {
          setSelectedAudienceId(data.lastAudienceId);
        }
      } catch {
        // silent — popover renders the empty state
      }
    }
    void fetchAudiences();
    return () => { cancelled = true; };
  }, []);

  // ── Audience select (UX-01 — per-thread pin, D-04) ─────────────────────────
  // null = General (sentinel). Persists to the open thread when one exists.
  // Non-fatal: the pill reflects optimistic state even if the PATCH fails.
  const handleSelectAudience = useCallback(async (audience: Audience) => {
    const newId = audience.is_general ? null : audience.id;
    // Mark a deliberate pick so the mount-time last-used seed never clobbers it (race guard).
    hasUserSelectedAudienceRef.current = true;
    setSelectedAudienceId(newId);
    // Persist the USER-level last-used audience (resolveUserAudience) so the choice survives a
    // page reload + seeds new threads/surfaces. Only a real audience UUID (or null=General) is a
    // valid last-used pin — virtual preset ids stay session-local (like the thread pin, below).
    // Fire-and-forget: non-fatal if it fails (the in-memory selection still reflects the pick).
    if (newId === null || UUID_PATTERN.test(newId)) {
      void fetch("/api/settings/last-audience", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceId: newId }),
      }).catch(() => {});
    }
    // WR-02: reconcile the active skill with the new audience's mode. If the current
    // tool isn't valid in the new mode (e.g. "simulate" lingering after a General →
    // Socials switch, which would silently router.push away + discard the draft),
    // reset to the in-mode default — "test" for socials, the first General verb for
    // general — so the pill, slash menu, placeholder, and submit path stay coherent.
    const newMode = audience.mode ?? "socials";
    setActiveTool((current) =>
      getSkill(current).modes.includes(newMode)
        ? current
        : newMode === "general" ? "profile" : "test",
    );
    if (!openThreadId) return;
    // Only persist a per-thread pin for null (General) or a REAL audience UUID. Virtual
    // preset ids ("preset-growth"/"preset-conversion") are not UUIDs and threads
    // .active_audience_id is a uuid column — PATCHing one used to 500. Presets stay
    // session-local (optimistic pill) until materialized into a real row. (Bug: P13.)
    if (newId !== null && !UUID_PATTERN.test(newId)) return;
    try {
      await fetch(`/api/threads/${openThreadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active_audience_id: newId }),
      });
    } catch {
      // non-fatal — chip reflects optimistic state
    }
  }, [openThreadId]);

  // ── Built/cloned SIM → active audience (UX-04 / D-03) ───────────────────────
  // The chooser's template path returns a saved General SIM. Append it to the local
  // list (so the picker shows it immediately) and select it so the new General SIM
  // is active — driving the mode-scoped skill menu + reactor.
  const handleBuiltAudience = useCallback((saved: Audience) => {
    setAudiences((prev) =>
      prev.some((a) => a.id === saved.id) ? prev : [...prev, saved],
    );
    hasUserSelectedAudienceRef.current = true;
    setSelectedAudienceId(saved.id);
    // Persist the built SIM as the user-level last-used so it survives reload (mirrors
    // handleSelectAudience). Real UUID by construction (a saved row). Fire-and-forget.
    if (UUID_PATTERN.test(saved.id)) {
      void fetch("/api/settings/last-audience", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceId: saved.id }),
      }).catch(() => {});
    }
    setBuildOpen(false);
  }, []);

  // ── "Test full →" handoff (Task 2 — D-05/D-06, HOOKS-03) ──────────────────
  // Invoked by HookCardRenderer via HookTestContext when the creator clicks
  // "Test full →". Switches to the Test tool + stores a visible brief above the
  // upload affordance ("shoot this hook → upload → Max scores the real thing").
  // CRITICAL: does NOT invoke any model on the hook text (D-05 honesty spine).
  const handleTestHook = useCallback((hookLine: string, audienceArchetype: string) => {
    setActiveTool("test");
    setShowUpload(true); // Test absorbs upload — reveal the drop zone for the real video
    setTestBrief({ hookLine, audienceArchetype });
  }, []);

  // ── "Write script →" handoff (Plan 06-05 gap-close — CHAIN_HANDOFFS hooks→script) ──
  // Invoked by HookCardRenderer via HookWriteScriptContext when the creator clicks
  // "Write script →". Switches to the Script tool and starts a script run anchored on
  // the chosen hookLine (streams into ScriptThreadView, mirroring the Script-chip path).
  // The hook is the anchor (PINNED: /api/tools/script accepts { ask?, anchor, platform }).
  // CRITICAL: NEVER sets pendingNavRef / calls stream.start — Script never navigates to /analyze.
  const handleWriteScript = useCallback((hookLine: string, _audienceArchetype: string) => {
    setActiveTool("script");
    setScriptAnchorHook(hookLine); // PR-2: cite this input hook in the script intro
    script.reset();
    // ask empty — the carried hookLine anchors the script generation.
    void script.start("", platform, hookLine, intent);
  }, [script, platform, intent]);

  // ── Script → Test handoff (Plan 06-05 — D-05/D-06, SCRIPT-01) ─────────────
  // Invoked by ScriptCardRenderer via ScriptTestContext when "Test full →" is clicked.
  // Carries the script opener line as the test brief (D-07 honesty spine).
  // CRITICAL: does NOT invoke any model on the script text (D-05 honesty spine).
  const handleTestScript = useCallback((openingBeatLine: string, _scriptBrief: string) => {
    setActiveTool("test");
    setShowUpload(true); // Test absorbs upload — reveal the drop zone for the real video
    // Surface the script opener as the hook brief (matches the visual brief posture)
    setTestBrief({ hookLine: openingBeatLine, audienceArchetype: "script opener" });
  }, []);

  // ── Remix → Hooks handoff (Plan 06-05 — REMIX-01) ─────────────────────────
  // Invoked by RemixCardRenderer via RemixDevelopContext when "Develop into hooks →" is clicked.
  // Card-POST model: POSTs adaptedHook as anchor to /api/tools/ideas/develop (PINNED endpoint).
  // After develop completes, reloads the open thread to surface the new hook cards.
  // CRITICAL: this fires ONLY on explicit tap (D-05 honesty spine).
  // CRITICAL: NEVER arms pendingNavRef / calls stream.start (T-03-13/T-06-20).
  const handleDevelopRemix = useCallback(async (adaptedHook: string, remixPlatform: string) => {
    // Switch to hooks view so the user sees the in-progress state
    setActiveTool("hooks");
    hooks.reset();
    try {
      // POST the adapted hook as the anchor to the PINNED develop endpoint.
      // ideaId is absent — PINNED CONTRACT: { ideaId?, anchor, platform } → ideaId optional.
      const res = await fetch('/api/tools/ideas/develop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anchor: adaptedHook, platform: remixPlatform }),
      });
      if (!res.ok) {
        const err: unknown = await res.json().catch(() => null);
        reportCredit402(res.status, err); // wall dialog if it's the credit 402
        return;
      }
      // After develop persists the hook cards, reload the open thread so they appear.
      const threadRes = await fetch('/api/threads/open');
      if (!threadRes.ok) return;
      const data = await threadRes.json() as {
        messages?: Array<{ blocks?: Array<{ type?: string; props?: unknown }> }>;
      };
      const messages = data.messages ?? [];
      const allBlocks = messages.flatMap((m: { blocks?: Array<{ type?: string; props?: unknown }> }) => m.blocks ?? []);
      const newHookBlocks = allBlocks.filter((b: { type?: string }) => b.type === 'hook-card');
      setPersistedHookBlocks(newHookBlocks);
    } catch {
      // Network error — silent (user can retry)
    }
  }, [hooks]);

  // ── Explore in-place thread reload (Plan 11-07 — RESEARCH Q2) ──────────────
  // After a tile "Remix → Read" tap, the remix-card persists to the SAME open
  // thread. Explore renders in-thread in /home, so we refetch GET /api/threads/open
  // and re-filter the persisted blocks IN PLACE (NEVER router.push — Pitfall 1 sibling).
  // Re-filtering remix-card is what surfaces the freshly-persisted Read; we also
  // refresh outlier-grid so the grid stays in sync. Mirrors handleDevelopRemix's shape.
  const reloadOpenThread = useCallback(async () => {
    try {
      const res = await fetch('/api/threads/open');
      if (!res.ok) return;
      const data = await res.json() as {
        messages?: Array<{ blocks?: Array<{ type?: string; props?: unknown }> }>;
      };
      const messages = data.messages ?? [];
      const allBlocks = messages.flatMap(
        (m: { blocks?: Array<{ type?: string; props?: unknown }> }) => m.blocks ?? [],
      );
      const outlierGridBlocks = allBlocks.filter((b: { type?: string }) => b.type === 'outlier-grid');
      const remixBlocks = allBlocks.filter((b: { type?: string }) => b.type === 'remix-card');
      setPersistedExploreBlocks(outlierGridBlocks);
      setPersistedRemixBlocks(remixBlocks);
    } catch {
      // Network error — silent (the grid stays; the user can retry the tap)
    }
  }, []);

  // Reload the CHAT thread into the ordered-turn buckets (persistedChatTurns/Blocks). Shared by the
  // post-turn swap effect (below) and the in-thread input affordance (a Remix from a pasted link
  // persists its card server-side, then calls this so the card surfaces in-place). no-store: this is
  // a live poll for a just-persisted block; a cached GET would serve the pre-run thread.
  const reloadChatThread = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/threads/open', { cache: 'no-store' });
      if (!res.ok) return false;
      const data = (await res.json()) as {
        messages?: Array<{ role?: string; blocks?: Array<{ type?: string; props?: unknown }> }>;
      };
      const messages = data.messages ?? [];
      if (messages.length === 0) return false;
      setPersistedChatTurns(orderedTurns(messages));
      setPersistedChatBlocks(orderedAssistantBlocks(messages).filter((b) => b.type === 'markdown'));
      return true;
    } catch {
      // Network error — leave current state; the next reload reconciles it.
      return false;
    }
  }, []);

  // The in-thread input affordance (input-request block) reloads the chat thread on completion so its
  // result card surfaces in-place. Memoised so the block's context consumers don't re-render each pass.
  const inThreadInputValue = useMemo(() => ({ onComplete: reloadChatThread }), [reloadChatThread]);

  // ── Evidence-drop affordance (D-07 — the additive Profile inbox) ────────────
  // reloadProfileThread re-reads the open thread and re-filters the profile-read +
  // reaction-distribution blocks IN PLACE. It surfaces (a) the profile-read just
  // persisted by /api/tools/profile and (b) the reaction-distribution the
  // profile-read card's own "Simulate a message →" CTA persists to the SAME thread
  // (SIMU-03 one-thread wow). Mirrors reloadOpenThread's shape. Never navigates.
  const reloadProfileThread = useCallback(async () => {
    try {
      // no-store: this is a live poll for the just-persisted reaction-distribution.
      // A default-cached repeated GET serves the pre-reaction thread, so the card
      // never auto-surfaces in-session (a full reload revalidated, masking it).
      const res = await fetch('/api/threads/open', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages?: Array<{ blocks?: Array<{ type?: string; props?: unknown }> }>;
      };
      const messages = data.messages ?? [];
      const allBlocks = messages.flatMap(
        (m: { blocks?: Array<{ type?: string; props?: unknown }> }) => m.blocks ?? [],
      );
      const profileBlocks = allBlocks.filter(
        (b: { type?: string }) =>
          b.type === 'profile-read' ||
          b.type === 'reaction-distribution' ||
          b.type === 'prediction-gauge' || // 07-04: the Predict (analyst-panel) result block
          b.type === 'multi-audience-read', // the Read — tool-agnostic (mirrors rehydration)
      );
      setPersistedProfileBlocks(profileBlocks);
    } catch {
      // Network error — silent (the user can retry the drop)
    }
  }, []);

  // ── Chat-agent live-turn persistence (SCROLL/DISAPPEAR fix) ─────────────────
  // useChatStream holds only the CURRENT turn (reset on each send), and persistedChatTurns loads
  // only on mount — so a live chat with >1 turn dropped earlier turns from view (the user could no
  // longer scroll up; a reload brought them back). When a chat turn finishes (isDone), re-read the
  // open thread (every turn IS persisted server-side) into persistedChatTurns, THEN reset the live
  // turn — swapping the just-finished turn from "live" to "persisted" in ONE commit (React 18 batches
  // the sets after the awaited fetch), so no turn disappears and no duplicate flashes. Every turn now
  // renders from the same clean per-turn path (live === reloaded).
  const { isDone: chatIsDone, isStreaming: chatIsStreaming, reset: chatReset } = chat;
  const chatDoneHandledRef = useRef(false);
  useEffect(() => {
    if (!chatIsDone) {
      // A new turn started (or state cleared) — re-arm for the next completion.
      chatDoneHandledRef.current = false;
      return;
    }
    if (chatIsStreaming || chatDoneHandledRef.current) return;
    chatDoneHandledRef.current = true;
    let cancelled = false;
    void (async () => {
      // Persisted history gains the finished turn, THEN the live turn clears — swapping live→persisted
      // with no flash and no dup. chatReset() runs ONLY on a successful reload (and if not cancelled) —
      // a failed fetch must NOT clear an unpersisted turn.
      const ok = await reloadChatThread();
      if (cancelled || !ok) return;
      chatReset();
    })();
    return () => {
      cancelled = true;
    };
  }, [chatIsDone, chatIsStreaming, chatReset, reloadChatThread]);

  // ── Chat follow-up chips (chat-followups.ts) ───────────────────────────────
  // A tapped follow-up continues the conversation in THIS chat thread: it echoes the prompt as the
  // optimistic user bubble (lastUserTurn) and re-enters the SSE loop (chat.start). No tool-switch,
  // no blank re-run — the retired chain-handoff CTA did both and lost the topic. The thread already
  // exists (a completed turn is on screen), and the route persists the user turn server-side, so no
  // ensureThreadForSend / user-turn POST is needed here. Fires ONLY on the user's tap (D-05).
  const sendChatFollowup = useCallback(
    (prompt: string) => {
      const t = prompt.trim();
      if (!t) return;
      setLastUserTurn(t);
      chat.reset();
      void chat.start(t, platform);
    },
    [chat, platform],
  );

  // Stage a dropped/selected evidence file. Unsupported types (.docx/.pdf — D-09)
  // set the inline muted reject; never a blocking modal. Server re-validates (T-05-18).
  const acceptEvidenceFile = useCallback((f: File) => {
    if (classifyEvidence(f) === null) {
      setEvidenceFile(null);
      setEvidenceError(EVIDENCE_UNSUPPORTED);
      return;
    }
    setEvidenceError(null);
    setEvidenceFile(f);
  }, []);

  // POST the staged evidence to /api/tools/profile (built in 05-04). file_text/image
  // ride a base64 JSON body; a short clip is staged to Supabase storage first (mirrors
  // the Test upload path) then posted as a storagePath. On success the profile-read
  // block is persisted to the open thread — reloadProfileThread surfaces it.
  const handleProfileSubmit = useCallback(async () => {
    if (!evidenceFile || profiling) return;
    const kind = classifyEvidence(evidenceFile);
    if (kind === null) {
      setEvidenceError(EVIDENCE_UNSUPPORTED);
      return;
    }
    setProfiling(true);
    setEvidenceError(null);
    // WR-04 — track a staged clip so a downstream failure can clean it up (no orphaned
    // blob). Safe here because /api/tools/profile is synchronous: a non-ok response means
    // the server rejected the read, so the file is ours to remove.
    const supabase = createClient();
    let stagedPath: string | null = null;
    try {
      let res: Response;
      if (kind === 'video') {
        // Stage the clip to storage, then post the sanitized key (the route re-checks it).
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) {
          // WR-04: was a silent no-op — surface the expired session via the evidence slot.
          setEvidenceError(EVIDENCE_RUN_FAILED);
          setProfiling(false);
          return;
        }
        const ext = (evidenceFile.name.split('.').pop() ?? 'mp4').toLowerCase();
        const path = `${userId}/${nanoid()}.${ext}`;
        const { error } = await supabase.storage
          .from('videos')
          .upload(path, evidenceFile, {
            contentType: evidenceFile.type || 'video/mp4',
            upsert: false,
          });
        if (error) {
          setEvidenceError(EVIDENCE_RUN_FAILED);
          setProfiling(false);
          return;
        }
        stagedPath = path;
        res = await fetch('/api/tools/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'video',
            storagePath: path,
            isProfiledSubject: true,
            filename: evidenceFile.name,
          }),
        });
      } else {
        const dataBase64 = await fileToBase64(evidenceFile);
        res = await fetch('/api/tools/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind,
            file: { name: evidenceFile.name, type: evidenceFile.type, dataBase64 },
          }),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: EVIDENCE_RUN_FAILED }));
        reportCredit402(res.status, err); // wall dialog if it's the credit 402
        setEvidenceError((err as { error?: string }).error ?? EVIDENCE_RUN_FAILED);
        // WR-04: the server rejected the read — drop the staged clip so it doesn't orphan.
        if (stagedPath) void supabase.storage.from('videos').remove([stagedPath]).catch(() => {});
        return;
      }
      // Persisted to the open thread — clear the chip + surface the profile-read card.
      setEvidenceFile(null);
      await reloadProfileThread();
    } catch {
      setEvidenceError(EVIDENCE_RUN_FAILED);
      // WR-04: request threw after the clip was staged — best-effort cleanup.
      if (stagedPath) void supabase.storage.from('videos').remove([stagedPath]).catch(() => {});
    } finally {
      setProfiling(false);
    }
  }, [evidenceFile, profiling, reloadProfileThread]);

  // The profile-read card owns its own "Simulate a message →" CTA, which POSTs to
  // /api/tools/simulate and persists the reaction-distribution to the SAME open thread
  // (then shows "check the thread below"). The card cannot call back into the composer,
  // so while a profile-read is shown without its reaction yet, poll the open thread so
  // the reaction-distribution surfaces live (bounded; self-clears once it lands).
  const awaitingReaction =
    persistedProfileBlocks.some((b) => b?.type === 'profile-read') &&
    !persistedProfileBlocks.some((b) => b?.type === 'reaction-distribution');
  useEffect(() => {
    if (!awaitingReaction) return;
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (tries > 45) {
        clearInterval(id);
        return;
      }
      void reloadProfileThread();
    }, 4000);
    return () => clearInterval(id);
  }, [awaitingReaction, reloadProfileThread]);

  // ── Navigate-on-id (lifted from Board.tsx L300-307, guarded per WR-05) ───
  // The id originates server-side: POST /api/analyze does nanoid(12) + emits
  // SSE started{id}; useAnalysisStream surfaces it as stream.analysisId. A
  // null -> string transition is what fires the /analyze/[id] navigation.
  //
  // WR-05: a bare null->string flip is NOT a safe trigger in the pinned
  // (permalink) layout — useAnalysisStream also sets analysisId from the URL
  // on hydration (use-analysis-stream.ts:521), which would push us to an
  // /analyze/[id] the user never submitted. Board distinguishes "an id I
  // started streaming" from "an id that appeared via hydration" with a ref.
  // We mirror that: navigation is ARMED only when handleSubmit actually calls
  // stream.start (pendingNavRef), so a hydration-sourced id can never navigate.
  //
  // CRITICAL (T-03-13): pendingNavRef is EXCLUSIVE to the Test path.
  // The Idea path never sets it — an Idea send must not navigate to /analyze.
  const prevAnalysisIdRef = useRef<string | null>(stream.analysisId);
  const pendingNavRef = useRef(false);
  useEffect(() => {
    const id = stream.analysisId;
    if (id && prevAnalysisIdRef.current === null && pendingNavRef.current) {
      pendingNavRef.current = false;
      router.push(`/analyze/${id}`);
    }
    // Re-arming only happens in handleSubmit (Test path); here we just track the
    // value so the next genuine null->string (after a fresh submit) is detectable.
    prevAnalysisIdRef.current = id;
  }, [stream.analysisId, router]);

  // ── Submit -> create (lifted/adapted from Board.tsx handleContentSubmit) ──
  // Slim: only the TikTok-URL and video-upload paths for Test; Ideas pipeline for Idea.
  // CRITICAL: Idea path NEVER sets pendingNavRef or calls stream.start (T-03-13).
  const handleSubmit = useCallback(async () => {
    // Skills that persist into the open chat thread AND whose user turn must be
    // persisted client-side (chat persists its own turn server-side; Test navigates
    // to /analyze and owns no chat thread). Kept in sync with the ensureThreadForSend
    // set below — every tool here creates its thread lazily on first send.
    const USER_TURN_TOOLS: ToolId[] = [
      "idea", "hooks", "script", "remix", "explore", "simulate", "predict",
    ];
    const captureUserTurn = (raw: string) => {
      const t = raw.trim();
      setLastUserTurn(t || null);
      // Persist the question so re-opening the thread restores the top "you asked"
      // bubble (issue 3). Fire-and-forget: the turn renders at the top via
      // lastUserTurn independent of persisted order, so it never needs awaiting.
      // Must run AFTER the thread exists (ensureThreadForSend) so it targets the
      // right thread — guaranteed by call ordering in every branch below.
      if (t && USER_TURN_TOOLS.includes(activeTool)) {
        void fetch("/api/threads/user-turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: t }),
        }).catch(() => {
          /* best-effort — a missed persist only loses the restored question bubble */
        });
      }
    };

    // ── Lazy thread creation (issue 2 — no blank threads in history) ──────────
    // "New Thread" creates NO row; the pointer is the NEW_THREAD_SENTINEL and the
    // composer renders empty. The row is materialised HERE, on the first real send,
    // so a thread only enters history once it holds a message. Flips the pointer to
    // the fresh id BEFORE the skill runs, so every tool route appends to this thread.
    const ensureThreadForSend = async (): Promise<void> => {
      if (getActiveThreadCookie() !== NEW_THREAD_SENTINEL) return; // resuming an existing thread
      try {
        const res = await fetch("/api/threads/new", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!res.ok) return;
        const { threadId } = (await res.json()) as { threadId: string };
        setActiveThreadCookie(threadId);
        setOpenThreadId(threadId);
        setActiveThreadId(threadId);
        // Surface the new thread (and, once titled, its label) in the sidebar.
        void queryClient.invalidateQueries({ queryKey: queryKeys.threads.list() });
      } catch {
        // Network error — the tool route's createOpenThreadLazy still resolves a
        // target thread server-side, so the send is not lost.
      }
    };
    // Skills that persist into the open chat thread create it lazily on first send.
    // (Test/video navigates to /analyze and owns no chat thread — excluded.)
    if (
      activeTool === "idea" ||
      activeTool === "hooks" ||
      activeTool === "chat" ||
      activeTool === "script" ||
      activeTool === "remix" ||
      activeTool === "explore"
    ) {
      await ensureThreadForSend();
    }

    // ── Account Read path (SELF-01/02/03) ───────────────────────────────────
    // Bodyless: the read resolves the creator's OWN handle server-side, so the field is
    // ignored entirely. This fires from an explicit send (a real user gesture), which is
    // what D-05 requires — it is not an auto-fire on render.
    if (activeTool === "account") {
      setUrl(""); // the field was never an input here; don't leave a stale draft behind
      await account.start();
      return;
    }

    // ── Idea tool path (D-12) ───────────────────────────────────────────────
    // CRITICAL: this block must never set pendingNavRef.current or call stream.start.
    // Empty ask = Auto mode; typed ask = seeded mode (D-12).
    if (activeTool === "idea") {
      const ask = trimmedUrl; // empty string → Auto; non-empty → seeded
      captureUserTurn(ask);
      setUrl(""); // clear input after send
      // ideas.start() does the full fetch+getReader SSE loop (BLOCKER-1 compliant)
      await ideas.start(ask, platform, intent);
      return;
    }

    // ── Hooks tool path (D-09, Plan 04-03 Task 1) ───────────────────────────
    // CRITICAL: this block must never set pendingNavRef.current or call stream.start.
    // Empty ask = Auto/anchored mode; typed ask = seeded mode (D-09).
    // T-03-13/T-04-13: Hook send NEVER navigates to /analyze.
    if (activeTool === "hooks") {
      const ask = trimmedUrl; // empty string → Auto; non-empty → seeded
      captureUserTurn(ask);
      setUrl(""); // clear input after send
      // hooks.start() does the full fetch+getReader SSE loop (BLOCKER-1 compliant)
      await hooks.start(ask, platform, intent);
      return;
    }

    // ── Chat tool path (Plan 05-03, D-05) ────────────────────────────────────
    // CRITICAL: this block MUST NOT set pendingNavRef.current or call stream.start.
    // Chat send NEVER navigates to /analyze (D-05 — no silent auto-fire).
    // ask must be non-empty (canSubmit already gates on trimmedUrl.length > 0).
    if (activeTool === "chat") {
      const ask = trimmedUrl;
      captureUserTurn(ask);
      setUrl(""); // clear input after send

      // ── Plan 05-05: Refine-intent detection (D-04 / D-05) ──────────────────
      // Before routing to a plain chat turn, check whether the message is a
      // bounded refine request ("make hook 1 punchier", "tighten idea 2").
      // detectRefineIntent requires: refine verb + card noun + ordinal — a plain
      // question ("what should I post?") returns isRefine: false (D-05 no false positive).
      // CRITICAL: refine fires because the user EXPLICITLY sent a refine message —
      // this is an explicit send, not an auto-fire (D-05).
      // On a refine, routes to /api/tools/refine via hooks.startRefine / ideas.startRefine
      // (see use-hooks-stream.ts / use-ideas-stream.ts for the SSE consumer).
      const refineIntent = detectRefineIntent(ask);
      if (refineIntent.isRefine && refineIntent.skill && refineIntent.cardRef !== undefined) {
        const { skill, cardRef, instruction } = refineIntent;

        // Look up the original card to build the anchor.
        // Hooks: merge persisted + streaming (hooks carry a stable rank field).
        // Ideas: single pool (CR-02) — see idea branch below.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allHookBlocks: any[] = [...persistedHookBlocks, ...hooksBlocks];

        if (skill === "hooks") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const foundCard = allHookBlocks.find((b: any) => b?.props?.rank === cardRef);
          // WR-02: only fire refine when the card was actually resolved.
          // If not found, surface a chat note instead of refining a fallback.
          if (!foundCard?.props) {
            await chat.start(
              `I couldn't find Hook #${cardRef}. Try "make hook 1 punchier" — use the number shown on the card.`,
              platform,
            );
            return;
          }
          const { buildRefineAnchor } = await import("@/lib/tools/refine");
          const anchor = buildRefineAnchor(foundCard.props, instruction ?? ask);
          // Route to hooks stream refine path — error surfaces via hooks.error → SkillRunError
          hooks.reset();
          // Switch to hooks view so the new card renders in the hooks thread
          setActiveTool("hooks");
          await hooks.startRefine({ skill: "hooks", instruction: instruction ?? ask, anchor, cardRef, platform });
        } else {
          // skill === "idea"
          // CR-02: resolve from a SINGLE non-merged pool — prefer the in-session
          // streaming cards (ideasBlocks); fall back to persisted when none streaming.
          // Concatenating both arrays double-counts cards and shifts ordinals, so
          // the user's "idea 2" would silently refine the wrong card.
          const ideaPool = ideasBlocks.length > 0 ? ideasBlocks : persistedIdeaBlocks;
          const foundCard = ideaPool[cardRef - 1]; // 1-based within a single pool
          // WR-02: only fire refine when the card was actually resolved.
          if (!foundCard?.props) {
            await chat.start(
              `I couldn't find Idea #${cardRef}. Try "tighten idea 1" — use the number shown on the card.`,
              platform,
            );
            return;
          }
          const { buildRefineAnchor } = await import("@/lib/tools/refine");
          const anchor = buildRefineAnchor(foundCard.props, instruction ?? ask);
          // Route to ideas stream refine path — error surfaces via ideas.error → SkillRunError
          ideas.reset();
          // Switch to ideas view so the new card renders in the ideas thread
          setActiveTool("idea");
          await ideas.startRefine({ skill: "idea", instruction: instruction ?? ask, anchor, cardRef, platform });
        }
        return;
      }

      // ── Plain chat turn (no refine intent detected) ────────────────────────
      chat.reset(); // clear prior error/coldStart for the new turn
      // chat.start() does the full fetch+getReader SSE loop (BLOCKER-1 compliant)
      await chat.start(ask, platform);
      return;
    }

    // ── Script tool path (Plan 06-05, D-09) ──────────────────────────────────
    // CRITICAL: NEVER sets pendingNavRef.current or calls stream.start (T-03-13/T-06-20).
    // Script send NEVER navigates to /analyze.
    // ask = typed topic or empty; anchor = carried hookLine from hooks→script seam.
    if (activeTool === "script") {
      const ask = trimmedUrl; // topic seed or empty (anchor drives the script when carried)
      captureUserTurn(ask);
      setUrl(""); // clear input after send
      setScriptAnchorHook(null); // direct topic send — no anchor hook → thinner intro
      script.reset();
      // script.start(ask, platform, anchor?) — anchor omitted from direct composer sends
      await script.start(ask, platform, undefined, intent);
      return;
    }

    // ── Remix tool path (Plan 06-05, REMIX-01) ────────────────────────────────
    // CRITICAL: NEVER sets pendingNavRef.current or calls stream.start (T-03-13/T-06-20).
    // Remix send NEVER navigates to /analyze.
    // URL is required (canSubmit gates on trimmedUrl.length > 0 for remix).
    if (activeTool === "remix") {
      const url = trimmedUrl; // trending/competitor TikTok URL (required)
      captureUserTurn(url);
      setUrl(""); // clear input after send
      remix.reset();
      await remix.start(url, platform, intent);
      return;
    }

    // ── Explore tool path (Plan 11-07, EXPLORE-01 — Pitfall 1 CRITICAL) ───────
    // CRITICAL: this block MUST NOT set pendingNavRef.current and MUST NOT call
    // stream.start — Explore renders in-thread in /home and NEVER navigates to
    // /analyze/[id] (Pitfall 1; pendingNavRef/stream.start are Test-exclusive).
    // A typed field-send maps to the niche param (empty → un-niched pull). The
    // params popover + quick-actions are the richer entry points (onRunExplore /
    // onQuickAction → explore.start), but a bare field-send still works.
    if (activeTool === "explore") {
      const ask = trimmedUrl; // typed niche/keywords or empty
      captureUserTurn(ask);
      setUrl(""); // clear input after send
      // explore.start() does the full fetch+getReader SSE loop (BLOCKER-1 compliant).
      await explore.start({ niche: ask || undefined });
      return;
    }

    // ── Simulate / Predict tool paths (07-04 / D-07, UX-02) ──────────────────
    // The two General verbs reuse the P5/P6 routes reached today via card-chain
    // CTAs. CRITICAL (T-07-04-01 gate): both REQUIRE a selected General audience —
    // when absent, route the user to Build and return WITHOUT firing an ungated
    // stimulus (the client gate is UX; the server independently enforces auth +
    // the D-08 honesty guards). CRITICAL: NEVER set pendingNavRef / call stream.start
    // — a General verb never navigates to /analyze (Pitfall 2 / sibling of Chat).
    // The draft/scenario is passed RAW (T-07-04-02) — never pre-concatenated into a
    // prompt; the routes data-fence it downstream.
    if (activeTool === "simulate" || activeTool === "predict") {
      // Gate: a General audience must be selected (asymmetry §16.4). A General verb
      // can be active while no General audience is selected (e.g. picked via the `/`
      // slash menu, or after switching audience away) — route to Build, never fire.
      if (!selectedAudience || selectedAudience.mode !== "general") {
        router.push("/audience/new");
        return;
      }
      const draft = trimmedUrl;
      if (draft.length === 0) return; // nothing to run (canSubmit already gates this)
      // Materialise the thread FIRST (after the audience gate) so a General verb never
      // orphans a blank thread when it bails to /audience/new above — and so the user
      // turn captureUserTurn persists targets this thread, not a stray one.
      await ensureThreadForSend();
      captureUserTurn(draft);
      setUrl(""); // clear input after send
      const endpoint =
        activeTool === "simulate" ? "/api/tools/simulate" : "/api/tools/predict";
      const body =
        activeTool === "simulate"
          ? { audienceId: selectedAudience.id, message: draft }
          : { audienceId: selectedAudience.id, scenario: draft };
      setSubmitting(true);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err: unknown = await res.json().catch(() => null);
          reportCredit402(res.status, err); // wall dialog if it's the credit 402
          return;
        }
        // The reaction-distribution (Simulate) / prediction-gauge (Predict) persisted
        // to the SAME open thread — surface it via the one-thread reload (05-06 path).
        await reloadProfileThread();
      } catch {
        // Network error — silent (the user can retry the draft)
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ── Test tool path (pendingNavRef/stream.start exclusive here) ─
    // A3: echo the submitted input before the navigation gap. The Test path only
    // reaches /analyze/[id] once the `started` SSE flips analysisId (1–3s); until
    // then it was a silent spinner. captureUserTurn(...) drives the optimistic echo
    // + status line (testSubmitTurn) so the wait reads as work, not a dead button.
    if (file !== null) {
      // Upload path — stage the file to Supabase storage, then start with the path.
      captureUserTurn(file.name);
      setSubmitError(null);
      setSubmitting(true);
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) {
          // WR-04: was a silent no-op — the spinner reset with zero feedback.
          setSubmitError(ERROR_SESSION_EXPIRED);
          setSubmitting(false);
          return;
        }
        const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase();
        const path = `${userId}/${nanoid()}.${ext}`;
        const { error } = await supabase.storage
          .from("videos")
          .upload(path, file, {
            contentType: file.type || "video/mp4",
            upsert: false,
          });
        if (error) {
          // WR-04: surface the storage failure instead of silently resetting.
          setSubmitError(ERROR_UPLOAD_FAILED);
          setSubmitting(false);
          return;
        }
        // WR-05: arm navigation — this run's started{id} is a real submission,
        // so the null->string flip it produces SHOULD navigate (unlike a
        // hydration-sourced id, which never arms this).
        pendingNavRef.current = true;
        // WR-04: no client-side storage cleanup on failure here (unlike the profile path).
        // /api/analyze consumes video_storage_path in a background job, so deleting the blob
        // on a stream error would race the server that may still read it. Orphans on the Test
        // path are left to a server-side sweep.
        await stream
          .start({
            input_mode: "video_upload",
            content_type: "video",
            video_storage_path: path,
          })
          .catch(() => {
            /* stream.phase -> error transition owns the UI */
          });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!isValidTikTok) return;
    captureUserTurn(trimmedUrl); // A3 optimistic echo (drives testSubmitTurn)
    setSubmitError(null);
    setSubmitting(true);
    try {
      // WR-05: arm navigation for this real submission (see upload path above).
      pendingNavRef.current = true;
      await stream
        .start({
          input_mode: "tiktok_url",
          content_type: "video",
          tiktok_url: trimmedUrl,
        })
        .catch(() => {
          /* stream.phase -> error transition owns the UI */
        });
    } finally {
      setSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, file, isValidTikTok, trimmedUrl, stream, ideas, hooks, chat, script, remix, explore, platform, intent, persistedHookBlocks, persistedIdeaBlocks, hooksBlocks, ideasBlocks, selectedAudience, router, reloadProfileThread, queryClient, setActiveThreadId]);

  // ── Seam 4 — the launch-seed inlet (THE-CONTRACT.md §3) ────────────────────────
  // A surface (the start page's embedded composer) hands a composed intent off as a
  // `/home?v=…&seed=…&run=1` URL (buildThreadLaunchHref). Consume it ONCE on mount: map the
  // verb → its default skill, pre-fill the field, and — when run=1 and the verb is runnable
  // from a text seed — arm a one-shot auto-run. The explicit surface send IS the fire, so this
  // is honesty-spine-safe (never a silent auto-fire). Reads window.location.search directly
  // (not useSearchParams) so /home needs no Suspense boundary and never de-opts to client-only
  // static render. The launched audience (`aud`) is intentionally NOT consumed yet — /home uses
  // its own user-level last-used audience until the Seam-3 real-audience graft lands surfaces-side.
  useEffect(() => {
    if (seedConsumedRef.current || typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const verbParam = sp.get(LAUNCH_PARAM.verb) as Verb | null;
    const seedParam = sp.get(LAUNCH_PARAM.seed);
    const runParam = sp.get(LAUNCH_PARAM.run) === "1";
    if (!verbParam && !seedParam) return; // no launch to consume
    seedConsumedRef.current = true;

    const tool: ToolId = (verbParam && LAUNCH_VERB_TOOL[verbParam]) || "test";
    // Mark a deliberate pick so the open-thread rehydration never overrides the launched verb.
    hasUserSelectedToolRef.current = true;
    // One-shot handoff consumption on mount — setState here is intentional (a client-only
    // window.location read can't seed lazy initial state); seedConsumedRef makes it fire once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTool(tool);
    if (tool === "test") setShowUpload(true); // Test absorbs upload — reveal its drop zone (v6)
    if (seedParam) setUrl(seedParam);

    // Runnable from a text seed? Make (hooks/idea/script) runs even empty (Auto mode). Ask
    // (chat) needs a thought. Test can only run headless from a valid TikTok URL — a video
    // upload needs a file the surface can't carry, so it degrades to pre-fill (the safe fallback).
    const runnable =
      tool === "hooks" || tool === "idea" || tool === "script"
        ? true
        : tool === "chat"
          ? !!seedParam?.trim()
          : tool === "test"
            ? !!seedParam && TIKTOK_URL_PATTERN.test(seedParam.trim())
            : false;
    if (runParam && runnable) setPendingAutoRun(true);

    // Strip the launch params so a refresh / re-render never re-seeds or re-fires.
    router.replace("/home", { scroll: false });
  }, [router]);

  // Fire the armed auto-run once — in a LATER commit than the seed inlet, so setActiveTool +
  // setUrl have landed and handleSubmit's closure reads the seeded verb + field. One-shot
  // (pendingAutoRun self-clears; seedConsumedRef already tripped), so a normal render never
  // re-fires. Test's path navigates to /analyze/[id]; Make/Ask stream into the /home thread.
  useEffect(() => {
    if (!pendingAutoRun) return;
    // One-shot: clear the arm before firing so the run never repeats.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingAutoRun(false);
    void handleSubmit();
  }, [pendingAutoRun, handleSubmit]);

  const onSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    // Ask-the-room verb: the field sends into the room, not a skill pipeline (mode → verb, 07-18).
    if (isAsk) {
      if (url.trim().length > 0) {
        void askAudience(url);
        setUrl("");
      }
      return;
    }
    // Evidence-drop mode (D-07): a staged chat/screenshot/clip POSTs to /api/tools/profile.
    // Sibling to the creator path — the creator tool/submit flow below is byte-identical.
    if (evidenceFile) {
      void handleProfileSubmit();
      return;
    }
    if (!canSubmit) return;
    void handleSubmit();
  };

  // ── `/` slash entry (UX-01) ────────────────────────────────────────────────
  // Typing `/` in the field opens the skill list as a command menu, filterable;
  // selecting sets the skill and clears the `/`. A URL never starts with `/`, so
  // this never collides with the Test/Remix URL paths.
  // `/` always opens the skill switcher — it's how you leave any verb, Ask included (typing
  // `/hooks` from Ask arms Hooks). A real thought rarely starts with `/`, and only a leading
  // `/` triggers, so it never eats a mid-sentence slash.
  const slashActive = url.startsWith("/");
  const slashQuery = slashActive ? url.slice(1) : "";
  const firstSlashSkill = () => {
    const q = slashQuery.trim().toLowerCase();
    // Gate identically to the skill pill / slash menu via the shared isSkillVisible
    // (WR-01) so Enter can never select a skill the menu never displayed — and the
    // always-visible General verbs ARE selectable here too.
    const slashMode = selectedAudience?.mode ?? "socials";
    return (
      SKILLS.find(
        (s) =>
          s.enabled &&
          isSkillVisible(s, slashMode) &&
          (!q || s.label.toLowerCase().includes(q) || s.command.includes(q)),
      ) ?? null
    );
  };
  const selectSkill = (id: ToolId) => {
    handleUserSelectTool(id);
    setUrl(""); // clear the `/query` after selection
  };

  const onFieldKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashActive) {
      if (e.key === "Enter") {
        e.preventDefault();
        const s = firstSlashSkill();
        if (s) selectSkill(s.id);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setUrl("");
        return;
      }
      // While the slash menu is open, Enter/Escape are handled above; other keys
      // keep filtering. Don't fall through to submit-on-Enter.
      return;
    }
    // Enter submits (Shift+Enter = newline) — textarea needs this explicitly.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Ask-the-room verb: send the thought into the room (mode → verb, 07-18).
      if (isAsk) {
        if (url.trim().length > 0) {
          void askAudience(url);
          setUrl("");
        }
        return;
      }
      if (canSubmit) void handleSubmit();
    }
  };

  // Placeholder follows the active chip (the `ask` verb's copy lives in PLACEHOLDER_BY_TOOL now,
  // not a mode branch); in the pinned state the follow-up copy takes precedence so it's
  // contextually accurate (D-07 / D-24).
  const activePlaceholder = hasSimulation
    ? PLACEHOLDER_ACTIVE
    : PLACEHOLDER_BY_TOOL[activeTool];

  // Thread mode on /home (no route id): full-height column — thread region
  // scrolls above the pinned form. Active when hasThread is true OR while a switch
  // is rehydrating (A1) — so the shell stays mounted across the load gap instead of
  // collapsing to the centered hero. Empty home (no thread, not rehydrating) keeps
  // the existing centered hero layout (no regression).
  const homeThreadMode = (hasThread || rehydrating) && !hasSimulation;
  // P2 (A2b): <xl thread mode, the room is a 68px HEADER above the thread (variant='header'),
  // not the bottom-dock peek — it survives the keyboard (top-anchored). ≥xl the rail (A2a) owns it,
  // so `!isXl` keeps them exclusive. Empty/permalink keep the dock peek (no thread to head).
  const useHeader = homeThreadMode && !isXl;

  // ── Ambient presence focus (Plan 13-04 — AMBIENT-01, D-01/D-02/D-03/D-04) ──
  // The room's card ledger + the batch's kind label for the anchored-focus stepper
  // (‹ Hook N of M ›), built from the blocks the MOUNTED thread view already rendered
  // (persisted + streaming, in DOM order). Each card already emits its real
  // { fraction, scrollQuote } + a concept line — the spotlight READS that data, never re-runs
  // a model (D-03 determinism-gate-safe; zero new model calls).
  //
  // The ledger is keyed on the BLOCKS, never on the composer chip: chat-as-agent
  // (CHAT_AGENT_DISPATCH) dispatches real idea/hook/script cards inline while the chip stays
  // "chat", so the chat view's cards are its own dispatched blocks — every persisted turn's,
  // then this turn's stream. See ambient-descriptors.ts for the decision + its guard.
  const { descriptors: ambientDescriptors, kindLabel: ambientKindLabel } = buildAmbientDescriptors({
    activeTool,
    hook: [...persistedHookBlocks, ...hooksBlocks],
    idea: [...persistedIdeaBlocks, ...ideasBlocks],
    script: [...persistedScriptBlocks, ...scriptBlocks],
    remix: [...persistedRemixBlocks, ...remixBlocks],
    chat: [...persistedChatTurns.flatMap((t) => t.blocks), ...chat.streamingBlocks],
  });

  const {
    focus: ambientFocus,
    focusByTap,
    focusByThought,
    registerThreadRegion,
  } = useAmbientFocus(ambientDescriptors);

  // A card's "See the room →" opens the docked CURRENT-audience Room anchored on that card
  // (via OpenRoomContext → ProofUnit), NOT the standalone per-card Lens (placeholder viewers).
  // Resolve the card by its concept text to the matching descriptor, make it the sticky focus,
  // and bloom the presence open. Returns false when no descriptor matches → ProofUnit keeps its
  // standalone Lens fallback.
  const openRoomForCard = useCallback(
    (conceptText: string, cardId?: string | null): boolean => {
      // Resolve by the card's LEDGER id first (dup-concept safe), falling back to concept text —
      // matching text alone opened the FIRST of two identical concepts (family of #306).
      const d = resolveFocusDescriptor(ambientDescriptors, conceptText, cardId);
      if (!d) return false;
      setRoomDrill(true);
      focusByTap(d.id);
      // Visual expand only (dock/header) — drilling into a card's read never arms the ask verb.
      setRoomExpanded(true);
      return true;
    },
    [ambientDescriptors, focusByTap],
  );

  // ── The Room Rewrite loop (PR-3, LIVE-07) ──────────────────────────────────
  // The Population weak-spot's "Rewrite to win back the N% who bounced →" CTA re-runs the
  // ORIGINATING skill steered by the bouncers' real words (the `lever`), via the composer's OWN
  // stream hook. That's the honest re-POST-to-runner: the SSE is read to completion (unlike a
  // fire-and-forget fetch that resolves at headers, before persistence), so the regenerated batch
  // streams into the SAME thread + Read, and on completion we land focus on the winning (highest-
  // stop) card so the Room shows the real delta (prior → new). Only the text-seedable skills
  // rewrite; remix (URL-seeded) has no lever-reseed path → the CTA is gated off there.
  const canRoomRewrite =
    activeTool === "hooks" || activeTool === "idea" || activeTool === "script";
  // Bumped once a reseed lands + the Room re-focuses; the Room reveals the delta only after this
  // advances past the value it captured at tap-time (so its "current" read is the post-rewrite one).
  const [rewriteNonce, setRewriteNonce] = useState(0);
  // Set the moment a rewrite fires; the completion effect below consumes it once the reseed's SSE
  // closes. A ref (not state) so setting it never renders + it reads fresh inside the effect.
  const roomRewriteExpectingRef = useRef(false);

  const onRoomRewrite = useCallback(
    async (lever: string) => {
      const seed = lever.trim();
      if (seed.length === 0) return;
      // reset() clears the prior batch (isDone → false) BEFORE we arm the flag, so the completion
      // effect can't misfire on the previous run; the reseed then streams a fresh steered batch.
      if (activeTool === "hooks") {
        hooks.reset();
        roomRewriteExpectingRef.current = true;
        await hooks.start(seed, platform, intent);
      } else if (activeTool === "idea") {
        ideas.reset();
        roomRewriteExpectingRef.current = true;
        await ideas.start(seed, platform, intent);
      } else if (activeTool === "script") {
        script.reset();
        roomRewriteExpectingRef.current = true;
        await script.start(seed, platform, undefined, intent);
      }
    },
    [activeTool, hooks, ideas, script, platform, intent],
  );

  // Reseed completion: once the active skill's stream closes, land the Room's focus on the winning
  // (highest-stop) card of the fresh batch, then bump the nonce so the Room reveals the delta. The
  // fresh batch is the TAIL of the descriptor list (persisted history unchanged) — picking the best
  // of that tail is robust to the positional descriptor ids. Early-returns unless a rewrite is
  // pending, so normal generation (expecting = false) is never touched.
  useEffect(() => {
    if (!roomRewriteExpectingRef.current) return;
    const stream =
      activeTool === "hooks"
        ? hooks
        : activeTool === "idea"
          ? ideas
          : activeTool === "script"
            ? script
            : null;
    if (!stream || stream.isStreaming || !stream.isDone) return;
    const streamingCount =
      activeTool === "hooks"
        ? hooksBlocks.length
        : activeTool === "idea"
          ? ideasBlocks.length
          : scriptBlocks.length;
    if (streamingCount === 0) return;
    roomRewriteExpectingRef.current = false;
    const batch = ambientDescriptors.slice(-streamingCount);
    if (batch.length === 0) return;
    const stopOf = (d: AmbientCardDescriptor): number => {
      const m = d.fraction.match(/(\d+)\s*\/\s*(\d+)/);
      return m ? Number(m[1]) : -1;
    };
    let best = batch[0]!;
    for (const d of batch) if (stopOf(d) > stopOf(best)) best = d;
    focusByTap(best.id);
    setRewriteNonce((n) => n + 1);
  }, [
    activeTool,
    hooks.isDone,
    hooks.isStreaming,
    ideas.isDone,
    ideas.isStreaming,
    script.isDone,
    script.isStreaming,
    hooksBlocks.length,
    ideasBlocks.length,
    scriptBlocks.length,
    ambientDescriptors,
    focusByTap,
  ]);

  // ── Ask-the-room handler (P13; mode → `ask` verb 2026-07-18) ────────────────
  // The `ask` verb makes the composer FIELD the room input (no second input): submit routes to
  // askAudience (POST /api/tools/react) → appends a turn + sets the focus so the Lens shows the
  // room's read. (`isAsk` is declared up top so the submit/render code can branch on it.)
  const askInflightRef = useRef<AbortController | null>(null);
  useEffect(() => () => askInflightRef.current?.abort(), []);

  const askAudience = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (text.length === 0 || asking) return;
      askInflightRef.current?.abort();
      const controller = new AbortController();
      askInflightRef.current = controller;
      setAsking(true);
      try {
        const res = await fetch("/api/tools/react", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, intent }),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!res.ok) throw new Error("reaction_failed");
        const data: {
          fraction?: string;
          scrollQuote?: string;
          personas?: { archetype: string; verdict: "stop" | "scroll"; quote: string }[];
          population?: import("@/lib/audience/population").PopulationAggregate | null;
        } = await res.json();
        if (controller.signal.aborted) return;
        const fraction = data.fraction ?? "";
        const scrollQuote = data.scrollQuote ?? "";
        const personas = Array.isArray(data.personas) ? data.personas : undefined;
        // Stage 2 population projection — present only for a calibrated audience with v2 axes.
        const population = data.population ?? undefined;
        setAudienceAsks((a) => [...a, { id: nanoid(), thought: text, fraction, scrollQuote, personas, population }]);
        // Lens shows this read — with the real named cast (react route returns registry-enum personas).
        focusByThought({ conceptText: text, fraction, scrollQuote, personas, population });
      } catch (e) {
        if (controller.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
        setAudienceAsks((a) => [...a, { id: nanoid(), thought: text, fraction: "", scrollQuote: "", error: true }]);
      } finally {
        if (askInflightRef.current === controller) setAsking(false);
      }
    },
    [asking, focusByThought, intent],
  );

  // The presence props for the ONE docked peek+Bloom presence (all breakpoints — the desktop
  // rail presentation was retired in #208 and its code deleted).
  // ── Reactions-arrive signal (Phase 2) ────────────────────────────────────────
  // True while a ROOM-REACTION generation is streaming. Only the skills that produce audience
  // reactions count (ideas/hooks/script/remix) — chat/explore/account are conversation/ideation,
  // so the presence must NOT claim "reading the room" for them. Drives the presence's reacting
  // pulse + constellation blink, and — on its true→false edge — the "N new" arrival badge.
  const audienceReacting =
    ideas.isStreaming || hooks.isStreaming || script.isStreaming || remix.isStreaming;

  // Arrival edge (reactions-arrive dopamine, Phase 2): the composer owns the reactions
  // true→false edge and bumps `arrivalNonce` when a generation finishes. The presence reads the
  // nonce to fire its "N new" count-up. This lives HERE (a stable instance) — not inside
  // AudiencePresence — because the presence remounts across the empty→thread layout switch that
  // lands mid-generation, which reset its mount-seeded ref and swallowed the edge (the badge
  // never fired). The composer never remounts through the flow, so the edge is caught reliably.
  const [arrivalNonce, setArrivalNonce] = useState(0);
  const prevAudienceReactingRef = useRef(audienceReacting);
  useEffect(() => {
    const was = prevAudienceReactingRef.current;
    prevAudienceReactingRef.current = audienceReacting;
    if (was && !audienceReacting) setArrivalNonce((n) => n + 1); // reactions just landed
  }, [audienceReacting]);

  const presenceCommonProps: Omit<AudiencePresenceProps, "docked"> = {
    audience: selectedAudience,
    audiences,
    selectedAudienceId,
    onSelectAudience: (a: Audience) => {
      // A typed-thought read + the ask ledger were produced against the PREVIOUS audience —
      // leaving them in focus would show the old room's reaction under the new audience's
      // name. Clear them; the focus falls back to the thread's own cards (each card carries
      // its own read, anchored to the thread history, so those stay).
      focusByThought(null);
      setAudienceAsks([]);
      void handleSelectAudience(a);
    },
    focus: ambientFocus,
    reducedMotion,
    // Visual expand only (dock bloom + <xl header sheet). The rail ignores it; tapping the band
    // no longer arms an input mode — asking the room is the `ask` verb (activeTool === "ask").
    open: roomExpanded,
    onOpenChange: handleRoomExpandedChange,
    drillIntoFocus: roomDrill,
    asks: audienceAsks,
    asking,
    onReask: (a: AudienceAsk) =>
      focusByThought({
        conceptText: a.thought,
        fraction: a.fraction,
        scrollQuote: a.scrollQuote,
        personas: a.personas,
        population: a.population,
      }),
    onBuildAudience: () => setBuildOpen(true),
    focusList: ambientDescriptors,
    onStep: focusByTap,
    kindLabel: ambientKindLabel,
    canRewrite: canRoomRewrite,
    onRewrite: onRoomRewrite,
    rewriteNonce,
    reacting: audienceReacting,
    arrivalNonce,
  };
  const audiencePresence = <AudiencePresence {...presenceCommonProps} docked />;
  // P2 (A2a) — the SAME presence, persistent + in-flow, for the desktop rail (variant='rail', A1).
  // Same props (same focus/asks/reacting state), so the rail reacts to scroll-spy exactly as the
  // dock peek did; only the container + DOM owner change. Rendered ONLY via the portal below.
  const audienceRail = <AudiencePresence {...presenceCommonProps} variant="rail" />;
  // Ambient Audience v2 (parallel-run, AMBIENT_V2_ENABLED) — the SAME rail slot, fed the SAME real
  // inputs (active audience + the live projection ledger), rendering the v2 Overview⇄Simulate flow.
  // Legacy rail is the default; this only swaps the ≥xl thread-rail portal content when the flag is on.
  const audienceRailV2 = (
    <AmbientOverviewRail
      audience={effectiveAudience}
      descriptors={ambientDescriptors}
      reducedMotion={reducedMotion}
      persistedSeals={persistedSimSeals}
    />
  );
  // P2 (A2b) — the <xl header: a 68px bar that expands DOWNWARD. Same props again; rendered at the
  // TOP of the thread branch (below), not the dock.
  const audienceHeader = <AudiencePresence {...presenceCommonProps} variant="header" />;

  // ── Build-an-audience chooser host (UX-04 / D-03 / D-08) ────────────────────
  // onBuilt → the cloned General SIM becomes the active audience; onEvidence reuses
  // the existing evidence-drop file picker (the Profile/From-evidence door, do not
  // rebuild). The From-a-description path navigates to /audience/new?mode=general and
  // returns via the normal audience load on mount.
  // Not mounted while the horizontal is off — all three of its paths mint a mode:'general'
  // SIM, so the whole chooser is horizontal. Its trigger in AudiencePresence is gated on the
  // same flag; this keeps the dialog itself unreachable even if a trigger is ever re-added.
  const buildChooser = !HORIZONTAL_ENABLED ? null : (
    <BuildChooser
      open={buildOpen}
      onOpenChange={setBuildOpen}
      onBuilt={(saved) => {
        // A built SIM becoming active is an audience switch — same re-ground as
        // onSelectAudience above (a stale thought read must not carry the new name).
        focusByThought(null);
        setAudienceAsks([]);
        handleBuiltAudience(saved);
      }}
      onEvidence={() => evidenceInputRef.current?.click()}
    />
  );

  // DELETED (2026-07-17): the sr-only `[data-ambient-card]` focus markers — a shadow copy of the
  // ledger stacked at the top of the scroll region, which is why the scroll-spy never worked.
  //
  // They claimed to let the IntersectionObserver "track the ledger ... WITHOUT forking the shipped
  // card renderers", but all N markers measured 1x1 at y=-1 in one sr-only box ABOVE the focus line
  // while the real cards sat at y=1147..2529. The observer watched five zero-height boxes; the cards
  // scrolled past unobserved and the band stayed pinned to the last descriptor forever.
  //
  // The anchors now ride the REAL cards (message-blocks.tsx `ambientBaseIndex`) — one shared choke
  // point, so no renderer was forked after all. Their other job, a keyboard tap seam, was a second
  // invisible copy of every card's own "See the room →" (which calls the same focusByTap via
  // openRoomForCard). Their data-concept/-fraction/-scroll-quote payload was read by nothing —
  // not one test. Guard: thread/__tests__/ambient-card-anchors.test.tsx.

  // Shared thread content block (rendered in both mode branches below).
  const threadSkillLabel = getSkill(activeTool).label;
  const threadAudienceLabel = selectedAudience?.name ?? "General";
  const threadPresentation = {
    userTurn: lastUserTurn,
    skillLabel: threadSkillLabel,
    audienceLabel: threadAudienceLabel,
  };

  // A3 — Test/URL submit feedback. No thread view renders for the Test tool, so the
  // submit→started→/analyze nav was a silent spinner. Echo the input (ThreadShell)
  // + a live status line (ThreadAssistantTurn) while the run is in flight. Gated on
  // the in-flight window only, so nothing lingers after navigation or an early error.
  const testSubmitPending =
    activeTool === "test" && (submitting || stream.phase === "analyzing");
  const testSubmitTurn = testSubmitPending ? (
    <ThreadShell userTurn={lastUserTurn}>
      <ThreadAssistantTurn>
        <div
          className="flex items-center gap-2 text-sm text-foreground-muted"
          aria-live="polite"
        >
          <Spinner size="sm" />
          <span>
            {/* Upload path stages a file first ("Uploading…"); the URL path goes
                straight to the analysis POST. Both resolve to "Starting analysis…"
                once the stream phase flips to analyzing. */}
            {file && stream.phase !== "analyzing"
              ? "Uploading your video…"
              : "Starting analysis…"}
          </span>
        </div>
      </ThreadAssistantTurn>
    </ThreadShell>
  ) : null;

  const threadContent = (
    <OpenRoomContext.Provider value={openRoomForCard}>
     <InThreadInputContext.Provider value={inThreadInputValue}>
      <FollowupContext.Provider value={sendChatFollowup}>
      {testSubmitTurn}
      {/* Profile thread view (05-06 — D-07) — the profile-read + reaction-distribution
          blocks render here via the shared MessageBlocks renderer (registered in 05-01).
          Not gated on any CARD tool: the evidence-drop affordance is the entry, and the
          profile-read card carries its own Simulate CTA → reaction-distribution lands in
          the SAME thread (SIMU-03). Sibling to the creator tool views — additive only.
          EXCEPT the chat view: ChatThreadView renders the whole thread as ordered turns
          (every block type, via the same MessageBlocks registry), so with chat active this
          bucket would paint the SAME blocks a second time — live-caught when the chat
          default (#316) met the tool-agnostic bucket (a Read-only thread restored to chat
          and "The Read" rendered twice, 2026-07-17). */}
      {!showChatView && persistedProfileBlocks.length > 0 && (
        <div data-testid="profile-thread-view" className="px-1 py-4">
          <MessageBlocks body={persistedProfileBlocks} />
        </div>
      )}

      {/* Ideas thread view — renders above the composer when the Idea tool is active.
          Consumes useIdeasStream state; provides PlatformContext to IdeaCardRenderer
          so the "Develop this →" CTA knows the active platform (D-15).
          Plan 05-04: stages + followupText + error + onRetry wired (STUDIO-01/02 + W2). */}
      {showIdeasView && (
        <IdeasThreadView
          persistedBlocks={persistedIdeaBlocks}
          streamingBlocks={ideasBlocks}
          statusMessage={ideas.statusMessage}
          stages={ideas.stages}
          warnings={ideas.warnings}
          followupText={ideas.followupText}
          outliersAvailable={ideas.outliersAvailable}
          onFindOutliers={() => void ideas.findOutliers()}
          isStreaming={ideas.isStreaming}
          error={ideas.error}
          platform={platform}
          onRetry={() => void ideas.start("", platform)}
          {...threadPresentation}
        />
      )}

      {/* Hooks thread view — renders above the composer when the Hook tool is active.
          Consumes useHooksStream state; provides PlatformContext + HookTestContext
          to HookCardRenderer so the "Test full →" CTA can fire the handoff (D-05).
          Plan 05-04: stages + followupText + error + onRetry wired (STUDIO-01/02 + W2). */}
      {showHooksView && (
        <HooksThreadView
          persistedBlocks={persistedHookBlocks}
          streamingBlocks={hooksBlocks}
          statusMessage={hooks.statusMessage}
          stages={hooks.stages}
          followupText={hooks.followupText}
          warnings={hooks.warnings}
          outliersAvailable={hooks.outliersAvailable}
          onFindOutliers={() => void hooks.findOutliers()}
          isStreaming={hooks.isStreaming}
          error={hooks.error}
          platform={platform}
          onTestHook={handleTestHook}
          onWriteScriptHook={handleWriteScript}
          onRetry={() => void hooks.start("", platform)}
          {...threadPresentation}
        />
      )}

      {/* Script thread view — renders above the composer when the Script tool is active.
          Provides ScriptTestContext so ScriptCardRenderer's "Test full →" can fire.
          Plan 06-05: script send NEVER navigates; no pendingNavRef (T-06-20). */}
      {showScriptView && (
        <ScriptThreadView
          persistedBlocks={persistedScriptBlocks}
          streamingBlocks={scriptBlocks}
          stages={script.stages}
          warnings={script.warnings}
          followupText={script.followupText}
          outliersAvailable={script.outliersAvailable}
          onFindOutliers={() => void script.findOutliers()}
          isStreaming={script.isStreaming}
          error={script.error}
          platform={platform}
          inputHookLine={scriptAnchorHook}
          onTestScript={handleTestScript}
          onRetry={() => void script.start("", platform)}
          {...threadPresentation}
        />
      )}

      {/* Remix thread view — renders above the composer when the Remix tool is active.
          Provides RemixDevelopContext so RemixCardRenderer's "Develop into hooks →" can fire.
          Plan 06-05: remix send NEVER navigates; no pendingNavRef (T-06-20). */}
      {showRemixView && (
        <RemixThreadView
          persistedBlocks={persistedRemixBlocks}
          streamingBlocks={remixBlocks}
          stages={remix.stages}
          followupText={remix.followupText}
          isStreaming={remix.isStreaming}
          error={remix.error}
          platform={platform}
          onDevelop={(adaptedHook, remixPlatform) => void handleDevelopRemix(adaptedHook, remixPlatform)}
          onRetry={() => void remix.start("", platform)}
          {...threadPresentation}
        />
      )}

      {/* Chat thread view — renders above the composer when the Chat tool is active.
          ChatThreadView owns its own empty state + cold-start nudge + error state.
          CRITICAL: chat send NEVER navigates; no pendingNavRef (D-05).
          Follow-up chips SEND A NEW CHAT MESSAGE into this same thread (sendChatFollowup) —
          the agent then routes it. No tool-switch, no blank re-run (the retired behavior).
          The chip tap fires ONLY on onClick — never auto-fires (D-05). */}
      {showChatView && (
        <ChatThreadView
          persistedBlocks={persistedChatBlocks}
          persistedTurns={persistedChatTurns}
          streamingBlocks={chatBlocks}
          streamingCardBlocks={chat.streamingBlocks}
          stages={chat.stages}
          dispatchedSkill={chat.dispatchedSkill}
          isStreaming={chat.isStreaming}
          coldStart={chat.coldStart}
          nudgeShown={chat.nudgeShown}
          error={chat.error}
          niche={undefined}
          platform={platform}
          onFollowup={sendChatFollowup}
          {...threadPresentation}
        />
      )}

      {/* Explore thread view — renders above the composer when the Explore tool is active.
          Its idle quick-actions moved OUT to the starter (THE STARTER CONTRACT), so this
          view now renders only what Explore produces: the progress spine, the error, the
          outlier grids. Tile taps fire the discover→remix chain internally, surfacing the
          persisted remix-card via onThreadReload (in-place, RESEARCH Q2).
          CRITICAL: Explore NEVER navigates to /analyze — the starter's cards and onRetry
          both call explore.start (no pendingNavRef, Pitfall 1). */}
      {showExploreView && (
        <ExploreThreadView
          persistedBlocks={persistedExploreBlocks}
          streamingBlocks={exploreBlocks}
          stages={explore.stages}
          isStreaming={explore.isStreaming}
          error={explore.error}
          platform={platform}
          onRetry={() => void explore.start({})}
          onThreadReload={() => void reloadOpenThread()}
          {...threadPresentation}
        />
      )}

      {/* Account Read thread view (A5) — one-tap self-Read. Owns its idle CTA + the
          profile-shaped loading skeleton; canSubmit is false (the in-view CTA is the entry). */}
      {showAccountView && (
        <AccountReadThreadView
          block={account.block}
          isStreaming={account.isStreaming}
          error={account.error}
          fallbackMessage={account.fallbackMessage}
          onRun={() => void account.start()}
          userTurn={lastUserTurn}
        />
      )}
      </FollowupContext.Provider>
     </InThreadInputContext.Provider>
    </OpenRoomContext.Provider>
  );

  // Shared form element (identical markup; referenced by both layout branches).
  const composerForm = (
    <form
      data-testid="composer"
      data-layout={homeThreadMode ? "thread" : layout}
      onSubmit={onSubmitForm}
      onDragOver={(e) => {
        // Evidence-drop overlay (D-07). Additive: VideoUpload stops propagation on its
        // own drop zone, so the creator upload path is unaffected. Inert while the ask verb
        // owns the field — submit goes to askAudience, so a staged file would be dropped.
        if (isAsk) return;
        e.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragOver(false);
      }}
      onDrop={(e) => {
        if (isAsk) return;
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) acceptEvidenceFile(f);
      }}
      className="relative w-full"
    >
        {/* Drag-over overlay (05-UI-SPEC Surface 3) — matte surface + float shadow,
            appears only while dragging; dismisses on drop/leave. Respects reduced motion. */}
        {dragOver && (
          <div
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-2xl border border-dashed border-white/[0.10] bg-surface shadow-float"
            data-testid="evidence-drop-overlay"
          >
            <p className="text-sm text-foreground-secondary">{EVIDENCE_DROP_HINT}</p>
          </div>
        )}
        <div className="relative p-4">
          {/* `/` slash command menu (UX-01) — opens UPWARD above the composer when
              the field value starts with `/`. Filterable; selecting sets the skill
              and clears the `/`. Reuses SkillRows (the same list as the skill pill). */}
          {slashActive && (
            <div
              role="menu"
              aria-label="Skills"
              className={cn(
                "absolute bottom-[calc(100%+10px)] left-3 z-50",
                "w-[320px] max-w-[calc(100%-1.5rem)] max-h-[60vh] overflow-y-auto",
                "rounded-xl border border-white/[0.06] bg-surface-elevated p-1.5",
                "shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
                "origin-bottom-left animate-[composer-pop_.14s_ease-out]",
              )}
            >
              <SkillRows
                active={activeTool}
                filter={slashQuery}
                onSelect={selectSkill}
                activeMode={selectedAudience?.mode ?? "socials"}
              />
            </div>
          )}

          {/* Test brief banner (Task 2 — D-05/D-06 handoff).
              Shown when "Test full →" was clicked on a hook card; surfaces the
              chosen hook as the anchored brief. Reminds the creator to shoot + upload
              the REAL video — SIM-1 Max scores the real thing, not this text (D-05). */}
          {activeTool === "test" && testBrief && (
            <div
              className="mb-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 flex items-start justify-between gap-2"
              data-testid="test-brief-banner"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground-muted/60 mb-0.5">
                  Shoot this hook → upload → SIM-1 Max scores the real thing
                </p>
                <p
                  className="text-sm font-medium text-foreground leading-snug"
                >
                  &ldquo;{testBrief.hookLine}&rdquo;
                </p>
                {testBrief.audienceArchetype && (
                  <p className="text-xs text-foreground-muted/50 mt-0.5">{testBrief.audienceArchetype}</p>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss hook brief"
                onClick={() => setTestBrief(null)}
                className="shrink-0 text-foreground-muted/40 hover:text-foreground-muted transition-colors text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* Evidence chip (05-UI-SPEC Surface 3) — the staged chat/screenshot/clip.
              Removable (filename + ×), neutral elevated surface, cream text, no accent. */}
          {evidenceFile && (
            <div
              className="mb-2.5 flex items-center gap-2 rounded-lg bg-surface-elevated px-3 py-2"
              data-testid="evidence-chip"
            >
              <Paperclip className="h-4 w-4 shrink-0 text-foreground-muted" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{evidenceFile.name}</span>
              <button
                type="button"
                aria-label="Remove attachment"
                onClick={() => {
                  setEvidenceFile(null);
                  setEvidenceError(null);
                }}
                className="shrink-0 rounded p-0.5 text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Upload drop zone — Test ABSORBS the upload (v6 — THE-ROOM-HANDOFF §3.5): the
              zone reveals when the creator INTENTIONALLY enters Test (showUpload, set on an
              explicit Test pick or a hook/script "Test full →" handoff) or a file is staged,
              so "Test = upload a video" needs no separate `+` control — and the empty-home
              default stays a clean topic composer. VideoUpload (bare) is always mounted so
              its file input is part of the composer; a staged file keeps it visible. */}
          <div
            className={cn(
              "overflow-hidden",
              showUpload || file
                ? "mb-2 border-b border-white/[0.06] pb-2"
                : "hidden",
            )}
          >
            <VideoUpload bare file={file} onFileSelect={setFile} />
          </div>

          {/* Two-row composer (Claude / Perplexity pattern): the field owns the FULL-WIDTH
              top row so it has real height + breathing room; the controls sit on a bottom
              row — [✦ Verb ▾] on the left, evidence attach + cream send on the right. This
              replaces the old single cramped bar. Banners + the Test upload zone stack ABOVE.
              Tool selection is NEVER a submit (Pitfall #5 / WR-05). */}
          <div className="flex flex-col gap-3.5">
            {/* Row 1 — the field. textarea (auto-multiline); Enter submits, Shift+Enter
                newlines (onFieldKeyDown). Test/Remix carry a URL; `/` opens the skill menu. */}
            <textarea
              rows={1}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={onFieldKeyDown}
              placeholder={activePlaceholder}
              aria-label={
                activeTool === "idea"
                  ? "Idea topic or angle (leave empty for Auto)"
                  : activeTool === "hooks"
                    ? "Hook topic (leave empty for Auto)"
                    : activeTool === "chat"
                      ? "Ask anything about your content"
                      : activeTool === "script"
                        ? "Script topic or leave empty to carry in a hook"
                        : activeTool === "remix"
                          ? "Paste a TikTok URL to decode and remix"
                          : hasSimulation
                            ? "Ask about this simulation"
                            : "Paste a TikTok link"
              }
              aria-invalid={showUrlError || undefined}
              className={cn(
                "w-full min-w-0 resize-none bg-transparent px-1 pt-0.5 text-[15px] text-foreground",
                "placeholder:text-foreground-muted focus:outline-none",
                // The empty box breathes: the placeholder sits at the top and the controls
                // rest at the bottom edge with real void between them. This air — not the
                // radius or the border — is what separates a premium composer from a cramped one.
                "min-h-[72px] max-h-[200px] leading-[1.55]",
              )}
            />

            {/* Row 2 — controls, split the way Claude/Perplexity split theirs: the LEFT
                cluster is what you're about to do (attach · verb), the RIGHT cluster is what
                you're talking to (the SIM-1 tier) plus the send. Every control is a bare or
                quietly-filled glyph — the cream send disc is the surface's ONE bright element.
                The skill menu is mode-scoped (07-01/UX-02/D-07): activeMode is DERIVED from the
                selected audience (null/Socials → "socials" — Pitfall 2). */}
            <div className="flex items-center justify-between gap-2">
              {/* LEFT cluster — attach + verb. The `+` attach is HIDDEN while the ask verb owns
                  the field: submit routes to askAudience (onSubmitForm's first branch), so a staged
                  evidence file would be silently discarded. The verb chip STAYS in every mode —
                  it's the only way OUT of Ask (Ask is a verb now, not a trap you can't leave). The
                  file <input> stays mounted regardless — handleUserSelectTool("profile") clicks it. */}
              <div className="flex min-w-0 items-center gap-1.5">
                {/* In-input evidence attach (05-06 / D-07) — a chat / screenshot (the Profile
                    evidence door). Opens a file picker; drag-drop is the form overlay. */}
                <input
                  ref={evidenceInputRef}
                  type="file"
                  accept={EVIDENCE_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) acceptEvidenceFile(f);
                    e.target.value = ""; // allow re-selecting the same file
                  }}
                />
                {!isAsk && (
                  <button
                    type="button"
                    aria-label={EVIDENCE_ATTACH_LABEL}
                    title={EVIDENCE_ATTACH_LABEL}
                    onClick={() => evidenceInputRef.current?.click()}
                    className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-foreground-muted transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10 pointer-coarse:h-11 pointer-coarse:w-11"
                  >
                    <Plus className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </button>
                )}

                <ComposerControls
                  activeTool={activeTool}
                  onSelectTool={handleUserSelectTool}
                  activeMode={selectedAudience?.mode ?? "socials"}
                  onRunExplore={(params) => void explore.start(params)}
                  className="shrink-0"
                />
              </div>

              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
                <SimModelSelector
                  value={selectedModel}
                  onChange={setSelectedModel}
                  className="hidden sm:inline-flex"
                />

                {/* Submit — the cream disc. boxShadow is forced off inline so the primary
                    variant's dark 2px ring (--shadow-button) can never re-add a border. */}
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  // Account fell through to "Simulate" here — it was never submittable, so the
                  // chain never needed a case for it. Now that send RUNS the read, the button
                  // has to say so: a screen-reader user pressing "Simulate" and being charged
                  // for an account scrape is the same bug as a sighted one, just louder.
                  aria-label={isAsk ? "Ask the room" : evidenceFile ? "Read this evidence" : activeTool === "idea" ? "Generate ideas" : activeTool === "hooks" ? "Generate hooks" : activeTool === "chat" ? "Send message" : activeTool === "script" ? "Generate script" : activeTool === "remix" ? "Remix video" : activeTool === "explore" ? "Run Explore" : activeTool === "account" ? "Read my account" : "Simulate"}
                  disabled={isAsk ? url.trim().length === 0 || asking : evidenceFile ? profiling : !canSubmit}
                  loading={isAsk ? asking : profiling || submitting || ideas.isStreaming || hooks.isStreaming || chat.isStreaming || script.isStreaming || remix.isStreaming || explore.isStreaming}
                  style={{ boxShadow: "none" }}
                  className="shrink-0 h-[36px] w-[36px] min-w-0 p-0 rounded-full"
                >
                  <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.25} />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Errors — non-TikTok URL (D-21), Test tool only. Upload-type errors are surfaced by VideoUpload. */}
        {showUrlError && (
          <p className="mt-2 px-1 text-sm text-error" role="alert">
            {ERROR_NON_TIKTOK}
          </p>
        )}

        {/* WR-04 — Test upload pre-flight failure (session-expired / storage-upload). Was a
            silent no-op: the button reset with no feedback. Cleared on the next submit. */}
        {submitError && (
          <p className="mt-2 px-1 text-sm text-error" role="alert">
            {submitError}
          </p>
        )}

        {/* Evidence reject / run error (05-UI-SPEC) — inline muted, never a blocking modal (D-09). */}
        {evidenceError && (
          <p className="mt-2 px-1 text-sm text-foreground-muted" role="alert">
            {evidenceError}
          </p>
        )}

        {/* The balance. Quiet by construction: a Reading is what the plan is sold on, so the
            number belongs where a Reading is spent — but it is a footnote, not a warning, until
            it starts running out (readingsBalanceTone). Absent entirely for `free`, who have no
            balance to show (see BillingSection). */}
        {readingsBalanceLabel && (
          // Right-aligned, so it sits under the submit button — where the Reading is spent —
          // and, on mobile, clear of the sidebar's fixed avatar in the bottom-left corner,
          // which was sitting on top of it.
          <p className={`mt-2 px-1 text-right text-xs ${readingsBalanceTone}`}>
            {readingsBalanceLabel}
          </p>
        )}
      </form>
  );

  // Bottom dock — the composer is ONE clean surface. On empty / permalink home the audience
  // room stays closed (no composer-row chip); thread mode hosts presence in the rail (≥xl) or
  // header (<xl). `roomExpanded` still blooms the dock panel when triggered programmatically.
  const composerDock = (
    <div data-testid="composer-dock" className="pointer-events-auto relative flex w-full flex-col">
      {/* The audience room, ONE mount routed by breakpoint/mode:
          ≥xl thread → PORTALED to HomePageLayout's right rail (A2a);
          <xl thread → the HEADER above the thread (A2b, rendered in the thread branch — not here);
          empty / permalink → bloom panel only while roomExpanded (no chip affordance on home). */}
      {useRail && railHost
        ? createPortal(AMBIENT_V2_ENABLED ? audienceRailV2 : audienceRail, railHost)
        : useHeader || !roomExpanded
          ? null
          : audiencePresence}
      <div className="relative w-full">
        {/* Opaque page-bg backdrop — thread mode ONLY, where the dock floats over the scroll.
            The card is opaque, but its rounded corners and the 16px strip below it are not, so
            scrolled messages used to stay visible in a band under the composer. This paints the
            page colour behind exactly the card's own footprint (+16px down), so the thread
            vanishes UNDER the card while the audience tab above keeps its see-through rounded
            corners. Column-width, so it never over-paints. Omitted on the centered home: nothing
            scrolls behind there, and being positioned it would paint over the starter chips. */}
        {homeThreadMode && (
          <div
            aria-hidden
            data-testid="composer-backdrop"
            className="pointer-events-none absolute inset-x-0 -bottom-4 top-0 bg-background"
          />
        )}
        <div
          className={cn(
            "relative w-full rounded-[24px] border border-white/[0.06] bg-surface-elevated",
            // The dock panel blooms flush with the composer top → flatten the box's top edge so
            // the two read as one surface. Driven by the VISUAL expand, never the ask verb.
            !roomExpanded && "overflow-hidden",
            roomExpanded && "rounded-t-none border-t-0",
            layout === "centered" && "shadow-float",
            !reducedMotion && "transition-shadow duration-200",
          )}
        >
          {composerForm}
          {buildChooser}
        </div>
      </div>

      {/* The quota wall (402). A modal, unlike every other error here, on purpose: the run did
          not fail — it was refused, and the only way forward is a decision (upgrade, or wait
          for the reset). An inline muted line would leave the user re-pressing a button that
          can never work. */}
      {stream.quotaError && (
        <ReadingLimitDialog
          open
          quota={stream.quotaError}
          renewsAt={usage?.renewsAt ?? null}
          onClose={stream.clearQuotaError}
        />
      )}
    </div>
  );

  // ── The starter (THE STARTER CONTRACT — home-starter.tsx) ────────────────────
  // The SAME SIX cards under every skill — the map of what the app does, which must not
  // redraw itself when the creator turns. It shows on the fresh home only, and retires the
  // moment real content lands. What is ARMED is told by the skill chip + the placeholder,
  // not by this grid.
  //
  // It no longer needs to follow the creator into thread mode: that was only ever to keep
  // Account reachable, and Account now rides the send button like every other skill.
  const homeStarter = !hasConversationContent ? (
    <HomeStarter
      onSelectTool={handleUserSelectTool}
      onAccountRun={handleStarterAccountRun}
      className="mt-6"
    />
  ) : null;
  // The first-run demo POSTs a canned chat fixture straight to /api/tools/profile — the ONE
  // horizontal entry point that bypasses the skill menu entirely, so disabling the Profile
  // verb is not enough to close it. Gated on the same flag (owner call 2026-07-13); the
  // component and its fixture stay put for the day the horizontal comes back.
  const homeFirstRunDemo =
    HORIZONTAL_ENABLED && !hasConversationContent ? (
      <HomeFirstRunDemo
        onDemoComplete={() => void reloadProfileThread()}
        className="mt-5"
      />
    ) : null;

  // ── Layout branches ────────────────────────────────────────────────────────
  //
  // Branch A — Home thread mode (hasThread && !hasSimulation):
  //   Full-height flex column. Thread region scrolls; form row is shrink-0
  //   (pinned at the bottom of the column). The parent HomePageLayout provides
  //   the height context (h-full) so this column fills the main area.
  //
  // Branch B — All other states (empty home / permalink):
  //   Original centered layout. Thread views + form inside one flex-col column,
  //   grows with content. Permalink pinning is handled by the Reading wrapper.
  //
  if (homeThreadMode) {
    return (
      <div
        data-testid="composer-shell"
        data-layout="thread"
        className={cn(
          // Full-width shell so the scroll region spans the whole surface (the
          // conversation scrolls page-wide, not inside a narrow 760px column) —
          // content is re-centered at 760px INSIDE the scroll + dock so it reads
          // like a real chat surface. Scrollbar itself is hidden app-wide (globals.css).
          // `relative` roots the floating dock's absolute positioning (below).
          "relative flex h-full w-full flex-col",
          className,
        )}
      >
        {/* P2 (A2b) — the mobile/tablet audience HEADER (<xl only; the rail owns ≥xl). A 68px bar
            above the thread that expands DOWNWARD, top-anchored so it survives the keyboard (§2).
            shrink-0 so it holds its height; the sheet blooms over the thread below (z-55). The
            xl:hidden is belt-and-suspenders against the one-frame pre-hydration flash. */}
        {useHeader && (
          <div data-testid="audience-header-slot" className="relative z-10 shrink-0 px-4 pt-2 xl:hidden">
            <div className="mx-auto w-full max-w-[760px]">{audienceHeader}</div>
          </div>
        )}
        {/* Scrollable thread region — full width, fills the FULL shell height and scrolls
            UNDER the floating dock (the dock is absolutely positioned below, not in flow).
            The bottom padding clears the collapsed dock so the last message can rest just
            above the composer instead of hiding behind it.
            registerThreadRegion roots the scroll-spy IntersectionObserver on this element
            (Pattern 5). It observes the `[data-ambient-card]` anchors that the REAL cards carry
            (message-blocks.tsx), so the spotlight tracks the ledger as it actually scrolls (D-01). */}
        <div
          ref={registerThreadRegion}
          data-testid="composer-thread-region"
          className="flex-1 min-h-0 overflow-y-auto pb-[184px]"
        >
          <div className="w-full max-w-[760px] mx-auto px-4">
            {/* A1: while a switch is rehydrating and no content has landed yet, fill the
                scroll with the branded skeleton — never the prior thread's emptied views
                or the centered serif hero. When the persisted blocks arrive (or it's a
                brand-new empty thread) hasConversationContent / rehydrating settle and
                threadContent takes over. */}
            {/* No starter here. It used to follow the creator into thread mode purely to keep
                Account reachable (its in-view CTA was its only door); Account now rides the
                send button, so the grid stays what it should be — a fresh-home affordance. */}
            {rehydrating && !hasConversationContent ? (
              <ThreadLoadingSkeleton variant="chat" caption="Opening thread…" />
            ) : (
              threadContent
            )}
          </div>
        </div>

        {/* Floating bottom dock — audience + composer fused as one surface, overlaid on the
            scroll so chat passes BEHIND it. The wrapper itself stays transparent + click-through
            (pointer-events-none) so the thread still shows around the audience tab's rounded top
            corners; the opaque page-bg backdrop that hides scrolled content lives on the composer
            BOX (see composerDock), which is where the card actually starts. Content is re-centered
            at 760px to align with the thread column above. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 pb-4">
          <div className="w-full max-w-[760px] mx-auto px-4">
            {composerDock}
          </div>
        </div>
      </div>
    );
  }

  // Branch B: centered / permalink layout. The presence NEVER hides (D-01) — at rest it
  // is the composer's room chip (identity + liveness, control row); opening it blooms the
  // panel above the box. `ambientFocus` is null here (no thread cards to focus), so an
  // opened room reads readiness, never a stale reaction.
  return (
    <div className={cn("w-full max-w-[760px] mx-auto flex flex-col pb-4", className)}>
      {threadContent}
      {/* The FIELD is the hero (2026-07-20, owner call — the reference pattern): the empty
          home reads greeting → composer → starter. The cards are suggestions UNDER the
          field, not a wall in front of it. The show-once demo stays a quiet footer below. */}
      {AMBIENT_V2_ENABLED && !hasConversationContent && !startEngaged ? (
        // Ambient v2 Start (④) as the empty-home hero (parallel-run): the categorized skill grid.
        // Picking a skill (option B) arms the tool + drops into the normal fresh-chat home below.
        <AmbientStartHome
          audience={effectiveAudience}
          // The Start grid ids are curated SKILL_RUN_META keys (all valid ToolIds).
          onSkill={pickStartSkill}
          onSubmit={seedAndRun}
          activeSkillId={activeTool}
        />
      ) : (
        // Post-pick (option B, owner call 2026-07-23): drop straight into the fresh-chat start —
        // the same composer + starter + demo as the legacy home, with the chosen skill armed. No
        // bespoke bare-field state, no back-to-grid chrome; picking a skill just enters the chat.
        <>
          {composerDock}
          {homeStarter}
          {homeFirstRunDemo}
        </>
      )}
    </div>
  );
}
