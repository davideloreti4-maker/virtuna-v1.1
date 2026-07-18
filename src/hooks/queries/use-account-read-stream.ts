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

import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountReadBlock } from "@/lib/tools/blocks";

export interface UseAccountReadStreamReturn {
  /** The composed account-read block from the done event (null until it arrives). */
  block: AccountReadBlock | null;
  /** True while the SSE stream is active. */
  isStreaming: boolean;
  /** Hard error (scrape/network) — truthy renders the retryable error state. */
  error: string | null;
  /** Honest thin-history fallback message (SELF-02) — a calm warning, not an error. */
  fallbackMessage: string | null;
  /**
   * POST /api/account-read and stream the result. Fire ONLY on explicit tap (D-05/D-07).
   * `persist:true` (the in-thread chat field) tells the route to also write the account-read block to
   * the open thread, so a reload surfaces it in the chat view. The account TOOL omits it → the route
   * stays bodyless-equivalent and does NOT persist (unchanged behavior).
   */
  start: (opts?: { persist?: boolean }) => Promise<void>;
  /** Abort the in-flight stream. */
  stop: () => void;
  /** Reset state for a fresh run (e.g. on tool switch). */
  reset: () => void;
}

export function useAccountReadStream(): UseAccountReadStreamReturn {
  const [block, setBlock] = useState<AccountReadBlock | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // WR-05: guard against setState on an unmounted component (verbatim the sibling streams).
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    setBlock(null);
    setIsStreaming(false);
    setError(null);
    setFallbackMessage(null);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    if (isMountedRef.current) setIsStreaming(false);
  }, []);

  const start = useCallback(async (opts?: { persist?: boolean }) => {
    // Abort any prior in-flight stream.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBlock(null);
    setError(null);
    setFallbackMessage(null);
    setIsStreaming(true);

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

          if (eventType === "fallback") {
            const msg =
              typeof data.message === "string"
                ? data.message
                : "Not enough history to read yet. Calibrate your personal audience first, then run this again.";
            if (isMountedRef.current) setFallbackMessage(msg);

          } else if (eventType === "done") {
            // Guard the shape — only accept a block.type === "account-read".
            const raw = data.block;
            if (
              typeof raw === "object" &&
              raw !== null &&
              (raw as { type?: unknown }).type === "account-read" &&
              isMountedRef.current
            ) {
              setBlock(raw as AccountReadBlock);
            }

          } else if (eventType === "error") {
            const msg = typeof data.message === "string" ? data.message : "Account Read error";
            throw new Error(msg);
          }
          // event: status is transient — the shaped skeleton is the surface, nothing to store.
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // intentional cancel
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Account Read stream error");
      }
    } finally {
      if (isMountedRef.current) setIsStreaming(false);
    }
  }, []);

  return { block, isStreaming, error, fallbackMessage, start, stop, reset };
}
