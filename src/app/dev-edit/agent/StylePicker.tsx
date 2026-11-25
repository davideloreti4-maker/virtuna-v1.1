"use client";

/**
 * StylePicker.tsx — "How should it look?" (Task 13b): the panel before the first cut. Four rows, one chosen at a time: our
 * pick (chosen as the page opens), like a video (a TikTok link or an upload), a preset, or the creator's own words. The
 * chosen row has the brighter border and opens its field. The button is off until the chosen row has what it needs
 * (`ready`), and gives way to one line of progress and a thin bar while the cut is made; a failure is one sentence under it
 * with "Try again", which is there only while trying again can be done.
 *
 * While the take is cut the rows are off. While a video's style is read they stay on: picking another row stops the read
 * (the page's doing, `onPick`). When the work ends without a cut, the keyboard's focus goes back to the button it left.
 *
 * The rows are native radios in one group (arrow keys move between them), each row's whole head its label.
 */
import { X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { HOUSE_STYLE } from "@/lib/edit/style/house";
import { PRESETS, presetOf } from "@/lib/edit/style/presets";
import { TAKE_TYPES } from "@/lib/edit/worker/takes";
import { Bar } from "./Bar";
import { MOST_WORDS, hintOf, ready, type Choice, type Picking } from "./picking";
import { Sample } from "./Sample";

/** What a creator has put into the rows, the file as the browser gave it. */
export type Picked = Omit<Picking, "file"> & { file: File | null };

/** The page's one headline, in the serif: the question, or what stands in its place when there is no take to ask it of. */
export const HEADLINE = "font-serif text-[26px] leading-8 tracking-[-0.01em] text-foreground min-[900px]:text-[30px] min-[900px]:leading-9";
/** The ring a row or a chip shows when its own radio has the keyboard's focus (the radio itself is not drawn). */
const ROW_RING = "has-[>label>input:focus-visible]:outline-2 has-[>label>input:focus-visible]:-outline-offset-2 has-[>label>input:focus-visible]:outline-[color:var(--focus-ring)]";
const CHIP_RING = "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-[color:var(--focus-ring)]";
const FIELD = "rounded-md border border-border bg-surface px-3 text-[14px] text-foreground placeholder:text-foreground-muted focus:border-foreground/40";
const SMALL = "text-[13px] leading-[18px] text-foreground-secondary";
/** A row's own line: its two lines broken evenly, never a word alone on the second. */
const SAYS = `${SMALL} text-balance`;

interface Props {
  picking: Picked;
  onPick: (next: Picked) => void;
  /** The take is not here yet: the rows can be chosen, the cut cannot be made. */
  waiting: boolean;
  /** What is under way: its line and the bar's share; `reading` while it is a video's style being read, not yet the cut. */
  working: { stage: string; share: number | null; reading: boolean } | null;
  problem: string | null;
  onMake: () => void;
}

export function StylePicker({ picking, onPick, waiting, working, problem, onMake }: Props) {
  const heading = useId();
  const upload = useRef<HTMLInputElement>(null);
  /** The link field was left: only then is a link that is none said to be none, not at every letter typed. */
  const [left, setLeft] = useState(false);
  const set = (more: Partial<Picked>) => onPick({ ...picking, ...more });
  const preset = picking.preset === null ? undefined : presetOf(picking.preset);
  const hint = picking.choice === "video" && !picking.file && !left ? null : hintOf(picking);
  const row = (choice: Choice) => ({ chosen: picking.choice === choice, onChoose: () => set({ choice }) });
  const can = !waiting && ready(picking);

  // The button gave its place to the line of progress and took the keyboard's focus with it. When the work ends and the
  // button is back (it failed, or was stopped), the focus returns to it, unless the creator has put it somewhere since.
  const submit = useRef<HTMLButtonElement>(null);
  const busy = working !== null;
  const was = useRef(busy);
  useEffect(() => {
    if (was.current && !busy && document.activeElement === document.body) submit.current?.focus({ preventScroll: true });
    was.current = busy;
  }, [busy]);

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!working && can) onMake();
      }}
    >
      <h1 id={heading} className={HEADLINE}>
        How should it look?
      </h1>

      <fieldset disabled={working !== null && !working.reading} aria-labelledby={heading} className="group grid min-w-0 gap-2 disabled:opacity-50">
        <Row {...row("pick")} sample={<Sample show="look" style={HOUSE_STYLE} />} title="Our pick" says="Clean white captions and a label that stays." />

        <Row {...row("video")} sample={<Sample show="play" />} title="Like a video" says="Paste a TikTok link, or upload a video. We read its style, then delete it.">
          <div className="flex gap-2">
            {picking.file ? (
              <span className="flex h-10 min-w-0 flex-1 items-center rounded-md border border-border bg-surface pl-3 pr-1 text-[14px] text-foreground">
                <span className="min-w-0 flex-1 truncate">{picking.file.name}</span>
                <button type="button" aria-label="Take the video away" onClick={() => set({ file: null })} className="grid size-8 flex-none place-items-center rounded-sm text-foreground-muted hover:text-foreground">
                  <X size={14} />
                </button>
              </span>
            ) : (
              <input
                type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                aria-label="A TikTok link" placeholder="Paste a TikTok link"
                value={picking.link}
                onChange={(event) => set({ link: event.target.value })}
                onFocus={() => setLeft(false)}
                onBlur={() => setLeft(true)}
                className={`${FIELD} h-10 min-w-0 flex-1`}
              />
            )}
            <button type="button" onClick={() => upload.current?.click()} className="h-10 flex-none rounded-md border border-border px-3 text-[14px] text-foreground-secondary hover:border-border-hover hover:text-foreground">
              Upload
            </button>
            <input
              ref={upload} type="file" hidden accept={TAKE_TYPES.join(",")} aria-label="A video to upload"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) set({ file });
                event.target.value = ""; // the same file can be chosen again after it was taken away
              }}
            />
          </div>
          {hint ? <p role="status" className={SMALL}>{hint}</p> : null}
        </Row>

        <Row {...row("preset")} sample={preset ? <Sample show="look" style={preset.profile} /> : <Sample show="looks" />} title="A preset" says="Ready-made looks. Pick one.">
          <div role="radiogroup" aria-label="Presets" className="flex flex-wrap gap-2">
            {PRESETS.map((each) => (
              <label
                key={each.id}
                className={`relative inline-flex h-8 cursor-pointer items-center rounded-md border border-border px-3 text-[13px] text-foreground-secondary hover:border-border-hover has-[:checked]:border-foreground/40 has-[:checked]:bg-surface-elevated has-[:checked]:text-foreground group-disabled:cursor-default ${CHIP_RING}`}
              >
                <input type="radio" name="preset" value={each.id} checked={picking.preset === each.id} onChange={() => set({ preset: each.id })} className="sr-only" />
                {each.name}
              </label>
            ))}
          </div>
          {preset ? <p role="status" className={SMALL}>{preset.description}</p> : null}
        </Row>

        <Row {...row("words")} sample={<Sample show="quote" />} title="In your words" says="Say it the way you would to an editor.">
          <textarea
            rows={2} maxLength={MOST_WORDS}
            aria-label="The look in your words" placeholder="fast cuts, big yellow captions, zoom when I make a point"
            value={picking.words}
            onChange={(event) => set({ words: event.target.value })}
            className={`${FIELD} block w-full resize-none py-2 leading-5`}
          />
          {hint ? <p role="status" className={SMALL}>{hint}</p> : null}
        </Row>
      </fieldset>

      <div className="grid gap-3">
        {working ? (
          <div role="status" data-working className="grid min-h-11 content-center gap-2">
            <p className="text-[14px] leading-5 text-foreground">{working.stage}</p>
            <Bar share={working.share} label="The first cut" />
            {picking.choice === "video" ? <p className="text-[13px] leading-[18px] text-foreground-muted">This takes a minute or two. Your take still plays meanwhile.</p> : null}
          </div>
        ) : (
          <button ref={submit} type="submit" disabled={!can} className="h-11 rounded-md border border-transparent bg-action text-[15px] font-medium text-action-foreground disabled:border-border disabled:bg-transparent disabled:text-foreground-muted">
            Make the first cut
          </button>
        )}
        {problem && !working ? (
          <p role="alert" className={SMALL}>
            {problem}{" "}
            {can ? (
              <button type="submit" className="text-foreground underline underline-offset-4">
                Try again
              </button>
            ) : null}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** One way to say it: its sample, its name and a line, the whole head the radio's label; chosen, its field under it. */
function Row({ chosen, onChoose, sample, title, says, children }: { chosen: boolean; onChoose: () => void; sample: ReactNode; title: string; says: string; children?: ReactNode }) {
  return (
    <div data-chosen={chosen} className={`rounded-lg border ${chosen ? "border-foreground/40" : "border-border hover:border-border-hover"} ${ROW_RING}`}>
      {/* `relative`: the radio is not drawn, and stays in its row as the page scrolls. */}
      <label className="relative flex cursor-pointer items-center gap-3 p-3 group-disabled:cursor-default">
        <input type="radio" name="look" checked={chosen} onChange={onChoose} className="sr-only" />
        {sample}
        <span className="grid min-w-0 gap-0.5">
          <span className="text-[15px] font-medium leading-5 text-foreground">{title}</span>
          <span className={SAYS}>{says}</span>
        </span>
      </label>
      {chosen && children ? <div className="grid gap-2 px-3 pb-3">{children}</div> : null}
    </div>
  );
}
