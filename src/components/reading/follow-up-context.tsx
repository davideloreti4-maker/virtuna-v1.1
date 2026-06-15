'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useExpertChat, type ChatMessage } from '@/hooks/queries/use-expert-chat';

/**
 * FollowUpProvider (Phase 5, CHAT-01/02) — the SINGLE shared chat state for a
 * Simulation's follow-up tail. The pinned composer (which sends) and the thread
 * tail (which displays) must read the SAME useExpertChat instance, so it lives
 * here once and both consume it via useFollowUp().
 *
 * It also holds `draft` — the composer's text — so the quick-action chips
 * (CHAT-02) can SEED a prompt into the composer (the user then edits/sends),
 * rather than firing a message directly. This is the "seed into the composer"
 * behavior the brief specifies (no separate chat dock; the composer IS the input).
 *
 * Reuses the existing "Ask the expert" backend verbatim (POST /api/analyze/[id]/chat)
 * — presentation only, no engine or API change.
 */
export interface FollowUpValue {
  analysisId: string;
  messages: ChatMessage[];
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
  /** Send the current text as a follow-up (trims; no-op on empty/while streaming). */
  send: (message: string) => void;
  /** Composer draft — chips seed it, the composer binds to it. */
  draft: string;
  setDraft: (value: string) => void;
}

const FollowUpContext = createContext<FollowUpValue | null>(null);

/** Returns the follow-up chat context, or null when not inside a Simulation thread
 *  (e.g. the /home composer) — callers must handle the null (analysis-mode) case. */
export function useFollowUp(): FollowUpValue | null {
  return useContext(FollowUpContext);
}

export function FollowUpProvider({
  analysisId,
  children,
}: {
  analysisId: string;
  children: ReactNode;
}) {
  const chat = useExpertChat({ analysisId });
  const [draft, setDraft] = useState('');
  const { send: chatSend, isStreaming } = chat;

  const send = useCallback(
    (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || isStreaming) return;
      setDraft('');
      void chatSend(trimmed);
    },
    [chatSend, isStreaming],
  );

  const value = useMemo<FollowUpValue>(
    () => ({
      analysisId,
      messages: chat.messages,
      streamingText: chat.streamingText,
      isStreaming: chat.isStreaming,
      error: chat.error,
      send,
      draft,
      setDraft,
    }),
    [analysisId, chat.messages, chat.streamingText, chat.isStreaming, chat.error, send, draft],
  );

  return <FollowUpContext.Provider value={value}>{children}</FollowUpContext.Provider>;
}
