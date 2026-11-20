/**
 * The orphan cleanup of POST /api/analyze: which uploaded files it may delete.
 *
 * The store below is a small working stand-in for the two things the cleanup talks to (the
 * `analysis_results` table and the `videos` bucket). It filters rows by the columns it is asked
 * for and really removes objects, so a test fails when the code asks the wrong question.
 */

import { describe, it, expect } from "vitest";
import { removeOrphanUpload } from "../upload-cleanup";

interface StoredRun {
  id: string;
  user_id: string;
  video_storage_path: string | null;
}

function makeStore(opts: {
  objects: string[];
  runs?: StoredRun[];
  queryError?: string;
  queryThrows?: boolean;
  queryHangs?: boolean;
  removeError?: string;
}) {
  const objects = new Set(opts.objects);
  const runs = opts.runs ?? [];
  const queries: Array<Record<string, unknown>> = [];
  const warnings: string[] = [];

  const service = {
    from(table: string) {
      if (table !== "analysis_results") throw new Error(`unexpected table ${table}`);
      const filters: Record<string, unknown> = {};
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return query;
        },
        limit: async (n: number) => {
          queries.push({ ...filters });
          if (opts.queryThrows) throw new Error("network down");
          if (opts.queryHangs) return new Promise<never>(() => {});
          if (opts.queryError) return { data: null, error: { message: opts.queryError } };
          const hits = runs.filter((run) =>
            Object.entries(filters).every(([column, value]) => run[column as keyof StoredRun] === value)
          );
          return { data: hits.slice(0, n).map((run) => ({ id: run.id })), error: null };
        },
      };
      return query;
    },
    storage: {
      from(bucket: string) {
        if (bucket !== "videos") throw new Error(`unexpected bucket ${bucket}`);
        return {
          remove: async (paths: string[]) => {
            if (opts.removeError) return { data: null, error: { message: opts.removeError } };
            for (const path of paths) objects.delete(path);
            return { data: [], error: null };
          },
        };
      },
    },
  };

  const log = { warn: (event: string) => void warnings.push(event) };
  return {
    // The stand-in implements the calls the cleanup makes, not the whole Supabase client.
    service: service as unknown as Parameters<typeof removeOrphanUpload>[0],
    log,
    objects,
    queries,
    warnings,
  };
}

describe("removeOrphanUpload", () => {
  it("removes the caller's upload when no stored run plays from it", async () => {
    const store = makeStore({ objects: ["user-1/fresh.mp4"] });

    const outcome = await removeOrphanUpload(store.service, {
      path: "user-1/fresh.mp4",
      userId: "user-1",
      log: store.log,
    });

    expect(outcome).toBe("removed");
    expect(store.objects.has("user-1/fresh.mp4")).toBe(false);
  });

  it("keeps a file that a stored run plays from", async () => {
    const store = makeStore({
      objects: ["user-1/stored.mp4"],
      runs: [{ id: "run-a", user_id: "user-1", video_storage_path: "user-1/stored.mp4" }],
    });

    const outcome = await removeOrphanUpload(store.service, {
      path: "user-1/stored.mp4",
      userId: "user-1",
      log: store.log,
    });

    expect(outcome).toBe("kept-referenced");
    expect(store.objects.has("user-1/stored.mp4")).toBe(true);
  });

  it("is not held back by the caller's other runs, which play from other files", async () => {
    const store = makeStore({
      objects: ["user-1/fresh.mp4", "user-1/other.mp4"],
      runs: [
        { id: "run-a", user_id: "user-1", video_storage_path: "user-1/other.mp4" },
        { id: "run-b", user_id: "user-1", video_storage_path: null },
      ],
    });

    const outcome = await removeOrphanUpload(store.service, {
      path: "user-1/fresh.mp4",
      userId: "user-1",
      log: store.log,
    });

    expect(outcome).toBe("removed");
    expect([...store.objects]).toEqual(["user-1/other.mp4"]);
  });

  it("never touches a file in another account's folder, and does not even look it up", async () => {
    const store = makeStore({ objects: ["user-2/theirs.mp4"] });

    const outcome = await removeOrphanUpload(store.service, {
      path: "user-2/theirs.mp4",
      userId: "user-1",
      log: store.log,
    });

    expect(outcome).toBe("kept-not-owned");
    expect(store.objects.has("user-2/theirs.mp4")).toBe(true);
    expect(store.queries).toHaveLength(0);
    expect(store.warnings).toContain("storage_cleanup_refused_not_owned");
  });

  it("keeps the file when it cannot find out whether a run plays from it", async () => {
    const store = makeStore({ objects: ["user-1/stored.mp4"], queryError: "timeout" });

    const outcome = await removeOrphanUpload(store.service, {
      path: "user-1/stored.mp4",
      userId: "user-1",
      log: store.log,
    });

    expect(outcome).toBe("kept-check-failed");
    expect(store.objects.has("user-1/stored.mp4")).toBe(true);
    expect(store.warnings).toContain("storage_cleanup_check_failed");
  });

  it("keeps the file and does not throw when the lookup itself throws", async () => {
    const store = makeStore({ objects: ["user-1/stored.mp4"], queryThrows: true });

    const outcome = await removeOrphanUpload(store.service, {
      path: "user-1/stored.mp4",
      userId: "user-1",
      log: store.log,
    });

    expect(outcome).toBe("kept-check-failed");
    expect(store.objects.has("user-1/stored.mp4")).toBe(true);
  });

  it("reports a failed delete instead of throwing", async () => {
    const store = makeStore({ objects: ["user-1/fresh.mp4"], removeError: "bucket offline" });

    const outcome = await removeOrphanUpload(store.service, {
      path: "user-1/fresh.mp4",
      userId: "user-1",
      log: store.log,
    });

    expect(outcome).toBe("remove-failed");
    expect(store.warnings).toContain("storage_cleanup_failed");
  });

  it("gives up on a lookup that never answers, and keeps the file", async () => {
    const store = makeStore({ objects: ["user-1/fresh.mp4"], queryHangs: true });

    const outcome = await removeOrphanUpload(
      store.service,
      { path: "user-1/fresh.mp4", userId: "user-1", log: store.log },
      { timeoutMs: 20 }
    );

    expect(outcome).toBe("timed-out");
    expect(store.objects.has("user-1/fresh.mp4")).toBe(true);
    expect(store.warnings).toContain("storage_cleanup_timed_out");
  });

  it("asks for runs of this caller that play from exactly this file", async () => {
    const store = makeStore({ objects: ["user-1/fresh.mp4"] });

    await removeOrphanUpload(store.service, {
      path: "user-1/fresh.mp4",
      userId: "user-1",
      log: store.log,
    });

    expect(store.queries).toEqual([
      { user_id: "user-1", video_storage_path: "user-1/fresh.mp4" },
    ]);
  });
});
