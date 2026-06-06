/**
 * ExpertChatThread — thread content for the "Ask the expert" unified chat panel.
 *
 * v2 changes vs v1:
 * - Markdown rendering via react-markdown + rehype-sanitize (no raw HTML injection)
 * - §citation pills inline (coral-outline, title= section name on hover)
 * - FRAME:<name> tag parser — renders non-interactive frame pill
 * - Copy + Regenerate controls on hover (Regenerate on last answer only)
 * - jump-to-latest pill when scrolled up during/after streaming
 * - role="log", aria-live="polite" throttled (announce on completion, not per token)
 * - prefers-reduced-motion honors caret/dots/pulse
 * - Amber error state (not red), with recovery link for cap/rate-limit errors
 *
 * Raycast tokens: 6% borders, 10% hover, 12px radius, coral accents only.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { Copy, RotateCcw, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/hooks/queries/use-expert-chat';

// ── Corpus section map for §citation tooltips ──────────────────────────────
const CORPUS_SECTIONS: Record<string, string> = {
  '1': 'Hook & first-3-seconds retention',
  '2': 'Pacing & editing rhythm',
  '3': 'Storytelling arc & narrative',
  '4': 'CTA placement & conversion',
  '5': 'Authenticity & creator trust',
  '6': 'Visual quality & production',
  '7': 'Audio & sound design',
  '8': 'Viewer psychology & retention',
  '9': 'Platform-specific optimization',
  '10': 'Viral triggers & shareability',
};

// ── Valid board frame names ────────────────────────────────────────────────
const VALID_FRAMES = new Set([
  'Engine', 'Audience', 'Verdict', 'Actions', 'Content craft',
]);

// ── Props ─────────────────────────────────────────────────────────────────

interface ExpertChatThreadProps {
  messages: ChatMessage[];
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
  isExpanded: boolean;
  /** Called when user hits Regenerate on the last assistant message. */
  onRegenerate?: () => void;
}

// ── Main component ─────────────────────────────────────────────────────────

export function ExpertChatThread({
  messages,
  streamingText,
  isStreaming,
  error,
  isExpanded,
  onRegenerate,
}: ExpertChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  // Throttled aria-live: announce only on completion (not per token)
  const [ariaAnnounce, setAriaAnnounce] = useState('');
  const prevStreamingRef = useRef(false);
  const reducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  // Track scroll for jump-to-latest pill
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJumpLatest(distFromBottom > 80);
  }, []);

  // Auto-scroll when near bottom or streaming
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 120 || isStreaming) {
      scrollToBottom();
    }
  }, [messages, streamingText, isStreaming, scrollToBottom]);

  // Throttled aria-live: announce completed message only (not per token)
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = isStreaming;
    if (wasStreaming && !isStreaming) {
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
      if (lastAssistant) {
        const { cleanContent } = parseFrameTag(lastAssistant.content);
        setAriaAnnounce(cleanContent.slice(0, 200));
      }
    }
  }, [isStreaming, messages]);

  if (!isExpanded || (messages.length === 0 && !isStreaming && !error)) return null;

  const lastAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  })();

  return (
    <div className="relative flex flex-col" style={{ height: '100%' }}>
      {/* Throttled aria-live — announces completed answers, not streaming tokens */}
      <div role="status" aria-live="polite" className="sr-only" aria-atomic="true">
        {ariaAnnounce}
      </div>

      {/* Thread scroll area — role=log for chat semantics */}
      <div
        ref={scrollRef}
        role="log"
        aria-label="Conversation"
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-3 min-h-0"
      >
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            isLastAssistant={i === lastAssistantIndex}
            showRegenerate={i === lastAssistantIndex && !isStreaming && !!onRegenerate}
            onRegenerate={onRegenerate}
            reducedMotion={reducedMotion}
          />
        ))}

        {/* Live streaming display */}
        {isStreaming && streamingText && (
          <MessageBubble
            message={{ role: 'assistant', content: streamingText }}
            isStreaming
            isLastAssistant={false}
            showRegenerate={false}
            reducedMotion={reducedMotion}
          />
        )}

        {/* Waiting for first token */}
        {isStreaming && !streamingText && (
          <div className="flex items-center gap-1.5 pl-1">
            <span className="text-xs text-foreground-muted">Apollo is thinking</span>
            {!reducedMotion && <StreamingDots />}
          </div>
        )}

        {/* Error state — amber per spec, recovery link for cap/rate errors */}
        {error && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            {error}
            {(error.toLowerCase().includes('cap') ||
              error.toLowerCase().includes('limit') ||
              error.toLowerCase().includes('rate')) && (
              <span className="ml-1">
                —{' '}
                <a href="/analyze" className="underline hover:text-amber-300">
                  Start a new analysis
                </a>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Jump-to-latest pill — overlaid on the thread */}
      {showJumpLatest && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              scrollToBottom();
              setShowJumpLatest(false);
            }}
            className="flex items-center gap-1 rounded-full border border-white/[0.1] bg-black/60 px-2.5 py-1 text-xs text-foreground-muted backdrop-blur-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/50"
          >
            <ChevronDown className="h-3 w-3" />
            Jump to latest
          </button>
        </div>
      )}
    </div>
  );
}

// ── MessageBubble ──────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Pick<ChatMessage, 'role' | 'content'>;
  isStreaming?: boolean;
  isLastAssistant: boolean;
  showRegenerate: boolean;
  onRegenerate?: () => void;
  reducedMotion: boolean;
}

function MessageBubble({
  message,
  isStreaming,
  isLastAssistant: _isLastAssistant,
  showRegenerate,
  onRegenerate,
  reducedMotion,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const { cleanContent, frameTag } = parseFrameTag(message.content);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(cleanContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }, [cleanContent]);

  return (
    <div
      className={cn(
        'group flex flex-col gap-0.5',
        isUser ? 'items-end' : 'items-start',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className={cn(
          'text-[10px] font-medium tracking-wide uppercase',
          isUser ? 'text-foreground-muted' : 'text-coral/70',
        )}
      >
        {isUser ? 'You' : 'Apollo'}
      </span>

      <div
        className={cn(
          'rounded-lg text-sm leading-relaxed',
          isUser
            ? 'max-w-[74%] bg-white/[0.055] px-3 py-2 text-foreground'
            : 'w-full max-w-[64ch] text-foreground-muted',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <AssistantContent
            content={cleanContent}
            isStreaming={isStreaming}
            reducedMotion={reducedMotion}
          />
        )}

        {/* Non-interactive frame pill (v1 = static; camera-jump deferred to v2) */}
        {frameTag && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 rounded border border-white/[0.06] px-2 py-0.5 text-[10px] text-foreground-muted">
              ↗ {frameTag}
            </span>
          </div>
        )}
      </div>

      {/* Hover controls: copy always, regenerate on last answer only */}
      {!isUser && !isStreaming && (
        <div
          className={cn(
            'flex items-center gap-1 transition-opacity duration-150',
            hovered ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy answer"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-foreground-muted transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
          >
            {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          {showRegenerate && onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              aria-label="Regenerate answer"
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-foreground-muted transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Regenerate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── AssistantContent — Markdown + §citation pills ─────────────────────────

interface AssistantContentProps {
  content: string;
  isStreaming?: boolean;
  reducedMotion: boolean;
}

/**
 * Pre-process content: replace §N with `§cite:N` so the code component
 * can render them as coral-outline pills, cleanly separated from real code.
 */
function insertCitationMarkers(content: string): string {
  return content.replace(/§(\d+)/g, '`§cite:$1`');
}

function AssistantContent({ content, isStreaming, reducedMotion }: AssistantContentProps) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        components={{
          // Bold lead sentence — white for emphasis
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          // Bullet list — coral dot markers per spec
          ul: ({ children }) => (
            <ul className="my-1 space-y-0.5 pl-0 list-none">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="flex gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral/70" />
              <span>{children}</span>
            </li>
          ),
          // Paragraphs
          p: ({ children }) => (
            <p className="mb-1 last:mb-0 text-sm leading-relaxed">{children}</p>
          ),
          // Code: intercept §cite:N pills, pass through real code
          code: ({ children, ...props }) => {
            const text = String(children).trim();
            if (text.startsWith('§cite:')) {
              const num = text.replace('§cite:', '').trim();
              const sectionName = CORPUS_SECTIONS[num] ?? `Section ${num}`;
              return (
                <span
                  title={sectionName}
                  className="mx-0.5 inline-flex items-center rounded border border-coral/30 px-1 py-0.5 text-[10px] font-medium text-coral/80 cursor-help"
                >
                  §{num}
                </span>
              );
            }
            return (
              <code
                {...props}
                className="rounded bg-white/[0.06] px-1 py-0.5 text-xs font-mono text-foreground"
              >
                {children}
              </code>
            );
          },
        }}
      >
        {insertCitationMarkers(content)}
      </ReactMarkdown>
      {/* Streaming caret — disabled under prefers-reduced-motion */}
      {isStreaming && !reducedMotion && (
        <span
          className="ml-0.5 inline-block h-3 w-0.5 animate-pulse rounded-full bg-coral/60"
          aria-hidden
        />
      )}
    </div>
  );
}

// ── parseFrameTag — extract FRAME:<name> from assistant content ────────────

function parseFrameTag(content: string): { cleanContent: string; frameTag: string | null } {
  const match = content.match(/\bFRAME:([^\n]+)/);
  if (!match) return { cleanContent: content, frameTag: null };

  const frameName = match[1].trim();
  if (!VALID_FRAMES.has(frameName)) return { cleanContent: content, frameTag: null };

  const cleanContent = content.replace(/\bFRAME:[^\n]*\n?/, '').trim();
  return { cleanContent, frameTag: frameName };
}

// ── StreamingDots ──────────────────────────────────────────────────────────

function StreamingDots() {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1 w-1 rounded-full bg-foreground-muted/60 animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
