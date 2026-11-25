"use client";

import { useRef, useState } from "react";

import { BILLABLE_BY_TOOL, type ToolId } from "@/components/app/home/composer-controls";
import { NEXT_PLACEHOLDER_BY_TOOL, NEXT_SIMULATE_PLACEHOLDER } from "@/components/thread-next/field-copy";
import { MORE_SKILLS, MoreSheet, type MoreSheetProps } from "@/components/thread-next/more-sheet";
import { ThreadField } from "@/components/thread-next/thread-field";
import { creditCost } from "@/lib/pricing";

/**
 * The field and More on local state, for /dev/field (`page.tsx`). The placeholders are the
 * composer's own (`field-copy.ts`); the names and send rules below stand in for the composer's;
 * the field's own behaviour is real. Nothing here sends anything.
 */

/** The states of the reference the page can open in (`page.tsx` checks the name). */
export type DevFieldState = "rest" | "hooks" | "typed" | "video" | "simulate" | "more" | "streaming";

const STATES: Record<DevFieldState, { tool?: ToolId; value?: string; more?: boolean; streaming?: boolean }> = {
  rest: {},
  hooks: { tool: "hooks" },
  typed: { tool: "hooks", value: "meal prep for busy students" },
  video: { tool: "test" },
  simulate: { tool: "test" },
  more: { more: true },
  streaming: { streaming: true },
};

// Today's strings (composer.tsx, the textarea's aria-label and the send button's).
const ARIA_LABEL: Partial<Record<ToolId, string>> = {
  idea: "Idea topic or angle (leave empty for Auto)",
  hooks: "Hook topic (leave empty for Auto)",
  chat: "Ask anything about your content",
  script: "Script topic or leave empty to carry in a hook",
  remix: "Paste a TikTok URL to decode and remix",
};
const SEND_LABEL: Partial<Record<ToolId, string>> = {
  idea: "Generate ideas",
  hooks: "Generate hooks",
  chat: "Send message",
  script: "Generate script",
  remix: "Remix video",
  explore: "Run Explore",
  account: "Read my account",
};

const TIKTOK = /tiktok\.com\//i;

const priceOf = (tool: ToolId): number | null => {
  const action = BILLABLE_BY_TOOL[tool];
  return action ? creditCost(action) : null;
};

export function DevField({ state, withBrief }: { state: DevFieldState; withBrief: boolean }) {
  const start = STATES[state];
  const anchorRef = useRef<HTMLDivElement>(null);
  const evidenceRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(start.value ?? "");
  const [tool, setTool] = useState<ToolId>(start.tool ?? "chat");
  const [video, setVideo] = useState<File | null>(null);
  const [evidence, setEvidence] = useState<File | null>(null);
  const [streaming, setStreaming] = useState(Boolean(start.streaming));
  const [moreOpen, setMoreOpen] = useState(Boolean(start.more));
  const [lens, setLens] = useState<MoreSheetProps["lens"]>("tiktok");
  const [brief, setBrief] = useState<{ hookLine: string } | null>(
    withBrief ? { hookLine: "This is $5 of food. It fed me for three days." } : null,
  );

  const picked = MORE_SKILLS.find((s) => s.id === tool);
  const canSend = evidence
    ? true
    : tool === "chat"
      ? value.trim() !== ""
      : tool === "test"
        ? video !== null || TIKTOK.test(value)
        : tool === "remix"
          ? TIKTOK.test(value)
          : true;

  return (
    <div className="relative h-full bg-background">
      <div className="absolute inset-x-4 bottom-[30px] md:inset-x-0 md:bottom-6 md:mx-auto md:w-[720px] md:max-w-[calc(100%-32px)]">
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
            setEvidence(null);
            setTool("chat");
          }}
          tool={tool}
          onSelectTool={setTool}
          priceOf={priceOf}
          canSend={canSend}
          busy={false}
          online
          streaming={streaming}
          onStop={() => setStreaming(false)}
          video={tool === "test" ? video : null}
          onVideoChange={(file) => {
            setVideo(file);
            if (file) setTool("test");
          }}
          evidence={evidence}
          onRemoveEvidence={() => setEvidence(null)}
          onDropFile={setEvidence}
          errors={[]}
          placeholder={
            tool === "test"
              ? video
                ? NEXT_SIMULATE_PLACEHOLDER.video
                : NEXT_SIMULATE_PLACEHOLDER.empty
              : (NEXT_PLACEHOLDER_BY_TOOL[tool] ?? NEXT_PLACEHOLDER_BY_TOOL.chat)
          }
          ariaLabel={ARIA_LABEL[tool] ?? "Paste a TikTok link"}
          sendLabel={evidence ? "Read this evidence" : (SEND_LABEL[tool] ?? "Simulate")}
          brief={brief}
          onDismissBrief={() => setBrief(null)}
          anchorRef={anchorRef}
          moreArmed={picked ? { label: picked.label, price: priceOf(picked.id) } : null}
          moreOpen={moreOpen}
          onOpenMore={() => setMoreOpen(true)}
        />
        <input
          ref={evidenceRef}
          type="file"
          accept=".txt,.md,text/plain,text/markdown,image/*,video/*"
          aria-label="Choose a chat or screenshot"
          tabIndex={-1}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) setEvidence(file);
          }}
        />
      </div>
      <MoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        skills={MORE_SKILLS.map((s) => ({ ...s, price: priceOf(s.id) }))}
        onSelectSkill={setTool}
        onReadFile={() => evidenceRef.current?.click()}
        readFilePrice={creditCost("profile")}
        audienceLabel="Your TikTok audience"
        onOpenAudience={() => {}}
        lens={lens}
        onLensChange={setLens}
        anchorRef={anchorRef}
      />
    </div>
  );
}
