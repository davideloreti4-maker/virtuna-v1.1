"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ui/toast";
import { announceAudienceChanged, useAudienceBuild, useSetDefaultAudience } from "@/hooks/queries/use-audience-next";
import { initialOf, type Whose } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS, newChatsUse, stillReading } from "@/lib/audience-next/audience-words";
import type { BuildRequest, NewDoor } from "@/lib/audience-next/build-request";
import { isSessionExpiredRefusal } from "@/lib/auth/session-expired";

import { BuildingView } from "./building-view";
import { NewAudienceScreen } from "./new-audience-screen";

/**
 * `/audience/new` with its data (spec 2026-11-25-audience, 3.6): the form, then the read in place of it.
 *
 * - The door and its field: one handle for the two account rows, the description apart; an old address
 *   chooses the row and may bring the handle.
 * - Build audience starts the read (`useAudienceBuild`); a second press sends nothing. While it runs the
 *   page asks to stay open (the hook holds it). The same read already on its way from a visit the creator
 *   left: nothing is sent, the form stays, and a toast says Maven is still reading it.
 * - The audience made while the page was gone: once the write answers, the audience page now on screen is
 *   asked to read itself again (`announceAudienceChanged`).
 * - The audience made: it becomes the one new chats use at once, told by the read itself (`onMade`), so this
 *   holds even when the creator left the page while it ran. Still here, the page waits for the stream to
 *   close and for that write's answer, then `/audience` shows it; a refused write opens the new audience's
 *   own page instead and says so (an expired session's dialog says it already). Gone, a toast says how the
 *   write went, and nothing navigates.
 * - Too little to read: `Use general viewers` opens `/audience` and writes nothing (the old screen's
 *   "Continue with General"), for a creator with no audience in use (`inUse`); one who has one is offered
 *   only the way to try another. That empties the field and gives it the focus.
 * - Failed: Try again sends the same request again; the way to try another goes back to the form with
 *   what was typed kept and focused, to correct a mistyped handle.
 * - An expired session: the hook goes back to idle, so the form returns as it was under the session dialog.
 */

const S = AUDIENCE_STRINGS;
const AUDIENCE_HREF = "/audience";

/** Whose videos the evidence card names: none for a description (it has no account). */
const WHOSE: Record<NewDoor, Whose | null> = { own: "your", other: "their", describe: null };

type Toast = ReturnType<typeof useToast>["toast"];
type Outcome = { ok: true } | { ok: false; error: unknown };

/** The write that makes a new audience the one new chats use, and who has said how it went. */
interface DefaultWrite {
  id: string;
  /** The audience as a toast names it: "@nia.tests", or a description's name. */
  label: string;
  answer: Promise<Outcome>;
  outcome: Outcome | null;
  /** The page showed how it went: it opened `/audience`, or the audience's own page. */
  shown: boolean;
  /** A toast said how it went, the page having gone. */
  told: boolean;
}

/** Says in a toast how the write went, once it has answered: for when the page is not there to show it. */
function tell(write: DefaultWrite, toast: Toast) {
  if (write.outcome === null || write.shown || write.told) return;
  write.told = true;
  if (write.outcome.ok) {
    toast({ variant: "default", title: newChatsUse(write.label) });
    // The audience page the creator went to shows the old default: it reads itself again.
    announceAudienceChanged();
  }
  else if (!isSessionExpiredRefusal(write.outcome.error)) toast({ variant: "error", title: S.switchFailed });
}

const doorOfRequest = (request: BuildRequest): NewDoor => ("handle" in request ? (request.type === "personal" ? "own" : "other") : "describe");

export function NewAudienceNext({ initialDoor, prefill, inUse }: { initialDoor: NewDoor; prefill: string; inUse: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const { mutateAsync: makeDefault } = useSetDefaultAudience();

  // What outlives the page: whether it is still there, the default's write, and the toast to tell it with.
  const page = useRef<{ gone: boolean; write: DefaultWrite | null; toast: Toast }>({ gone: false, write: null, toast });
  useEffect(() => {
    page.current.toast = toast;
  }, [toast]);
  useEffect(() => {
    const here = page.current;
    here.gone = false;
    return () => {
      here.gone = true;
      // Gone before it could show how the write went: a toast says it instead.
      if (here.write) tell(here.write, here.toast);
    };
  }, []);

  /** The new audience is made (the read tells this even once the page has gone): new chats use it from now. */
  const onMade = useCallback(
    (audienceId: string, request: BuildRequest) => {
      const here = page.current;
      const answer = makeDefault(audienceId).then(
        (): Outcome => ({ ok: true }),
        (error: unknown): Outcome => ({ ok: false, error }),
      );
      const write: DefaultWrite = { id: audienceId, label: request.name, answer, outcome: null, shown: false, told: false };
      here.write = write;
      void answer.then((outcome) => {
        write.outcome = outcome;
        if (here.gone) tell(write, here.toast);
      });
    },
    [makeDefault],
  );
  const build = useAudienceBuild(undefined, onMade);

  const [door, setDoor] = useState<NewDoor>(initialDoor);
  const [handle, setHandle] = useState(prefill);
  const [description, setDescription] = useState("");
  const fieldEl = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const attachField = useCallback((el: HTMLInputElement | HTMLTextAreaElement | null) => {
    fieldEl.current = el;
  }, []);
  const { state, slow } = build;
  const phase = state?.phase ?? null;

  // The stream has closed: once the write has answered, the page shows how it went.
  const audienceId = phase === "done" ? (state?.audienceId ?? null) : null;
  const request = state?.request ?? null;
  useEffect(() => {
    if (audienceId === null || request === null) return;
    const here = page.current;
    // The read told `onMade` when the audience was made; should it not have, the write starts now.
    if (here.write?.id !== audienceId) onMade(audienceId, request);
    const write = here.write;
    if (!write || write.shown) return;
    void write.answer.then((outcome) => {
      if (here.gone || write.shown || write.told) return;
      write.shown = true;
      if (outcome.ok) {
        router.push(AUDIENCE_HREF);
        router.refresh();
        return;
      }
      router.push(`${AUDIENCE_HREF}/${encodeURIComponent(audienceId)}`);
      if (!isSessionExpiredRefusal(outcome.error)) here.toast({ variant: "error", title: S.switchFailed });
    });
  }, [audienceId, request, onMade, router]);

  const field = door === "describe" ? description : handle;
  const setField = door === "describe" ? setDescription : setHandle;

  const tryAnother = () => {
    // The form comes back with its field empty before the focus is given to it.
    flushSync(() => {
      build.reset();
      setField("");
    });
    fieldEl.current?.focus();
  };
  // After a failure: the form with what was typed, to correct it (a mistyped handle is the likely cause).
  const editAgain = () => {
    flushSync(() => build.reset());
    fieldEl.current?.focus();
  };

  const submit = (request: BuildRequest) => {
    if (build.start(request)) return;
    // Already on its way from a visit the creator left: nothing is sent, and the form stays.
    toast({ variant: "default", title: "handle" in request ? stillReading(request.handle) : S.stillBuilding });
  };

  // The read's own door, not the form's: the form cannot change while the read shows.
  const readDoor = state ? doorOfRequest(state.request) : door;

  return (
    <NewAudienceScreen
      door={door}
      field={field}
      onDoor={setDoor}
      onField={setField}
      onSubmit={submit}
      fieldRef={attachField}
      building={
        state ? (
          <BuildingView
            state={state}
            slow={slow}
            mode="new"
            whose={WHOSE[readDoor]}
            initial={initialOf("handle" in state.request ? state.request.handle : state.request.name)}
            onTryAgain={() => build.start(state.request)}
            onUseGeneral={inUse ? undefined : () => router.push(AUDIENCE_HREF)}
            onTryAnother={phase === "failed" ? editAgain : tryAnother}
            tryAnotherLabel={readDoor === "describe" ? S.changeDescription : S.tryAnother}
          />
        ) : undefined
      }
    />
  );
}
