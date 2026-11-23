"use client";

import { useRef, useState } from "react";

import { BILLABLE_BY_TOOL, type ToolId } from "@/components/app/home/composer-controls";
import { HomeScreen, type HomeRecentRow } from "@/components/home-next/home-screen";
import { AudienceSheet } from "@/components/thread-next/audience-sheet";
import {
  HOME_PLACEHOLDER_BY_TOOL,
  NEXT_PLACEHOLDER_BY_TOOL,
  NEXT_SIMULATE_PLACEHOLDER,
  fieldSkillLabel,
} from "@/components/thread-next/field-copy";
import type { Lens } from "@/components/thread-next/more-sheet";
import { ThreadField } from "@/components/thread-next/thread-field";
import type { Audience } from "@/lib/audience/audience-types";
import { creditCost } from "@/lib/pricing";

/**
 * Home on local state, for /dev/home (`page.tsx`): the screen the composer draws, with the real
 * field in its Home layout and the real audience sheet. The placeholders are the composer's own
 * (`field-copy.ts`); the values below are fixtures. Nothing here sends anything.
 */

/** The states the page can open in (`page.tsx` checks the name). */
export type DevHomeState = "empty" | "chats" | "picked" | "simulate" | "noname" | "unlimited" | "audience";

const STATES: Record<DevHomeState, { tool?: ToolId; noName?: boolean; unlimited?: boolean; noChats?: boolean; sheet?: boolean }> = {
  empty: { noChats: true },
  chats: {},
  picked: { tool: "hooks" },
  simulate: { tool: "test" },
  noname: { noName: true },
  unlimited: { unlimited: true },
  audience: { sheet: true },
};

const RECENT: HomeRecentRow[] = [
  { id: "dev-1", title: "Meal prep for busy students", when: "2h ago" },
  { id: "dev-2", title: "Fake a $10M camera move", when: "1d ago" },
  { id: "dev-3", title: "Morning routine, no cuts", when: "3d ago" },
];

const BASE: Audience = {
  id: "base",
  user_id: "dev",
  name: "Base",
  type: "target",
  mode: "socials",
  platform: "tiktok",
  goal_label: null,
  goal_intent: null,
  is_general: false,
  is_preset: false,
  source_account_id: null,
  persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
  personas: [],
  profile: null,
  calibration: null,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};

/** Two connected accounts and one described audience; the first is in use. */
const AUDIENCES: Audience[] = [
  { ...BASE, id: "dev-tests", name: "@nia.tests", type: "personal", platform: "tiktok", source_account_id: "dev-acc-1" },
  { ...BASE, id: "dev-cooks", name: "@nia.cooks", type: "personal", platform: "instagram", source_account_id: "dev-acc-2" },
  { ...BASE, id: "dev-gym", name: "Gym people" },
];

// Today's strings (composer.tsx, the textarea's aria-label and the send button's), as /dev/field.
const ARIA_LABEL: Partial<Record<ToolId, string>> = {
  hooks: "Hook topic (leave empty for Auto)",
  chat: "Ask anything about your content",
  script: "Script topic or leave empty to carry in a hook",
  remix: "Paste a TikTok URL to decode and remix",
};
const SEND_LABEL: Partial<Record<ToolId, string>> = {
  hooks: "Generate hooks",
  chat: "Send message",
  script: "Generate script",
  remix: "Remix video",
};

const TIKTOK = /tiktok\.com\//i;

const priceOf = (tool: ToolId): number | null => {
  const action = BILLABLE_BY_TOOL[tool];
  return action ? creditCost(action) : null;
};

export function DevHome({ state, recentOnDesktop }: { state: DevHomeState; recentOnDesktop: boolean }) {
  const start = STATES[state];
  const anchorRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const [tool, setTool] = useState<ToolId>(start.tool ?? "chat");
  const [video, setVideo] = useState<File | null>(null);
  const [audienceId, setAudienceId] = useState(AUDIENCES[0]!.id);
  const [sheetOpen, setSheetOpen] = useState(Boolean(start.sheet));
  const [lens, setLens] = useState<Lens>("tiktok");

  const audience = AUDIENCES.find((a) => a.id === audienceId) ?? AUDIENCES[0]!;
  const picked = tool !== "chat";
  const canSend =
    tool === "chat" ? value.trim() !== "" : tool === "test" ? video !== null || TIKTOK.test(value) : tool === "remix" ? TIKTOK.test(value) : true;
  // As the composer shows it on Home: Simulate keeps its own pair, the rest Home's words.
  const placeholder =
    tool === "test"
      ? video
        ? NEXT_SIMULATE_PLACEHOLDER.video
        : NEXT_SIMULATE_PLACEHOLDER.empty
      : (HOME_PLACEHOLDER_BY_TOOL[tool] ?? NEXT_PLACEHOLDER_BY_TOOL[tool] ?? NEXT_PLACEHOLDER_BY_TOOL.chat);

  return (
    // On the phone /dev/home is not a place, so the shell draws its Back header in the band that
    // Home's top row takes on /home (where the tab bar shows instead). The page starts under that
    // header here, so the top row stays in view; /home itself has no such offset.
    <div className="flex min-h-full flex-col max-md:pt-[var(--mobile-nav-band)]">
      <HomeScreen
        greeting={start.noName ? "Good morning." : "Good morning, Nia."}
        avatar={null}
        initials={start.noName ? "?" : "NL"}
        credits={start.unlimited ? null : 30}
        picked={picked}
        onPickSkill={setTool}
        recent={start.noChats ? [] : RECENT}
        onOpenThread={() => {}}
        recentOnDesktop={recentOnDesktop}
        // "More skills" opens the composer's More sheet on /home; nothing here.
        onMore={() => {}}
        field={
          <ThreadField
            value={value}
            onChange={setValue}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            onSubmit={(e) => {
              // Nothing is sent from here: the arm is one-shot, as in the composer.
              e.preventDefault();
              setValue("");
              setVideo(null);
              setTool("chat");
            }}
            tool={tool}
            onSelectTool={setTool}
            priceOf={priceOf}
            canSend={canSend}
            busy={false}
            online
            streaming={false}
            onStop={() => {}}
            video={tool === "test" ? video : null}
            onVideoChange={(file) => {
              setVideo(file);
              // "+" picks Simulate, as in a thread (spec §3.2).
              if (file) setTool("test");
            }}
            evidence={null}
            onRemoveEvidence={() => {}}
            onDropFile={() => {}}
            errors={[]}
            placeholder={placeholder}
            ariaLabel={ARIA_LABEL[tool] ?? "Paste a TikTok link"}
            sendLabel={SEND_LABEL[tool] ?? "Simulate"}
            anchorRef={anchorRef}
            onOpenMore={() => {}}
            moreOpen={false}
            home={{
              audience: { label: audience.name, open: sheetOpen, onOpen: () => setSheetOpen(true) },
              picked: picked ? { label: fieldSkillLabel(tool), price: priceOf(tool) } : null,
              onClearPicked: () => setTool("chat"),
            }}
          />
        }
      />
      <AudienceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        audiences={AUDIENCES}
        selectedId={audienceId}
        onSelect={(a) => {
          setAudienceId(a.id);
          setSheetOpen(false);
        }}
        onNewAudience={() => setSheetOpen(false)}
        lens={lens}
        onLensChange={setLens}
        anchorRef={anchorRef}
        side="bottom"
      />
    </div>
  );
}
