import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Discover's new-look parts follow Library's rules (library-next-guard.test.ts, same method), with
// the differences Discover needs:
//   1. Tokens only. No colour literal (hex, rgb(), hsl(), oklch()) and no Tailwind palette name,
//      except in `cover-look.ts`: text and badges drawn over a video's cover must read on a photo in
//      both themes, so their colours are fixed, and they live there, inside `COVER_LOOK` only.
//   2. No glass anywhere: Discover is a page; nothing filters a backdrop, as a class or inline.
//   3. The presentational parts send nothing: no `fetch`, no `/api/` address, no query or
//      mutation hook, nothing from `@/hooks/queries` or `@/app/actions`. Only the containers
//      (`*-next.tsx`, `use-*.ts`) reach the server.
//   4. The containers reach it only through what Discover is allowed: of `@/hooks/queries`,
//      `use-saved-items`, `use-channels` and `use-audience-next` (the creator's page chooses their
//      audience for new chats); of the old Discover, only `use-remix-launch`; of the
//      server actions, only `competitors/remove`; nothing else from the old Discover, channel,
//      competitor or feed folders. A `fetch` and an `/api/` address only in `use-pull.ts`, and
//      there only `/api/discover` (the paid pull, one request, one place to read it).
//   5. The three server reads (`library-video-read`, `watchlist-reads`, `creator-read`) only as
//      `import type`: a run-time import would pull a service client into the browser bundle.
// An import is read by where it leads: a relative path into a guarded folder counts as its `@/` form.
// A colour literal is a hex, a colour function, or a colour named in an inline style.
// The rules cover every file of the folder, so the parts added later are held to them too.
// PURE FS test (default `node` env).
// ─────────────────────────────────────────────────────────────────────────────

const DIR = join(__dirname, "..");
/** `src/`, what `@/` stands for. */
const SRC = resolve(DIR, "..", "..");

const FILES = readdirSync(DIR, { withFileTypes: true })
  .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
  .map((e) => e.name);

/** The one file allowed colour literals, and the one object it may hold them in. */
const COLOURS = "cover-look.ts";

/** A container reads data; every other file is presentational. */
const isContainer = (file: string) => /-next\.tsx$/.test(file) || /^use-.*\.ts$/.test(file);
const CONTAINERS = FILES.filter(isContainer);
const PARTS = FILES.filter((file) => !isContainer(file));

/** The one file that may call `fetch`, and the one address it may call. */
const PULL = "use-pull.ts";
const PULL_ROUTE = "/api/discover";

/** Source with comments removed, so prose like "#559" or "rgba" in a comment cannot trip it. */
function code(file: string): string {
  return readFileSync(join(DIR, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** A module as `@/…` when it leads into `src/` (a relative path is resolved from this folder); else as written. */
function aliasOf(module: string): string {
  if (!module.startsWith(".")) return module;
  const inSrc = relative(SRC, resolve(DIR, module)).split("\\").join("/");
  return inSrc.startsWith("..") ? module : `@/${inSrc}`;
}

/** Every module a source imports at run time or as a type: `import … from`, `export … from`, `import()`, `import "…"`. */
function importsOf(src: string): Array<{ module: string; typeOnly: boolean }> {
  const found: Array<{ module: string; typeOnly: boolean }> = [];
  for (const m of src.matchAll(/\b(import|export)\s+(type\s+)?(?:[^'"`;]*?\s+from\s*)?['"`]([^'"`]+)['"`]/g)) {
    found.push({ module: aliasOf(m[3]!), typeOnly: Boolean(m[2]) });
  }
  for (const m of src.matchAll(/\bimport\s*\(\s*['"`]([^'"`]+)['"`]/g)) found.push({ module: aliasOf(m[1]!), typeOnly: false });
  return found;
}
const modulesOf = (src: string) => importsOf(src).map((i) => i.module);

/** Rule 4: what a container may take from the guarded folders. */
const ALLOWED = [
  "@/hooks/queries/use-saved-items",
  "@/hooks/queries/use-channels",
  "@/hooks/queries/use-audience-next",
  "@/components/discover/use-remix-launch",
  "@/app/actions/competitors/remove",
];
const GUARDED = /^@\/(?:hooks\/queries|components\/(?:discover|channels|competitors|feed)|app\/actions)(?:\/|$)/;
const refusedModules = (src: string) => modulesOf(src).filter((module) => GUARDED.test(module) && !ALLOWED.includes(module));

/** Rule 3: what a presentational part may not import at all (the data hooks, the server actions). */
const SENDING_MODULES = /^@\/(?:hooks\/queries|app\/actions)(?:\/|$)/;
const sendingModules = (src: string) => modulesOf(src).filter((module) => SENDING_MODULES.test(module));

/** Rule 5: the server reads, as a run-time import (a type-only import passes). */
const SERVER_READS = ["@/lib/discover-next/library-video-read", "@/lib/discover/watchlist-reads", "@/lib/discover/creator-read"];
const runtimeServerReads = (src: string) =>
  importsOf(src)
    .filter((i) => SERVER_READS.includes(i.module) && !i.typeOnly)
    .map((i) => i.module);

/** Any Tailwind backdrop utility, or an arbitrary `[backdrop-…]` property. */
const BLUR_CLASS = /\bbackdrop-|\[backdrop/;
const GLASS = /backdrop-?filter/i;

const PALETTE = [
  "white", "black", "slate", "gray", "zinc", "neutral", "stone", "mauve", "olive", "mist", "taupe",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue",
  "indigo", "violet", "purple", "fuchsia", "pink", "rose",
].join("|");
const COLOUR_UTILITY =
  "text|bg|from|via|to|border(?:-[xytrblse])?|ring(?:-offset)?|inset-ring|outline|divide|fill|stroke|" +
  "shadow|inset-shadow|drop-shadow|decoration|caret|accent|placeholder";
const PALETTE_CLASS = new RegExp(`\\b(?:${COLOUR_UTILITY})-(?:(?:${PALETTE})\\b|\\[(?:color:)?(?:${PALETTE})\\])`, "g");
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color-mix)\(/g;

/** A colour named in an inline style or a style string (`color: "white"`, `background: 'black'`,
 *  `borderColor: "rebeccapurple"`). `transparent`, `currentColor` and `inherit` are not colours and pass. */
const NAMED_COLOURS = [
  "white", "black", "red", "green", "blue", "yellow", "orange", "purple", "pink", "brown", "gray", "grey",
  "silver", "gold", "maroon", "navy", "teal", "olive", "lime", "aqua", "cyan", "magenta", "fuchsia",
  "indigo", "violet", "crimson", "coral", "salmon", "tomato", "khaki", "beige", "ivory", "tan", "plum",
  "orchid", "turquoise", "chocolate", "rebeccapurple", "whitesmoke", "snow", "slategray", "slategrey",
  "darkgray", "darkgrey", "lightgray", "lightgrey", "dimgray", "dimgrey",
].join("|");
const STYLE_KEYS =
  "color|background|backgroundColor|borderColor|border|outline|outlineColor|fill|stroke|boxShadow|textShadow|caretColor|accentColor|textDecorationColor";
const NAMED_IN_STYLE = new RegExp(`\\b(?:${STYLE_KEYS})\\s*:\\s*['"\`][^'"\`]*\\b(?:${NAMED_COLOURS})\\b`, "gi");

/** What a part that sends a request would carry. */
const SENDS = /\bfetch\s*\(|['"`]\/api\/|\buse(?:Query|Mutation|InfiniteQuery)\b|@\/hooks\/queries/;
const FETCH = /\bfetch\s*\(/;
const API_ADDRESS = /['"`](\/api\/[^'"`]*)['"`]/g;

describe("the guard itself", () => {
  it.each(["backdrop-blur-xl", "md:backdrop-saturate-150", "[backdrop-filter:blur(4px)]"])("refuses the class %s", (sample) => {
    expect(BLUR_CLASS.test(`className="rounded-4xl ${sample}"`)).toBe(true);
  });

  it.each(["text-white", "bg-black", "from-black/60", "md:bg-zinc-900", "ring-white/30", "bg-[white]", "text-[color:black]"])(
    "refuses the palette colour %s",
    (sample) => {
      expect(`className="h-6 ${sample}"`.match(PALETTE_CLASS)).not.toBeNull();
    },
  );

  it.each(["text-foreground", "bg-surface-sunken", "text-action-foreground", "to-transparent", "shadow-[var(--shadow-float)]"])(
    "lets the token %s through",
    (sample) => {
      expect(`className="${sample}"`.match(PALETTE_CLASS)).toBeNull();
    },
  );

  it.each(["#fff", "#121211cc", "rgba(0, 0, 0, 0.8)", "rgb(1 2 3)", "hsl(0 0% 0%)", "oklch(0.2 0 0)", "lab(20% 0 0)", "color-mix(in srgb, red, blue)"])(
    "refuses the literal %s",
    (sample) => {
      expect(sample.match(COLOUR_LITERAL)).not.toBeNull();
    },
  );

  it.each([
    'style={{ color: "white" }}',
    "style={{ background: 'black' }}",
    'style={{ backgroundColor: "Red" }}',
    'style={{ borderColor: "rebeccapurple" }}',
    'style={{ border: "1px solid gray" }}',
    'const look = { boxShadow: "0 0 0 1px white" }',
  ])("refuses a colour named in an inline style: %s", (sample) => {
    expect(sample.match(NAMED_IN_STYLE)).not.toBeNull();
  });

  it.each([
    "style={{ color: COVER_LOOK.ink }}",
    'style={{ background: "transparent" }}',
    'style={{ color: "currentColor" }}',
    'style={{ color: "var(--color-foreground)" }}',
    'style={{ letterSpacing: "-0.035em" }}',
    'aria-label="Watch the original"',
  ])("lets through: %s", (sample) => {
    expect(sample.match(NAMED_IN_STYLE)).toBeNull();
  });

  it.each(['await fetch("/x")', 'const href = "/api/saved"', "useQuery({ queryKey })", 'import { useSavedItems } from "@/hooks/queries/use-saved-items"'])(
    "a part may not carry %s",
    (sample) => {
      expect(SENDS.test(sample)).toBe(true);
    },
  );

  it.each(['href="/feed/video/a1"', "prefetch={false}", "router.refresh()"])("a part may carry %s", (sample) => {
    expect(SENDS.test(sample)).toBe(false);
  });

  it.each([
    'import { useSaveItem } from "@/hooks/queries/use-saved-items";',
    "import { useAddChannel, useUntrackChannel } from '@/hooks/queries/use-channels';",
    'import { useRemixLaunch } from "@/components/discover/use-remix-launch";',
    'import { removeCompetitor } from "@/app/actions/competitors/remove";',
    'import { useSetDefaultAudience } from "@/hooks/queries/use-audience-next";',
    'import type { CardVideo } from "@/lib/discover-next/hub-data";',
    'import { Chip } from "@/components/ui/chip";',
  ])("a container may import: %s", (sample) => {
    expect(refusedModules(sample)).toEqual([]);
  });

  it.each([
    ['import { useDiscover } from "../../hooks/queries/use-discover";', "@/hooks/queries/use-discover"],
    ['import { DiscoverHub } from "../discover/discover-hub";', "@/components/discover/discover-hub"],
    ['import { addCompetitor } from "../../app/actions/competitors/add";', "@/app/actions/competitors/add"],
    ['import { useThreadList } from "@/hooks/queries";', "@/hooks/queries"],
    ['import { useDiscover } from "@/hooks/queries/use-discover";', "@/hooks/queries/use-discover"],
    ['import { DiscoverHub } from "@/components/discover/discover-hub";', "@/components/discover/discover-hub"],
    ['import { ChannelRow } from "@/components/channels/channel-row";', "@/components/channels/channel-row"],
    ['export { CompetitorTable } from "@/components/competitors/table";', "@/components/competitors/table"],
    ['const m = await import("@/components/feed/feed-card");', "@/components/feed/feed-card"],
    ['import { addCompetitor } from "@/app/actions/competitors/add";', "@/app/actions/competitors/add"],
    ['import "@/app/actions/discover/teardown";', "@/app/actions/discover/teardown"],
  ])("a container may not import: %s", (sample, module) => {
    expect(refusedModules(sample)).toEqual([module]);
  });

  it.each([
    'import { useSaveItem } from "../../hooks/queries/use-saved-items";',
    'import { removeCompetitor } from "../../app/actions/competitors/remove";',
  ])("a container may import by a relative path too: %s", (sample) => {
    expect(refusedModules(sample)).toEqual([]);
  });

  it.each([
    'import { removeCompetitor } from "@/app/actions/competitors/remove";',
    'import { removeCompetitor } from "../../app/actions/competitors/remove";',
    'import { useSaveItem } from "../../hooks/queries/use-saved-items";',
    'import { useChannels } from "@/hooks/queries/use-channels";',
    'import { useSetDefaultAudience } from "@/hooks/queries/use-audience-next";',
  ])("a part may not import a data hook or a server action: %s", (sample) => {
    expect(sendingModules(sample)).toHaveLength(1);
  });

  it.each(['import { Chip } from "@/components/ui/chip";', 'import { VideoCard } from "./video-card";', 'import { cardLine } from "../../lib/discover-next/card";'])(
    "a part may import: %s",
    (sample) => {
      expect(sendingModules(sample)).toEqual([]);
    },
  );

  it.each([
    'import { getLibraryVideo } from "../../lib/discover-next/library-video-read";',
    'import { getLibraryVideo } from "@/lib/discover-next/library-video-read";',
    'import { getWatchlistData, type WatchlistData } from "@/lib/discover/watchlist-reads";',
    'const m = await import("@/lib/discover/watchlist-reads");',
    'import { getCreatorPage } from "@/lib/discover/creator-read";',
  ])("refuses a run-time import of a server read: %s", (sample) => {
    expect(runtimeServerReads(sample)).toHaveLength(1);
  });

  it.each([
    'import type { LibraryVideo } from "@/lib/discover-next/library-video-read";',
    'import type { WatchlistData, WatchlistSource } from "@/lib/discover/watchlist-reads";',
    'import type { getCreatorPage } from "@/lib/discover/creator-read";',
  ])("lets a type-only import of a server read through: %s", (sample) => {
    expect(runtimeServerReads(sample)).toEqual([]);
  });

  it("tells a container from a part by its name", () => {
    expect(["discover-next.tsx", "video-next.tsx", "use-pull.ts", "use-video-save.ts"].every(isContainer)).toBe(true);
    expect(["discover-screen.tsx", "video-card.tsx", "cover-look.ts", "pull-next-loading.tsx", "use-pull.tsx"].some(isContainer)).toBe(false);
  });
});

describe("discover-next: tokens only, no glass, no requests from a part", () => {
  it("finds the parts (guards against a walker that matches nothing)", () => {
    for (const file of [
      "discover-next.tsx",
      "discover-screen.tsx",
      "videos-panel.tsx",
      "video-card.tsx",
      "filter-panel.tsx",
      "order-menu.tsx",
      "discover-icons.tsx",
      COLOURS,
    ]) {
      expect(FILES).toContain(file);
    }
    expect(CONTAINERS).toContain("discover-next.tsx");
    expect(PARTS).toContain("discover-screen.tsx");
    expect(CONTAINERS.length + PARTS.length).toBe(FILES.length);
  });

  it.each(FILES.filter((file) => file !== COLOURS))("%s carries no colour literal, and names no colour in a style", (file) => {
    const src = code(file);
    expect(src.match(COLOUR_LITERAL) ?? []).toEqual([]);
    expect(src.match(NAMED_IN_STYLE) ?? []).toEqual([]);
  });

  it(`${COLOURS} holds its colours in COVER_LOOK only`, () => {
    const src = code(COLOURS);
    const look = /export const COVER_LOOK = \{[\s\S]*?\} as const;/.exec(src);
    expect(look).not.toBeNull();
    expect(look![0].match(COLOUR_LITERAL)?.length ?? 0).toBeGreaterThan(0);
    expect(src.replace(look![0], "").match(COLOUR_LITERAL) ?? []).toEqual([]);
    expect(src.replace(look![0], "").match(NAMED_IN_STYLE) ?? []).toEqual([]);
  });

  it.each(FILES)("%s uses no Tailwind palette colour", (file) => {
    expect(code(file).match(PALETTE_CLASS) ?? []).toEqual([]);
  });

  it.each(FILES)("%s uses no backdrop class and no glass", (file) => {
    const src = code(file);
    expect(src.match(BLUR_CLASS)).toBeNull();
    expect(GLASS.test(src)).toBe(false);
  });

  it.each(PARTS)("%s sends nothing", (file) => {
    const src = code(file);
    expect(src.match(SENDS)).toBeNull();
    expect(sendingModules(src)).toEqual([]);
  });

  it.each(CONTAINERS)("%s takes only what Discover is allowed from the hooks, the old Discover and the actions", (file) => {
    expect(refusedModules(code(file))).toEqual([]);
  });

  it.each(FILES)("%s takes the server reads as types only", (file) => {
    expect(runtimeServerReads(code(file))).toEqual([]);
  });

  it.each(FILES.filter((file) => file !== PULL))("%s calls no fetch and names no /api/ address", (file) => {
    const src = code(file);
    expect(src.match(FETCH)).toBeNull();
    expect([...src.matchAll(API_ADDRESS)].map((m) => m[1])).toEqual([]);
  });

  it(`${PULL}, once it exists, names no address but ${PULL_ROUTE}`, () => {
    if (!existsSync(join(DIR, PULL))) return;
    expect([...code(PULL).matchAll(API_ADDRESS)].map((m) => m[1])).toEqual([PULL_ROUTE]);
  });
});
