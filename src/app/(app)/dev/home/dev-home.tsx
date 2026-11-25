"use client";

import { useRef, useState } from "react";

import { BILLABLE_BY_TOOL, type ToolId } from "@/components/app/home/composer-controls";
import { HomeScreen, type HomeMoney, type HomeRecentRow } from "@/components/home-next/home-screen";
import { MenuButton } from "@/components/shell/menu-button";
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
import { headline, moneyWord } from "@/lib/earn/earn-words";
import { creditCost } from "@/lib/pricing";

/**
 * Home on local state, for /dev/home (`page.tsx`): the screen the composer draws, with the real
 * field in its Home layout and the real audience sheet. The placeholders are the composer's own
 * (`field-copy.ts`); the values below are fixtures. Nothing here sends anything.
 */

/** The states the page can open in (`page.tsx` checks the name). */
export type DevHomeState = "empty" | "chats" | "plain" | "picked" | "simulate" | "noname" | "unlimited" | "audience" | "money";

const STATES: Record<
  DevHomeState,
  { tool?: ToolId; noName?: boolean; unlimited?: boolean; noChats?: boolean; plain?: boolean; sheet?: boolean; money?: boolean }
> = {
  empty: { noChats: true },
  chats: {},
  plain: { plain: true },
  picked: { tool: "hooks" },
  simulate: { tool: "test" },
  noname: { noName: true },
  unlimited: { unlimited: true },
  audience: { sheet: true },
  money: { money: true },
};

/** The "Money made" row of the state `money`, in Earn's own words (as `moneyOf` in `home-next.tsx`
 *  builds it): the amount from whole cents, none when the number could not be read. */
const moneyRow = (earnedCents: number | null): HomeMoney => ({
  state: "shown",
  amount: earnedCents === null ? null : moneyWord(earnedCents),
  hint: headline(),
});

/** A video frame, drawn: a figure at a desk with a camera, 9:16. */
const FRAME =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 160">` +
      `<rect width="90" height="160" fill="#cfc6b8"/>` +
      `<rect x="0" y="0" width="22" height="160" fill="#e9e4dc"/>` +
      `<rect x="0" y="112" width="90" height="48" fill="#6d5a4a"/>` +
      `<path d="M14 160c2-30 14-46 30-46s28 16 30 46z" fill="#3e4a5c"/>` +
      `<ellipse cx="44" cy="92" rx="13" ry="16" fill="#b98262"/>` +
      `<path d="M30 92c-3-18 6-28 14-28s18 8 14 28c-2-8-5-14-14-15c-9 1-12 7-14 15z" fill="#2c211b"/>` +
      `<rect x="56" y="98" width="22" height="14" rx="3" fill="#1f1f1e"/>` +
      `<circle cx="67" cy="105" r="4" fill="#57606b"/>` +
      `</svg>`,
  );

/** Recent once Library's summary is in: each row as Library draws it (the lines are `rowLine`'s). */
const RECENT: HomeRecentRow[] = [
  {
    id: "dev-1",
    title: "Meal prep for busy students",
    when: null,
    summary: {
      tile: { lead: "hooks", frame: null, still: null },
      line: "3 hooks · simulated 2h ago",
      gauge: { number: 45, describes: "45% would stop to watch", href: "/dev/answers?state=p7" },
    },
  },
  {
    id: "dev-2",
    title: "Fake a $10M camera move",
    when: null,
    summary: {
      tile: { lead: "video", frame: FRAME, still: null },
      line: "Video · simulated 5h ago",
      gauge: { number: 38, describes: "38% watch to the end", href: "/dev/result?fixture=middle" },
    },
  },
  {
    id: "dev-3",
    title: "Morning routine, no cuts",
    when: null,
    summary: { tile: { lead: "script", frame: null, still: null }, line: "Script · 3d ago", gauge: null },
  },
];

/** Recent while that summary is out, or when it failed: the chat list's titles and times, each row
 *  in the same shape with the plain chat mark. */
const RECENT_PLAIN: HomeRecentRow[] = [
  { id: "dev-1", title: "Meal prep for busy students", when: "2h ago" },
  { id: "dev-2", title: "Fake a $10M camera move", when: "5h ago" },
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

export function DevHome({
  state,
  recentOnDesktop,
  earnedCents,
}: {
  state: DevHomeState;
  recentOnDesktop: boolean;
  /** The state `money` only: what the row says, in whole cents; null for no amount. */
  earnedCents: number | null;
}) {
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
    // Home's top row takes on /home (where the shell draws no header). The page starts under that
    // header here, so the top row stays in view; /home itself has no such offset.
    <div className="flex min-h-full flex-col max-md:pt-[var(--mobile-nav-band)]">
      <HomeScreen
        greeting={start.noName ? "Good morning." : "Good morning, Nia."}
        // Only the state `money` has the row; every other state is Home without it (no space kept).
        money={start.money ? moneyRow(earnedCents) : null}
        // The drawer's opener with a face of its own: the preview has no account to publish one.
        opener={<MenuButton variant="picture" face={{ picture: null, initials: start.noName ? "?" : "NL" }} />}
        credits={start.unlimited ? null : 30}
        picked={picked}
        onPickSkill={setTool}
        recent={start.noChats ? [] : start.plain ? RECENT_PLAIN : RECENT}
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
