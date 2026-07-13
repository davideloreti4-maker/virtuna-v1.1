/**
 * /api/tools/profile — the Profile verb route (Phase 5 Plan 04, PROF-01/02/03 + D-06).
 *
 * POST — authenticate, CSRF-guard, cap/validate the untrusted evidence, normalize it to
 *        a `Stimulus`, run `runProfile` (the fused forensic READ + saved General SIM),
 *        and persist the resulting `profile-read` block to the user's open thread.
 *
 * Body accepts one of (application/json):
 *   - { kind: "text", text }                          — chat / doc text evidence
 *   - { kind: "file_text"|"image", file:{name,type,dataBase64} } — uploaded .txt/.md / screenshot
 *   - { kind: "video", storagePath, goal?, isProfiledSubject?, filename? } — person-video (Max)
 *
 * Security spine (mirrors read/route.ts — the headline untrusted boundary, P4/P3 carries):
 *   - auth.getUser() 401 BEFORE any DB/LLM (T-05-09 / T-03-07)
 *   - csrfGuard 415/403 (WR-01)
 *   - MAX_EVIDENCE_LENGTH cap on the text path — 400 on empty/oversize (T-05-12 / AR-04-02)
 *   - sanitizeStoragePath on the video key — 400 BEFORE any signed-URL dereference
 *     (T-05-11 / AR-04-01 / Pitfall 3)
 *   - insertMessage re-validates the block at the write boundary + KC stamp (T-03-11/12)
 *
 * D-08 isolation of the evidence into the model prompt is enforced INSIDE runProfile.
 */

import { createClient } from "@/lib/supabase/server";
import { maybeMockSkillRun } from "@/lib/tools/mock/mock-sse";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { csrfGuard } from "@/lib/http/csrf-guard";
import { rateLimitGuard } from "@/lib/http/rate-limit";
import { normalizeStimulus } from "@/lib/engine/stimulus/normalize";
import { sanitizeStoragePath } from "@/lib/audience/profile-bake";
import { runProfile } from "@/lib/tools/runners/profile-runner";
import type { StimulusInput } from "@/lib/engine/stimulus/types";

/** Text-evidence cap (chars) — enforced server-side (AR-04-02 / DoS, T-05-12). */
const MAX_EVIDENCE_LENGTH = 8000;

/** Decoded-size caps for UPLOADED evidence (WR-01). The text path caps chars; the file
 *  paths must cap bytes too, or an upload bypasses the DoS guard entirely. Checked from the
 *  base64 string length (≈4/3 of decoded bytes) so we never allocate an oversized buffer. */
const MAX_FILE_TEXT_BYTES = 1_000_000; // ~1MB decoded (.txt / .md)
const MAX_IMAGE_BYTES = 10_000_000; // ~10MB decoded (screenshot)

interface UploadedFile {
  name: string;
  type: string;
  dataBase64: string;
}

/** Reconstruct a `File` from a base64 JSON payload so normalizeStimulus can read it. */
function fileFromBody(file: unknown): File | null {
  if (!file || typeof file !== "object") return null;
  const f = file as Partial<UploadedFile>;
  if (typeof f.name !== "string" || typeof f.type !== "string" || typeof f.dataBase64 !== "string") {
    return null;
  }
  const buf = Buffer.from(f.dataBase64, "base64");
  return new File([buf], f.name, { type: f.type });
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();

  // ── (1) Auth gate (T-05-09) — BEFORE any DB/LLM ──────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Layer 2 mock short-circuit (dev only) — skip (no fixture stream yet), no engine call ──
  const mock = await maybeMockSkillRun("profile", user.id);
  if (mock) return mock;

  // ── (1b) CSRF guard — Content-Type 415 + cross-origin 403 (WR-01) ────────────
  const guard = csrfGuard(request);
  if (guard) return guard;

  // ── Rate limit (HARDEN-01) — per user, per route; fail-open if unconfigured ──
  const limited = await rateLimitGuard(user.id, "profile");
  if (limited) return limited;

  // ── (2) Parse the body ───────────────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Malformed body → handled as a bad kind below.
  }

  const kind = body.kind;

  // ── (3) Build + validate the per-kind input (the untrusted boundary closes here) ──
  let input: StimulusInput;
  switch (kind) {
    case "text": {
      const text = typeof body.text === "string" ? body.text : "";
      if (text.trim().length === 0) {
        return Response.json({ error: "text is required" }, { status: 400 });
      }
      if (text.length > MAX_EVIDENCE_LENGTH) {
        return Response.json(
          { error: `text must be at most ${MAX_EVIDENCE_LENGTH} characters` },
          { status: 400 },
        );
      }
      input = { kind: "text", text };
      break;
    }
    case "file_text":
    case "image": {
      // WR-01: cap the DECODED size BEFORE fileFromBody decodes it, so an upload can't bypass
      // the text-path DoS guard and we never allocate an oversized buffer. base64 ≈ 4/3 of bytes.
      const capBytes = kind === "image" ? MAX_IMAGE_BYTES : MAX_FILE_TEXT_BYTES;
      const rawB64 = (body.file as { dataBase64?: unknown } | null)?.dataBase64;
      if (typeof rawB64 === "string" && Math.floor((rawB64.length * 3) / 4) > capBytes) {
        return Response.json(
          { error: `file must be at most ${Math.round(capBytes / 1_000_000)}MB` },
          { status: 400 },
        );
      }
      const file = fileFromBody(body.file);
      if (!file) {
        return Response.json({ error: "file is required" }, { status: 400 });
      }
      input = { kind, file };
      break;
    }
    case "video": {
      const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
      // Reject a bad/traversal key BEFORE any signed-URL dereference (AR-04-01 / Pitfall 3).
      try {
        sanitizeStoragePath(storagePath);
      } catch {
        return Response.json({ error: "invalid storagePath" }, { status: 400 });
      }
      // Authorization (CR-01 IDOR): the signed-URL fetch downstream signs with the
      // service client (bypasses RLS), so ownership MUST be enforced here — the user
      // must own the path (`<userId>/<file>`). Shape sanitization above is NOT an
      // authz check. Mirrors /api/videos/sign; without this a valid-shaped foreign
      // key would yield a behavioral read of another tenant's private video.
      if (storagePath.split("/")[0] !== user.id) {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
      input = {
        kind: "video",
        storagePath,
        goal: typeof body.goal === "string" ? body.goal : undefined,
        filename: typeof body.filename === "string" ? body.filename : undefined,
        isProfiledSubject: body.isProfiledSubject === true,
      };
      break;
    }
    default:
      return Response.json({ error: "unsupported evidence kind" }, { status: 400 });
  }

  // ── (4) Normalize → run → persist ────────────────────────────────────────────
  try {
    const stimulus = await normalizeStimulus(input);
    const openThread = await createOpenThreadLazy(user.id);
    const block = await runProfile({ supabase, stimulus });
    // insertMessage re-validates the block at the write boundary (T-03-11) + KC stamp.
    await insertMessage(openThread.id, "assistant", [block], kcStamp().kcGenVersion);
    return Response.json({ block });
  } catch (err) {
    // Do not echo raw err.message to the client — it can carry Zod/DB/user-id
    // detail (WR-02 info disclosure). Log server-side, return a generic message.
    console.error("[/api/tools/profile] failed:", err);
    return Response.json({ error: "Profile failed" }, { status: 500 });
  }
}
