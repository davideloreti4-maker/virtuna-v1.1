/** @vitest-environment happy-dom */

/**
 * The Library's seal keys, held to the thread's (plan 2026-11-23-library).
 *
 * `chat-summary.ts` repeats the thread's key rules because they live inside a client component
 * (`thread-turn-next.tsx`: `rowOf` for a pack row, `openerOf` for a script, `RemixPart` for a remix
 * hook) and are not exported. This renders the REAL thread turn with every seal stored under the key
 * `piecesOf` computes for its card. Each card must then show that seal's number and link to the same
 * result page the Library would build (`textResultHref(thread, sealHashOf(key), as)`). A rule that
 * drifts on either side fails here.
 *
 * Real components and providers throughout (the turn, the cards, `TextSimProvider` holding the seal
 * map as the composer does). The one stand-in is `fetch`, which nothing here should call.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ThreadTurnNext } from "@/components/thread-next/thread-turn-next";
import { TextSimProvider } from "@/components/thread-next/text-sim";
import {
  IDEAS_4,
  IDEA_SHEET,
  MEAL_PREP_HOOKS,
  REMIX_CAMERA,
  SCRIPT_AI,
  hook,
  population,
  remix,
  runHeader,
  script,
} from "@/components/thread-next/__tests__/fixtures/answers";
import { textResultHref } from "@/lib/result/text-result";
import { ThreadIdContext } from "@/lib/save-provenance-context";
import { sealHashOf } from "@/lib/thread-next/seal-hash";
import type { SimSealMap } from "@/lib/threads/sim-seals";
import { piecesOf, type Piece } from "../chat-summary";

const THREAD = "00000000-0000-4000-8000-000000000001";

let fetchCalls = 0;
beforeEach(() => {
  fetchCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      fetchCalls += 1;
      return new Promise<Response>(() => {});
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type TextPiece = Exclude<Piece, { kind: "video" }>;

/** A seal at every piece's key, numbered 11, 12, 13… in piece order. */
function sealsAtKeys(pieces: readonly TextPiece[]): SimSealMap {
  return Object.fromEntries(
    pieces.map((p, i) => [p.key, { pct: 70, band: null, at: "2026-11-21T10:00:00Z", population: population(11 + i) }]),
  );
}

function renderTurn(blocks: unknown[], seals: SimSealMap, threadId: string | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ThreadIdContext.Provider value={threadId}>
        <TextSimProvider seals={seals} onSealed={() => {}}>
          <ThreadTurnNext userTurn="a request" blocks={blocks} />
        </TextSimProvider>
      </ThreadIdContext.Provider>
    </QueryClientProvider>,
  );
}

const resultHrefs = () =>
  screen.queryAllByRole("link", { name: /^Open the result: / }).map((a) => a.getAttribute("href"));

/** Every kind of card the thread draws a gauge on, with the edge cases of each key rule. */
const TURNS: Array<[string, unknown[]]> = [
  ["a hook pack (one line padded with spaces)", [runHeader("hooks"), ...MEAL_PREP_HOOKS, hook("   A padded hook line.  ", { rank: 4 })]],
  // The packs above store `seedHook` equal to the line or title, so they cannot tell the two keys apart.
  // These two can: the card's text and its `seedHook` differ.
  [
    "a hook whose seedHook differs from its line",
    [runHeader("hooks"), hook("The line the card shows.", { seedHook: "The seed line the simulator first reacted to." })],
  ],
  ["an idea pack", [runHeader("ideas"), ...IDEAS_4]],
  // Its own turn: it shares its title with IDEAS_4[1].
  ["an idea whose seedHook differs from its title (IDEA_SHEET)", [runHeader("ideas"), IDEA_SHEET]],
  [
    "scripts: a seed equal to the first beat, a seed that differs from it, and none (the first beat)",
    [runHeader("script"), SCRIPT_AI, script(undefined, { openingBeatSeed: "A seed line that is not the first beat." }), script(undefined, { openingBeatSeed: "" })],
  ],
  // A remix run is one card with a pager (one remix shown at a time), so each remix gets its own turn.
  ["a remix", [runHeader("remix"), REMIX_CAMERA]],
  ["a remix whose hook is padded with spaces", [runHeader("remix"), remix("  Another adapted hook ")]],
];

describe("the Library finds a card's seal under the key the thread looks up", () => {
  for (const [name, blocks] of TURNS) {
    it(`${name}: every card shows the number sealed under the Library's key`, () => {
      const all = piecesOf([blocks]);
      expect(all.length).toBeGreaterThan(0);
      expect(all.every((p) => p.kind !== "video" && p.key.length > 0)).toBe(true);
      const pieces = all as TextPiece[];
      renderTurn(blocks, sealsAtKeys(pieces), null);
      pieces.forEach((_, i) => {
        expect(screen.getByRole("img", { name: `${11 + i}% would stop to watch` })).toBeInTheDocument();
      });
      expect(fetchCalls).toBe(0);
    });

    it(`${name}: every card links to the result page the Library would build`, async () => {
      const pieces = piecesOf([blocks]) as TextPiece[];
      const expected = await Promise.all(pieces.map(async (p) => textResultHref(THREAD, await sealHashOf(p.key), p.as)));
      renderTurn(blocks, sealsAtKeys(pieces), THREAD);
      await waitFor(() => expect(resultHrefs()).toHaveLength(pieces.length));
      expect([...resultHrefs()].sort()).toEqual([...expected].sort());
    });
  }
});
