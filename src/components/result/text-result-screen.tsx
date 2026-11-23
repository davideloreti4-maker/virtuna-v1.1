"use client";

import { useMemo } from "react";
import { useTextSeal } from "@/hooks/queries/use-text-seal";
import { useOpenThread } from "@/hooks/useOpenThread";
import { textResultOf, type TextResultAs } from "@/lib/result/text-result";
import { leaveScriptFrom } from "@/lib/thread-next/script-from";
import { TextResultView, type TextResultState } from "./text-result";

/**
 * `/simulation/hook/[threadId]/[key]`: reads the seal and picks the state (spec §4). "Script this one"
 * leaves the text for this page's thread (`leaveScriptFrom`), points the active thread at it and
 * returns to /home; the composer runs the write-script turn once that thread has loaded.
 */
export function TextResultScreen({ threadId, sealKey, as }: { threadId: string; sealKey: string; as: TextResultAs }) {
  const { seal, notFound } = useTextSeal(threadId, sealKey);
  const openThread = useOpenThread();
  const model = useMemo(() => (seal ? textResultOf(seal.population) : null), [seal]);
  const state: TextResultState =
    notFound || (seal && !model)
      ? { kind: "not-found" }
      : seal && model
        ? { kind: "result", text: seal.text, model }
        : { kind: "loading" };
  // An archived thread cannot take a new turn (the cookie steers to open threads): no button there.
  const onScript =
    state.kind === "result" && seal?.open
      ? () => {
          if (leaveScriptFrom(threadId, state.text)) openThread(threadId);
        }
      : undefined;
  return <TextResultView state={state} as={as} onScript={onScript} />;
}
