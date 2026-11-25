"use client";

import { useQuery } from "@tanstack/react-query";

import { Chip } from "@/components/ui/chip";
import { FPS, filmFrames } from "@/lib/edit";
import type { EditView } from "@/lib/edit/edit-view";
import { lookName } from "@/lib/edit/said";
import { timecode } from "@/lib/result/format";
import type { EditBlock } from "@/lib/tools/profile-blocks";

import { AnswerCard, AnswerPrimary, CardHeader } from "./answer-card";
import { ScissorsIcon } from "./field-icons";
import { VideoThumb } from "./video-answer";

/**
 * The edit's card in its chat (spec 2026-11-24-editor-screens-design.md §3 screen 13, §6; plan
 * 2026-11-24-editor-screens-a, Task 4; drawing `.acard`): the take's picture (66 wide), "Edit", the title, the film's length
 * and its look, the day it was last changed, and the one primary "Open editor".
 *
 * Never out of date (spec §6; ruling R15): the edit is read each time the card is shown (`staleTime: 0`, over the app
 * client's minute), so back from the editor it shows what it had and then the edit as it now stands. A 404 always says "This
 * edit is not here.", whatever the card had. A read that fails any other way (offline, a 500) leaves the card showing what it
 * had, with no error; only with nothing to show does it say "This edit could not be read.", with "Try again". The card is
 * made while the take may still be uploading: until there is a length it writes none, and no look before one is picked.
 * The page says what is wrong with an edit; the card only that it is not there or was not read.
 */

/** "Edited today", "Edited yesterday", "Edited Nov 12": the day the edit was last changed, in the viewer's calendar. */
export function editedWords(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return "Edited";
  const day = (when: Date) => new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime();
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days <= 0) return "Edited today";
  if (days === 1) return "Edited yesterday";
  return `Edited ${at.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/** The film's length in seconds: the edit shown, else the take's; 0 while the take has no length yet. */
export function lengthOf(view: EditView): number {
  return view.edit ? filmFrames(view.edit) / FPS : (view.take.ms ?? 0) / 1000;
}

/**
 * "0:13 · Clean": the film's length and its look. The length alone before a look is picked; null before there is a length
 * to write (never "0:00", never a look nobody picked).
 */
function lengthLine(view: EditView): string | null {
  const seconds = lengthOf(view);
  if (Math.round(seconds) < 1) return null;
  return view.look === null ? timecode(seconds) : `${timecode(seconds)} · ${lookName(view.look)}`;
}

/** A read the route refused: its status tells an edit that is not there (404) from one that could not be read. */
class Unread extends Error {
  constructor(readonly status: number) {
    super(`the edit answered ${status}`);
  }
}

async function readEdit(id: string): Promise<EditView> {
  const response = await fetch(`/api/edit/edits/${id}`, { cache: "no-store" });
  if (!response.ok) throw new Unread(response.status);
  return (await response.json()) as EditView;
}

export function EditAnswerView({
  id,
  view,
  failed,
  gone = false,
  onRetry,
}: {
  id: string;
  view: EditView | null;
  /** The read failed: the card says so when it has no `view` to show. */
  failed: boolean;
  /** The failed read answered 404: the edit is not there, and there is nothing to try again. */
  gone?: boolean;
  /** Reads the edit again; offered when a read failed for any other reason. */
  onRetry?: () => void;
}) {
  const line = view ? lengthLine(view) : null;
  const wrong = view || !failed ? null : gone ? "This edit is not here." : "This edit could not be read.";
  return (
    <AnswerCard>
      <CardHeader
        left={
          <span className="inline-flex items-center gap-1.5">
            <ScissorsIcon size={15} aria-hidden />
            Edit
          </span>
        }
      />
      <div className="flex gap-3.5 pt-1">
        <VideoThumb src={view?.take.posterUrl ?? null} className="w-[66px]" />
        <div className="min-w-0 flex-1 pt-0.5">
          {view && (
            <>
              <p data-part="title" className="truncate text-title font-[640] text-foreground">
                {view.title}
              </p>
              <div className="mt-1 text-reading text-foreground-secondary">
                {line !== null && <p className="tabular-nums">{line}</p>}
                <p>{editedWords(view.updatedAt)}</p>
              </div>
            </>
          )}
          {/* What went wrong, in a status there from the card's first draw, empty till then: a card that turns into it is read
              (a region put in with its words is not, by every screen reader). */}
          <p role="status" className="text-reading text-foreground-secondary">
            {wrong}
          </p>
          {wrong !== null && !gone && onRetry && (
            <Chip surface="card" onClick={onRetry} className="mt-2">
              Try again
            </Chip>
          )}
        </div>
      </div>
      <div className="mt-3.5 md:mt-5">
        <AnswerPrimary icon={<ScissorsIcon size={20} aria-hidden className="shrink-0" />} label="Open editor" href={`/edit/${id}`} trailingArrow />
      </div>
    </AnswerCard>
  );
}

/** An `edit` block in the thread: its edit, read as the page reads it, each time the card is shown. */
export function EditAnswer({ block }: { block: EditBlock }) {
  const id = block.props.editId;
  const read = useQuery({ queryKey: ["edit", id], queryFn: () => readEdit(id), staleTime: 0, retry: false });
  const gone = read.error instanceof Unread && read.error.status === 404;
  // A deleted edit is not here, whatever the card had. Any other failed read leaves what it had: out of signal, a creator
  // keeps their card (R15).
  const view = gone ? null : (read.data ?? null);
  return <EditAnswerView id={id} view={view} failed={read.isError} gone={gone} onRetry={() => void read.refetch()} />;
}
