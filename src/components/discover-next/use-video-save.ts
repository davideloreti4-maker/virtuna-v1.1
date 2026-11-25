"use client";

import { useRef } from "react";

import { useToast } from "@/components/ui/toast";
import { useDeleteSavedItem, useSaveItem, useSavedItemByRef, useSavedItems } from "@/hooks/queries/use-saved-items";
import { DISCOVER_STRINGS } from "@/lib/discover-next/discover-words";
import type { VideoSave } from "@/lib/discover-next/saved-ref";

/**
 * Save on a video (spec 3.3, "Save"): the video goes to Library's Saved as "Video · saved in Discover",
 * and a second tap takes it out. Over the app's saved-items hooks, as the thread's Save is
 * (`thread-next/sheet-actions.tsx`, `useSaveToggle`).
 *
 * - The mark is read from the saved list by the row's identity (`item_type` "outlier", `ref_id` the
 *   video's id), so it survives a reload; a library video is saved with no chat (`thread_id` null).
 * - Nothing goes out while a save or a remove is on its way, while the row shown is still the save's
 *   optimistic stand-in (it has no id to remove yet), or before the list is read: an unread list is
 *   not "not saved", and a tap then would write a second row.
 * - A list that could not be read is not a dead button: a press asks for it again (never twice at once)
 *   and writes nothing; once it is read, the mark it holds shows and the next press saves or removes.
 * - A refused save or remove says so in a toast; the hooks have already put the mark back.
 * - Two taps can land before a render shows the first one going out; the ref catches the second.
 */
export interface VideoSaveState {
  saved: boolean;
  /** The saved list is read: the mark can be trusted, and a tap saves or removes. */
  ready: boolean;
  /** The saved list could not be read: a tap asks for it again. */
  unread: boolean;
  /** A save or a remove is on its way. */
  busy: boolean;
  toggle(): void;
}

const S = DISCOVER_STRINGS.video;

export function useVideoSave({ refId, title, snapshot }: VideoSave): VideoSaveState {
  const save = useSaveItem();
  const remove = useDeleteSavedItem();
  const list = useSavedItems();
  const { item, ready } = useSavedItemByRef("outlier", refId);
  const { toast } = useToast();
  // Out as of the last tap, not the last render.
  const out = useRef(false);
  const rowPending = item?.id.startsWith("optimistic-") ?? false;
  const busy = save.isPending || remove.isPending || rowPending;
  const unread = !ready && list.isError;

  const toggle = () => {
    if (unread) {
      // Joins a read already out rather than starting a second one.
      void list.refetch({ cancelRefetch: false });
      return;
    }
    if (!ready || busy || out.current) return;
    out.current = true;
    const onSettled = () => {
      out.current = false;
    };
    if (item) {
      remove.mutate(item.id, { onError: () => toast({ variant: "error", title: S.removeFailed }), onSettled });
    } else {
      save.mutate(
        { item_type: "outlier", ref_id: refId, thread_id: null, title, snapshot },
        { onError: () => toast({ variant: "error", title: S.saveFailed }), onSettled },
      );
    }
  };

  return { saved: item !== undefined, ready, unread, busy, toggle };
}
