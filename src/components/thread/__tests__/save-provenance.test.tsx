/** @vitest-environment happy-dom */
/**
 * save-provenance.test.tsx — a save must record WHERE it came from.
 *
 * Why this test exists: `saved_items` has carried `ref_id` and `thread_id` since P10, and
 * <SaveAffordance> has always accepted both as props — but no renderer passed them, so all ten live
 * saved rows are orphans with no route back to the thread that produced them. Nothing failed,
 * because nothing asserted the PAYLOAD; the columns simply stayed null.
 *
 * So these assertions are on the mutation input, not on the DOM. A card that renders a Save button
 * perfectly and posts a null ref is the exact bug we are fixing, and it is invisible to any test
 * that only checks the button exists.
 *
 * Renders through the real <MessageBlocks> so the seam under test is the production path: the
 * uniform `<Component block={block} />` dispatch that made prop-passing impossible in the first place.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageBlocks } from "../message-blocks";
import { ThreadIdContext } from "@/lib/save-provenance-context";
import type { BlockOrigin } from "@/components/app/home/rehydrate-thread";

const mutate = vi.fn();
const removeMutate = vi.fn();

// SaveAffordance now also reads saved state from the store (it used to derive it from this
// mutation's own isSuccess flag), so the mock has to cover the whole surface it consumes.
// `useSavedItemByRef` returning no item is the "not saved yet" case these tests are about.
vi.mock("@/hooks/queries/use-saved-items", () => ({
  useSaveItem: () => ({ mutate, isPending: false, isSuccess: false }),
  useDeleteSavedItem: () => ({ mutate: removeMutate, isPending: false }),
  useSavedItemByRef: () => ({ item: undefined, ready: true }),
}));

/** A hook card — one of the eleven renderers that mounts <SaveAffordance>. */
const hookBlock = (hookLine: string) => ({
  type: "hook-card",
  props: {
    hookLine,
    audienceArchetype: "Contrarian",
    mechanism: "withholds the payoff",
    seedHook: hookLine,
    rank: 1,
    band: "Strong",
    fraction: "7/10",
    scrollQuote: "the pace held me",
    model: "sim1-flash",
    scored: true,
    channel: "tiktok",
  },
});

const origins = (...o: BlockOrigin[]) => o;

function renderInThread(
  body: unknown[],
  opts: { threadId?: string | null; blockOrigins?: (BlockOrigin | null)[] } = {},
) {
  return render(
    <ThreadIdContext.Provider value={opts.threadId ?? null}>
      <MessageBlocks body={body} blockOrigins={opts.blockOrigins} />
    </ThreadIdContext.Provider>,
  );
}

/** Click the first Save affordance rendered and return the input it posted. */
function clickSaveAndReadInput(): Record<string, unknown> {
  const button = screen.getAllByLabelText("Save to shelf")[0];
  expect(button).toBeTruthy();
  fireEvent.click(button!);
  expect(mutate).toHaveBeenCalledTimes(1);
  return mutate.mock.calls[0]![0] as Record<string, unknown>;
}

beforeEach(() => mutate.mockClear());

describe("a save records its origin", () => {
  it("posts the thread id and a `${messageId}:${index}` ref", () => {
    renderInThread([hookBlock("Nobody tells you the first 10k are the easy part.")], {
      threadId: "thread-abc",
      blockOrigins: origins({ messageId: "msg-1", index: 0 }),
    });

    const input = clickSaveAndReadInput();
    expect(input.thread_id).toBe("thread-abc");
    expect(input.ref_id).toBe("msg-1:0");
  });

  it("gives two cards from the SAME message distinct refs", () => {
    // The dedup key depends on this: a five-hook run persists five blocks in ONE message body, so a
    // ref built from the message id alone would collide across all five.
    renderInThread([hookBlock("first"), hookBlock("second")], {
      threadId: "t",
      blockOrigins: origins({ messageId: "msg-1", index: 0 }, { messageId: "msg-1", index: 1 }),
    });

    const buttons = screen.getAllByLabelText("Save to shelf");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]!);
    expect((mutate.mock.calls[0]![0] as Record<string, unknown>).ref_id).toBe("msg-1:1");
  });

  it("posts a null ref — never a wrong one — when the block is not yet persisted", () => {
    // A live run's blocks have no message row until the run settles. Null is the honest answer.
    renderInThread([hookBlock("streaming")], {
      threadId: "thread-abc",
      blockOrigins: origins({ messageId: null, index: 0 }),
    });

    const input = clickSaveAndReadInput();
    expect(input.ref_id).toBeNull();
    expect(input.thread_id).toBe("thread-abc");
  });

  it("posts nulls outside a thread, so a gallery save cannot claim someone else's id", () => {
    // /dev/cards renders the same blocks with no thread and no origins.
    renderInThread([hookBlock("gallery fixture")]);

    const input = clickSaveAndReadInput();
    expect(input.ref_id).toBeNull();
    expect(input.thread_id).toBeNull();
  });
});
