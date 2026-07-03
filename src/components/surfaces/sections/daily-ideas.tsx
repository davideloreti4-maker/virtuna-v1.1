"use client";

/** DailyIdeas — pre-tested idea cards. Single column on mobile, 2-col grid on desktop. */

import type { IdeaCard as IdeaCardData } from "@/lib/room-contract/mock-room";
import { SectionHeader } from "./section-header";
import { IdeaCard } from "./idea-card";

export function DailyIdeas({
  ideas,
  focusedCardId,
  onOpen,
  onRefresh,
}: {
  ideas: IdeaCardData[];
  focusedCardId: string | null;
  onOpen: (cardId: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="pt-[18px]">
      <SectionHeader title="Daily ideas" action={{ label: "Refresh", onClick: onRefresh }} />
      <div className="grid gap-2.5 lg:grid-cols-2">
        {ideas.map((idea) => (
          <IdeaCard
            key={idea.cardId}
            idea={idea}
            focused={focusedCardId === idea.cardId}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
}
