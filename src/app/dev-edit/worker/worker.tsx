"use client";

import type { PlayerRef } from "@remotion/player";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditPlayer } from "@/edit/player/EditPlayer";
import { filmFrames, type Asset, type Edit } from "@/lib/edit";
import { firstEdit } from "@/lib/edit/worker/takes";
import { ENDED, call, put, useJob } from "../shared";

declare global {
  interface Window {
    /** The dev page's player, for a test or a person at the console to seek and play. */
    __editPlayer?: PlayerRef | null;
  }
}

type Ids = { take: string | null; analysis: string | null; render: string | null };
interface TakeShown {
  take: { id: string; name: string; bytes: number; status: string; error: string | null };
  asset: Asset | null;
  previewUrl: string | null;
}

/** The dev page that proves part 2: plain on purpose, in the app's charcoal; a tool, not a screen of the product. */
export function WorkerPage({ ids: first, bare }: { ids: Ids; bare: boolean }) {
  const [ids, setIds] = useState(first);
  const [take, setTake] = useState<TakeShown | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /** What the page has asked for and not yet been answered: a take's upload and the start of its analysis, or a render's start. Its button waits. */
  const [busy, setBusy] = useState<"upload" | "render" | null>(null);
  const { job: analysis, unread: analysisUnread } = useJob(bare ? null : ids.analysis);
  const { job: render, unread: renderUnread } = useJob(bare ? null : ids.render);
  const player = useRef<PlayerRef>(null);

  // What the page watches is in its address, so a reload goes on with the same take and jobs.
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const [name, value] of Object.entries(ids)) {
      if (value) url.searchParams.set(name, value);
      else url.searchParams.delete(name);
    }
    window.history.replaceState(null, "", url);
  }, [ids]);

  // The take is read again when its analysis starts and when it ends: its state follows its analysis.
  const analysed = analysis ? ENDED.has(analysis.status) : false;
  useEffect(() => {
    if (!ids.take) return;
    let stopped = false;
    call<TakeShown>(`/api/edit/takes/${ids.take}`).then(({ ok, body }) => {
      if (stopped) return;
      if (ok) setTake(body);
      else setProblem(body.error ?? "the take could not be read");
    });
    return () => {
      stopped = true;
    };
  }, [ids.take, ids.analysis, analysed]);

  const edit = useMemo<Edit | null>(() => (take?.asset ? firstEdit(take.asset) : null), [take?.asset]);
  const urls = useMemo(() => (take?.asset && take.previewUrl ? { [take.asset.id]: take.previewUrl } : {}), [take?.asset, take?.previewUrl]);
  const [approximate, setApproximate] = useState(false);
  const onApproximateColour = useCallback(() => setApproximate(true), []);

  useEffect(() => {
    window.__editPlayer = player.current;
    return () => {
      window.__editPlayer = null;
    };
  }, [edit]);

  const send = async (file: File) => {
    setBusy("upload");
    setProblem(null);
    setTake(null);
    setSent(0);
    try {
      const made = await call<{ take: TakeShown["take"]; uploadUrl: string }>("/api/edit/takes", { name: file.name, bytes: file.size, type: file.type });
      if (!made.ok) throw new Error(made.body.error);
      const id = made.body.take.id;
      setIds({ take: id, analysis: null, render: null });
      setTake({ take: made.body.take, asset: null, previewUrl: null });
      await put(made.body.uploadUrl, file, setSent);
      const started = await call<{ job?: { id: string } }>(`/api/edit/takes/${id}/uploaded`, {});
      if (started.body.job) setIds({ take: id, analysis: started.body.job.id, render: null });
      if (!started.ok) throw new Error(started.body.error);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const startRender = async () => {
    if (!edit || !ids.take) return;
    setBusy("render");
    setProblem(null);
    try {
      const started = await call<{ job?: { id: string }; problems?: { path: string; message: string }[] }>("/api/edit/renders", { edit });
      if (started.body.job) setIds({ ...ids, render: started.body.job.id });
      if (!started.ok) setProblem([started.body.error, ...(started.body.problems ?? []).map((one) => `${one.path}: ${one.message}`)].join("\n"));
    } finally {
      setBusy(null);
    }
  };

  if (bare) {
    if (!edit) return <p className="p-6 text-sm text-foreground-muted">{take ? `The take is ${take.take.status}.` : "Reading the take…"}</p>;
    return (
      <div id="edit-stage" data-colour={approximate ? "approximate" : "exact"} data-frames={filmFrames(edit)} style={{ position: "fixed", left: 0, top: 0, width: edit.stage.w, height: edit.stage.h, zIndex: 2147483647, background: "#000000" }}>
        <EditPlayer ref={player} edit={edit} kit="/edit" urls={urls} controls={false} onApproximateColour={onApproximateColour} />
      </div>
    );
  }

  const status = take?.take.status ?? null;
  const rendering = render !== null && !ENDED.has(render.status);
  return (
    <main className="min-h-screen bg-background p-4 text-foreground">
      <div className="mx-auto grid w-full max-w-[420px] gap-4">
        <h1 className="text-base font-medium">The edit worker</h1>

        <Section title="Take">
          <input
            id="take-file"
            type="file"
            accept="video/mp4,video/quicktime"
            disabled={busy === "upload"}
            className="text-sm text-foreground-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-action file:px-3 file:py-1.5 file:text-sm file:text-action-foreground"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void send(file);
            }}
          />
          {take ? (
            <p id="take" data-status={status} className="text-sm text-foreground-secondary">
              {take.take.name}, {(take.take.bytes / 1e6).toFixed(1)} MB: {status}
              {take.take.error ? `: ${take.take.error}` : ""}
            </p>
          ) : null}
          {sent !== null && status === "uploading" ? <Bar id="upload" label="Uploading" share={take ? sent / take.take.bytes : 0} /> : null}
        </Section>

        {analysis || analysisUnread ? (
          <Section title="Analysis">
            {analysis ? <Bar id="analysis" label={analysis.status === "running" ? `${analysis.stage ?? "starting"}` : analysis.status} share={analysis.progress} status={analysis.status} /> : null}
            {analysis?.error ? <p className="text-sm text-foreground-secondary">The analysis failed: {analysis.error}</p> : null}
            {analysisUnread ? <p className="text-xs text-foreground-muted">{analysisUnread}</p> : null}
          </Section>
        ) : null}

        {edit && take?.asset?.kind === "video" ? (
          <Section title="The take in the Player">
            <div id="edit-stage" data-colour={approximate ? "approximate" : "exact"} className="overflow-hidden rounded-xl border border-border">
              <EditPlayer ref={player} edit={edit} kit="/edit" urls={urls} onApproximateColour={onApproximateColour} />
            </div>
            <p className="text-xs text-foreground-muted">
              {(take.asset.ms / 1000).toFixed(1)} s, {take.asset.w}×{take.asset.h}, {take.asset.words?.length ?? 0} words · the whole take, its captions, the natural look
            </p>
            {approximate ? <p className="text-xs text-foreground-muted">This browser cannot run the colour pass: the looks here are close, not exact.</p> : null}
            <button
              id="render"
              type="button"
              disabled={rendering || busy === "render"}
              onClick={() => void startRender()}
              className="h-9 rounded-lg bg-action px-4 text-sm font-medium text-action-foreground disabled:opacity-40"
            >
              {busy === "render" ? "Starting…" : rendering ? "Rendering…" : "Render"}
            </button>
          </Section>
        ) : null}

        {render || renderUnread ? (
          <Section title="Render">
            {render ? <Bar id="render-progress" label={render.status === "running" ? `${render.stage ?? "starting"}` : render.status} share={render.progress} status={render.status} /> : null}
            {render?.error ? <p className="text-sm text-foreground-secondary">The render failed: {render.error}</p> : null}
            {renderUnread ? <p className="text-xs text-foreground-muted">{renderUnread}</p> : null}
            {render?.filmUrl ? (
              <a id="download" href={render.filmUrl} download className="text-sm text-foreground underline underline-offset-4">
                Download the film
              </a>
            ) : null}
          </Section>
        ) : null}

        {problem ? <pre id="problem" className="whitespace-pre-wrap text-xs text-foreground-secondary">{problem}</pre> : null}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 rounded-xl border border-border bg-surface-elevated p-3">
      <h2 className="text-xs text-foreground-muted">{title}</h2>
      {children}
    </section>
  );
}

/** A progress bar with its label and share; its state is in its data attributes, for the proof. */
function Bar({ id, label, share, status }: { id: string; label: string; share: number; status?: string }) {
  const percent = Math.round(Math.min(1, Math.max(0, share)) * 100);
  return (
    <div id={id} data-status={status} data-progress={share} className="grid gap-1">
      <div className="flex justify-between text-xs text-foreground-secondary">
        <span>{label}</span>
        <span>{percent} %</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-background">
        <div className="h-full bg-foreground-secondary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
