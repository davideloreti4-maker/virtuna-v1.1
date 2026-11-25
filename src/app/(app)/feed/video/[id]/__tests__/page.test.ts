/**
 * /feed/video/[id] and its loading file under each build of the flag. The flag is a build-time
 * constant, so each case loads the files fresh with the flag set the way that build would have it (as
 * Earn's page test does). Stand-ins: the session read and the one read of a library video.
 *
 * - Flag off: the page does not exist (404), and its loading file draws nothing.
 * - Flag on: signed out, nothing; signed in, the video's page with the video read by the id in the
 *   address. A video that is not there is the page's own "gone" state, not a 404. A read that fails
 *   is the page's failure state, and is logged.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

import type { LibraryVideo } from "@/lib/discover-next/video";

vi.setConfig({ testTimeout: 60_000 });

const VIDEO_ID = "0b6f3c1e-8f2a-4c55-9d3e-2a7b1c4d5e6f";

const VIDEO: LibraryVideo = {
  id: VIDEO_ID,
  coverUrl: "https://covers.example/nia.cooks/1.jpg",
  handle: "nia.cooks",
  spokenHook: "I ran an experiment to see if the pool really smells of chlorine",
  niche: "education-science",
  platform: "tiktok",
  views: 25_000_000,
  postedAt: "2020-06-01T12:00:00Z",
  multiplier: 16,
  baselineLabel: "vs their average",
  proven: true,
  extreme: false,
  formats: [],
  videoUrl: "https://videos.example/nia.cooks/1",
  whyItWorks: "The hook sets up a question. The visual answers it.",
  beats: [],
};

let user: { id: string } | null = { id: "acct-nia" };
let read: (id: string) => Promise<LibraryVideo | null>;
const readCalls: string[] = [];

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }));
  vi.doMock("@/lib/discover-next/library-video-read", () => ({
    getLibraryVideo: (id: string) => {
      readCalls.push(id);
      return read(id);
    },
  }));
  const page = await import("../page");
  const loading = await import("../loading");
  const parts = await import("@/components/discover-next/video-next");
  const Page = page.default as (props: { params: Promise<{ id: string }> }) => Promise<unknown>;
  return { Page, metadata: page.metadata, Loading: loading.default as () => unknown, parts };
}

const at = (id: string) => ({ params: Promise.resolve({ id }) });
type Element = ReactElement<{ video?: LibraryVideo | null; failed?: boolean; id?: string }>;

async function thrown(run: () => unknown): Promise<string> {
  try {
    await run();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? error);
  }
  return "nothing thrown";
}

afterEach(() => {
  user = { id: "acct-nia" };
  readCalls.length = 0;
  vi.restoreAllMocks();
  for (const name of ["@/lib/flags/new-look", "@/lib/supabase/server", "@/lib/discover-next/library-video-read"]) vi.doUnmock(name);
  vi.resetModules();
});

describe("/feed/video/[id] with the flag off", () => {
  it("does not exist, and reads nothing", async () => {
    read = async () => VIDEO;
    const { Page } = await load(false);
    expect(await thrown(() => Page(at(VIDEO_ID)))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
    expect(readCalls).toEqual([]);
  });

  it("its loading file draws nothing", async () => {
    const { Loading } = await load(false);
    expect(Loading()).toBeNull();
  });
});

describe("/feed/video/[id] with the flag on", () => {
  it("signed in: the video's page, the video read by the id in the address", async () => {
    read = async () => VIDEO;
    const { Page, parts, metadata } = await load(true);
    const element = (await Page(at(VIDEO_ID))) as Element;
    expect(isValidElement(element) && element.type).toBe(parts.VideoNext);
    expect(element.props.video).toBe(VIDEO);
    expect(element.props.failed).toBeFalsy();
    expect(readCalls).toEqual([VIDEO_ID]);
    expect(metadata.title).toBe("Video | Maven");
  });

  it("a video that is not in the library: the page's gone state, not a 404", async () => {
    read = async () => null;
    const { Page, parts } = await load(true);
    const element = (await Page(at("not-a-video"))) as Element;
    expect(element.type).toBe(parts.VideoNext);
    expect(element.props.video).toBeNull();
    expect(element.props.failed).toBeFalsy();
    // The id rides along: a saved row of that video may still open its original.
    expect(element.props.id).toBe("not-a-video");
    expect(readCalls).toEqual(["not-a-video"]);
  });

  it("a read that fails: the page's failure state, logged", async () => {
    const error = new Error("connection reset");
    read = async () => {
      throw error;
    };
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { Page, parts } = await load(true);
    const element = (await Page(at(VIDEO_ID))) as Element;
    expect(element.type).toBe(parts.VideoNext);
    expect(element.props.video).toBeNull();
    expect(element.props.failed).toBe(true);
    expect(logged).toHaveBeenCalledWith("[discover] video read failed", error);
  });

  it("signed out: nothing, and nothing read (the layout and the middleware send the visitor to log in)", async () => {
    user = null;
    read = async () => VIDEO;
    const { Page } = await load(true);
    expect(await Page(at(VIDEO_ID))).toBeNull();
    expect(readCalls).toEqual([]);
  });

  it("its loading file is the page's own outline", async () => {
    const { Loading, parts } = await load(true);
    const element = Loading() as ReactElement;
    expect(isValidElement(element) && element.type).toBe(parts.VideoNextLoading);
  });
});
