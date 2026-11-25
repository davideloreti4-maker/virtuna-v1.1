/**
 * root.tsx — the entry the renderer bundles. Scripts and tests use it; the app never imports it.
 *
 * The film's length and size come from the edit it is given, so there is one composition for
 * every edit.
 */
import { Composition, registerRoot } from "remotion";
import { Film } from "./Film";
import { FilmPropsSchema, filmSize, type FilmProps } from "./props";

const Root: React.FC = () => (
  <Composition
    id="film"
    component={Film}
    durationInFrames={1}
    fps={30}
    width={1080}
    height={1920}
    // A film is always rendered with an edit handed to it; there is none to fall back on.
    defaultProps={undefined as unknown as FilmProps}
    calculateMetadata={({ props }) => filmSize(FilmPropsSchema.parse(props).edit)}
  />
);

registerRoot(Root);
