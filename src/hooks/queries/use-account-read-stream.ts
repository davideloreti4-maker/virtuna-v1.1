"use client";

/**
 * useAccountReadStream — client SSE driver for the Account Read skill ("A Read on your
 * own account", SELF-01/02/03). Mirrors use-explore-stream's fetch+getReader SSE loop
 * (POST needs a body-capable client, not the GET-only EventSource — BLOCKER-1).
 *
 * The route is BODYLESS: it resolves the creator's OWN handle from their calibrated
 * personal audience server-side (T-10-12, never from client input). SSE contract:
 *   event: status   { message }        — transient "Reading your account…" (skeleton is the surface)
 *   event: fallback  { reason, message } — honest thin-history (SELF-02, a calm warning, NOT an error)
 *   event: error     { message }         — scrape/network failure (retryable)
 *   event: done      { block }           — the composed account-read block
 */

import { useCallback, useRef, useState } from "react";
import { reportCredit402, CreditWallRefusal, isCreditWallRefusal } from "@/lib/billing/credit-wall";
import { reportSession401, SessionExpiredRefusal } from "@/lib/auth/session-expired";
import { resolveRunError } from '@/lib/net/run-failure';
import type { AccountReadBlock } from "@/lib/tools/blocks";
import { parseRunEvidence, type RunEvidence } from "@/lib/tools/evidence";
import type { StageState } from "@/components/thread/progress-checklist";
import { useLetGoRun } from "@/hooks/queries/use-let-go-run";

export interface UseAccountReadStreamReturn {
  /** The composed account-read block from the done event (null until it arrives). */
  block: AccountReadBlock | null;
  /** True while the SSE stream is active. */
  isStreaming: boolean;
  /** Hard error (scrape/network) — truthy renders the retryable error state. */
  error: string | null;
  /**
   * The creator pressed Stop while this read's request was out. A stopped run is still a run: its
   * turn stays on screen even when Stop came before anything arrived, as it does for the other
   * streams. Cleared by the next start and by reset().
   */
  isStopped: boolean;
  /**
   * How many runs this stream has started (a refine and a retry each count). A new number is a new
   * run even when no render saw it streaming: a request refused at once ends in the render it began in.
   */
  runs: number;
  /** Honest thin-history fallback message (SELF-02) — a calm warning, not an error. */
  fallbackMessage: string | null;
  /**
   * The artifacts this read has pulled so far (4a): the profile the moment the profile scrape
   * lands, then the post covers as a filmstrip. Null until one arrives ⇒ no rail, not an empty one.
   */
  evidence: RunEvidence | null;
  /** The two real scrape phases, for the loading spine. Empty until the first frame (4a). */
  stages: StageState[];
  /**
   * POST /api/account-read and stream the result. Fire ONLY on explicit tap (D-05/D-07).
   * `persist:true` (the in-thread chat field) tells the route to also write the account-read block to
   * the open thread, so a reload surfaces it in the chat view. The account TOOL omits it → the route
   * stays bodyless-equivalent and does NOT persist (unchanged behavior).
   */
  start: (opts?: { persist?: boolean }) => Promise<void>;
  /** Abort the in-flight stream. */
  stop: () => void;
  /** Reset state for a fresh run (e.g. on a thread switch), letting a read still in flight go on unseen. */
  reset: () => void;
}

export function useAccountReadStream(): UseAccountReadStreamReturn {
  const [block, setBlock] = useState<AccountReadBlock | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStopped, setIsStopped] = useState(false);
  const [runs, setRuns] = useState(0);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<RunEvidence | null>(null);
  const [stages, setStages] = useState<StageState[]>([]);

  // The in-flight request's controller; null once its stream has ended, so Stop can tell a read it
  // cut short from one that was already over.
  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // The let-go machinery (`use-let-go-run`): each request's number and liveness, a thread switch or an
  // unmount letting the run go on in the background, and the mount effect that owns `isMountedRef`.
  const letGo = useLetGoRun(abortRef, isMountedRef);

  const reset = useCallback(() => {
    // A read still out is let go, not ended: the composer resets every stream when the creator opens
    // another chat. Its request stays open to its end, so the route stays alive to store the read in
    // the chat it was asked in (resolved when the request came in); its number is retired, so its
    // reader drops the card instead of landing it in the next chat's live turn. Stop ends it.
    letGo.detach();
    setBlock(null);
    setIsStreaming(false);
    setError(null);
    setIsStopped(false);
    setFallbackMessage(null);
    setEvidence(null);
    setStages([]);
  }, [letGo]);

  const stop = useCallback(() => {
    const inFlight = abortRef.current;
    inFlight?.abort();
    abortRef.current = null;
    if (isMountedRef.current) {
      setIsStreaming(false);
      if (inFlight) setIsStopped(true);
    }
  }, []);

  const start = useCallback(async (opts?: { persist?: boolean }) => {
    // Abort any prior in-flight stream.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // This request's number and liveness (`use-let-go-run`): once let go, every frame it still sends
    // is read and dropped, so it reaches its end without touching the next chat's run.
    const { gen, isLive } = letGo.begin();

    setBlock(null);
    setError(null);
    setIsStopped(false);
    setFallbackMessage(null);
    setEvidence(null);
    setStages([]);
    setIsStreaming(true);
    setRuns((r) => r + 1);

    try {
      // The own handle is resolved from the session (T-10-12), never from input. The optional
      // { persist } body flag (in-thread chat field only) asks the route to also write the block to
      // the open thread; the account tool sends no body → route persists nothing (unchanged).
      const persist = opts?.persist === true;
      const res = await fetch("/api/account-read", {
        method: "POST",
        ...(persist
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persist: true }) }
          : {}),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Account Read request failed" }));
        const errObj = err as { error?: string; message?: string };
        // The account Read became a PAID action on 2026-07-29 (5 credits), so this hook can now
        // receive a 402 — it was the only one of the six stream hooks with no wall handling,
        // purely because its route was the only one with no gate. Without this the paywall would
        // arrive as an inline red error string offering a retry that earns the same 402.
        // 401 first — it is not a 402, and each check then reads only its own status. The
        // refusal's flag carries the cause to this turn's copy (lib/net/run-failure.ts).
        if (reportSession401(res.status)) throw new SessionExpiredRefusal();
        if (reportCredit402(res.status, err)) {
          throw new CreditWallRefusal(errObj.message);
        }
        throw new Error(errObj.message ?? errObj.error ?? "Account Read request failed");
      }
      if (!res.body) throw new Error("No response body");

      // ── SSE body reader (mirrors use-explore-stream.ts SSE loop) ──────────────
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!isLive()) continue; // detached: read on to the end, draw nothing
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          let eventType = "message";
          let dataLine = "";
          for (const fLine of frame.split("\n")) {
            if (fLine.startsWith("event: ")) eventType = fLine.slice(7).trim();
            else if (fLine.startsWith("data: ")) dataLine = fLine.slice(6);
          }
          if (!dataLine) continue;

          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataLine) as Record<string, unknown>;
          } catch {
            continue; // malformed JSON — skip frame
          }

          if (eventType === "stage") {
            // 4a — the two real scrape phases. Last-write-wins per name so a repeat frame cannot
            // duplicate a row or let a stale `active` overwrite a `done`.
            const name = typeof data.name === "string" ? data.name : null;
            const status = data.status;
            if (name && (status === "active" || status === "done") && isLive()) {
              setStages((prev) => {
                const i = prev.findIndex((s) => s.name === name);
                if (i === -1) return [...prev, { name, status }];
                const next = [...prev];
                next[i] = { name, status };
                return next;
              });
            }

          } else if (eventType === "evidence") {
            // parseRunEvidence is TOTAL — it lives in the same read loop as every other frame, so
            // a malformed payload yields null and the rail simply does not render.
            const parsedEvidence = parseRunEvidence(data);
            if (parsedEvidence && isLive()) setEvidence(parsedEvidence);

          } else if (eventType === "fallback") {
            const msg =
              typeof data.message === "string"
                ? data.message
                : "Not enough history to read yet. Calibrate your personal audience first, then run this again.";
            if (isLive()) setFallbackMessage(msg);

          } else if (eventType === "done") {
            // Guard the shape — only accept a block.type === "account-read".
            const raw = data.block;
            if (
              typeof raw === "object" &&
              raw !== null &&
              (raw as { type?: unknown }).type === "account-read" &&
              isLive()
            ) {
              setBlock(raw as AccountReadBlock);
            }

          } else if (eventType === "error") {
            const msg = typeof data.message === "string" ? data.message : "Account Read error";
            // The route names a scrape TikTok refused or answered empty, so the turn can say so
            // rather than blame the handle (run-failure.ts, `accountScrape`).
            if (data.cause === "scrape_failed") throw Object.assign(new Error(msg), { accountScrapeFailed: true });
            throw new Error(msg);
          }
          // event: status is transient — the shaped skeleton is the surface, nothing to store.
        }
      }
    } catch (err) {
      // The credit wall is already up (CreditWallListener) and it IS the UI — drawing an inline
      // error underneath it would offer a retry that gets the same 402. `finally` still runs.
      if (isCreditWallRefusal(err)) return;
      // A null result means draw nothing: an abort is the user's own Stop, not a failure.
      const message = resolveRunError(err, "Account Read stream error");
      if (message === null) return;
      if (isLive()) setError(message);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      letGo.finish(gen);
      if (isLive()) setIsStreaming(false);
    }
  }, [letGo]);

  return { block, isStreaming, error, isStopped, runs, fallbackMessage, evidence, stages, start, stop, reset };
}
