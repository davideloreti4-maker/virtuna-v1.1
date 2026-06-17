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
 *   When activeTool === "idea", submit routes to POST /api/tools/ideas instead of
 *   stream.start. CRITICAL: the Idea path MUST NOT set pendingNavRef.current = true
 *   and MUST NOT call stream.start — those are exclusive to the Test upload/URL paths
 *   so an Idea send never navigates to /analyze/[id] (T-03-13, WR-05).
 *   The platform chip (D-07) sets the first-class platform param on the Ideas request.
 *   Client-side URL relax for the idea tool is UX-only; the server route independently
 *   validates the ask (WARNING-5, T-03-15).
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
// Idea is live in P3. Hooks/Chat are disabled in P1 (D-08) so their copy is for future use only.
const PLACEHOLDER_BY_TOOL: Record<ToolId, string> = {
  test: PLACEHOLDER_EMPTY,
  idea: "What idea or topic do you want to test? (or leave empty for Auto)",
  hooks: "Paste a hook to test…",
  chat: "Ask anything…",
};

export interface ComposerProps {
  className?: string;
}

export function Composer({ className }: ComposerProps) {
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

  // ── Ideas stream state ─────────────────────────────────────────────────────
  // Consumed by IdeasThreadView (Task 2) via the onIdeasResult callback pattern.
  // The Idea path never arms pendingNavRef/stream.start (T-03-13, Pitfall 5).
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);

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
  //  - Idea tool: always (empty = Auto; typed = seeded). Not mid-submit.
  //    VALIDATION: server independently caps ask length (WARNING-5, T-03-15).
  const canSubmit = activeTool === "idea"
    ? !submitting
    : (isValidTikTok || file !== null) && !submitting;

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

  // ── Ideas submit (Idea tool path — NEVER arms pendingNavRef/stream.start) ──
  // POSTs to /api/tools/ideas: empty ask = Auto; typed ask = seeded (D-12).
  // The response is an SSE stream consumed by the ideas-thread view (Task 2).
  // This function sets ideasLoading/ideasError — the view reads these.
  const handleIdeasSubmit = useCallback(async (ask: string) => {
    setIdeasLoading(true);
    setIdeasError(null);
    try {
      const res = await fetch("/api/tools/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ask, platform }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Ideas request failed" }));
        throw new Error((err as { error?: string }).error ?? "Ideas request failed");
      }
      // SSE reading is delegated to the IdeasThreadView via use-ideas-stream.
      // The composer just fires the POST; the thread view subscribes to its own
      // SSE consumer which receives the response body (Task 2 pattern).
      // Here we just track the loading lifecycle.
    } catch (err) {
      setIdeasError(err instanceof Error ? err.message : "Ideas error");
    } finally {
      setIdeasLoading(false);
    }
  }, [platform]);

  // ── Submit -> create (lifted/adapted from Board.tsx handleContentSubmit) ──
  // Slim: only the TikTok-URL and video-upload paths (no text mode, no intent).
  // Ideas path: never arms pendingNavRef/stream.start (T-03-13).
  const handleSubmit = useCallback(async () => {
    // ── Idea tool path (D-12) ───────────────────────────────────────────────
    // CRITICAL: this block must never set pendingNavRef.current or call stream.start.
    if (activeTool === "idea") {
      // Client UX: trim the input. Empty → Auto; typed → seeded.
      const ask = trimmedUrl; // reuses the same input field value
      void handleIdeasSubmit(ask);
      setUrl(""); // clear after send
      return;
    }

    // ── Test tool path (unchanged) ──────────────────────────────────────────
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
  }, [activeTool, file, isValidTikTok, trimmedUrl, stream, handleIdeasSubmit]);

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

  // Show the platform chip only when the Idea tool is active (D-07)
  const showPlatformChip = activeTool === "idea";

  // Loading indicator text for Idea submits
  const isIdeaSubmitting = activeTool === "idea" && ideasLoading;

  return (
    <form
      data-testid="composer"
      data-layout={layout}
      onSubmit={onSubmitForm}
      className={cn(
        "w-full max-w-[760px]",
        layout === "pinned"
          ? "mx-auto"
          : // Centered/empty: the floating composer carries the lone allowed shadow.
            "mx-auto",
        className,
      )}
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
              Hidden when Idea tool is active (upload not applicable). */}
          {activeTool !== "idea" && (
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

          {/* URL / future-follow-up input.
              For the Idea tool: free text (topic/angle or empty for Auto).
              For the Test tool: TikTok URL or upload path. Coral only on focus ring. */}
          <input
            type="text"
            inputMode={activeTool === "idea" ? "text" : "url"}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={activePlaceholder}
            aria-label={
              activeTool === "idea"
                ? "Idea topic or angle (leave empty for Auto)"
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
            aria-label={activeTool === "idea" ? "Generate ideas" : "Simulate"}
            disabled={!canSubmit}
            loading={submitting || isIdeaSubmitting}
            className="shrink-0 rounded-lg"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>

        {/* Ideas loading/error feedback — inline under the input row */}
        {activeTool === "idea" && ideasLoading && (
          <p className="mt-2 px-1 text-xs text-foreground-muted/70" aria-live="polite">
            Generating ideas…
          </p>
        )}
        {activeTool === "idea" && ideasError && (
          <p className="mt-2 px-1 text-sm text-error" role="alert">
            {ideasError}
          </p>
        )}
      </div>

      {/* Errors — non-TikTok URL (D-21), Test tool only. Upload-type errors are surfaced by VideoUpload. */}
      {showUrlError && (
        <p className="mt-2 px-1 text-sm text-error" role="alert">
          {ERROR_NON_TIKTOK}
        </p>
      )}
    </form>
  );
}
