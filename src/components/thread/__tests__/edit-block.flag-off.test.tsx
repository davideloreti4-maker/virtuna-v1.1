/** @vitest-environment happy-dom */
/**
 * edit-block.flag-off.test.tsx — an `edit` block with the new look OFF (plan 2026-11-24-editor-screens-a, Task 4): the legacy
 * thread draws nothing for it and reads nothing. The editor exists under the new look only, so there is no door to draw; a
 * chat that holds an edit shows what it showed before, with no "unsupported" note where the card would be. The flag-on half is
 * `src/components/thread-next/__tests__/edit-answer.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { MessageBlocks } from "../message-blocks";

const EDIT = { type: "edit", props: { editId: "55555555-5555-4555-8555-555555555555" } };
const SAID = { type: "markdown", props: { text: "Here is your edit." } };
const UNSUPPORTED = '[role="note"][aria-label="Unsupported content block"]';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("an edit block with the new look off", () => {
  it("runs with the flag off", () => {
    expect(NEW_LOOK_ENABLED).toBe(false);
  });

  it("draws the markdown beside it only: the thread is as it would be without the block", () => {
    const without = render(<MessageBlocks body={[SAID]} />).container.innerHTML;
    cleanup();
    const { container } = render(<MessageBlocks body={[SAID, EDIT]} />);
    expect(container.textContent).toBe("Here is your edit.");
    expect(container.innerHTML).toBe(without);
    expect(container.querySelector(UNSUPPORTED)).toBeNull();
  });

  it("alone, draws an empty container and no unsupported note", () => {
    const { container } = render(<MessageBlocks body={[EDIT]} />);
    expect(container.childElementCount).toBe(1);
    expect(container.firstElementChild?.childNodes.length).toBe(0);
    expect(container.querySelector(UNSUPPORTED)).toBeNull();
    expect(container.querySelector("a")).toBeNull();
  });

  it("does draw the note for a block it does not know, so its absence above is the edit block's doing", () => {
    const { container } = render(<MessageBlocks body={[{ type: "no-such-block", props: {} }]} />);
    expect(container.querySelector(UNSUPPORTED)).not.toBeNull();
    // An edit block whose id is not one is refused like any other bad block.
    cleanup();
    const bad = render(<MessageBlocks body={[{ type: "edit", props: { editId: "not-an-id" } }]} />);
    expect(bad.container.querySelector(UNSUPPORTED)).not.toBeNull();
  });

  it("reads nothing: no call for the edit goes out", () => {
    const fetched = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetched);
    render(<MessageBlocks body={[SAID, EDIT]} />);
    expect(fetched).not.toHaveBeenCalled();
  });
});
