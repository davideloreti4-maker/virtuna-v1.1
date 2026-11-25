/**
 * Film.tsx — the film: an edit, drawn.
 *
 * The runs of footage follow one another in a transition series. Everything else lies over them,
 * placed on the film by the edit's own functions, and is drawn once the typefaces are in. The same component is the preview in the app and the
 * picture the renderer posts, so what is seen is what is posted.
 */
import { TransitionSeries, linearTiming, type TransitionPresentation } from "@remotion/transitions";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { fade } from "@remotion/transitions/fade";
import { iris } from "@remotion/transitions/iris";
import { pushCut } from "@remotion/transitions/push-cut";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Sequence, useRemotionEnvironment, useVideoConfig } from "remotion";
import { assetOf, captionFrames, fontsOf, layout, lookOf, placed, runWords, sharedAfter, type Cut, type PartId } from "../../lib/edit";
import { Captions } from "./Captions";
import { Footage } from "./Footage";
import { pagesFor } from "./pages";
import { SET_AS, useFonts } from "./fonts";
import { PreviewContext, useCanGrade } from "./grading";
import { gradeOf } from "./looks";
import { KIT, LAYERS, type Layer, type PartProps } from "./parts";
import { addressOf, type FilmProps } from "./props";

type Presentation = TransitionPresentation<Record<string, unknown>>;

/**
 * The film's own ground. It takes nothing from the page it is shown on: everything a page hands
 * down to what is inside it (how letters are smoothed, spaced, cased and aligned, their colour and
 * size) starts again here, so the film is drawn the same in the app and in the renderer. Found
 * 2026-11-19: the app smooths its letters thin, the renderer's page did not, and every letter of
 * the film was 7 % fuller in the posted file than in the preview. Thin is set here for both: it
 * is how the posted file's letters are drawn where films are rendered, and on a phone.
 * `all` comes first: what follows it is the film's own.
 *
 * A page also sets some things on every element by name, which no start-again at the root undoes.
 * The app does: every box there counts its padding into its width, and in the renderer's page
 * none does. `BOXES` says it for the film's own elements, the same in both.
 *
 * Its letters are set as the kit measures them (`SET_AS`, X94): no ligatures, no contextual
 * alternates, the optical size held at its top. Kerning stays as the typeface asks. And they are
 * set in English (`lang` on the root), whatever the page's language, as the server's widths are.
 */
export const OWN: CSSProperties = {
  all: "initial",
  position: "absolute",
  inset: 0,
  display: "block",
  overflow: "hidden",
  direction: "ltr",
  backgroundColor: "#000000",
  WebkitTextSizeAdjust: "100%", // a phone held sideways does not make the film's letters larger on its own
  textSizeAdjust: "100%",
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
  ...SET_AS,
};
const BOXES = "[data-edit-film] *, [data-edit-film] *::before, [data-edit-film] *::after { box-sizing: border-box; }";

/** The engine's transition for one of the edit's cuts. A plain cut has none. */
function presentationOf(cut: Exclude<Cut, { kind: "cut" }>, width: number, height: number): Presentation {
  switch (cut.kind) {
    case "fade":
      return fade() as unknown as Presentation;
    case "push":
      return slide({ direction: `from-${cut.from}` }) as unknown as Presentation;
    case "wipe":
      return wipe({ direction: `from-${cut.from}` }) as unknown as Presentation;
    case "punch":
      return pushCut() as unknown as Presentation;
    case "iris":
      return iris({ width, height }) as unknown as Presentation;
    case "clock":
      return clockWipe({ width, height }) as unknown as Presentation;
  }
}

/**
 * Everything that lies over the footage, in the order it is drawn: every mark and item where the
 * edit's own functions place it, and each run's captions. By layer from the back, then by first
 * frame, then by id. A run's captions stop where a transition out of it begins, so two runs'
 * words are never on screen at once.
 */
function overlays(props: FilmProps): ReactNode[] {
  const { edit } = props;
  const lay = layout(edit);
  const things = placed(edit).map((place) => {
    const { thing } = place;
    const asset = "asset" in thing ? assetOf(edit, thing.asset) : undefined;
    const Part = KIT[thing.part].Component as React.FC<PartProps<PartId>>;
    const node = (
      <Sequence key={thing.id} from={place.at} durationInFrames={place.frames} name={`${thing.part} ${thing.id}`}>
        <Part settings={thing.props} at={place.at} frames={place.frames} skip={place.skip} toEnd={place.at + place.frames >= lay.frames} src={asset ? addressOf(props, asset) : null} kind={asset?.kind ?? null} fileMs={place.fileMs} />
      </Sequence>
    );
    return { layer: KIT[thing.part].layer as Layer, at: place.at, id: thing.id, node };
  });
  const captions = !edit.captions.on ? [] : lay.runs.map((run, r) => {
    const pages = pagesFor(edit.captions, runWords(edit, run), run.frames);
    const shown = captionFrames(edit, lay, r); // up to where a transition out of the run begins
    const node = (
      <Sequence key={`captions ${run.first}`} from={shown.at} durationInFrames={shown.frames} name="captions">
        <Captions settings={edit.captions} pages={pages} />
      </Sequence>
    );
    return { layer: "captions" as Layer, at: run.at, id: `captions ${run.first}`, node };
  });
  return [...things, ...captions]
    .sort((a, b) => LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer) || a.at - b.at || a.id.localeCompare(b.id))
    .map((drawn) => drawn.node);
}

export const Film: React.FC<FilmProps> = (props) => {
  const { edit } = props;
  const lay = useMemo(() => layout(edit), [edit]);
  const fonts = useMemo(() => fontsOf(edit), [edit]);
  const { width, height } = useVideoConfig();
  const lettered = useFonts(props.kit, fonts);
  const over = useMemo(() => overlays(props), [props]);

  // The renderer always runs the colour pass. A preview runs it where the browser can, and until it fails there.
  const { isRendering } = useRemotionEnvironment();
  const able = useCanGrade();
  const [lost, setLost] = useState(false);
  const exact = isRendering || (able && !lost);
  const preview = useContext(PreviewContext);
  const approximate = !exact && edit.shots.some((shot) => gradeOf(lookOf(edit, shot)) !== null);
  useEffect(() => {
    if (approximate) preview?.onApproximateColour();
  }, [approximate, preview]);

  return (
    <div style={OWN} lang="en" data-edit-film="">
      <style>{BOXES}</style>
      <TransitionSeries>
        {lay.runs.flatMap((run, r) => {
          const out = edit.shots[run.last]?.out;
          const footage = (
            <TransitionSeries.Sequence key={`run-${run.first}`} durationInFrames={run.frames}>
              <Footage props={props} lay={lay} run={run} into={r > 0 ? sharedAfter(edit, lay, r - 1) : 0} outOf={sharedAfter(edit, lay, r)} exact={exact} onLost={() => setLost(true)} />
            </TransitionSeries.Sequence>
          );
          if (!out || out.kind === "cut" || r === lay.runs.length - 1) return [footage];
          return [footage, <TransitionSeries.Transition key={`cut-${run.last}`} presentation={presentationOf(out, width, height)} timing={linearTiming({ durationInFrames: out.frames })} />];
        })}
      </TransitionSeries>
      {lettered ? over : null}
    </div>
  );
};
