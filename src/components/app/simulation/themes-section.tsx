'use client';

import { Info, MessageSquare } from 'lucide-react';
import type { ConversationTheme } from '@/types/test';
import { GlassCard } from '@/components/primitives';
import { Text, Caption } from '@/components/ui/typography';
import {
  AccordionRoot,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

interface ThemesSectionProps {
  themes: ConversationTheme[];
}

/**
 * ThemesSection - Displays conversation themes from simulation
 *
 * Uses GlassCard with Radix Accordion for expand/collapse.
 * - First theme auto-expanded by default
 * - Title with percentage indicator
 * - Description and sample quotes on expand
 */
export function ThemesSection({ themes }: ThemesSectionProps) {
  return (
    <GlassCard padding="md" hover="lift">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Text as="span" size="sm" muted>
            Conversation
          </Text>
          <Info className="h-4 w-4 text-foreground-muted" />
        </div>

        <AccordionRoot
          type="single"
          collapsible
          defaultValue={themes[0]?.id}
        >
          {themes.map((theme) => (
            <AccordionItem key={theme.id} value={theme.id}>
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-foreground-muted" />
                  <Text as="span" size="sm" className="font-medium">
                    {theme.title}
                  </Text>
                  <Caption>~{theme.percentage}%</Caption>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Text size="sm" muted>
                  {theme.description}
                </Text>
                {theme.quotes.map((quote, i) => (
                  <blockquote
                    key={i}
                    className="mt-2 border-l-2 border-border pl-3"
                  >
                    <Text size="sm" muted className="italic">
                      &ldquo;{quote}&rdquo;
                    </Text>
                  </blockquote>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </AccordionRoot>
      </div>
    </GlassCard>
  );
}
