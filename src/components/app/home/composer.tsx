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
 *   MUST NOT set pendingSealRef.current = true and MUST NOT call stream.start —
 *   those are exclusive to the Test upload/URL paths so an Idea send never
 *   navigates to /analyze/[id] (T-03-13, WR-05).
 *   The platform chip (D-07) sets the first-class platform param on the Ideas request.
 *   Client-side URL relax for the idea tool is UX-only; the server route independently
 *   validates the ask (WARNING-5, T-03-15).
 *
 *   useIdeasStream drives IdeasThreadView rendered above the composer when active.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// CreditWallRefusal / isCreditWallRefusal went with `askAudience` (step 4) — it was the one
// caller here that had to distinguish "refused" from "failed" to avoid recording a dead ask.
import { reportCredit402 } from "@/lib/billing/credit-wall";
import { reportSession401, SESSION_EXPIRED_MESSAGE } from "@/lib/auth/session-expired";
import { runErrorCopy, runFailureCauseOf } from "@/lib/net/run-failure";
import { createPortal } from "react-dom";
import {
  OpenRoomContext,
  HookTestContext,
  HookWriteScriptContext,
  SimulateVideoContext,
  OutlierGridActionsContext,
} from "@/lib/hook-test-context";
import { InThreadInputContext } from "@/lib/in-thread-input-context";
import { FollowupContext } from "@/lib/followup-context";
import { PlatformContext } from "@/lib/platform-context";
import { ScriptTestContext } from "@/lib/script-test-context";
import { RemixDevelopContext } from "@/lib/remix-develop-context";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Plus, Square } from "lucide-react";
import { Paperclip, X as XIcon } from "@phosphor-icons/react";
import { nanoid } from "nanoid";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { HORIZONTAL_ENABLED } from "@/lib/flags/horizontal";
import { AMBIENT_V2_ENABLED } from "@/lib/flags/ambient-v2";
import { AmbientOverviewSheet } from "@/components/audience-lens/v2/AmbientOverviewSheet";
import { MOBILE_NAV_BAND } from "@/components/sidebar/Sidebar";
import type { WireSimSealMap } from "@/lib/onboarding/verdict-seal";
import { queryKeys } from "@/lib/queries/query-keys";
import {
  setActiveThreadCookie,
  getActiveThreadCookie,
  NEW_THREAD_SENTINEL,
} from "@/lib/threads/active-thread-cookie";
import { Button } from "@/components/ui/button";
import { VideoUpload } from "@/components/app/video-upload";
import { useAnalysisStream } from "@/hooks/queries/use-analysis-stream";
import { STREAM_TIMEOUT_ERROR } from "@/lib/engine/stream-errors";
import { useSubscription } from "@/hooks/use-subscription";
import { isPaidPlanId, creditsRemainingLabel, creditCost } from "@/lib/pricing";
import { useBoardStore } from "@/stores/board-store";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useToast } from "@/components/ui/toast";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useOnline } from "@/hooks/use-online";
import { createClient } from "@/lib/supabase/client";
import {
  ComposerControls,
  Ico,
  MAX_BILLABLE_BY_TOOL,
  UpwardPopover,
  SimModelSelector,
  SkillRows,
  SKILLS,
  SKILL_ICON,
  getSkill,
  isSkillVisible,
  type ToolId,
  type Intent,
  type SkillModel,
} from "./composer-controls";
// ── Composer v8 (CONCEPT_V8_ENABLED — platform concept Phase 1) ──────────────
import { CONCEPT_V8_ENABLED } from "@/lib/flags/concept-v8";
import { SkillPill, SkillsPanel } from "./v8/skills-panel";
import { ComposerSubBar } from "./v8/sub-bar";
import { VerdictReport, type ReportSubject } from "./v8/verdict-report";
import { useFireSim } from "./v8/use-fire-sim";
import { AudienceSheetV8 } from "./v8/audience-sheet";
import { ChipsRow } from "./v8/chips-row";
import { ArrivalV8 } from "./v8/arrival";
// ── Composer v8 Phase 2 (the shelf) ──────────────────────────────────────────
import { DropShelf } from "./v8/drop-shelf";
import { useLazyWarm } from "@/lib/surfaces/use-lazy-warm";
import type { LiveDropCard } from "@/lib/surfaces/live-cards";
import { usePlatformLens, LENS_LABEL } from "./v8/platform-lens";
import type { Platform } from "./platform-chip";
import type { Audience, AudiencePlatform } from "@/lib/audience/audience-types";
import { goalIntentToLens } from "@/lib/audience/intent-lens";
import { useIdeasStream } from "@/hooks/queries/use-ideas-stream";
import { useHooksStream } from "@/hooks/queries/use-hooks-stream";
import { useChatStream } from "@/hooks/queries/use-chat-stream";
import { PersistedThreadStream, type LiveTurn } from "@/components/thread/persisted-thread-stream";
import { useActiveRun } from "@/components/app/home/use-active-run";
import type { ChatTurnKind } from "@/lib/tools/chat-followups";
import { useOutlierGridActions } from "@/components/app/home/use-outlier-grid-actions";
import { isChatAgentThread, orderedAssistantBlocks, orderedTurns } from "@/components/app/home/rehydrate-thread";
import { ThreadIdContext } from "@/lib/save-provenance-context";
import type { RehydrateTurn } from "@/components/app/home/rehydrate-thread";
import { useScriptStream } from "@/hooks/queries/use-script-stream";
import { useRemixStream } from "@/hooks/queries/use-remix-stream";
import { useExploreStream } from "@/hooks/queries/use-explore-stream";
import { useAccountReadStream } from "@/hooks/queries/use-account-read-stream";
import { ThreadLoadingSkeleton } from "@/components/thread/thread-loading";
import { ThreadShell, ThreadAssistantTurn } from "@/components/thread/thread-shell";
import { ProgressChecklist } from "@/components/thread/progress-checklist";
import { SKILL_RUN_META } from "@/components/thread/run-capsule";
import { useTestRunStages } from "@/components/thread/use-test-run-stages";
import { useTestRunEvidence } from "@/components/thread/use-test-run-evidence";
import { SkillRunError } from "@/components/thread/run-notices";
import { Spinner } from "@/components/ui/spinner";
import { AudiencePresence, type AudiencePresenceProps } from "@/components/audience-lens/audience-presence";
import { AmbientOverviewRail } from "@/components/audience-lens/v2/AmbientOverviewRail";
import { AmbientStartHome } from "@/components/audience-lens/v2/AmbientStartHome";
import { SimulateDoorHost } from "@/components/audience-lens/v2/SimulateDoorHost";
import type { BroughtStimulus } from "@/components/audience-lens/v2/AmbientSimulate";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { BuildChooser } from "./build-chooser";
import { HomeStarter, HomeFirstRunDemo } from "./home-starter";
import { HomeAudienceIntro } from "./home-audience-intro";
import { useAmbientFocus, type AmbientCardDescriptor } from "./use-ambient-focus";
import { useThreadAutoscroll } from "./use-thread-autoscroll";
import { buildAmbientDescriptors, resolveFocusDescriptor } from "./ambient-descriptors";
import { detectRefineIntent } from "@/lib/tools/refine";
// TikTok-only client check (D-21, WR-01). The pattern is the SHARED trust-
// boundary regex (src/lib/tiktok-url.ts) imported by BOTH the composer and the
// server /api/analyze route, so the fast UX reject can never drift from the
// server check. ContentForm's SOCIAL_URL_PATTERN ALSO allows Instagram — the
// slim composer must NOT (TikTok-only for v1).
import { TIKTOK_URL_PATTERN } from "@/lib/tiktok-url";
import { track } from "@/lib/analytics/funnel-events";
import { consumePendingUpload } from "@/lib/onboarding/pending-upload";
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
  /** A skill has been armed from the v2 Start grid — opens the audience rail. */
  onEngagedChange?: (engaged: boolean) => void;
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

export function Composer({ className, onThreadChange, onEngagedChange, onConversationChange, onRehydratingChange, railHost = null }: ComposerProps) {
  const router = useRouter();
  const { toast } = useToast();
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

  // ── The armed skill, and the skill that RAN ────────────────────────────────
  //
  // TWO pieces of state, because they answer two different questions and one variable
  // answering both is what made the one-shot dangerous to build.
  //
  //   activeTool  — what the NEXT send will do. The submit router, the placeholder, the
  //                 model tier, the Start tile highlight, the armed indicator.
  //   runningTool — what the LAST send actually did. Everything keyed on the run that is
  //                 on screen: the Test progress spine + failure turn, the Room Rewrite
  //                 CTA and its reseed. Survives the revert; restored on reload from the
  //                 thread's own last card.
  //
  // ⚠️ THE ONE-SHOT (Lane 2 step 5). A skill is armed for exactly ONE send: `armFired()`
  // inside handleSubmit puts activeTool back to chat the moment a run is actually
  // dispatched. With the skill pill gone there is no chip to un-arm yourself with, so an
  // arm that outlived its run would be a trap — reload into a thread of hook cards and
  // every plain sentence you typed would silently buy another hooks pack.
  //
  // Reverting on SUBMIT, not on completion, is deliberate: a run that FAILS leaves nothing
  // armed either, and its retry re-arms explicitly (`handleSubmit("test")`), so a retry can
  // never fire the wrong skill. And a branch that BAILS before dispatching (the General-verb
  // audience gate, an expired session, a failed upload) never calls armFired at all, so the
  // creator keeps their arm and can just press send again.
  //
  // NOTE: arming is NOT a submit; it MUST NEVER arm pendingSealRef (Pitfall #5).
  const [activeTool, setActiveTool] = useState<ToolId>(DEFAULT_TOOL);
  const [runningTool, setRunningTool] = useState<ToolId | null>(null);
  // Has a run been DISPATCHED in this thread since mount/switch? The rehydration below seeds
  // `runningTool` from the thread's last persisted card, and that fetch is a round-trip — so
  // without this it lands AFTER a run the creator started in the meantime and overwrites it
  // with whatever the thread used to hold (null, on a fresh thread). Caught by the Test
  // failure-turn suite the moment the seed was added: a funnel visitor's dead run rendered
  // NOTHING, because the reload had just wiped the `runningTool === "test"` the run had set.
  const hasDispatchedRunRef = useRef(false);
  // Every real dispatch goes through here, so the guard can never be set in one place and
  // forgotten in another. `armFired` (handleSubmit) and the card-chain handoffs all call it.
  const noteRun = useCallback((tool: ToolId) => {
    hasDispatchedRunRef.current = true;
    setRunningTool(tool);
  }, []);
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
  // WireSimSealMap, not SimSealMap: this branch seals the sim verdict SERVER-side, so what the
  // client holds is the WIRE shape with the verdict withheld until it is paid for.
  const [persistedSimSeals, setPersistedSimSeals] = useState<WireSimSealMap>({});
  // The Start grid hands back a tile id as a plain string. It used to be CAST — `id as ToolId` —
  // which is how a one-character typo (`ideas` for `idea`) armed a tool no branch matched and
  // dropped the creator into handleSubmit's final else: the paid SIM-1 Max video Test (F-017).
  // A cast cannot fail, so tsc never saw it and the pill happily read "Ideas" the whole time.
  // Validate against the SKILLS registry instead: an unknown id now arms NOTHING, so the worst a
  // future tile typo can do is make its tile inert — never spend a creator's money on the wrong skill.
  const pickStartSkill = useCallback(
    (id: string) => {
      const skill = SKILLS.find((s) => s.id === id);
      if (!skill) return;
      handleUserSelectTool(skill.id);
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
  // `roomExpanded` is PURELY VISUAL: it blooms the dock peek (empty/permalink) and expands the
  // <xl header sheet — nothing more. It used to be `audienceOpen`, a fused flag that ALSO put
  // the composer field into a hidden "ask the room" input MODE. That mode died in 07-18, when
  // it became the explicit `ask` VERB; the verb itself died on 2026-07-28 (owner call, Lane 2
  // step 4 — see the deleted SKILLS entry in composer-controls.tsx for why). Nothing routes
  // the composer field at the room any more: the room's own armed sim is the one door, and
  // `/api/tools/react` keeps its price through that door. The rail (≥xl) ignores this flag
  // entirely (persistent, in-flow), so it's only the dock + header that read it.
  const [roomExpanded, setRoomExpanded] = useState(false);
  // True while the presence was opened by a card's "See the room →" (a targeted single-card
  // entry) → the Room drills straight into that card instead of the ranked overview. Reset on
  // close so the next plain tab-tap opens the overview (the default bloom).
  const [roomDrill, setRoomDrill] = useState(false);
  // Wrap the expand/collapse setter so collapsing always clears the drill intent.
  const handleRoomExpandedChange = useCallback((next: boolean) => {
    setRoomExpanded(next);
    if (!next) setRoomDrill(false);
  }, []);

  const selectedAudience = audiences.find((a) => a.id === selectedAudienceId) ?? null;
  // ── v8 composer state (CONCEPT_V8_ENABLED) ─────────────────────────────────
  const [skillsPanelOpen, setSkillsPanelOpen] = useState(false);
  const [audienceSheetOpen, setAudienceSheetOpen] = useState(false);
  const skillPillRef = useRef<HTMLButtonElement | null>(null);
  // Anchors the v8 slash-menu portal to the field block (see the slash-menu mount).
  const slashAnchorRef = useRef<HTMLDivElement | null>(null);
  const {
    lens: platformLens,
    setLens: setPlatformLens,
    note: lensNote,
  } = usePlatformLens(selectedAudience);
  // The RESOLVED audience: `selectedAudienceId === null` means the General default (a virtual
  // constant absent from the `audiences` rows), so `selectedAudience` is null there. Fall back to
  // GENERAL_AUDIENCE so surfaces that need a concrete audience (the Ambient v2 Start/Overview) always
  // have one — mirrors how AudiencePresence treats a null audience as General internally.
  const effectiveAudience = selectedAudience ?? GENERAL_AUDIENCE;
  // Sent as the first-class platform param to the skill routes.
  // v8: platform is a RUN LENS (next-run-only — read at submit time), decoupled from the
  // audience (audiences.platform = provenance). Legacy: derived from the audience (D-07).
  const platform: Platform = CONCEPT_V8_ENABLED
    ? platformLens
    : audienceToPlatform(selectedAudience?.platform);

  // ── v8 report state (Phase 3) ──────────────────────────────────────────────
  // `roomExpanded` stays the OPEN flag (the sub-bar door and a card's "See the room →" both set
  // it); the SUBJECT is what the report is a report OF. Null ⇒ the honest empty state, never a
  // fabricated figure.
  const [reportSubject, setReportSubject] = useState<ReportSubject | null>(null);
  const [reportPinned, setReportPinned] = useState(false);
  const { watching: simWatching, snapshots: simSnapshots, fireSim: fireCardSim } = useFireSim();
  // The descriptor id whose fired run should land IN the open report when it seals.
  const pendingSimIdRef = useRef<string | null>(null);

  // A drop's meter → its CACHED read. This path never touches the network: the drops are the only
  // pre-scored surface, and opening one's report READS the cache (SSOT §1, fire-on-demand).
  const openReportForDrop = useCallback((card: LiveDropCard) => {
    setReportSubject({ id: card.contentId, title: card.hook, personas: card.personas });
    setRoomExpanded(true);
  }, []);

  // Task C (v6): intent is a PROPERTY OF THE AUDIENCE's goal (goal_intent → grow/sell lens),
  // never a per-run composer toggle (the Grow/Sell control retired — THE-ROOM-HANDOFF §3.5).
  // Switching audience swaps the lens automatically. Still sent to the skill routes (a calibrated
  // audience re-frames the SIM verdict; General → no-op).
  const intent: Intent = goalIntentToLens(selectedAudience?.goal_intent ?? null);

  // ── Open thread id (07-05 — D-04 per-thread pin for AudienceChip) ───────────
  // Captured on mount from GET /api/threads/open (returns threadId).
  // Null before first thread is created (first Ideas/Hooks send creates it).
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);

  // Keep the newest turn in view. Keyed on the open thread so switching threads always lands on
  // the latest turn rather than inheriting a pin the creator released in the previous one.
  //
  // Declared HERE, immediately after `openThreadId` (its only input), rather than beside the
  // thread render — the in-thread card handoffs below (`handleWriteScript`, `handleDevelopRemix`)
  // FIRE runs and must re-pin, and a `const` read from a callback defined above its declaration
  // is a TDZ throw, not a stale closure.
  const { registerScrollRegion, scrollThreadToBottom } = useThreadAutoscroll(openThreadId);

  // ── Active-thread switch signal (multi-thread chat history) ─────────────────
  // Bumped by the sidebar when the user opens a new thread or re-opens a past
  // one. The rehydration effect below watches it to clear the current thread's
  // rendered content (live + persisted) and reload the now-active open thread —
  // the in-memory equivalent of a remount when navigating /home → /home.
  const activeThreadSignal = useBoardStore((s) => s.activeThreadSignal);
  const setActiveThreadId = useBoardStore((s) => s.setActiveThreadId);
  // v8 Phase 2: the drop-Remix handoff switches to the freshly-seeded thread the
  // same way the sidebar does (cookie → id → pulse).
  const switchThread = useBoardStore((s) => s.switchThread);
  const queryClient = useQueryClient();
  const isFirstThreadLoadRef = useRef(true);

  // ── Persisted open-thread blocks (Task 3 — D-14/THREAD-07 rehydration) ─────
  // Loaded on mount from GET /api/threads/open. Declared before the view gates
  // below so the thread-presence signal can include them (no TDZ reference).
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
  // CRITICAL: ideas.start() NEVER arms pendingSealRef/stream.start (T-03-13).
  const ideas = useIdeasStream();
  const ideasBlocks = ideas.toBlocks();

  // ── Hooks stream (Plan 04-03, Task 1 — D-09) ──────────────────────────────
  // Provides SSE hook-card blocks rendered above the composer in HooksThreadView.
  // CRITICAL: hooks.start() NEVER arms pendingSealRef/stream.start (T-03-13/T-04-13).
  const hooks = useHooksStream();
  const hooksBlocks = hooks.toBlocks();

  // ── Chat stream (Plan 05-03, Task 2 — D-05/D-08) ─────────────────────────
  // Provides SSE markdown turns rendered above the composer in ChatThreadView.
  // CRITICAL: chat.start() NEVER arms pendingSealRef/stream.start — chat send
  // NEVER navigates to /analyze (D-05, no silent auto-fire).
  const chat = useChatStream();
  const chatBlocks = chat.toBlocks();

  // ── Script stream (Plan 06-05 — D-09) ─────────────────────────────────────
  // Provides SSE script-card blocks rendered above the composer in ScriptThreadView.
  // CRITICAL: script.start() NEVER arms pendingSealRef/stream.start (T-03-13/T-06-20).
  const script = useScriptStream();
  const scriptBlocks = script.toBlocks();

  // ── Remix stream (Plan 06-05 — REMIX-01) ──────────────────────────────────
  // Provides SSE remix-card blocks rendered above the composer in RemixThreadView.
  // CRITICAL: remix.start() NEVER arms pendingSealRef/stream.start (T-03-13/T-06-20).
  const remix = useRemixStream();
  const remixBlocks = remix.toBlocks();

  // ── Explore stream (Plan 11-07 — EXPLORE-01/02/04) ─────────────────────────
  // Provides the SSE outlier-grid block rendered above the composer in
  // ExploreThreadView. CRITICAL: explore.start() NEVER arms pendingSealRef/stream.start
  // (Pitfall 1 — Explore renders in-thread in /home, NEVER navigates to /analyze/[id]).
  const explore = useExploreStream();
  const exploreBlocks = explore.toBlocks();
  // Account Read (A5) — one-tap self-Read.
  const account = useAccountReadStream();
  // Account content = streaming or a result block (does NOT flip on tool selection alone).
  const hasAccountContent = account.isStreaming || account.block !== null;

  // ── THE ACTIVE RUN — one at a time, normalized (thread unification) ─────────
  // Every stream above is a candidate; exactly one owns the thread's tail turn. This replaced the
  // seven `activeTool ===` view gates, and with them the whole per-skill viewport: a finished run
  // used to sit OUTSIDE the thread in its own private view until the creator switched skills, and
  // the hand-off between the two surfaces is what lost work (`account`/`test` were never folded at
  // all; a mid-stream switch never folded; a failed reload folded nothing and unmounted anyway).
  //
  // Gates the send disc (not Stop — see the `disabled` prop). Never used to CLAIM a connection:
  // `true` only means the device reports a network, which a captive portal also does.
  const online = useOnline();

  // ⚠️ `skill` here is the DISPLAY namespace (ChatTurnKind — "ideas" PLURAL), never ToolId
  // ("idea" singular). The two differ in exactly this one id and a cast cannot fail (F-017).
  const { activeRun, isAnyStreaming, stopActive } = useActiveRun([
    { skill: "ideas", isStreaming: ideas.isStreaming, isDone: ideas.isDone, isClosed: ideas.isClosed, blocks: ideasBlocks,
      stages: ideas.stages, evidence: ideas.evidence, followupText: ideas.followupText, warnings: ideas.warnings,
      error: ideas.error, outliersAvailable: ideas.outliersAvailable, stop: ideas.stop, reset: ideas.reset },
    { skill: "hooks", isStreaming: hooks.isStreaming, isDone: hooks.isDone, isClosed: hooks.isClosed, blocks: hooksBlocks,
      stages: hooks.stages, evidence: hooks.evidence, followupText: hooks.followupText, warnings: hooks.warnings,
      error: hooks.error, outliersAvailable: hooks.outliersAvailable, stop: hooks.stop, reset: hooks.reset },
    { skill: "script", isStreaming: script.isStreaming, isDone: script.isDone, isClosed: script.isClosed, blocks: scriptBlocks,
      stages: script.stages, evidence: script.evidence, followupText: script.followupText, warnings: script.warnings,
      error: script.error, outliersAvailable: script.outliersAvailable, stop: script.stop, reset: script.reset },
    { skill: "remix", isStreaming: remix.isStreaming, isDone: remix.isDone, isClosed: remix.isClosed, blocks: remixBlocks,
      stages: remix.stages, evidence: remix.evidence, followupText: remix.followupText, error: remix.error,
      stop: remix.stop, reset: remix.reset },
    { skill: "explore", isStreaming: explore.isStreaming, isDone: explore.isDone, blocks: exploreBlocks,
      stages: explore.stages, error: explore.error, stop: explore.stop, reset: explore.reset },
    // The chat agent announces which skill it dispatched (the `dispatch` SSE frame) BEFORE the
    // first stage event. Naming it here is what gives an agent-routed run the SAME capsule label,
    // seeded plan, intro and outro as running that skill directly — the 1:1 the whole unification
    // is for. No dispatch ⇒ a plain conversational turn.
    { skill: (chat.dispatchedSkill as ChatTurnKind | null) ?? "chat",
      isStreaming: chat.isStreaming,
      // Cards ABOVE the co-pilot line: a dispatched skill's real cards, then the closing prose.
      blocks: [...chat.streamingBlocks, ...chatBlocks],
      stages: chat.stages, evidence: chat.evidence, error: chat.error, stop: chat.stop, reset: chat.reset },
    // Account emits no stages and no card stream — one block, delivered on done.
    { skill: "account", isStreaming: account.isStreaming,
      blocks: account.block ? [account.block] : [], error: account.error,
      stop: account.stop, reset: account.reset },
  ]);

  // The Account starter card ARMS the skill and RUNS it in one tap. The other five cards arm
  // and stop, because the other five skills need the field; Account takes no input, so arming
  // alone would leave the creator in front of a composer with nothing to type. Declared here
  // (after `account`, not up beside handleUserSelectTool) so it closes over a live binding
  // rather than a TDZ one. It spends a Reading — so it fires from the creator's tap, never a
  // render (D-05).
  const handleStarterAccountRun = useCallback(() => {
    // Arms AND runs in one tap, so it never passes through handleSubmit's armFired(). It has
    // to do both halves itself: name the run, and leave the composer on chat.
    noteRun("account");
    setActiveTool(DEFAULT_TOOL);
    setShowUpload(false);
    void account.start();
  }, [account]);

  /**
   * THE ACTIVATION CARD — the first-run action, and the one the intro now offers.
   *
   * Arms AND runs in one tap (same shape as the account run above), because the point is that
   * the creator SEES a card written for one of their own personas without having to work out
   * what to type. `ideas.start("")` is the skill's Auto mode: no ask, drafted against the
   * audience that was just calibrated.
   *
   * It replaced "Read my recent posts", which was the only CTA in the only sentence of in-app
   * onboarding and returned 402 on every new account — `account` costs 5 credits, the free
   * tier's allowance is 0, and BILLING_ENFORCE_QUOTA is on in production. This one is covered
   * by the activation entitlement in lib/pricing.ts, and unlike the account read it makes no
   * Apify call at all.
   *
   * `first_card_shown` is emitted here rather than on the card's render: this is the moment the
   * user asked for it, and a render-time event would also fire for every later ideas run.
   */
  const handleActivationCardRun = useCallback(() => {
    track("first_card_shown", { source: "audience-intro" });
    noteRun("idea");
    setActiveTool(DEFAULT_TOOL);
    setShowUpload(false);
    void ideas.start("", platform, intent);
  }, [ideas, platform, intent]);


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
    persistedChatTurns.length > 0 || // the unified persisted stream (thread-unification) — the SSOT for
    // "this thread has history"; the per-type persisted buckets above are retired in Phase 5, this term stays.
    hasAccountContent;
  // ⚠️ hasThread must never key off the ARMED SKILL. Arming a skill is not a thread. Three
  // per-skill view gates used to flip hasThread on TOOL SELECTION ALONE (they were the only
  // skills owning an idle view), which tore the empty
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

  // The RAIL gate. Separate from `hasThread` on purpose: the rail should open the moment a skill is
  // armed (owner call 2026-07-24) — you've committed to a run, so the room belongs on screen — but
  // `hasThread` must keep meaning "real content exists" (see the regression note above).
  useEffect(() => {
    onEngagedChange?.(startEngaged);
  }, [startEngaged, onEngagedChange]);

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
  // Test seal-in-thread (D-05 rework): after the Max analysis completes, the composer POSTs the
  // analysisId to /api/tools/test/card, which drops the video-test-card in the open thread — the
  // Test lands 1:1 in-thread like every other skill, NO navigate-out. `carding` is that POST in
  // flight (the sub-second card-adapter tail on the run spine). A degrade / build failure falls
  // back to the honest full-breakdown page (setTestDegradeId → router.push), mirroring the
  // in-thread UploadField. See test-vs-simulation-split.
  const [carding, setCarding] = useState(false);

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
    persistedChatTurns.length > 0 || // the unified persisted stream — mirrors hasThread (:639).
    // Without this term a thread whose only block sits outside every per-skill bucket
    // (`video-test-card` is the one such type) reads as EMPTY, so :3090 rendered the Start
    // grid OVER a correctly-loaded paid card — F-019 layer 2.
    hasAccountContent ||
    !!lastUserTurn;

  // Notify parent whenever conversation content changes (welcome hero visibility).
  useEffect(() => {
    onConversationChange?.(hasConversationContent);
  }, [hasConversationContent, onConversationChange]);

  // ── v8 Phase 2 — the shelf: today's drops over the daily-surface cache ──────
  // First visit of the day warms via POST /api/surfaces/drops (skeletons); a warm
  // cache returns instantly. The platform lens deliberately does NOT key this
  // cache (spec: the lens changes generation prompts only). The warm key advances
  // only AFTER an audience switch's persist settles (use-lazy-warm contract) —
  // see handleSelectAudience. Flag-off: enabled=false → the hook is inert.
  const [warmAudienceKey, setWarmAudienceKey] = useState<string>("general");
  const dropsEnabled =
    CONCEPT_V8_ENABLED &&
    AMBIENT_V2_ENABLED &&
    !hasConversationContent &&
    !startEngaged &&
    !rehydrating;
  const { items: dropCards, status: dropsStatus } = useLazyWarm<LiveDropCard>(
    null,
    "/api/surfaces/drops",
    "drops",
    dropsEnabled,
    warmAudienceKey,
  );

  // Remix a drop: seed the persisted thread from the CACHED card (zero model
  // calls — fire-on-demand law intact) and switch to it; the normal open-thread
  // rehydration renders the 3-angle stack.
  const [remixingDropId, setRemixingDropId] = useState<string | null>(null);
  const handleRemixDrop = useCallback(
    async (card: LiveDropCard) => {
      if (remixingDropId) return; // one seed in flight
      setRemixingDropId(card.contentId);
      try {
        const res = await fetch("/api/surfaces/drops/remix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentId: card.contentId }),
        });
        if (!res.ok) return; // honest no-op — the card stays tappable, nothing fabricated
        const { threadId } = (await res.json()) as { threadId: string };
        setActiveThreadCookie(threadId);
        setActiveThreadId(threadId);
        switchThread();
      } catch {
        // network failure → no-op (card stays tappable)
      } finally {
        setRemixingDropId(null);
      }
    },
    [remixingDropId, setActiveThreadId, switchThread],
  );

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
      setRoomDrill(false);
      // Ambient v2 (AMBIENT_V2_ENABLED): a thread switch to a brand-new/empty thread must land
      // back on the Start grid, not the post-pick fresh-chat home. `startEngaged` is per-session
      // UI state, so clear it here alongside the other per-thread wipes — the rehydration below
      // repopulates content for a re-opened thread (which then renders thread mode, not Start).
      setStartEngaged(false);
      // Ambient v2 Phase D: clear the prior thread's sealed verdicts; the rehydration below
      // repopulates them from the re-opened thread's `sim_seals` (or leaves them empty for a new one).
      setPersistedSimSeals({});
      // Let the rehydration below restore the right state for the loaded thread: the ARM
      // resets to the front door, and `runningTool` is re-seeded from the new thread's own
      // last card (so the previous thread's run never gates a CTA over this one's cards).
      hasUserSelectedToolRef.current = false;
      hasDispatchedRunRef.current = false;
      setRunningTool(null);
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
          // An anonymous session receives the SEALED wire form instead (verdict-seal.ts §0b②).
          simSeals?: WireSimSealMap;
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

        // ── RESTORE on rehydration — but restore the RUN, never the ARM ─────────
        //
        // This used to restore `activeTool` from the last persisted card, because every
        // thread-view gate required `activeTool ===` its matching tool and a reload
        // otherwise rendered a blank home under a pinned composer. Lane 1 deleted those
        // gates, and the one-shot (Lane 2 step 5) makes restoring the ARM actively wrong:
        // reload into a thread of hook cards and the composer would sit silently armed on
        // Hooks with no pill left to disarm it, so the next plain sentence you typed would
        // buy another pack. THE ARM NEVER SURVIVES A RELOAD — it resets to the front door.
        //
        // What the last card DOES still tell us is which skill produced what is on screen,
        // and that is `runningTool`: it keeps the Room Rewrite CTA alive across a reload
        // (it gates on hooks/idea/script) without arming anything.
        const TYPE_TO_TOOL: Record<string, ToolId> = {
          'idea-card': 'idea',
          'hook-card': 'hooks',
          'script-card': 'script',
          'remix-card': 'remix',
          'outlier-grid': 'explore',
          'video-test-card': 'test',
        };
        let ranSkill: ToolId | null = null;
        for (let i = messages.length - 1; i >= 0 && !ranSkill; i--) {
          const blocks = messages[i]?.blocks ?? [];
          for (let j = blocks.length - 1; j >= 0; j--) {
            const t = blocks[j]?.type;
            if (t && TYPE_TO_TOOL[t]) { ranSkill = TYPE_TO_TOOL[t]; break; }
          }
        }
        // Only seed when nothing has run since this thread was opened — otherwise this
        // round-trip lands on top of a run the creator started while it was in flight.
        if (!hasDispatchedRunRef.current) setRunningTool(ranSkill);
        // `chatAgentThread` no longer changes anything here: every thread renders through the
        // one unified stream, so there is no per-tool view left for it to route to. It stays
        // read above only as the marker it is.
        void chatAgentThread;
        // Guarded by hasUserSelectedToolRef so an arm made while this fetch was in flight
        // (a Start tile tapped during the load) always wins over the reset.
        if (!hasUserSelectedToolRef.current) {
          setActiveTool(DEFAULT_TOOL);
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
      const put = fetch("/api/settings/last-audience", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceId: newId }),
      }).catch(() => {});
      // v8 Phase 2: advance the shelf's warm key only AFTER the persist settles —
      // the drops route server-resolves the audience, so a key that leads the PUT
      // would cache the OLD audience's cards under the NEW key (use-lazy-warm doc).
      if (CONCEPT_V8_ENABLED) void put.then(() => setWarmAudienceKey(newId ?? "general"));
    }
    // WR-02: reconcile the active skill with the new audience's mode. If the current
    // tool isn't valid in the new mode (e.g. "simulate" lingering after a General →
    // Socials switch, which would silently router.push away + discard the draft),
    // reset to the in-mode default — "test" for socials, the first General verb for
    // general — so the pill, slash menu, placeholder, and submit path stay coherent.
    const newMode = audience.mode ?? "socials";
    // An out-of-mode arm resets to the in-mode front door. The socials fallback used to be
    // "test" — the most expensive skill in the product, silently armed by switching audience.
    setActiveTool((current) =>
      getSkill(current).modes.includes(newMode)
        ? current
        : newMode === "general" ? "profile" : DEFAULT_TOOL,
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
  // CRITICAL: NEVER sets pendingSealRef / calls stream.start — Script never navigates to /analyze.
  const handleWriteScript = useCallback((hookLine: string, _audienceArchetype: string) => {
    // The script appends at the BOTTOM, but the hook card that started it can be thousands of
    // pixels up — every completed turn keeps its cards, so pressing "Write the script →" on a
    // card from an earlier turn is normal. Measured signed-in 2026-08-05: the run streamed a
    // full script 8,478px below the viewport and the view never moved, so the tap read as the
    // app doing nothing for 90s. Same rule as a chip: an explicit tap is consent to be taken
    // to its result (see sendChatFollowup).
    scrollThreadToBottom();
    // This FIRES a script run (below) rather than arming one, so it names the RUN. Arming the
    // composer here would strand the creator on Script after a card CTA they never aimed at
    // the field — the one-shot's whole point.
    noteRun("script");
    setScriptAnchorHook(hookLine); // PR-2: cite this input hook in the script intro
    script.reset();
    // ask empty — the carried hookLine anchors the script generation.
    void script.start("", platform, hookLine, intent);
  }, [script, platform, intent, scrollThreadToBottom]);

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
  // CRITICAL: NEVER arms pendingSealRef / calls stream.start (T-03-13/T-06-20).
  const handleDevelopRemix = useCallback(async (adaptedHook: string, remixPlatform: string) => {
    // Re-pin for the same reason handleWriteScript does: the developed hook cards land at the
    // bottom of the thread, and the remix card that was tapped can be far above it.
    scrollThreadToBottom();
    // POSTs a develop run below — it fires, so it names the RUN, not the composer's arm.
    noteRun("hooks");
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
        reportSession401(res.status); // session dialog if the session died
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
      // Thread-unification: the developed hook cards render through PersistedThreadStream, which reads
      // persistedChatTurns — NOT persistedHookBlocks. Refresh the unified stream so the cards actually
      // appear (the develop endpoint has no SSE, so hooks.isStreaming never flips and the live view
      // never mounts). Without this the thread switches to hooks and shows a blank gap until reload.
      setPersistedChatTurns(orderedTurns(messages));
    } catch {
      // Network error — silent (user can retry)
    }
  }, [hooks, scrollThreadToBottom]);

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
      // Thread-unification: the profile-read / reaction-distribution / prediction-gauge / Read cards
      // render through PersistedThreadStream (persistedChatTurns), NOT the retired persistedProfileBlocks
      // bucket. Refresh the unified stream so an evidence-drop / Simulate / Predict result surfaces
      // in-session (dormant behind HORIZONTAL_ENABLED today, but the write path must stay honest).
      setPersistedChatTurns(orderedTurns(messages));
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

  // ── Run completion → the thread owns it (thread unification) ────────────────
  // THE fix for "I ask for hooks, then want something else, and sometimes it doesn't work."
  //
  // This used to be a SKILL-SWITCH fold: a finished run stayed in its own private view and was
  // folded into the thread only when the creator LEFT the skill. Four ways that lost work —
  // `account`/`test` were not in the fold list at all; a mid-stream switch bailed after the view
  // had already unmounted and never re-fired; a failed reload skipped the reset with the view gone;
  // and even the happy path blinked, because unmount is synchronous while the reload is a
  // round-trip.
  //
  // A run now enters the thread WHEN IT FINISHES, not when the user happens to navigate away —
  // generalizing the chat swap above to every skill. Reload persisted history first, THEN reset the
  // live stream, so the swap is one commit with no gap and no duplicate. Because each route now
  // persists a `run-header` block, the persisted turn carries the same intro + receipt the live one
  // showed: the swap is invisible.
  //
  // reset() runs ONLY on a successful reload — a failed fetch must never clear an unpersisted turn.
  //
  // ⚠️ IT FOLDS ON `isClosed`, NOT ON `isDone`, and the two are not the same moment. Every
  // generative route emits `done` BEFORE its closing line (S2: unblock the UI early), persists that
  // line as a trailing markdown message, and only THEN closes the stream. Folding on `done` reloaded
  // history a beat too early to ever see the outro, which is why this used to need a SECOND reload
  // per run to collect one sentence. Waiting for the close costs the creator nothing — the composer
  // is already unblocked, `isStreaming` still flips on `done` — and it makes the swap atomic: the
  // turn arrives with its closing line already on it instead of the line popping in ~2s later.
  //
  // Close is the only signal that works. A route whose follow-up model call returns empty sends NO
  // `followup` event at all (`if (followupText.trim())`), so waiting on that frame would stall those
  // runs forever; and every hook sets `isClosed` in a `finally`, so an abort or a throw folds too.
  // Streams that never report closure default to `isClosed: true` and fold on `done` as before.
  const runDoneHandledRef = useRef<string | null>(null);
  const activeRunSkill = activeRun?.skill ?? null;
  const activeRunIsDone = activeRun?.isDone ?? false;
  const activeRunIsClosed = activeRun?.isClosed ?? true;
  const activeRunIsStreaming = activeRun?.isStreaming ?? false;
  const activeRunReset = activeRun?.reset;
  const activeRunSettled = activeRunIsDone && activeRunIsClosed;
  useEffect(() => {
    if (!activeRunSkill || !activeRunSettled) {
      if (!activeRunIsDone) runDoneHandledRef.current = null; // re-arm for the next run
      return;
    }
    if (activeRunIsStreaming || runDoneHandledRef.current === activeRunSkill) return;
    runDoneHandledRef.current = activeRunSkill;
    let cancelled = false;
    void (async () => {
      const ok = await reloadChatThread();
      if (cancelled || !ok) return;
      activeRunReset?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeRunSkill,
    activeRunSettled,
    activeRunIsDone,
    activeRunIsStreaming,
    activeRunReset,
    reloadChatThread,
  ]);

  // NOTE (2026-07-29): the "late follow-up → one more reload" effect that lived here is GONE, and
  // deliberately so. It existed because the fold above fired on `done` and therefore always reloaded
  // BEFORE the closing line was written — a second GET /api/threads/open per run, to collect one
  // sentence. The fold now waits for `isClosed`, by which point that line is already persisted, so
  // the first reload carries it and there is no second one to schedule.
  //
  // ⚠️ `hasContent()` in use-active-run.ts must still EXCLUDE `followupText`. That exclusion is not
  // about this effect — it is what stops a late frame refilling an emptied stream and re-claiming
  // the tail (the duplicate-turn defect measured live on 2026-07-28). It stays load-bearing.

  // ── Chat follow-up chips (chat-followups.ts) ───────────────────────────────
  // A tapped follow-up continues the conversation in THIS chat thread: it echoes the prompt as the
  // optimistic user bubble (lastUserTurn) and re-enters the SSE loop (chat.start). No tool-switch,
  // no blank re-run — the retired chain-handoff CTA did both and lost the topic. The thread already
  // exists (a completed turn is on screen), and the route persists the user turn server-side, so no
  // ensureThreadForSend / user-turn POST is needed here. Fires ONLY on the user's tap (D-05).
  //
  // `skill` is the chip's DECLARED generator (chat-followups.ts). It is forwarded, not re-derived:
  // the chip's sentence reads as subject-less on its own ("Give me a few more hook options."), so
  // the agent used to answer it with a request for a sharper angle and run nothing — measured 0/3,
  // and not fixable by rewording. Carrying the intent as data lets the route pin the first tool
  // choice. Conversational chips ("Which is strongest?") declare none and are unaffected.
  const sendChatFollowup = useCallback(
    (prompt: string, skill?: string) => {
      const t = prompt.trim();
      if (!t) return;
      // The answer appends at the BOTTOM, but the chip that started it can be thousands of pixels
      // up — every completed turn keeps its row, so tapping one from an earlier turn is normal.
      // Measured signed-in: tapping a chip 7,000px up ran the skill and streamed cards the creator
      // never saw. An explicit tap is consent to be taken to its result.
      scrollThreadToBottom();
      setLastUserTurn(t);
      chat.reset();
      void chat.start(t, platform, skill);
    },
    [chat, platform, scrollThreadToBottom],
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
        // 401 first. The staged-clip cleanup below still has to run, so this records the cause
        // rather than returning early — otherwise the error line reads the `Unauthorized` slug.
        const deadSession = reportSession401(res.status);
        reportCredit402(res.status, err); // wall dialog if it's the credit 402
        setEvidenceError(
          deadSession
            ? SESSION_EXPIRED_MESSAGE
            : ((err as { error?: string }).error ?? EVIDENCE_RUN_FAILED),
        );
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

  // ── Seal-on-complete (Test lands 1:1 in-thread — D-05 rework) ────────────
  // Test USED to navigate to /analyze/[id] the moment the `started` SSE flipped analysisId (1–3s).
  // It now stays in-thread for the whole run and, on COMPLETE, POSTs the analysisId to
  // /api/tools/test/card — the cheap adapter that turns the persisted row into the honest
  // video-test-card and drops it in the open thread (createOpenThreadLazy + insertMessage,
  // server-side). reloadChatThread() then surfaces that card through PersistedThreadStream. This
  // mirrors the in-thread UploadField (input-request-block.tsx) exactly — same seal, same degrade.
  //
  // Arming (pendingSealRef) is EXCLUSIVE to the Test path (set in handleSubmit's Test branch), so a
  // hydration-sourced complete (permalink) never seals — mirrors the old pendingSealRef guard. On
  // /home there is no urlAnalysisId, so the stream never auto-completes off a permalink anyway
  // (use-analysis-stream.ts), but the ref keeps the intent honest. sealHandledRef fires the seal
  // once per run (a fresh submit resets it). CRITICAL (T-03-13): the Idea path never arms this.
  //
  // Degrade honesty: a row with no craft material (route → { degraded }) or a build/network failure
  // falls back to the full frame-by-frame page — the only navigate-out that survives, and only when
  // there is genuinely nothing to card in-thread.
  const pendingSealRef = useRef(false);
  const sealHandledRef = useRef(false);
  useEffect(() => {
    if (stream.phase !== "complete" || !stream.analysisId || !pendingSealRef.current || sealHandledRef.current) {
      return;
    }
    sealHandledRef.current = true;
    pendingSealRef.current = false;
    const id = stream.analysisId;
    void (async () => {
      setCarding(true);
      try {
        const res = await fetch("/api/tools/test/card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysisId: id }),
        });
        const data = (await res.json().catch(() => ({}))) as { degraded?: string };
        if (!res.ok || data.degraded) {
          // No honest craft card to drop → the full breakdown page is the honest fallback.
          router.push(`/analyze/${id}`);
          return;
        }
        // Surface the freshly-sealed card in the unified stream (no navigate-out).
        await reloadChatThread();
      } catch {
        router.push(`/analyze/${id}`);
      } finally {
        setCarding(false);
      }
    })();
  }, [stream.phase, stream.analysisId, router, reloadChatThread]);

  // ── Lazy thread creation (issue 2 — no blank threads in history) ──────────
  // "New Thread" creates NO row; the pointer is the NEW_THREAD_SENTINEL and the composer renders
  // empty. The row is materialised on the first real send, so a thread only enters history once it
  // holds a message. Flips the pointer to the fresh id BEFORE the run, so every tool route appends
  // to THIS thread.
  //
  // Hoisted out of `handleSubmit` (2026-07-28) because the ＋ door has to call it too, and for the
  // same reason `test` was added to the set below: while the pointer sits on the sentinel, every
  // server-side `createOpenThreadLazy` mints its OWN fresh row, so the run's card lands in a thread
  // the client is not pointing at — a completed run finishing into a blank screen (F-019). A brought
  // stimulus fired as the first send of a new thread is that exact shape.
  const ensureThreadForSend = useCallback(async (): Promise<void> => {
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
      // Network error — the tool route's createOpenThreadLazy still resolves a target thread
      // server-side, so the send is not lost.
    }
  }, [queryClient, setActiveThreadId]);

  // ── Submit -> create (lifted/adapted from Board.tsx handleContentSubmit) ──
  // Slim: only the TikTok-URL and video-upload paths for Test; Ideas pipeline for Idea.
  // CRITICAL: Idea path NEVER sets pendingSealRef or calls stream.start (T-03-13).
  //
  // `toolOverride` exists for ONE reason: the one-shot. A retry fires long after `activeTool`
  // has reverted to chat, so an error card's "Retry" would otherwise send a plain chat turn
  // instead of re-running the skill that failed. Passing the tool explicitly makes the retry
  // say what it means — it cannot silently become a different, cheaper, wrong run.
  const handleSubmit = useCallback(async (toolOverride?: ToolId) => {
    const tool = toolOverride ?? activeTool;

    // Sending is consent to be shown the result. Re-pin BEFORE any branch runs — including the
    // ones that bail (the audience gate, an expired session, a bad URL), because those render
    // their notice at the bottom of the thread too, and a creator who had scrolled up to re-read
    // a card would otherwise get silence back from a send.
    scrollThreadToBottom();

    // THE ONE-SHOT (Lane 2 step 5). Called at the exact point a branch DISPATCHES a run —
    // never at the top, because a branch that bails (the General-verb audience gate, an
    // expired session, a failed upload, a non-TikTok URL) must leave the arm intact so the
    // creator can just press send again rather than re-arming from the grid.
    //
    // Two writes, and they are not the same fact: `runningTool` remembers what is on screen
    // (the Test spine, the failure turn, the Rewrite CTA read it); `activeTool` goes back to
    // chat so the NEXT sentence is a conversation, not another billed pack.
    const armFired = () => {
      noteRun(tool);
      setActiveTool(DEFAULT_TOOL);
      setShowUpload(false);
    };

    // Skills that persist into the open chat thread AND whose user turn must be
    // persisted client-side (chat is the exception — it persists its own turn
    // server-side to keep its refine anchor). Kept in sync with the ensureThreadForSend
    // set below — every tool here creates its thread lazily on first send.
    // `test` belongs here since the D-05 seal-in-thread rework: the run ends as a
    // video-test-card IN the thread, so a reload without this shows a card with no
    // question above it (upload path persists the file name, URL path the URL).
    const USER_TURN_TOOLS: ToolId[] = [
      "idea", "hooks", "script", "remix", "explore", "simulate", "predict", "test",
    ];
    const captureUserTurn = (raw: string) => {
      const t = raw.trim();
      setLastUserTurn(t || null);
      // Persist the question so re-opening the thread restores the top "you asked"
      // bubble (issue 3). Fire-and-forget: the turn renders at the top via
      // lastUserTurn independent of persisted order, so it never needs awaiting.
      // Must run AFTER the thread exists (ensureThreadForSend) so it targets the
      // right thread — guaranteed by call ordering in every branch below.
      if (t && USER_TURN_TOOLS.includes(tool)) {
        void fetch("/api/threads/user-turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: t }),
        }).catch(() => {
          /* best-effort — a missed persist only loses the restored question bubble */
        });
      }
    };

    // Skills that persist into the open chat thread create it lazily on first send.
    // `test` is in this set since the D-05 rework made it seal in-thread. While it was
    // excluded, a Test sent as the FIRST send of a new thread left the pointer on the
    // NEW_THREAD_SENTINEL for the whole run, so every server-side createOpenThreadLazy
    // minted a FRESH row (three per run) and the sealed card landed in a thread the
    // client was never pointing at — a paid Max run completing into a blank screen (F-019).
    if (
      tool === "idea" ||
      tool === "hooks" ||
      tool === "chat" ||
      tool === "script" ||
      tool === "remix" ||
      tool === "explore" ||
      tool === "test"
    ) {
      await ensureThreadForSend();
    }

    // ── Account Read path (SELF-01/02/03) ───────────────────────────────────
    // Bodyless: the read resolves the creator's OWN handle server-side, so the field is
    // ignored entirely. This fires from an explicit send (a real user gesture), which is
    // what D-05 requires — it is not an auto-fire on render.
    if (tool === "account") {
      setUrl(""); // the field was never an input here; don't leave a stale draft behind
      armFired();
      await account.start();
      return;
    }

    // ── Idea tool path (D-12) ───────────────────────────────────────────────
    // CRITICAL: this block must never set pendingSealRef.current or call stream.start.
    // Empty ask = Auto mode; typed ask = seeded mode (D-12).
    if (tool === "idea") {
      const ask = trimmedUrl; // empty string → Auto; non-empty → seeded
      captureUserTurn(ask);
      setUrl(""); // clear input after send
      armFired();
      // ideas.start() does the full fetch+getReader SSE loop (BLOCKER-1 compliant)
      await ideas.start(ask, platform, intent);
      return;
    }

    // ── Hooks tool path (D-09, Plan 04-03 Task 1) ───────────────────────────
    // CRITICAL: this block must never set pendingSealRef.current or call stream.start.
    // Empty ask = Auto/anchored mode; typed ask = seeded mode (D-09).
    // T-03-13/T-04-13: Hook send NEVER navigates to /analyze.
    if (tool === "hooks") {
      const ask = trimmedUrl; // empty string → Auto; non-empty → seeded
      captureUserTurn(ask);
      setUrl(""); // clear input after send
      armFired();
      // hooks.start() does the full fetch+getReader SSE loop (BLOCKER-1 compliant)
      await hooks.start(ask, platform, intent);
      return;
    }

    // ── Chat tool path (Plan 05-03, D-05) ────────────────────────────────────
    // CRITICAL: this block MUST NOT set pendingSealRef.current or call stream.start.
    // Chat send NEVER navigates to /analyze (D-05 — no silent auto-fire).
    // ask must be non-empty (canSubmit already gates on trimmedUrl.length > 0).
    if (tool === "chat") {
      const ask = trimmedUrl;
      captureUserTurn(ask);
      setUrl(""); // clear input after send
      armFired();

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
          // The refine RUNS as hooks, so the thread's live tail is a hooks run — but the
          // composer must not stay armed on it (one-shot). `setActiveTool("hooks")` here used
          // to switch a per-skill VIEW that Lane 1 deleted; naming the run is all it ever meant.
          noteRun("hooks");
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
          // Same as the hooks branch above — name the run, never re-arm the composer.
          noteRun("idea");
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
    // CRITICAL: NEVER sets pendingSealRef.current or calls stream.start (T-03-13/T-06-20).
    // Script send NEVER navigates to /analyze.
    // ask = typed topic or empty; anchor = carried hookLine from hooks→script seam.
    if (tool === "script") {
      const ask = trimmedUrl; // topic seed or empty (anchor drives the script when carried)
      captureUserTurn(ask);
      setUrl(""); // clear input after send
      setScriptAnchorHook(null); // direct topic send — no anchor hook → thinner intro
      armFired();
      script.reset();
      // script.start(ask, platform, anchor?) — anchor omitted from direct composer sends
      await script.start(ask, platform, undefined, intent);
      return;
    }

    // ── Remix tool path (Plan 06-05, REMIX-01) ────────────────────────────────
    // CRITICAL: NEVER sets pendingSealRef.current or calls stream.start (T-03-13/T-06-20).
    // Remix send NEVER navigates to /analyze.
    // URL is required (canSubmit gates on trimmedUrl.length > 0 for remix).
    if (tool === "remix") {
      const url = trimmedUrl; // trending/competitor TikTok URL (required)
      captureUserTurn(url);
      setUrl(""); // clear input after send
      armFired();
      remix.reset();
      await remix.start(url, platform, intent);
      return;
    }

    // ── Explore tool path (Plan 11-07, EXPLORE-01 — Pitfall 1 CRITICAL) ───────
    // CRITICAL: this block MUST NOT set pendingSealRef.current and MUST NOT call
    // stream.start — Explore renders in-thread in /home and NEVER navigates to
    // /analyze/[id] (Pitfall 1; pendingSealRef/stream.start are Test-exclusive).
    // A typed field-send maps to the niche param (empty → un-niched pull). The
    // params popover + quick-actions are the richer entry points (onRunExplore /
    // onQuickAction → explore.start), but a bare field-send still works.
    if (tool === "explore") {
      const ask = trimmedUrl; // typed niche/keywords or empty
      captureUserTurn(ask);
      setUrl(""); // clear input after send
      armFired();
      // explore.start() does the full fetch+getReader SSE loop (BLOCKER-1 compliant).
      await explore.start({ niche: ask || undefined });
      return;
    }

    // ── Simulate / Predict tool paths (07-04 / D-07, UX-02) ──────────────────
    // The two General verbs reuse the P5/P6 routes reached today via card-chain
    // CTAs. CRITICAL (T-07-04-01 gate): both REQUIRE a selected General audience —
    // when absent, route the user to Build and return WITHOUT firing an ungated
    // stimulus (the client gate is UX; the server independently enforces auth +
    // the D-08 honesty guards). CRITICAL: NEVER set pendingSealRef / call stream.start
    // — a General verb never navigates to /analyze (Pitfall 2 / sibling of Chat).
    // The draft/scenario is passed RAW (T-07-04-02) — never pre-concatenated into a
    // prompt; the routes data-fence it downstream.
    if (tool === "simulate" || tool === "predict") {
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
      armFired();
      const endpoint =
        tool === "simulate" ? "/api/tools/simulate" : "/api/tools/predict";
      const body =
        tool === "simulate"
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
          reportSession401(res.status); // session dialog if the session died
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

    // ── Test tool path (pendingSealRef/stream.start exclusive here) ─
    // A3: echo the submitted input so the ~2-min run reads as work, not a dead button. The Test
    // now stays IN-THREAD for the whole run and seals the video-test-card on complete (the
    // seal-on-complete effect above) — no navigate-out. captureUserTurn(...) drives the optimistic
    // echo + the run-capsule spine (testSubmitTurn) until the card lands.
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
        // Arm the in-thread seal — this run's completion is a real submission, so its complete
        // SHOULD card in-thread (unlike a hydration-sourced complete, which never arms this).
        // sealHandledRef reset so this fresh run's complete fires the seal once.
        pendingSealRef.current = true;
        sealHandledRef.current = false;
        armFired();
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
      // Arm the in-thread seal for this real submission (see upload path above).
      pendingSealRef.current = true;
      sealHandledRef.current = false;
      armFired();
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
  }, [activeTool, file, isValidTikTok, trimmedUrl, stream, ideas, hooks, chat, script, remix, explore, platform, intent, persistedHookBlocks, persistedIdeaBlocks, hooksBlocks, ideasBlocks, selectedAudience, router, reloadProfileThread, queryClient, setActiveThreadId, scrollThreadToBottom]);

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

    // The hero's file handoff (ONBOARDING-FUNNEL-DESIGN.md §0b④). A File can't ride a query
    // string, so the /go hero stages it in module scope and it is consumed HERE, on the other
    // side of the client-side push. Consume-once, so a re-render can never replay the same
    // upload into a second billed run. Nothing staged (a hard reload, a pasted URL) simply
    // leaves the revealed drop zone empty — the pre-existing fallback, unchanged.
    const stagedUpload = consumePendingUpload();
    if (stagedUpload) {
      setFile(stagedUpload);
      setShowUpload(true);
    }

    // Runnable from a text seed? Make (hooks/idea/script) runs even empty (Auto mode). Ask
    // (chat) needs a thought. Test runs headless from a valid TikTok URL — OR from a file the
    // surface staged for us (above). Without a staged file an upload still degrades to
    // pre-fill, which stays the safe fallback for every surface that can't stage one.
    const runnable =
      tool === "hooks" || tool === "idea" || tool === "script"
        ? true
        : tool === "chat"
          ? !!seedParam?.trim()
          : tool === "test"
            ? (!!seedParam && TIKTOK_URL_PATTERN.test(seedParam.trim())) || !!stagedUpload
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
    // Evidence-drop mode (D-07): a staged chat/screenshot/clip POSTs to /api/tools/profile.
    // Sibling to the creator path — the creator tool/submit flow below is byte-identical.
    if (evidenceFile) {
      void handleProfileSubmit();
      return;
    }
    if (!canSubmit) return;
    void handleSubmit();
  };

  // ── `/` slash entry (UX-01) — THE skill picker now ─────────────────────────
  // Typing `/` in the field opens the skill list as a command menu, filterable; selecting
  // ARMS the skill (for one send) and clears the `/`. A URL never starts with `/`, so this
  // never collides with the Test/Remix URL paths, and only a LEADING `/` triggers, so it
  // never eats a mid-sentence slash.
  //
  // ⚠️ Owner call 2026-07-28: this door STAYS while the skill pill goes. The two were a
  // deliberate pair — same SkillRows, same isSkillVisible gate — and deleting both would
  // have left the chat agent as the only router, i.e. no deterministic way to reach a
  // skill's own gated, billed, 300s route. This one carries no persistent chrome: it does
  // not exist until you type `/`, which is why it survives "no skill pill in the composer".
  const slashActive = url.startsWith("/");
  const slashQuery = slashActive ? url.slice(1) : "";
  const firstSlashSkill = () => {
    const q = slashQuery.trim().toLowerCase();
    // Gate identically to the rendered slash menu via the shared isSkillVisible (WR-01) so
    // Enter can never select a skill the menu never displayed — and the always-visible
    // General verbs ARE selectable here too. (This used to say "the skill pill / slash
    // menu"; the pill is gone, and the two-door lock-step it describes is now one door.)
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
      if (canSubmit) void handleSubmit();
    }
  };

  // Placeholder follows the ARMED skill; in the pinned state the follow-up copy takes
  // precedence so it's contextually accurate (D-07 / D-24).
  //
  // ⚠️ Load-bearing since the skill pill was deleted: with the armed indicator, this is
  // half of what tells a creator what their next send will do (and therefore spend).
  const activePlaceholder = hasSimulation
    ? PLACEHOLDER_ACTIVE
    : PLACEHOLDER_BY_TOOL[activeTool];

  // Thread mode on /home (no route id): full-height column — thread region
  // scrolls above the pinned form. Active when hasThread is true OR while a switch
  // is rehydrating (A1) — so the shell stays mounted across the load gap instead of
  // collapsing to the centered hero. Empty home (no thread, not rehydrating) keeps
  // the existing centered hero layout (no regression).
  // Under Ambient v2 the empty home uses the THREAD layout too (owner call 2026-07-24): the Start
  // panel rides the scroll region and the composer sits in the floating bottom dock, so the field
  // is where a chat's field always is instead of floating mid-page. Post-pick the panel simply
  // drops out and the starter takes its place above the dock — same shell, no remount, no jump.
  //
  // NOTE the 2026-07-xx regression recorded above `onThreadChange`: flipping *hasThread* on skill
  // SELECTION tore the empty home in half (greeting pinned top, composer bottom, dead gap). This is
  // not that. `hasThread` still means "real content exists" — only the LAYOUT branch moves, and the
  // greeting that made the old break visible is suppressed under v2 (home-page-layout.tsx:79).
  const homeThreadMode = (hasThread || rehydrating || AMBIENT_V2_ENABLED) && !hasSimulation;
  // P2 (A2b): <xl thread mode, the room is a 68px HEADER above the thread (variant='header'),
  // not the bottom-dock peek — it survives the keyboard (top-anchored). ≥xl the rail (A2a) owns it,
  // so `!isXl` keeps them exclusive. Empty/permalink keep the dock peek (no thread to head).
  // v8: no plate, no top strip — "nothing above the field, ever" (spec §3). The sub-bar
  // hangs BELOW the foot instead, and the room opens as the verdict report.
  const useHeader = homeThreadMode && !isXl && !CONCEPT_V8_ENABLED;

  // ── Ambient presence focus (Plan 13-04 — AMBIENT-01, D-01/D-02/D-03/D-04) ──
  // The room's card ledger + the batch's kind label for the anchored-focus stepper
  // (‹ Hook N of M ›), built from the blocks the MOUNTED thread view already rendered
  // (persisted + streaming, in DOM order). Each card already emits its real
  // { fraction, scrollQuote } + a concept line — the spotlight READS that data, never re-runs
  // a model (D-03 determinism-gate-safe; zero new model calls).
  //
  // THE UNIFIED AMBIENT LEDGER (thread-unification Phase 4). The room reacts to what is ON SCREEN,
  // and the whole thread now renders as ONE flat stream — the persisted history (PersistedThreadStream)
  // then the active skill's live cards — so the ledger is that same flat array, in DOM order. This
  // replaces the per-tool pick, which undercounted a mixed thread (a hooks + ideas thread showed both
  // sets of cards but the rail only knew one tool's). The ledger is keyed on the BLOCKS, never the chip.
  // `outlier-grid` used to be filtered OUT of this stream (and the ledger) because its Remix/Track
  // handlers rode PROPS, which MessageBlocks cannot forward — so a rehydrated grid would have been
  // inert tiles. Those handlers now come from OutlierGridActionsContext (provided at the thread
  // root), so Explore renders in the one stream like every other skill and NOTHING is filtered:
  // the flat indices the stream anchors and the ledger scores are the same array, by construction.
  const persistedStreamTurns = persistedChatTurns;
  const persistedFlatBlocks = persistedStreamTurns.flatMap((t) => t.blocks);
  // The live tail's cards — whichever run owns the thread's last turn. Keyed on the RUN, never on a
  // chip: the room reacts to what is on screen, and what is on screen is now always the active run.
  const activeStreamCards: unknown[] = activeRun?.blocks ?? [];
  const ambientLedgerBlocks = [...persistedFlatBlocks, ...activeStreamCards];
  const { descriptors: ambientDescriptors, kindLabel: ambientKindLabel } =
    buildAmbientDescriptors(ambientLedgerBlocks);

  const {
    focus: ambientFocus,
    focusByTap,
    focusByThought,
    registerThreadRegion,
  } = useAmbientFocus(ambientDescriptors);

  // The thread region carries TWO independent concerns: the ambient scroll-spy (which card is in
  // focus) and the autoscroll (does the view follow the stream). One element, one ref slot, so
  // they compose here rather than either hook knowing about the other.
  const registerThreadRegionRef = useCallback(
    (el: HTMLDivElement | null) => {
      registerThreadRegion(el);
      registerScrollRegion(el);
    },
    [registerThreadRegion, registerScrollRegion],
  );

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

  // ── The tested-video door (Test card → the room's audience read) ────────────
  // A video Test's RECEPTION was already measured — the analyze run repainted the fold with this
  // thread's active audience and `/api/tools/test/card` sealed it. So "Simulate with your audience →"
  // does not spend: it opens the room on that seal. The nonce makes a repeat tap on the SAME video a
  // fresh request, so backing out of the drill and tapping again re-opens it.
  const [focusVideo, setFocusVideo] = useState<{ id: string; nonce: number } | null>(null);
  const simulateVideoInRoom = useCallback(
    (analysisId: string): boolean => {
      // Only claim the tap when there is a real sealed video to open. No seal (the ambient room is
      // off, or the run degraded before producing an attention curve) ⇒ return false and the card
      // keeps its /analyze link instead of dead-ending on an inert button.
      if (!persistedSimSeals?.[analysisId]?.video) return false;
      setFocusVideo((prev) => ({ id: analysisId, nonce: (prev?.nonce ?? 0) + 1 }));
      // Desktop shows the rail already; a phone needs the sheet opened onto the same drill.
      setRoomExpanded(true);
      return true;
    },
    [persistedSimSeals],
  );

  // ── The ＋ door: bring your own stimulus (Phases 3+4, 2026-07-28) ───────────
  // ONE host, opened from the board's ＋ (in-thread) and from the Start card's SIMULATE DOOR
  // (pre-thread). It has to live here rather than inside the rail because on the empty home
  // `railHost` is NULL — HomePageLayout only mounts the rail <aside> in thread mode — so the rail,
  // and anything inside it, does not exist yet on the surface that needs the door most.
  const [simDoorOpen, setSimDoorOpen] = useState(false);

  // A brought TEXT landed: its `brought-card` is in the thread and its seal is written. Re-read
  // BOTH — reloadChatThread alone leaves `persistedSimSeals` stale, so the new row would appear
  // honestly QUEUED until the next full reload even though a measured verdict already exists for it.
  const reloadThreadAndSeals = useCallback(async () => {
    await reloadChatThread();
    try {
      const res = await fetch("/api/threads/open", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { simSeals?: WireSimSealMap };
      setPersistedSimSeals(data.simSeals ?? {});
    } catch {
      // The card is already in the thread; the row just stays queued until the next load.
    }
  }, [reloadChatThread]);

  // A brought VIDEO — the ~2-minute /api/analyze Max pipeline. Deliberately NOT re-implemented in
  // the door: this arms the SAME seams the Test skill uses (`pendingSealRef` → the seal-on-complete
  // effect above → /api/tools/test/card → the video seal the board reads by analysisId), so the
  // brought video lands exactly like a Test and nothing about the money path forks.
  const runBroughtVideo = useCallback(
    async (brought: BroughtStimulus) => {
      const file = brought.file ?? null;
      const url = (brought.url ?? "").trim();
      if (!file && url.length === 0) return;

      // The thread must exist BEFORE the run, or every server-side createOpenThreadLazy mints its
      // own row and the sealed card lands where the client is not looking (F-019).
      await ensureThreadForSend();
      // The echo that makes a 2-minute wait read as work, and restores the question on reload.
      const turn = file ? file.name : url;
      setLastUserTurn(turn);
      void fetch("/api/threads/user-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: turn }),
      }).catch(() => {});

      setSubmitError(null);
      setSubmitting(true);
      try {
        let storagePath: string | null = null;
        if (file) {
          const supabase = createClient();
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData.user?.id;
          if (!userId) {
            setSubmitError(ERROR_SESSION_EXPIRED);
            return;
          }
          const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase();
          const path = `${userId}/${nanoid()}.${ext}`;
          const { error } = await supabase.storage
            .from("videos")
            .upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
          if (error) {
            setSubmitError(ERROR_UPLOAD_FAILED);
            return;
          }
          storagePath = path;
        }
        // Arm the in-thread seal for THIS run (a hydration-sourced complete never arms it).
        pendingSealRef.current = true;
        sealHandledRef.current = false;
        await stream
          .start(
            storagePath
              ? { input_mode: "video_upload", content_type: "video", video_storage_path: storagePath }
              : { input_mode: "tiktok_url", content_type: "video", tiktok_url: url },
          )
          .catch(() => {
            /* stream.phase -> error transition owns the UI */
          });
      } finally {
        setSubmitting(false);
      }
    },
    [ensureThreadForSend, stream],
  );

  // ── The funnel-return inlet (ONBOARDING-FUNNEL-DESIGN.md §0b②) ─────────────
  // Two markers land a funnel visitor back on /home:
  //   ?claimed=1        — the OAuth link round-trip (claim-account.ts). The identity has
  //                       landed on the SAME anon user, so every seal is already open —
  //                       what's missing is the moment: nothing re-opened the verdict
  //                       they paid for. Auto-open the tested video's drill and say so.
  //   ?checkout=success — Whop's funnel redirect_url (whop/checkout/route.ts). Payment
  //                       landed but this return path bypassed the in-page claim step, so
  //                       the visitor is paid-but-unlinked: the drill re-opens on the
  //                       sealed wall, whose CTA is already "Finish unlocking — link your
  //                       account" (sealed-wall-cta.tsx). One behavior serves both — open
  //                       the drill; the drill's own sealed/unsealed state says the rest.
  // Armed once from location.search and stripped immediately (a refresh must never
  // re-celebrate); fired only once the rehydration above has landed the thread's seals.
  // A thread with no video seal leaves the arm to expire silently — never a dead drill.
  const funnelReturnRef = useRef<"claimed" | "checkout" | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const marker =
      sp.get("claimed") === "1"
        ? ("claimed" as const)
        : sp.get("checkout") === "success"
          ? ("checkout" as const)
          : null;
    if (!marker) return;
    funnelReturnRef.current = marker;
    sp.delete("claimed");
    sp.delete("checkout");
    const rest = sp.toString();
    router.replace(rest ? `/home?${rest}` : "/home", { scroll: false });
  }, [router]);

  useEffect(() => {
    const marker = funnelReturnRef.current;
    if (!marker) return;
    const videoEntries = Object.entries(persistedSimSeals).filter(([, s]) => s?.video);
    if (videoEntries.length === 0) return; // seals not hydrated yet — stay armed
    funnelReturnRef.current = null;
    const entry = videoEntries[videoEntries.length - 1];
    if (!entry) return;
    simulateVideoInRoom(entry[0]);
    if (marker === "claimed") {
      toast({
        variant: "success",
        title: "Account linked",
        description: "Your thread is yours — the verdict is unlocked.",
      });
    }
  }, [persistedSimSeals, simulateVideoInRoom, toast]);

  // ── The Room Rewrite loop (PR-3, LIVE-07) ──────────────────────────────────
  // The Population weak-spot's "Rewrite to win back the N% who bounced →" CTA re-runs the
  // ORIGINATING skill steered by the bouncers' real words (the `lever`), via the composer's OWN
  // stream hook. That's the honest re-POST-to-runner: the SSE is read to completion (unlike a
  // fire-and-forget fetch that resolves at headers, before persistence), so the regenerated batch
  // streams into the SAME thread + Read, and on completion we land focus on the winning (highest-
  // stop) card so the Room shows the real delta (prior → new). Only the text-seedable skills
  // rewrite; remix (URL-seeded) has no lever-reseed path → the CTA is gated off there.
  // ⚠️ runningTool, NOT activeTool. This gates the Population weak-spot's "Rewrite to win back
  // the N% who bounced →" CTA, which by definition appears AFTER a run has produced cards — by
  // which time the one-shot has already put activeTool back to chat. Reading the arm here would
  // have made the CTA vanish at the exact moment it becomes meaningful.
  const canRoomRewrite =
    runningTool === "hooks" || runningTool === "idea" || runningTool === "script";
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
      // The reseed re-runs the ORIGINATING skill — the one whose cards are on screen — so it
      // reads runningTool. It also leaves runningTool alone: a rewrite of a hooks batch is
      // still a hooks run, so the CTA survives its own use.
      if (runningTool === "hooks") {
        hooks.reset();
        roomRewriteExpectingRef.current = true;
        await hooks.start(seed, platform, intent);
      } else if (runningTool === "idea") {
        ideas.reset();
        roomRewriteExpectingRef.current = true;
        await ideas.start(seed, platform, intent);
      } else if (runningTool === "script") {
        script.reset();
        roomRewriteExpectingRef.current = true;
        await script.start(seed, platform, undefined, intent);
      }
    },
    [runningTool, hooks, ideas, script, platform, intent],
  );

  // Reseed completion: once the active skill's stream closes, land the Room's focus on the winning
  // (highest-stop) card of the fresh batch, then bump the nonce so the Room reveals the delta. The
  // fresh batch is the TAIL of the descriptor list (persisted history unchanged) — picking the best
  // of that tail is robust to the positional descriptor ids. Early-returns unless a rewrite is
  // pending, so normal generation (expecting = false) is never touched.
  useEffect(() => {
    if (!roomRewriteExpectingRef.current) return;
    const stream =
      runningTool === "hooks"
        ? hooks
        : runningTool === "idea"
          ? ideas
          : runningTool === "script"
            ? script
            : null;
    if (!stream || stream.isStreaming || !stream.isDone) return;
    const streamingCount =
      runningTool === "hooks"
        ? hooksBlocks.length
        : runningTool === "idea"
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
    runningTool,
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

  // ── The ask-the-room handler is GONE (2026-07-28 — owner call, Lane 2 step 4) ────────────
  //
  // `askAudience` POSTed the composer field to /api/tools/react and pushed the result into the
  // legacy <AudiencePresence> ask trail + the thought focus. It was deleted because it billed
  // for silence. Probed against the real component, both flag ways, before touching anything:
  //
  //   flag OFF, fresh /home      → 1 billed call, NOTHING on screen
  //   flag OFF, existing thread  → the thought appears in the collapsed pulse bar; no verdict
  //   flag ON  (either state)    → 1 billed call, NOTHING on screen — AmbientOverviewRail and
  //                                AmbientOverviewSheet never consumed `asks` or the focus
  //
  // and on 2026-07-28 the route became a PAID action (1 credit). Its only doors were the skill
  // pill (deleted the same day) and `/ask`.
  //
  // WHAT SURVIVES: the route, its price, the ＋ door, and `AmbientOverviewRail.fireSim` — the
  // room's own armed sim, which is a real surface with a real result. This deletion removed a
  // second, blind door to the same engine call; it did not remove the revenue line.
  //
  // `focusByThought` stays: the per-thread wipes and the audience switch still clear a stale
  // read through it. Nothing SETS a thought focus now, which is exactly the point.

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
      // A typed-thought read was produced against the PREVIOUS audience — leaving it in focus
      // would show the old room's reaction under the new audience's name. Clear it; the focus
      // falls back to the thread's own cards (each card carries its own read, anchored to the
      // thread history, so those stay).
      focusByThought(null);
      void handleSelectAudience(a);
    },
    focus: ambientFocus,
    reducedMotion,
    // Visual expand only (dock bloom + <xl header sheet). The rail ignores it; tapping the band
    // arms nothing — the composer field has no route to the room at all now (step 4).
    open: roomExpanded,
    onOpenChange: handleRoomExpandedChange,
    drillIntoFocus: roomDrill,
    // `asks` / `asking` / `onReask` are NOT passed any more: the composer's ask verb was the only
    // producer, and it is gone. They stay optional on <AudiencePresence> (which is itself on the
    // v2 cutover's list) so nothing there had to change — but with no producer, the trail is
    // permanently empty and `earlierAsks` renders null by construction.
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
      focusVideo={focusVideo}
      // The ＋ door. The rail hands the tap up here because what comes through it has to be routed
      // to a real run — the rail can reach neither the analyze stream nor the thread reload.
      onTestVariant={() => setSimDoorOpen(true)}
    />
  );
  // P2 (A2b) — the <xl header: a 68px bar that expands DOWNWARD. Same props again; rendered at the
  // TOP of the thread branch (below), not the dock.
  //
  // Ambient v2 (2026-07-24 fix): the flag used to swap ONLY the ≥xl rail, so a phone kept the retired
  // room (constellation crown · "N people ready" · the "say hi →" cast) while desktop got the ranked
  // v2 board — one product, two rooms. The header now swaps on the SAME flag, to the SAME surfaces
  // fed the SAME live inputs as `audienceRailV2`, presented as a sheet instead of a column.
  const audienceHeader = AMBIENT_V2_ENABLED ? (
    <AmbientOverviewSheet
      audience={effectiveAudience}
      descriptors={ambientDescriptors}
      reducedMotion={reducedMotion}
      persistedSeals={persistedSimSeals}
      focusVideo={focusVideo}
      onTestVariant={() => setSimDoorOpen(true)}
      open={roomExpanded}
      onOpenChange={handleRoomExpandedChange}
      // It hangs off the composer now, not the top row — the plate in the dock owns the surface.
      attached
    />
  ) : (
    <AudiencePresence {...presenceCommonProps} variant="header" />
  );

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
  const threadAudienceLabel = selectedAudience?.name ?? "General";

  // ── THE LIVE TAIL ───────────────────────────────────────────────────────────
  // The in-flight run, shaped as the thread's last turn. Everything a per-skill view used to own —
  // the intro's inputs, the stage spine, the outro text, the degrade notices, retry, the outliers
  // offer — rides here, so <ThreadTurn> renders it with the SAME grammar it renders a reloaded turn
  // with. The retry entry points are per-skill because each stream's `start` has its own signature.
  const retryActiveRun = useCallback(() => {
    switch (activeRun?.skill) {
      case "ideas": return void ideas.start("", platform);
      case "hooks": return void hooks.start("", platform);
      case "script": return void script.start("", platform);
      case "remix": return void remix.start("", platform);
      case "explore": return void explore.start({});
      case "account": return void account.start();
      default: return undefined;
    }
  }, [activeRun?.skill, ideas, hooks, script, remix, explore, account, platform]);

  const findOutliersActiveRun = useCallback(() => {
    switch (activeRun?.skill) {
      case "ideas": return void ideas.findOutliers();
      case "hooks": return void hooks.findOutliers();
      case "script": return void script.findOutliers();
      default: return undefined;
    }
  }, [activeRun?.skill, ideas, hooks, script]);

  const liveTurn: LiveTurn | null = activeRun
    ? {
        userTurn: lastUserTurn,
        blocks: activeRun.blocks,
        live: {
          skill: activeRun.skill,
          isStreaming: activeRun.isStreaming,
          stages: activeRun.stages,
          evidence: activeRun.evidence,
          followupText: activeRun.followupText,
          warnings: activeRun.warnings,
          error: activeRun.error,
          outliersAvailable: activeRun.outliersAvailable,
          audienceLabel: threadAudienceLabel,
          platform,
          // The input hook a script run was built from — the intro cites it honestly ("Writing a
          // script from …"), and only the script chain sets it.
          hookLine: activeRun.skill === "script" ? scriptAnchorHook : null,
          onRetry: retryActiveRun,
          onFindOutliers: activeRun.outliersAvailable ? findOutliersActiveRun : undefined,
        },
      }
    : null;

  // Explore's tile actions, provided once at the thread root so a grid stays live whether it just
  // streamed in or came back from the database (see use-outlier-grid-actions.ts).
  const outlierGridActions = useOutlierGridActions(platform, () => void reloadOpenThread());

  // Test in-flight feedback. The Test now runs the full Max pipeline (~2 min) IN-THREAD, then seals
  // the card (no navigate-out) — so the wait needs the SAME run-capsule spine the in-thread Upload
  // field + the flagship /analyze skeleton show, not a lone spinner. `analyzing` spans the whole
  // stream-connected stretch (analyzing → any reconnect/poll dropback); `carding` is the card-adapter
  // POST tail. useTestRunStages is called unconditionally (React rules) and idle until a Test runs.
  const testAnalyzing =
    stream.phase === "analyzing" ||
    stream.phase === "reconnecting" ||
    stream.phase === "polling";
  const testRunStages = useTestRunStages({ analyzing: testAnalyzing, carding });
  // …and the run's live evidence: the post the scrape resolved, then the real keyframes the
  // extractor cuts. Same signals the flagship /analyze skeleton uses (use-test-run-evidence.ts),
  // so the composer's Test wait and the full-page one now show the same proof-of-work.
  const testRunEvidence = useTestRunEvidence(
    stream.analysisId,
    testAnalyzing || carding,
  );
  // ⚠️ runningTool, NOT activeTool. armFired() reverts the arm to chat the instant the Test is
  // dispatched — a ~2-minute run — so keying the progress spine on the arm would have blanked
  // the whole wait the moment it started. This is the read that made the one-shot safe.
  const testSubmitPending =
    runningTool === "test" && (submitting || testAnalyzing || carding);
  const testSubmitTurn = testSubmitPending ? (
    <ThreadShell userTurn={lastUserTurn}>
      <ThreadAssistantTurn>
        {/* Staging (a file is uploading, before the stream connects) has no clock yet — a lone
            spinner reads honestly there. Once analyzing/carding, the 3-step spine carries the wait. */}
        {submitting && file && !testAnalyzing && !carding ? (
          <div className="flex items-center gap-2 text-sm text-foreground-muted" aria-live="polite">
            <Spinner size="sm" />
            <span>Uploading your video…</span>
          </div>
        ) : (
          <div aria-live="polite" aria-atomic="false">
            <p className="mb-2 text-body font-medium text-foreground-secondary">
              {SKILL_RUN_META.test!.running}
            </p>
            <ProgressChecklist
              stages={testRunStages}
              plan={SKILL_RUN_META.test!.plan}
              evidence={testRunEvidence}
            />
          </div>
        )}
      </ThreadAssistantTurn>
    </ThreadShell>
  ) : null;

  // Test's FAILURE turn — the sibling of testSubmitTurn above.
  //
  // Every other skill renders <SkillRunError> off its stream's `error` (hooks, ideas, script,
  // remix, explore all do). Test was the one that never did: the composer reads `stream.phase`,
  // `analysisId`, `isStreaming`, `quotaError` — and dropped `stream.error` on the floor. So when
  // a run died, `testSubmitPending` simply went false and testSubmitTurn unmounted: the progress
  // spine, the echoed link, all of it vanished and left an empty composer with no word of what
  // happened. Measured against a production build on 2026-07-27 by refusing /api/analyze with a
  // 500 — the whole screen wiped, silently. That is the /go funnel's own failure path (a private,
  // deleted or region-locked post is an ordinary TikTok outcome), so the silence landed on exactly
  // the visitor the page exists to convert.
  //
  // NOT the quota 402: that sets `quotaError` too, and the wall dialog below owns it — rendering
  // both would put an inline "retry" under a modal that just said the allowance is spent.
  const testRunFailed =
    runningTool === "test" &&
    stream.phase === "error" &&
    !stream.quotaError &&
    !testSubmitPending;
  // The polling ceiling is the one error where the pipeline may still be ALIVE server-side, so a
  // "retry" there would start a second billed run on top of it. Offer the truth instead of a button.
  const testRunStillAlive = stream.error === STREAM_TIMEOUT_ERROR;
  // CAUSE BEATS SKILL (lib/net/run-failure.ts rule 1). This is a bespoke error surface — it writes
  // its own sentences instead of resolving them through `thread-turn.tsx` — so it did not inherit
  // that rule, and the skill copy below is an ACCUSATION: it blames a private, deleted or
  // region-locked post. That is the likeliest truth for a /go visitor and worth keeping, but it is
  // a lie about a file that is fine when the run actually died on a dead session or a dropped
  // connection, and it is the sentence the creator acts on — by deleting and re-uploading a video
  // that was never the problem. So a named cause overrules it; an unnamed failure keeps it.
  const testRunCause = runFailureCauseOf(stream.error);
  const testRunCauseCopy = runErrorCopy(stream.error, "test");
  const testFailedTurn = testRunFailed ? (
    <ThreadShell userTurn={lastUserTurn}>
      <ThreadAssistantTurn>
        <SkillRunError
          headline={
            testRunCause
              ? testRunCauseCopy.headline
              : testRunStillAlive
                ? "This read is taking longer than usual."
                : "Couldn’t finish that read."
          }
          body={
            testRunCause
              ? testRunCauseCopy.body
              : testRunStillAlive
                ? "Your video is still being read — it just outran the live connection. Reload in a minute and the card will be waiting in this thread."
                : "The run dropped before the read was finished. A private, deleted or region-locked post will do that. Tap to retry — nothing was charged."
          }
          // Billing happens only in /api/analyze's success branch ("BILL THE READING — inside the
          // success branch, on purpose"), so a dead run really did cost them nothing, and a retry
          // really is free. Both halves of that sentence are load-bearing; don't soften either.
          // handleSubmit("test") — explicitly, not handleSubmit(). By the time this button
          // exists the one-shot has reverted the arm to chat, so a bare retry would have sent
          // the failed video URL as a CHAT MESSAGE and called it a retry.
          //
          // The retry SURVIVES a named cause — the run is still free to repeat, and removing the
          // button would strand a user whose session or connection comes back a second later. Only
          // its label changes, to name the precondition ("Retry after signing in") rather than
          // inviting a tap that earns the same 401 forever.
          onRetry={testRunStillAlive ? undefined : () => void handleSubmit("test")}
          retryLabel={testRunCause ? testRunCauseCopy.retryLabel : "Retry the video test"}
        />
      </ThreadAssistantTurn>
    </ThreadShell>
  ) : null;

  const threadContent = (
    <OpenRoomContext.Provider value={openRoomForCard}>
     <SimulateVideoContext.Provider value={simulateVideoInRoom}>
     <InThreadInputContext.Provider value={inThreadInputValue}>
      <FollowupContext.Provider value={sendChatFollowup}>
       {/* Card-CTA contexts lifted to the thread root (thread-unification Phase 1): any card rendered
           through MessageBlocks — persisted stream OR live view — keeps its "Test full →" / "Write the
           script →" / "Develop into hooks →" / "Develop this →" action. The callbacks already exist in
           the composer; the per-skill views' own (nested, identical) providers stay for now (idempotent). */}
       <PlatformContext.Provider value={platform}>
        <HookTestContext.Provider value={handleTestHook}>
         <HookWriteScriptContext.Provider value={handleWriteScript}>
          <ScriptTestContext.Provider value={handleTestScript}>
           <RemixDevelopContext.Provider value={handleDevelopRemix}>
            <OutlierGridActionsContext.Provider value={outlierGridActions}>
      {testSubmitTurn}
      {testFailedTurn}
      {/* THE THREAD — history AND the live tail, through ONE renderer.
          Every turn (persisted or in-flight) renders via <ThreadTurn>: user bubble → intro →
          loading spine → cards → outro. This replaced seven per-skill views mounted behind
          `activeTool ===` gates, which is what made a finished run live OUTSIDE the thread until
          the creator switched skills. Nothing here reads activeTool; there is no second surface to
          race with. */}
      {/* Which thread these blocks belong to. Read by <SaveAffordance> so a save records its own
          origin — `saved_items.thread_id` has existed since P10 but only one of eleven renderers
          ever passed it, leaving every saved row orphaned from the thread that produced it. */}
      <ThreadIdContext.Provider value={openThreadId}>
        <PersistedThreadStream
          persistedTurns={persistedStreamTurns}
          liveTurn={liveTurn}
          ambientBaseIndex={0}
        />
      </ThreadIdContext.Provider>
            </OutlierGridActionsContext.Provider>
           </RemixDevelopContext.Provider>
          </ScriptTestContext.Provider>
         </HookWriteScriptContext.Provider>
        </HookTestContext.Provider>
       </PlatformContext.Provider>
      </FollowupContext.Provider>
     </InThreadInputContext.Provider>
    </SimulateVideoContext.Provider>
    </OpenRoomContext.Provider>
  );

  // ── THE ARMED INDICATOR — what replaced the skill pill, and why it is not one ────────────
  //
  // The pill was a PICKER: a chip that opened a nine-row popover and set `activeTool`. It is
  // deleted (owner call). But deleting it alone would have left a real hole: with the pill
  // gone, and a Start tile able to arm a SIM-1 Max video Test, the only thing on screen saying
  // what the next send costs would have been the placeholder — which vanishes the moment you
  // type a character. "Press send and find out" is not a thing to ship on a metered product.
  //
  // So this states the armed skill and offers exactly ONE control: `×`, back to chat. No menu,
  // no popover, no list — the `/` slash menu is where you PICK a skill. It renders only while
  // something other than chat is armed, so the default composer is a clean field, and it
  // disappears by itself the moment the one-shot fires.
  const armedSkill = activeTool === DEFAULT_TOOL ? null : getSkill(activeTool);
  const armedIndicator = armedSkill ? (
    <span
      data-testid="composer-armed-skill"
      data-skill={activeTool}
      className="inline-flex h-[34px] min-w-0 shrink items-center gap-1.5 rounded-lg bg-white/[0.05] pl-2.5 pr-1.5 text-reading font-medium text-foreground pointer-coarse:h-11"
    >
      <Ico name={SKILL_ICON[activeTool]} size={15} className="shrink-0 text-foreground-secondary" />
      <span className="truncate">{armedSkill.label}</span>
      <button
        type="button"
        aria-label={`Disarm ${armedSkill.label} — back to chat`}
        title="Back to chat"
        onClick={() => handleUserSelectTool(DEFAULT_TOOL)}
        className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] text-foreground-muted transition-colors hover:bg-white/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]"
      >
        <XIcon className="h-[13px] w-[13px]" />
      </button>
    </span>
  ) : null;

  // Shared form element (identical markup; referenced by both layout branches).
  const composerForm = (
    <form
      data-testid="composer"
      data-layout={homeThreadMode ? "thread" : layout}
      onSubmit={onSubmitForm}
      onDragOver={(e) => {
        // Evidence-drop overlay (D-07). Additive: VideoUpload stops propagation on its
        // own drop zone, so the creator upload path is unaffected. (The `isAsk` bail that
        // used to guard this went with the ask verb — no skill hijacks the field now.)
        e.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragOver(false);
      }}
      onDrop={(e) => {
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
        <div ref={slashAnchorRef} className="relative p-4">
          {/* `/` slash command menu (UX-01) — opens UPWARD above the composer when
              the field value starts with `/`. Filterable; selecting sets the skill
              and clears the `/`. SkillRows is the same list the pill used to show — this is
              the only place it renders now. */}
          {/* v8: PORTALED (UpwardPopover) — the composer box's overflow-hidden clips the
              in-place absolutely-positioned menu COMPLETELY (measured 2026-08-08: the menu
              rect ends 9px above the clip box, so the live menu is invisible). The legacy
              branch below keeps its markup byte-identical. */}
          {slashActive && CONCEPT_V8_ENABLED && (
            <UpwardPopover open anchorRef={slashAnchorRef} ariaLabel="Skills" className="w-[320px]">
              <SkillRows
                active={activeTool}
                filter={slashQuery}
                onSelect={selectSkill}
                activeMode={selectedAudience?.mode ?? "socials"}
              />
            </UpwardPopover>
          )}
          {slashActive && !CONCEPT_V8_ENABLED && (
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

          {/* v8: the skills panel — the pill's target (and More ▸'s). Discovery only;
              Use arms via handleUserSelectTool, the same door every picker uses. */}
          {CONCEPT_V8_ENABLED && (
            <SkillsPanel
              open={skillsPanelOpen}
              onClose={() => setSkillsPanelOpen(false)}
              active={activeTool}
              activeMode={selectedAudience?.mode ?? "socials"}
              onUse={(id) => {
                handleUserSelectTool(id);
                setSkillsPanelOpen(false);
              }}
              anchorRef={skillPillRef}
            />
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
                className="shrink-0 rounded p-0.5 text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]"
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
            {/* v8: the armed skill is a dismissible tag IN the field (spec §3) — the foot
                slot empties (the pill lives there instead). */}
            {CONCEPT_V8_ENABLED && armedIndicator ? (
              <div className="flex">{armedIndicator}</div>
            ) : null}
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
                "w-full min-w-0 resize-none bg-transparent px-1 pt-0.5 text-reading text-foreground",
                "placeholder:text-foreground-muted focus:outline-none",
                // The empty box breathes — but 72px of void above the controls read as an
                // empty panel rather than an input, and it pushed the whole dock to 180px.
                // 48px still gives the placeholder room to sit high with air beneath it,
                // and the dock lands nearer 150px. It grows to 200 as you type, as before.
                "min-h-[48px] max-h-[200px] leading-[1.55]",
              )}
            />

            {/* Row 2 — controls, split the way Claude/Perplexity split theirs: the LEFT
                cluster is what you're about to do (attach · armed skill), the RIGHT cluster is
                what you're talking to (the SIM-1 tier) plus the send. Every control is a bare or
                quietly-filled glyph — the cream send disc is the surface's ONE bright element. */}
            <div className="flex items-center justify-between gap-2">
              {/* LEFT cluster — attach · armed indicator · (Explore params, when armed).
                  The skill PILL used to sit here; it is gone (owner call — Lane 2 step 3). The
                  `+` attach is now unconditional: it was hidden under the ask verb because that
                  verb hijacked submit and would have discarded a staged file, and the verb is
                  gone too. The file <input> stays mounted regardless — handleUserSelectTool
                  ("profile") clicks it from inside the click gesture. */}
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
                <button
                  type="button"
                  aria-label={EVIDENCE_ATTACH_LABEL}
                  title={EVIDENCE_ATTACH_LABEL}
                  onClick={() => evidenceInputRef.current?.click()}
                  className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-foreground-muted transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)] pointer-coarse:h-11 pointer-coarse:w-11"
                >
                  <Plus className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </button>

                {CONCEPT_V8_ENABLED ? (
                  <SkillPill
                    open={skillsPanelOpen}
                    onClick={() => setSkillsPanelOpen((v) => !v)}
                    anchorRef={skillPillRef}
                  />
                ) : (
                  armedIndicator
                )}

                <ComposerControls
                  activeTool={activeTool}
                  onRunExplore={(params) => void explore.start(params)}
                  className="shrink-0"
                />
              </div>

              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
                <SimModelSelector
                  value={selectedModel}
                  onChange={setSelectedModel}
                  // v8: always visible (owner decision 11); carries the armed Max skill's
                  // real price from CREDIT_COSTS — never a typed figure.
                  className={CONCEPT_V8_ENABLED ? undefined : "hidden sm:inline-flex"}
                  price={
                    CONCEPT_V8_ENABLED && MAX_BILLABLE_BY_TOOL[activeTool]
                      ? `${creditCost(MAX_BILLABLE_BY_TOOL[activeTool]!)} cr`
                      : undefined
                  }
                />

                {/* Submit — the cream disc — which becomes STOP while a run streams.
                    ONE RUN AT A TIME (the ChatGPT/Claude model): the field stays editable, but the
                    submit action swaps for an abort, so a slow run is never a trap. Every stream
                    hook backs `stop()` with a real AbortController, so this cancels for real; an
                    aborted run keeps whatever blocks already persisted server-side.
                    boxShadow is forced off inline so the primary variant's dark 2px ring
                    (--shadow-button) can never re-add a border. */}
                <Button
                  type={isAnyStreaming ? "button" : "submit"}
                  // ⚠️ preventDefault is LOAD-BEARING, not defensive tidiness. `type` alone does
                  // not close the race: form submission is the CLICK's default action, and the
                  // default action runs AFTER React has flushed this discrete event — so
                  // `stopActive()` sets isStreaming false, React re-renders the very same DOM node
                  // to type="submit", and the browser then submits the form it is now looking at.
                  // Measured live 2026-07-28: one click on Stop aborted the run and fired a SECOND
                  // billed /api/tools/hooks in the same 100ms, and the two runs' cards merged into
                  // one 10-card turn. Cancelling the default action kills it whatever `type` says
                  // by the time the default action is dispatched.
                  onClick={
                    isAnyStreaming
                      ? (e) => {
                          e.preventDefault();
                          stopActive();
                        }
                      : undefined
                  }
                  variant="primary"
                  size="sm"
                  // Account fell through to "Simulate" here — it was never submittable, so the
                  // chain never needed a case for it. Now that send RUNS the read, the button
                  // has to say so: a screen-reader user pressing "Simulate" and being charged
                  // for an account scrape is the same bug as a sighted one, just louder.
                  aria-label={isAnyStreaming ? "Stop the run" : evidenceFile ? "Read this evidence" : activeTool === "idea" ? "Generate ideas" : activeTool === "hooks" ? "Generate hooks" : activeTool === "chat" ? "Send message" : activeTool === "script" ? "Generate script" : activeTool === "remix" ? "Remix video" : activeTool === "explore" ? "Run Explore" : activeTool === "account" ? "Read my account" : "Simulate"}
                  // Offline folds into the NON-streaming arm only. While a run streams this disc
                  // is Stop, and taking Stop away at the moment the connection drops removes the
                  // control the user most wants — and the one that prevents a second billed run
                  // (composer-stop-disc.test.tsx).
                  disabled={isAnyStreaming ? false : !online || (evidenceFile ? profiling : !canSubmit)}
                  // A spinner would HIDE the stop affordance, so the streaming state wears the
                  // square instead. `loading` is left for the pre-stream waits only.
                  loading={isAnyStreaming ? false : profiling || submitting}
                  style={{ boxShadow: "none" }}
                  className="shrink-0 h-[36px] w-[36px] min-w-0 p-0 rounded-full"
                >
                  {isAnyStreaming ? (
                    <Square className="h-[13px] w-[13px]" strokeWidth={2.25} fill="currentColor" />
                  ) : (
                    <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.25} />
                  )}
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
        : CONCEPT_V8_ENABLED || useHeader || !roomExpanded
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
        {/* THE PLATE (2026-07-31, owner call). <xl the audience bar used to sit in the mobile TOP
            row, a full screen away from the field it describes — you read "18 ranked" at the top and
            typed at the bottom. It is now the STRIP fused to the composer's top edge, built on the
            same geometry Claude hangs its usage banner off the BOTTOM of theirs: one outer plate, a
            quiet full-width row, and the field inset inside it.

            Three surfaces, so the stack reads as depth and not as three cards. The plate is the
            SKILL-CARD fill (`surface-sunken` #1a1a19 — skill-result-card.tsx calls it "the one
            in-thread card fill", and every hook/idea/script card carries it), so the banner reads
            as the same family of surface as the cards it describes rather than a third tone:
            page #1f1f1e → plate #1a1a19 (`surface-sunken`) → field #2c2c2b (`surface-elevated`).
            Radii nest (plate 24 = field 20 + the 4px inset) or the corners fight.

            ≥xl the rail still owns the room, so the plate collapses to a passthrough and the
            composer box below is byte-identical to what it always was. */}
        <div
          className={cn(
            "relative w-full",
            useHeader &&
              "rounded-[24px] border border-white/[0.06] bg-surface-sunken p-[4px] pt-0",
          )}
        >
          {useHeader ? (
            <div data-testid="audience-header-slot">{audienceHeader}</div>
          ) : null}
          <div
            className={cn(
              "relative w-full border border-white/[0.06] bg-surface-elevated",
              useHeader ? "rounded-[20px]" : "rounded-[24px]",
              // The dock panel blooms flush with the composer top → flatten the box's top edge so
              // the two read as one surface. Driven by the VISUAL expand, never the ask verb.
              !roomExpanded && "overflow-hidden",
              roomExpanded && "rounded-t-none border-t-0",
              // Was --shadow-float (0 10px 30px rgba(0,0,0,.35)) — a 30px blur that pooled
              // visibly on the surface behind the dock. Halved the blur and the alpha so the
              // composer still reads as floating without casting a smudge under it.
              layout === "centered" && "shadow-[0_6px_16px_rgba(0,0,0,0.18)]",
              !reducedMotion && "transition-shadow duration-200",
            )}
          >
            {composerForm}
            {/* v8: the attached SUB-BAR — one hairline strip under the foot (owner
                decision 13). Left half → the audience sheet; right half → the room. */}
            {CONCEPT_V8_ENABLED && (
              <ComposerSubBar
                audience={effectiveAudience}
                watching={audienceReacting}
                lensLabel={LENS_LABEL[platform]}
                onOpenAudience={() => setAudienceSheetOpen(true)}
                onOpenSim={() => setRoomExpanded(true)}
              />
            )}
            {buildChooser}
          </div>
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

      {/* THE ＋ DOOR (Phases 3+4) — bring your own hook, script, video or link.
          Mounted in the DOCK because the dock is the one thing both layout branches render, so a
          single host serves the board's ＋ (thread mode) and Start's SIMULATE DOOR (empty home).
          Only under the v2 flag: both doors that open it are v2 surfaces. */}
      {AMBIENT_V2_ENABLED && (
        <SimulateDoorHost
          audience={effectiveAudience}
          open={simDoorOpen}
          onClose={() => setSimDoorOpen(false)}
          onLanded={reloadThreadAndSeals}
          onVideo={(brought) => void runBroughtVideo(brought)}
          ensureThread={ensureThreadForSend}
        />
      )}

      {/* v8: THE REPORT (Phase 3 — sheet <xl, overlay/pinnable panel ≥xl) + the audience
          sheet. Both driven from the sub-bar; roomExpanded is also set by a card's
          "See the room →", which lands here too now that the header bar is retired
          under v8. */}
      {CONCEPT_V8_ENABLED && (
        <>
          <VerdictReport
            open={roomExpanded}
            onClose={() => handleRoomExpandedChange(false)}
            subject={reportSubject}
            audience={effectiveAudience}
            variant={isXl ? "panel" : "sheet"}
            pinned={reportPinned}
            onPinnedChange={setReportPinned}
            pinHost={railHost}
            watching={simWatching}
            reducedMotion={reducedMotion}
            onSteer={(steer) => {
              // The fix feeds the thread as a STEER: it lands in the field, it does not send.
              // Fire-on-demand means the creator still presses the button.
              setUrl(steer);
              handleRoomExpandedChange(false);
            }}
          />
          <AudienceSheetV8
            open={audienceSheetOpen}
            onClose={() => setAudienceSheetOpen(false)}
            audiences={audiences}
            selectedAudienceId={selectedAudienceId}
            onSelect={(a) => {
              // Same reground as every other switcher: a typed-thought read was
              // produced against the PREVIOUS audience — clear the focus.
              focusByThought(null);
              void handleSelectAudience(a);
              setAudienceSheetOpen(false);
            }}
            lens={platformLens}
            onLensChange={setPlatformLens}
            note={lensNote}
            onNewAudience={() => router.push("/audience/new")}
          />
        </>
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
  // v8 retires the starter grid outright — the drops (Phase 2) replace it as arrival
  // content; skill discovery is the pill + panel + chips (spec §6, "what dies").
  const homeStarter = !hasConversationContent && !CONCEPT_V8_ENABLED ? (
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

  // The first-run moment. Onboarding now hands every new account a calibrated audience and then
  // said nothing about it — this names it once and offers ONE first action. It renders itself
  // only when a real calibration landed and only until dismissed, so for everyone else it is
  // already null; the guard here is just the same empty-home condition its siblings use, because
  // it is a footer for the idle home rather than chrome that follows you into a thread.
  // The layout classes ride ON the component rather than on a wrapper here, deliberately: it
  // returns null for anyone uncalibrated or already dismissed, and a wrapper div would survive
  // that and leave a dead 12px gap under the composer for every one of them.
  const homeAudienceIntro = !hasConversationContent ? (
    <HomeAudienceIntro
      audience={selectedAudience}
      onFirstCard={handleActivationCardRun}
      className="pointer-events-auto mt-3"
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
        {/* The <xl audience bar USED to live here — a row in the mobile top nav, laid out against
            `MOBILE_NAV` so it sat flush beside the sidebar opener tab. It moved into the dock on
            2026-07-31 (owner call): a room you consult while composing belongs against the field,
            not a full phone screen above it. */}
        {/* Scrollable thread region — full width, fills the FULL shell height and scrolls
            UNDER the floating dock (the dock is absolutely positioned below, not in flow).
            The bottom padding clears the collapsed dock so the last message can rest just
            above the composer instead of hiding behind it.
            registerThreadRegion roots the scroll-spy IntersectionObserver on this element
            (Pattern 5). It observes the `[data-ambient-card]` anchors that the REAL cards carry
            (message-blocks.tsx), so the spotlight tracks the ledger as it actually scrolls (D-01). */}
        <div
          ref={registerThreadRegionRef}
          data-testid="composer-thread-region"
          // THE BAND IS TRANSPARENT ON THE THREAD (2026-07-31, owner call). AppShell pads `main`
          // down by MOBILE_NAV_BAND so no page renders under the fixed burger — rent the audience
          // bar used to pay, when it lived in that band. Once the bar moved into the composer dock
          // the band became a dead shelf that CLIPPED the conversation: the scroll box began below
          // it, so a message scrolling up vanished at that edge instead of passing behind the
          // burger the way it already passes behind the dock.
          //
          // The negative margin lifts THE SCROLL BOX over the band and the matching padding puts
          // the clearance back INSIDE it — so at rest the first message still clears the burger,
          // but the pad scrolls away and the thread runs full-bleed underneath.
          //
          // ⚠️ On the scroll region, NOT the shell. The shell is `h-full` and roots the dock's
          // `absolute inset-x-0 bottom-0`; pulling the shell up would have carried the dock 46px
          // off the bottom of the viewport with it. Here the flex column absorbs the margin and
          // the dock never moves.
          //
          // Same 768px boundary as AppShell's `md:pt-0` and the burger's `md:hidden`; custom
          // properties rather than inline values so the `md:` resets can outrank them.
          className="flex-1 min-h-0 overflow-y-auto mt-[var(--nav-mt)] pt-[var(--nav-pt)] pb-[184px] md:mt-0 md:pt-0"
          style={
            {
              "--nav-mt": `-${MOBILE_NAV_BAND}px`,
              "--nav-pt": `${MOBILE_NAV_BAND}px`,
            } as React.CSSProperties
          }
        >
          <div className="w-full max-w-[760px] mx-auto px-2.5 sm:px-4">
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
            ) : AMBIENT_V2_ENABLED && !hasConversationContent && !startEngaged ? (
              // v2 Start (④) rides the SCROLL region — the artifact grid sits where the first
              // message would, with the composer docked below it. Picking a skill sets
              // startEngaged, this drops out, and you land on an empty chat.
              // pb-40 clears the floating dock. The dock is `absolute bottom-0` over this same
              // scroll region, so with `justify-end` the grid's last row sat directly under it
              // and "Test something of your own" rendered half-hidden behind the composer at
              // 1512×982 — the last starter card, sliced, on the first screen a new account sees.
              <div className="flex min-h-full flex-col justify-end pt-6 pb-40">
                {CONCEPT_V8_ENABLED ? (
                  // v8 arrival (Phase 2): greeting + the shelf — spec §0b restraint:
                  // greeting · drops · composer, nothing else.
                  <>
                    <ArrivalV8 shelfReady={dropCards.length > 0} />
                    <DropShelf
                      cards={dropCards}
                      status={dropsStatus}
                      onRemix={(c) => void handleRemixDrop(c)}
                      onOpenReport={openReportForDrop}
                      remixingId={remixingDropId}
                    />
                  </>
                ) : (
                  <AmbientStartHome
                    audience={effectiveAudience}
                    onSkill={pickStartSkill}
                    onSubmit={seedAndRun}
                    // The SIMULATE DOOR — a creator holding a script should not have to run a skill
                    // first to get it in front of the room. Same host as the board's ＋.
                    onSimDoor={() => setSimDoorOpen(true)}
                    activeSkillId={activeTool}
                    audiences={audiences}
                    selectedAudienceId={selectedAudienceId}
                    onSelectAudience={(a) => {
                      focusByThought(null);
                      void handleSelectAudience(a);
                    }}
                  />
                )}
              </div>
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
          <div className="w-full max-w-[760px] mx-auto px-2.5 sm:px-4">
            {/* The six quick actions live ABOVE the field, never below it (owner call 2026-07-24):
                below, they read as results of a chat that hasn't happened. Only on the post-pick
                empty chat — once real content lands, the thread is the offer. */}
            {AMBIENT_V2_ENABLED && startEngaged && !hasConversationContent ? (
              <div className="pointer-events-auto mb-3">{homeStarter}</div>
            ) : null}
            {composerDock}
            {/* v8: example chips + More ▸ — under the composer, fresh home only. */}
            {CONCEPT_V8_ENABLED && !hasConversationContent ? (
              <div className="pointer-events-auto">
                <ChipsRow
                  onArm={handleUserSelectTool}
                  onMore={() => setSkillsPanelOpen(true)}
                />
              </div>
            ) : null}
            {/* BENEATH the field, deliberately. Above it would be a prose lede over the grid,
                which STARTER CONTRACT rule 2 forbids outright — and the dock is bottom-anchored,
                so content added here grows downward from the composer rather than displacing it.
                NOT gated on startEngaged: under ambient v2 the empty home opens on the Start
                surface with the grid still behind that gate, so gating here would hide the intro
                on precisely the screen a new account actually lands on. */}
            {homeAudienceIntro}
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
        // Ambient v2 Start (④) as the empty-home hero (parallel-run): the categorized artifact grid
        // ABOVE the live composer (owner call 2026-07-24). The grid used to REPLACE the field until
        // you picked something, which read as a menu you had to get past; showing both makes the
        // empty home read as the start of a chat that happens to offer shortcuts. Picking a skill
        // still arms the tool and drops into the normal fresh-chat home.
        <>
        {CONCEPT_V8_ENABLED ? (
          // v8 arrival (see the branch-A mount): greeting + the shelf (Phase 2).
          <>
            <ArrivalV8 shelfReady={dropCards.length > 0} />
            <DropShelf
              cards={dropCards}
              status={dropsStatus}
              onRemix={(c) => void handleRemixDrop(c)}
              onOpenReport={openReportForDrop}
              remixingId={remixingDropId}
            />
          </>
        ) : (
          <AmbientStartHome
            audience={effectiveAudience}
            // The Start grid ids are ToolIds — NOT SKILL_RUN_META keys, which this comment used to
            // claim were "all valid ToolIds". They are not: SKILL_RUN_META spells Ideas `ideas`
            // (F-017). pickStartSkill validates against SKILLS, so an unknown id is now inert.
            onSkill={pickStartSkill}
            onSubmit={seedAndRun}
            // The SIMULATE DOOR (see the branch-A mount) — the second verb, its own act.
            onSimDoor={() => setSimDoorOpen(true)}
            activeSkillId={activeTool}
            // Pre-thread audience choice: the "Testing against" chip is a real picker here (no thread
            // to lock to yet). Same reground as the presence's onSelectAudience — a switched audience
            // must not carry a stale thought read / ask ledger.
            audiences={audiences}
            selectedAudienceId={selectedAudienceId}
            onSelectAudience={(a) => {
              focusByThought(null);
              void handleSelectAudience(a);
            }}
          />
        )}
        {composerDock}
        {CONCEPT_V8_ENABLED && !hasConversationContent ? (
          <ChipsRow onArm={handleUserSelectTool} onMore={() => setSkillsPanelOpen(true)} />
        ) : null}
        {homeAudienceIntro}
        </>
      ) : (
        // Post-pick (option B, owner call 2026-07-23): drop straight into the fresh-chat start —
        // the same composer + starter + demo as the legacy home, with the chosen skill armed. No
        // bespoke bare-field state, no back-to-grid chrome; picking a skill just enters the chat.
        <>
          {composerDock}
          {CONCEPT_V8_ENABLED && !hasConversationContent ? (
            <ChipsRow onArm={handleUserSelectTool} onMore={() => setSkillsPanelOpen(true)} />
          ) : null}
          {homeStarter}
          {homeFirstRunDemo}
          {homeAudienceIntro}
        </>
      )}
    </div>
  );
}
