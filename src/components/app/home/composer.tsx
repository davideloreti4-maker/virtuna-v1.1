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

  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // URL validity: empty is "neutral" (no error, just disabled); non-empty +
  // non-TikTok shows the D-21 reject; a valid TikTok URL enables submit.
  const trimmedUrl = url.trim();
  const hasUrl = trimmedUrl.length > 0;
  const isValidTikTok = hasUrl && TIKTOK_URL_PATTERN.test(trimmedUrl);
  const showUrlError = hasUrl && !isValidTikTok;

  // Submit is enabled when there's a valid TikTok URL OR a staged upload, and
  // we're not mid-submit. (Upload validity is enforced by VideoUpload itself —
  // it only calls onFileSelect for an accepted MP4/MOV/WebM under 200MB.)
  const canSubmit = (isValidTikTok || file !== null) && !submitting;

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
  const prevAnalysisIdRef = useRef<string | null>(stream.analysisId);
  const pendingNavRef = useRef(false);
  useEffect(() => {
    const id = stream.analysisId;
    if (id && prevAnalysisIdRef.current === null && pendingNavRef.current) {
      pendingNavRef.current = false;
      router.push(`/analyze/${id}`);
    }
    // Re-arming only happens in handleSubmit; here we just track the value so
    // the next genuine null->string (after a fresh submit) is detectable.
    prevAnalysisIdRef.current = id;
  }, [stream.analysisId, router]);

  // ── Submit -> create (lifted/adapted from Board.tsx handleContentSubmit) ──
  // Slim: only the TikTok-URL and video-upload paths (no text mode, no intent).
  const handleSubmit = useCallback(async () => {
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
  }, [file, isValidTikTok, trimmedUrl, stream]);

  const onSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    void handleSubmit();
  };

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
        {/* Upload drop zone — VideoUpload (bare) is always mounted (so its file
            input is part of the composer); the + control reveals/hides it. A
            staged file forces it visible so the preview never hides. */}
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
          {/* + upload toggle (D-22). ≥44px hit area on touch. */}
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

          {/* URL / future-follow-up input. Coral only on the focus ring. */}
          <input
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={hasSimulation ? PLACEHOLDER_ACTIVE : PLACEHOLDER_EMPTY}
            aria-label={hasSimulation ? "Ask about this simulation" : "Paste a TikTok link"}
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
            aria-label="Simulate"
            disabled={!canSubmit}
            loading={submitting}
            className="shrink-0 rounded-lg"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Errors — non-TikTok URL (D-21). Upload-type errors are surfaced by VideoUpload. */}
      {showUrlError && (
        <p className="mt-2 px-1 text-sm text-error" role="alert">
          {ERROR_NON_TIKTOK}
        </p>
      )}
    </form>
  );
}
