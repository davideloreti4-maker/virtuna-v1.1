"use client";

import { useContext } from "react";

import type { BlockOrigin } from "@/components/app/home/rehydrate-thread";
import { BlockOriginContext, ThreadIdContext } from "@/lib/save-provenance-context";
import type { AnswerPart } from "@/lib/thread-next/answer-parts";

import type { GaugeState } from "./answer-gauge";
import { AnswerSheet } from "./answer-sheet";
import { CopyButton, SaveButton, useCopyText, useSaveToggle } from "./sheet-actions";
import { HookSheetBody, IdeaSheetBody, type SheetGauge } from "./sheet-body";
import { useTextSim } from "./text-sim";
import { resultLinkOf, useSealKeys } from "./use-seal-keys";

/**
 * A pack row's details sheet in the thread (thread answers step 2, spec §3): the presentational sheet
 * wired to the thread's one text-sim queue (Simulate = the row's own fire), the pack's own script call
 * for this row (`onScript`, the same the card's primary makes: "Script this one" closes the sheet, the
 * script lands at the bottom), the thread id and the text's key (the result-page link), and the row's
 * OWN block origin, so Save keeps that row's `${messageId}:${index}` (the pack's part carries only its
 * first item's).
 */

type Pack = Extract<AnswerPart, { kind: "hooks" | "ideas" }>;

const EMPTY: GaugeState = { kind: "empty" };

export function PackSheet({
  part,
  index,
  origin,
  open,
  onOpenChange,
  returnFocus,
  onScript,
}: {
  part: Pack;
  index: number;
  origin: BlockOrigin | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus: HTMLElement | null;
  /** Writes the script from this row, as the card's primary does for it. None: the button is disabled. */
  onScript?: () => void;
}) {
  return (
    <BlockOriginContext.Provider value={origin}>
      <PackSheetInner part={part} index={index} open={open} onOpenChange={onOpenChange} returnFocus={returnFocus} onScript={onScript} />
    </BlockOriginContext.Provider>
  );
}

function PackSheetInner({
  part,
  index,
  open,
  onOpenChange,
  returnFocus,
  onScript,
}: {
  part: Pack;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus: HTMLElement | null;
  onScript?: () => void;
}) {
  const sim = useTextSim();
  const threadId = useContext(ThreadIdContext);
  const hook = part.kind === "hooks" ? (part.items[index]?.block.props ?? null) : null;
  const idea = part.kind === "ideas" ? (part.items[index]?.block.props ?? null) : null;
  const text = hook?.hookLine ?? idea?.title ?? "";
  // One word for all three: the queue's kind, the saved item's type, the page's `as`.
  const kind: "hook" | "idea" = hook ? "hook" : "idea";
  const keys = useSealKeys(text ? [text] : []);
  const copy = useCopyText(text);
  const save = useSaveToggle({ itemType: kind, title: text, snapshot: hook ?? idea ?? {} });

  if (!hook && !idea) return null;

  const state = sim?.stateOf(text) ?? EMPTY;
  const gauge: SheetGauge = {
    state,
    failed: sim?.failed(text) ?? false,
    text,
    href: resultLinkOf(state, threadId, keys.get(text.trim()), kind),
    onSimulate: sim ? () => sim.fire(text, kind) : undefined,
  };
  const actions = (
    <>
      <CopyButton copied={copy.copied} onCopy={copy.copy} />
      <SaveButton saved={save.saved} onToggle={save.toggle} />
    </>
  );
  const scriptThis = onScript
    ? () => {
        onOpenChange(false);
        onScript();
      }
    : undefined;

  return (
    <AnswerSheet open={open} onOpenChange={onOpenChange} title={text} returnFocus={returnFocus}>
      {hook ? (
        <HookSheetBody hook={hook} gauge={gauge} actions={actions} onScript={scriptThis} />
      ) : (
        <IdeaSheetBody idea={idea!} gauge={gauge} actions={actions} onScript={scriptThis} />
      )}
    </AnswerSheet>
  );
}
