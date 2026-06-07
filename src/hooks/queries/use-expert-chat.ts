/**
 * useExpertChat — SSE consumer hook for the "Ask the expert" chat dock.
 *
 * Mirrors the POST body-reader SSE loop from use-analysis-stream.ts:337-371.
 * Manages: message history, streaming text, history replay on mount.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  scope?: string | null;
  created_at?: string;
}

interface UseExpertChatOptions {
  analysisId: string | null;
}

export interface UseExpertChatReturn {
  messages: ChatMessage[];
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
  send: (message: string, scope?: string | null) => Promise<void>;
  stop: () => void;
  clearMessages: () => void;
  loadHistory: () => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useExpertChat({ analysisId }: UseExpertChatOptions): UseExpertChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  /** Load conversation history from the server for permalink replay. */
  const loadHistory = useCallback(async () => {
    if (!analysisId) return;
    try {
      const res = await fetch(`/api/analyze/${analysisId}/chat`);
      if (!res.ok) return; // fail silently — history is a nice-to-have
      const data: { messages: ChatMessage[] } = await res.json();
      if (isMountedRef.current) {
        setMessages(data.messages ?? []);
      }
    } catch {
      // ignore — history load failure is non-fatal
    }
  }, [analysisId]);

  // Auto-load history when analysisId becomes available
  useEffect(() => {
    if (analysisId) {
      void loadHistory();
    } else {
      setMessages([]);
    }
  }, [analysisId, loadHistory]);

  /** Send a message and stream the Qwen response. */
  const send = useCallback(
    async (message: string, scope?: string | null) => {
      if (!analysisId || isStreaming) return;

      // Abort any prior in-flight stream
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Optimistic: append user turn immediately
      const userMsg: ChatMessage = {
        role: 'user',
        content: message,
        scope: scope ?? null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setStreamingText('');
      setIsStreaming(true);
      setError(null);

      try {
        const res = await fetch(`/api/analyze/${analysisId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            scope: scope ?? undefined,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: 'Chat request failed' }));
          throw new Error(errBody.error ?? 'Chat request failed');
        }
        if (!res.body) throw new Error('No response body');

        // ── SSE body reader (mirrors use-analysis-stream.ts:337-371) ────────
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            const frameLines = frame.split('\n');
            let eventType = 'message';
            let dataLine = '';
            for (const fLine of frameLines) {
              if (fLine.startsWith('event: ')) eventType = fLine.slice(7).trim();
              else if (fLine.startsWith('data: ')) dataLine = fLine.slice(6);
            }
            if (!dataLine) continue;
            try {
              const data = JSON.parse(dataLine) as Record<string, unknown>;
              if (eventType === 'token' && typeof data.delta === 'string') {
                accumulatedContent += data.delta;
                if (isMountedRef.current) setStreamingText(accumulatedContent);
              } else if (eventType === 'done') {
                const content =
                  typeof data.content === 'string' ? data.content : accumulatedContent;
                if (isMountedRef.current) {
                  const assistantMsg: ChatMessage = {
                    role: 'assistant',
                    content,
                    scope: scope ?? null,
                    created_at: new Date().toISOString(),
                  };
                  setMessages((prev) => [...prev, assistantMsg]);
                  setStreamingText('');
                }
              } else if (eventType === 'error') {
                const msg =
                  typeof data.message === 'string' ? data.message : 'Stream error';
                throw new Error(msg);
              }
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue; // malformed JSON
              throw parseErr;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return; // intentional cancel
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'Chat error');
          // Remove the optimistic user turn on error
          setMessages((prev) => prev.filter((m) => m !== userMsg));
        }
      } finally {
        if (isMountedRef.current) {
          setIsStreaming(false);
          setStreamingText('');
        }
      }
    },
    [analysisId, isStreaming]
  );

  /** Stop the current in-flight stream (for the Stop button). */
  const stop = useCallback(() => {
    abortRef.current?.abort();
    if (isMountedRef.current) {
      setIsStreaming(false);
      setStreamingText('');
    }
  }, []);

  /** Clear conversation messages (for ⌘⌫ clear). */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setStreamingText('');
  }, []);

  return {
    messages,
    streamingText,
    isStreaming,
    error,
    send,
    stop,
    clearMessages,
    loadHistory,
  };
}
