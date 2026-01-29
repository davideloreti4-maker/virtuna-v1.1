'use client';

import { useState } from 'react';
import { Info, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import type { ConversationTheme } from '@/types/test';

interface ThemesSectionProps {
  themes: ConversationTheme[];
}

/**
 * ThemesSection - Displays conversation themes from simulation
 *
 * Features:
 * - Expandable cards for each theme
 * - Title with percentage indicator
 * - Description and sample quotes on expand
 * - First theme auto-expanded by default
 */
export function ThemesSection({ themes }: ThemesSectionProps) {
  const [expandedTheme, setExpandedTheme] = useState<string | null>(
    themes[0]?.id ?? null
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-zinc-400">Conversation</h3>
        <Info className="h-4 w-4 text-zinc-500" />
      </div>

      <div className="space-y-2">
        {themes.map((theme) => {
          const isExpanded = expandedTheme === theme.id;

          return (
            <div
              key={theme.id}
              className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800/50"
            >
              {/* Header - clickable */}
              <button
                type="button"
                onClick={() => setExpandedTheme(isExpanded ? null : theme.id)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-zinc-500" />
                  <span className="font-medium text-white">{theme.title}</span>
                  <span className="text-sm text-zinc-500">
                    ~{theme.percentage}%
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-zinc-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-zinc-700 px-4 pb-4">
                  <p className="py-3 text-sm text-zinc-400">
                    {theme.description}
                  </p>
                  <div className="space-y-2">
                    {theme.quotes.map((quote, i) => (
                      <p
                        key={i}
                        className="border-l-2 border-zinc-700 pl-3 text-sm italic text-zinc-500"
                      >
                        &ldquo;{quote}&rdquo;
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
