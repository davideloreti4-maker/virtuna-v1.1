/**
 * /library/[projectId] under each build of the flag (plan 2026-11-23-library, Task 4 fix round 1,
 * item 6). Folders are not shown under the new look: a link to one goes to Library (as /saved
 * does). Flag off: the folder, exactly as before. The flag is a build-time constant, so each case
 * loads the page fresh; the session read is the one stand-in.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

vi.setConfig({ testTimeout: 60_000 });

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) } }),
  }));
  const page = await import("../page");
  const parts = {
    PageShell: (await import("@/components/surfaces/surface-header")).PageShell,
    ProjectDetail: (await import("@/components/saved/project-detail")).ProjectDetail,
  };
  return { Page: page.default, metadata: page.metadata, parts };
}

const params = (projectId: string) => ({ params: Promise.resolve({ projectId }) });

/** What Next throws for redirect(): an error whose digest names the target. */
async function thrown(run: () => unknown): Promise<string> {
  try {
    await run();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? error);
  }
  return "nothing thrown";
}

type Element = ReactElement<{ children?: unknown; className?: string; projectId?: string }>;
const childOf = (element: Element) => element.props.children as Element;

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.doUnmock("@/lib/supabase/server");
  vi.resetModules();
});

describe("/library/[projectId]", () => {
  it("flag on: goes to Library (folders are not shown under the new look)", async () => {
    const { Page } = await load(true);
    expect(await thrown(() => Page(params("p-1")))).toMatch(/^NEXT_REDIRECT;\w+;\/library;/);
  });

  it("flag off: the folder in its column, as before", async () => {
    const { Page, metadata, parts } = await load(false);
    const element = (await Page(params("p-1"))) as Element;
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe("div");
    expect(element.props.className).toBe("relative min-h-full text-foreground");
    const shell = childOf(element);
    expect(shell.type).toBe(parts.PageShell);
    expect(childOf(shell).type).toBe(parts.ProjectDetail);
    expect(childOf(shell).props.projectId).toBe("p-1");
    expect(metadata.title).toBe("Project | Maven");
  });
});
