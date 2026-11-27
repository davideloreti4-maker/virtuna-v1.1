/**
 * first-build.ts — /start's first audience build, handed to the building screen (`/audience/new?guide=1`).
 *
 * The build is a streamed request the building screen itself must make (it draws the read as it streams), so
 * /start only holds the request, in session storage, and the screen takes it once: taking removes it, so a
 * reload of the building screen shows the form and never starts a second paid read. What is taken is read
 * through `buildRequestOf` again: only the creator's own TikTok account or a description, each by the build's
 * own rules.
 */
import { buildRequestOf, type BuildRequest } from "@/lib/audience-next/build-request";

export const FIRST_BUILD_KEY = "maven.start.build.v1";

export function holdFirstBuild(storage: Pick<Storage, "setItem"> | null, request: BuildRequest): void {
  try {
    storage?.setItem(FIRST_BUILD_KEY, JSON.stringify(request));
  } catch {
    // Blocked: the building screen shows its form, with nothing lost but the head start.
  }
}

export function takeFirstBuild(storage: Pick<Storage, "getItem" | "removeItem"> | null): BuildRequest | null {
  let raw: string | null;
  try {
    raw = storage?.getItem(FIRST_BUILD_KEY) ?? null;
    storage?.removeItem(FIRST_BUILD_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (typeof value.handle === "string" && value.type === "personal") return buildRequestOf("own", value.handle);
    if (typeof value.description === "string") return buildRequestOf("describe", value.description);
  } catch {
    // Not JSON: nothing to start.
  }
  return null;
}
