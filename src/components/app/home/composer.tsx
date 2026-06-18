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

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, ArrowUp } from "lucide-react";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { VideoUpload } from "@/components/app/video-upload";
import { useAnalysisStream } from "@/hooks/queries/use-analysis-stream";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { createClient } from "@/lib/supabase/client";
import { ToolChips, type ToolId } from "./tool-chips";
import { PlatformChip, type Platform } from "./platform-chip";
import { useIdeasStream } from "@/hooks/queries/use-ideas-stream";
import { IdeasThreadView } from "@/components/thread/ideas-thread-view";
import { useHooksStream } from "@/hooks/queries/use-hooks-stream";
import { HooksThreadView } from "@/components/thread/hooks-thread-view";
import { useChatStream } from "@/hooks/queries/use-chat-stream";
import { ChatThreadView } from "@/components/thread/chat-thread-view";
import { detectRefineIntent } from "@/lib/tools/refine";
// TikTok-only client check (D-21, WR-01). The pattern is the SHARED trust-
// boundary regex (src/lib/tiktok-url.ts) imported by BOTH the composer and the
// server /api/analyze route, so the fast UX reject can never drift from the
// server check. ContentForm's SOCIAL_URL_PATTERN ALSO allows Instagram — the
// slim composer must NOT (TikTok-only for v1).
import { TIKTOK_URL_PATTERN } from "@/lib/tiktok-url";

// Copy — UI-SPEC § Copywriting (all [UAT], lock at THEME-06).
const PLACEHOLDER_EMPTY = "Paste a TikTok link or drop a video…";
const PLACEHOLDER_ACTIVE = "Ask about this simulation…";
const ERROR_NON_TIKTOK =
  "Numen reads TikTok videos for now. Paste a TikTok link or upload the file.";

// Placeholder copy per tool — Test reuses the existing URL/upload copy (D-07).
// Idea is live in P3 (D-12). Hooks live in P4 (D-09). Chat disabled (D-08) — P5.
const PLACEHOLDER_BY_TOOL: Record<ToolId, string> = {
  test: PLACEHOLDER_EMPTY,
  idea: "What idea or topic do you want to test? (or leave empty for Auto)",
  hooks: "What topic do you want hooks for? (or leave empty for Auto)",
  chat: "Ask anything…",
};

export interface ComposerProps {
  className?: string;
  /** Called whenever the thread-content presence changes (ideas or hooks cards exist/disappear).
   *  Parent (HomePageLayout) uses this to switch between centered and full-height layout. */
  onThreadChange?: (hasThread: boolean) => void;
}

export function Composer({ className, onThreadChange }: ComposerProps) {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();

  // Layout signal: does a Simulation exist? Mirrors ContentForm L158.
  const params = useParams();
  const hasSimulation =
    !!params && typeof (params as { id?: unknown }).id === "string";
  const layout = hasSimulation ? "pinned" : "centered";

  const stream = useAnalysisStream();

  // ── Tool chip state (D-06/D-07) ─────────────────────────────────────────────
  // activeTool drives the placeholder + active-model field (D-09).
  // Default: "test" — the only live tool in P1 (D-08). Idea live in P3 (D-12).
  // NOTE: chip selection is NOT a submit; it MUST NEVER arm pendingNavRef (Pitfall #5).
  const [activeTool, setActiveTool] = useState<ToolId>("test");

  // ── Platform chip state (D-07) ─────────────────────────────────────────────
  // Default: "tiktok". The user can change per send via the chip.
  // Sent as the first-class platform param to the Ideas route.
  const [platform, setPlatform] = useState<Platform>("tiktok");

  // ── Persisted open-thread blocks (Task 3 — D-14/THREAD-07 rehydration) ─────
  // Loaded on mount from GET /api/threads/open. Declared before the view gates
  // below so showIdeasView/showHooksView can include them (no TDZ reference).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [persistedIdeaBlocks, setPersistedIdeaBlocks] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [persistedHookBlocks, setPersistedHookBlocks] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [persistedChatBlocks, setPersistedChatBlocks] = useState<any[]>([]);

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
  // Chat view always shows when the chat chip is active (it owns its own empty state)
  const showChatView = activeTool === "chat";

  // ── Thread-presence signal (UX-pin fix, post-UAT) ─────────────────────────
  // True when any idea/hook thread content exists to show (streaming or persisted).
  // Used by page-level layout (HomePageLayout) to switch to the full-height
  // chat-app layout (thread scrolls above, form pinned at bottom).
  // Declared AFTER all stream/block/persisted state is live (no TDZ).
  const hasThread =
    ideas.isStreaming ||
    hooks.isStreaming ||
    chat.isStreaming ||
    ideasBlocks.length > 0 ||
    hooksBlocks.length > 0 ||
    chatBlocks.length > 0 ||
    persistedIdeaBlocks.length > 0 ||
    persistedHookBlocks.length > 0 ||
    persistedChatBlocks.length > 0 ||
    showChatView; // chat view always shown when chip is active (owns empty state)

  // Notify parent whenever thread presence changes (HomePageLayout uses this).
  useEffect(() => {
    onThreadChange?.(hasThread);
  }, [hasThread, onThreadChange]);

  // ── Test brief state (Task 2 — D-05/D-06 handoff) ─────────────────────────
  // When "Test full →" is clicked on a hook card, we switch to the Test tool
  // and store the chosen hook as a visible brief above the upload affordance.
  const [testBrief, setTestBrief] = useState<{ hookLine: string; audienceArchetype: string } | null>(null);

  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
        : (isValidTikTok || file !== null) && !submitting;

  // ── Open-thread rehydration (Task 3 — D-14/THREAD-07) ─────────────────────
  // On mount, fetch the user's open-thread messages from GET /api/threads/open
  // and split into idea-card + hook-card blocks for their respective thread views.
  // Guard: unauthenticated → 401 → silent (no crash; views render nothing extra).
  // Does NOT block the composer render (views already no-op when idle).
  useEffect(() => {
    let cancelled = false;
    async function loadPersistedBlocks() {
      try {
        const res = await fetch('/api/threads/open');
        if (!res.ok) return; // 401 or other error — silent (user not logged in yet)
        const data = await res.json() as {
          messages?: Array<{ blocks?: Array<{ type?: string; props?: unknown }> }>;
        };
        if (cancelled) return;
        const messages = data.messages ?? [];
        // Flatten all blocks across all messages, split by type
        const allBlocks = messages.flatMap((m) => m.blocks ?? []);
        const ideaBlocks = allBlocks.filter((b) => b.type === 'idea-card');
        const hookBlocks = allBlocks.filter((b) => b.type === 'hook-card');
        const markdownBlocks = allBlocks.filter((b) => b.type === 'markdown');
        setPersistedIdeaBlocks(ideaBlocks);
        setPersistedHookBlocks(hookBlocks);
        setPersistedChatBlocks(markdownBlocks);
      } catch {
        // Network error or parse error — silent (no crash, views stay idle)
      }
    }
    void loadPersistedBlocks();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty dep set — run once on mount

  // ── "Test full →" handoff (Task 2 — D-05/D-06, HOOKS-03) ──────────────────
  // Invoked by HookCardRenderer via HookTestContext when the creator clicks
  // "Test full →". Switches to the Test tool + stores a visible brief above the
  // upload affordance ("shoot this hook → upload → Max scores the real thing").
  // CRITICAL: does NOT invoke any model on the hook text (D-05 honesty spine).
  const handleTestHook = useCallback((hookLine: string, audienceArchetype: string) => {
    setActiveTool("test");
    setTestBrief({ hookLine, audienceArchetype });
  }, []);

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

    // ── Idea tool path (D-12) ───────────────────────────────────────────────
    // CRITICAL: this block must never set pendingNavRef.current or call stream.start.
    // Empty ask = Auto mode; typed ask = seeded mode (D-12).
    if (activeTool === "idea") {
      const ask = trimmedUrl; // empty string → Auto; non-empty → seeded
      setUrl(""); // clear input after send
      // ideas.start() does the full fetch+getReader SSE loop (BLOCKER-1 compliant)
      await ideas.start(ask, platform);
      return;
    }

    // ── Hooks tool path (D-09, Plan 04-03 Task 1) ───────────────────────────
    // CRITICAL: this block must never set pendingNavRef.current or call stream.start.
    // Empty ask = Auto/anchored mode; typed ask = seeded mode (D-09).
    // T-03-13/T-04-13: Hook send NEVER navigates to /analyze.
    if (activeTool === "hooks") {
      const ask = trimmedUrl; // empty string → Auto; non-empty → seeded
      setUrl(""); // clear input after send
      // hooks.start() does the full fetch+getReader SSE loop (BLOCKER-1 compliant)
      await hooks.start(ask, platform);
      return;
    }

    // ── Chat tool path (Plan 05-03, D-05) ────────────────────────────────────
    // CRITICAL: this block MUST NOT set pendingNavRef.current or call stream.start.
    // Chat send NEVER navigates to /analyze (D-05 — no silent auto-fire).
    // ask must be non-empty (canSubmit already gates on trimmedUrl.length > 0).
    if (activeTool === "chat") {
      const ask = trimmedUrl;
      setUrl(""); // clear input after send
      chat.reset(); // clear prior error/coldStart for the new turn
      // chat.start() does the full fetch+getReader SSE loop (BLOCKER-1 compliant)
      await chat.start(ask, platform);
      return;
    }

    // ── Test tool path (unchanged — pendingNavRef/stream.start exclusive here) ─
    if (file !== null) {
      // Upload path — stage the file to Supabase storage, then start with the path.
      setSubmitting(true);
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) {
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
          setSubmitting(false);
          return;
        }
        // WR-05: arm navigation — this run's started{id} is a real submission,
        // so the null->string flip it produces SHOULD navigate (unlike a
        // hydration-sourced id, which never arms this).
        pendingNavRef.current = true;
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
  }, [activeTool, file, isValidTikTok, trimmedUrl, stream, ideas, hooks, chat, platform]);

  const onSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    void handleSubmit();
  };

  // Placeholder follows the active chip; in the pinned state the follow-up copy
  // takes precedence so it's contextually accurate (D-07 / D-24).
  const activePlaceholder = hasSimulation
    ? PLACEHOLDER_ACTIVE
    : PLACEHOLDER_BY_TOOL[activeTool];

  // Show the platform chip when Idea, Hooks, or Chat tool is active (D-07)
  const showPlatformChip = activeTool === "idea" || activeTool === "hooks" || activeTool === "chat";

  // Thread mode on /home (no route id): full-height column — thread region
  // scrolls above the pinned form. This only activates when hasThread is true,
  // so empty home keeps the existing centered hero layout (no regression).
  const homeThreadMode = hasThread && !hasSimulation;

  // Shared thread content block (rendered in both mode branches below).
  const threadContent = (
    <>
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
          followupText={ideas.followupText}
          isStreaming={ideas.isStreaming}
          error={ideas.error}
          platform={platform}
          onRetry={() => void ideas.start("", platform)}
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
          isStreaming={hooks.isStreaming}
          error={hooks.error}
          platform={platform}
          onTestHook={handleTestHook}
          onRetry={() => void hooks.start("", platform)}
        />
      )}

      {/* Chat thread view — renders above the composer when the Chat tool is active.
          ChatThreadView owns its own empty state + cold-start nudge + error state.
          CRITICAL: chat send NEVER navigates; no pendingNavRef (D-05). */}
      {showChatView && (
        <ChatThreadView
          persistedBlocks={persistedChatBlocks}
          streamingBlocks={chatBlocks}
          isStreaming={chat.isStreaming}
          coldStart={chat.coldStart}
          nudgeShown={chat.nudgeShown}
          error={chat.error}
          niche={undefined}
          platform={platform}
        />
      )}
    </>
  );

  // Shared form element (identical markup; referenced by both layout branches).
  const composerForm = (
    <form
      data-testid="composer"
      data-layout={homeThreadMode ? "thread" : layout}
      onSubmit={onSubmitForm}
      className="w-full"
    >
        <div
          className={cn(
            "rounded-2xl border border-white/[0.06] bg-surface-elevated p-3",
            // Whisper float ONLY when centered (D-05) — pinned rests on the column.
            layout === "centered" && "shadow-float",
            !reducedMotion && "transition-shadow duration-200",
          )}
        >
          {/* Tool chip row (D-07/D-08/D-09) — sits above the input row.
              onSelect updates activeTool; it is NEVER a submit and MUST NOT arm
              pendingNavRef.current (Pitfall #5 / WR-05). */}
          <div className="mb-2.5 flex items-center gap-2 flex-wrap">
            <ToolChips
              activeTool={activeTool}
              onSelect={setActiveTool}
            />
            {/* Platform chip — only visible when Idea tool is active (D-07) */}
            {showPlatformChip && (
              <PlatformChip
                value={platform}
                onChange={setPlatform}
                className="ml-1"
              />
            )}
          </div>

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
                  style={{ color: 'var(--color-accent)' }}
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

          {/* Upload drop zone — only relevant for the Test tool path.
              VideoUpload (bare) is always mounted (so its file input is part of
              the composer); the + control reveals/hides it. A staged file forces
              it visible so the preview never hides. */}
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

          <div className="flex items-end gap-2">
            {/* + upload toggle (D-22). ≥44px hit area on touch.
                Hidden when Idea, Hooks, or Chat tool is active (upload not applicable). */}
            {activeTool !== "idea" && activeTool !== "hooks" && activeTool !== "chat" && (
              <button
                type="button"
                aria-label="Upload a video"
                aria-expanded={showUpload}
                onClick={() => setShowUpload((v) => !v)}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  "text-foreground-muted transition-colors hover:bg-white/[0.05] hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "pointer-coarse:h-11 pointer-coarse:w-11",
                  showUpload && "bg-white/[0.06] text-foreground",
                )}
              >
                <Plus className="h-4 w-4" />
              </button>
            )}

            {/* URL / free-text input.
                For the Idea tool: free text (topic/angle or empty for Auto).
                For the Test tool: TikTok URL or upload path. Coral only on focus ring. */}
            <input
              type="text"
              inputMode={activeTool === "idea" || activeTool === "hooks" || activeTool === "chat" ? "text" : "url"}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={activePlaceholder}
              aria-label={
                activeTool === "idea"
                  ? "Idea topic or angle (leave empty for Auto)"
                  : activeTool === "hooks"
                    ? "Hook topic (leave empty for Auto)"
                    : activeTool === "chat"
                      ? "Ask anything about your content"
                      : hasSimulation
                        ? "Ask about this simulation"
                        : "Paste a TikTok link"
              }
              aria-invalid={showUrlError || undefined}
              className={cn(
                "min-w-0 flex-1 bg-transparent px-1 py-2 text-base text-foreground",
                "placeholder:text-foreground-muted focus:outline-none",
              )}
            />

            {/* Submit — the lone coral affordance besides the focus ring. */}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              aria-label={activeTool === "idea" ? "Generate ideas" : activeTool === "hooks" ? "Generate hooks" : activeTool === "chat" ? "Send message" : "Simulate"}
              disabled={!canSubmit}
              loading={submitting || ideas.isStreaming || hooks.isStreaming || chat.isStreaming}
              className="shrink-0 rounded-lg"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Errors — non-TikTok URL (D-21), Test tool only. Upload-type errors are surfaced by VideoUpload. */}
        {showUrlError && (
          <p className="mt-2 px-1 text-sm text-error" role="alert">
            {ERROR_NON_TIKTOK}
          </p>
        )}
      </form>
  );

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
          "flex h-full w-full max-w-[760px] mx-auto flex-col",
          className,
        )}
      >
        {/* Scrollable thread region — fills all available space above the form */}
        <div
          data-testid="composer-thread-region"
          className="flex-1 min-h-0 overflow-y-auto"
        >
          {threadContent}
        </div>

        {/* Pinned form row — stays at the bottom while thread scrolls above */}
        <div className="shrink-0 pb-4 pt-2">
          {composerForm}
        </div>
      </div>
    );
  }

  // Branch B: centered / permalink layout (unchanged behavior).
  return (
    <div className={cn("w-full max-w-[760px] mx-auto flex flex-col gap-0", className)}>
      {threadContent}
      {composerForm}
    </div>
  );
}
