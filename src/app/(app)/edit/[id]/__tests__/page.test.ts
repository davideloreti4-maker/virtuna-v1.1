/**
 * /edit/[id] under each build of the flag (plan 2026-11-24-editor-screens-a, Task 15): a 404 with it off, the editor with it on,
 * mounted anew for another edit (ruling R20: the page's state is one edit's).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

vi.setConfig({ testTimeout: 60_000 });

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  const page = await import("../page");
  return { Page: page.default, metadata: page.metadata, EditorScreen: (await import("@/components/editor/editor-screen")).EditorScreen };
}
const ID = "55555555-5555-4555-8555-555555555555";
const params = (id: string) => ({ params: Promise.resolve({ id }) });

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.resetModules();
});

describe("/edit/[id]", () => {
  it("does not exist with the flag off", async () => {
    const { Page } = await load(false);
    const thrown = await Page(params(ID)).then(() => "nothing thrown", (error: { digest?: string }) => String(error.digest ?? error));
    expect(thrown).toContain("404");
  });

  it("is the editor of that edit with the flag on", async () => {
    const { Page, EditorScreen, metadata } = await load(true);
    const element = (await Page(params(ID))) as ReactElement<{ id: string }>;
    expect(isValidElement(element) && element.type).toBe(EditorScreen);
    expect(element.props.id).toBe(ID);
    expect(metadata.title).toBe("Edit | Maven");
  });

  it("mounts the editor anew for another edit", async () => {
    const { Page } = await load(true);
    const other = "66666666-6666-4666-8666-666666666666";
    const [one, two] = (await Promise.all([Page(params(ID)), Page(params(other))])) as ReactElement[];
    expect(one!.key).toBe(ID);
    expect(two!.key).toBe(other);
  });
});
