"use client";

import { useId, type CSSProperties, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { usePushedTitle } from "@/components/result/use-pushed-title";
import { BackIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { AUDIENCE_STRINGS } from "@/lib/audience-next/audience-words";
import { buildRequestOf, DESCRIPTION_MAX, type BuildRequest, type NewDoor } from "@/lib/audience-next/build-request";
import { cn } from "@/lib/utils";

/**
 * New audience (spec 2026-11-25-audience, 3.6; the drawing's New audience frame): a pushed page.
 * Presentational: the door and the field come in; a press hands out the request they make.
 *
 *   ‹  New audience                         desk only: the phone has the shell's Back and title
 *   ( ) Your TikTok account                 one card of three native radio rows
 *       Built from your own videos
 *   ( ) Another creator / ( ) Describe them
 *   [ @yourhandle ]                         the one field: a handle, or three lines of description
 *   [ Build audience ]                      the ink button: a press with no request sends nothing
 *   About two minutes. Free.
 *   Instagram and YouTube can't be read …   TikTok only, quietly, and where the others connect
 *
 * `building` (a read running, or its outcome) replaces the form in place, under the same title.
 */

export interface NewAudienceScreenProps {
  door: NewDoor;
  field: string;
  onDoor(door: NewDoor): void;
  onField(value: string): void;
  /** Build audience, with the request the door and the field make. */
  onSubmit(request: BuildRequest): void;
  /** The field's element, for the container to give it the focus. */
  fieldRef?: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
  /** Replaces the form while a read runs and once it ends. */
  building?: ReactNode;
}

const S = AUDIENCE_STRINGS;

/** Back on a desk goes to the audience page (the phone's is the shell's). */
const BACK_HREF = "/audience";
const CONNECT_HREF = "/you";

/** As an `<h1>` the app-wide `h1` tracking (unlayered) would beat a utility: inline. */
const TITLE_TRACKING: CSSProperties = { letterSpacing: "-0.014em" };

const DOORS: ReadonlyArray<{ key: NewDoor; title: string; line: string }> = [
  { key: "own", title: S.doorOwn, line: S.doorOwnLine },
  { key: "other", title: S.doorOther, line: S.doorOtherLine },
  { key: "describe", title: S.doorDescribe, line: S.doorDescribeLine },
];

/**
 * A native radio drawn as the drawing's: a hairline ring, filled thick when checked. Text fields and
 * radios lose the app's outline on focus (an unlayered rule), so its focus ring is a box-shadow ring.
 */
const RADIO = cn(
  "size-[22px] shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-foreground-muted bg-surface",
  "checked:border-[7px] checked:border-foreground motion-safe:transition-[border-width,border-color] motion-safe:duration-150",
  "focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
);

const FIELD =
  "w-full min-w-0 rounded-2xl bg-surface-sunken px-4 text-title text-foreground placeholder:text-foreground-muted " +
  "motion-safe:transition-[background-color,box-shadow] focus:bg-surface focus:shadow-[var(--shadow-control)]";

/** The ink buttons: full width (their corners are the button's own, radius 10). */
const WIDE = "w-full";

/** The page's frame: the desk's title row over a column of 560. */
function Frame({ children }: { children: ReactNode }) {
  const router = useRouter();
  usePushedTitle(S.newAudience);
  return (
    <div data-testid="new-audience" className="flex w-full flex-1 flex-col">
      {/* On a phone the foot clears the home indicator: the shell keeps no safe area under a pushed page. */}
      <div className="mx-auto flex w-full max-w-[592px] flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] md:pb-12">
        <header className="hidden h-[68px] items-center gap-2.5 md:flex">
          <IconButton aria-label={S.back} onClick={() => router.push(BACK_HREF)}>
            <BackIcon aria-hidden />
          </IconButton>
          <h1 style={TITLE_TRACKING} className="min-w-0 truncate text-title font-[640] text-foreground">
            {S.newAudience}
          </h1>
        </header>
        <div className="pt-3 md:pt-0">{children}</div>
      </div>
    </div>
  );
}

function Doors({ door, onDoor }: { door: NewDoor; onDoor(door: NewDoor): void }) {
  const base = useId();
  return (
    <Card className="overflow-hidden p-0">
      <fieldset>
        <legend className="sr-only">{S.newAudienceLine}</legend>
        <div className="divide-y divide-border">
          {DOORS.map((d) => (
            <label key={d.key} className="flex min-h-[60px] cursor-pointer items-center gap-3.5 px-4 py-3">
              <input
                type="radio"
                name="door"
                value={d.key}
                checked={door === d.key}
                onChange={() => onDoor(d.key)}
                aria-labelledby={`${base}-${d.key}`}
                aria-describedby={`${base}-${d.key}-line`}
                className={RADIO}
              />
              <span className="min-w-0">
                <span id={`${base}-${d.key}`} className="block break-words text-ui font-[620] text-foreground">
                  {d.title}
                </span>
                <span id={`${base}-${d.key}-line`} className="block text-meta text-foreground-secondary">
                  {d.line}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </Card>
  );
}

export function NewAudienceScreen({ door, field, onDoor, onField, onSubmit, fieldRef, building }: NewAudienceScreenProps) {
  const request = buildRequestOf(door, field);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (request) onSubmit(request);
  };

  if (building) return <Frame>{building}</Frame>;

  return (
    <Frame>
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <Doors door={door} onDoor={onDoor} />
        {door === "describe" ? (
          <textarea
            ref={fieldRef}
            name="description"
            rows={3}
            maxLength={DESCRIPTION_MAX}
            value={field}
            onChange={(e) => onField(e.target.value)}
            aria-label={S.describeField}
            placeholder={S.describePlaceholder}
            className={cn(FIELD, "resize-none py-3.5 leading-[22px]")}
          />
        ) : (
          <input
            ref={fieldRef}
            type="text"
            name="handle"
            value={field}
            onChange={(e) => onField(e.target.value)}
            aria-label={door === "own" ? S.ownField : S.otherField}
            placeholder={door === "own" ? S.ownPlaceholder : S.otherPlaceholder}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            className={cn(FIELD, "h-[52px]")}
          />
        )}
        {/* `aria-disabled`, not `disabled`: it stays in the tab order, and a press with no request sends nothing. */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          aria-disabled={request === null || undefined}
          className={cn(WIDE, "aria-disabled:cursor-default aria-disabled:opacity-40")}
        >
          {S.build}
        </Button>
        <p className="text-center text-meta text-foreground-secondary">{S.buildLine}</p>
        <p className="mt-3 px-1 text-meta text-foreground-muted">
          {S.onlyTikTok}{" "}
          <Link href={CONNECT_HREF} className="font-[620] text-foreground-secondary underline-offset-2 hover:underline">
            {S.connectOnYou}
          </Link>
        </p>
      </form>
    </Frame>
  );
}

/** The page while it loads: the title, and the card and the field as quiet blocks. */
export function NewAudienceLoading() {
  return (
    <Frame>
      <div aria-busy="true" className="flex flex-col gap-3">
        <div data-quiet="" className="h-[186px] rounded-3xl bg-surface shadow-[var(--shadow-rest)]" />
        <div data-quiet="" className="h-[52px] rounded-2xl bg-surface-sunken" />
      </div>
    </Frame>
  );
}
