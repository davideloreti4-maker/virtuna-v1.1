/**
 * r2.ts — the edit tool's storage, from the app (X43): a signed PUT for a take's upload, signed reads of two
 * hours, and a HEAD for how much of an upload arrived; and for a reference (part 3, Task 11), the keys under a
 * folder and a delete, to drop it (X96). The app streams no media: the browser puts and reads the files itself,
 * at the bucket's address (signing.ts says how an address is signed); a reference fetched by its link is the one
 * file the app puts itself, through the same signed PUT.
 *
 * Server only: it reads the R2 keys from the environment, and nothing it signs carries them.
 */
import "server-only";
import { AwsClient } from "aws4fetch";
import { READ_SECONDS, addressOf, signed, type R2Keys } from "./signing";

export { READ_SECONDS };
/** How long an upload's address lasts: it is used at once, and a PUT that has started finishes. */
export const UPLOAD_SECONDS = 60 * 60;

export const takeKey = (user: string, take: string, name: string) => `u/${user}/takes/${take}/${name}`;
/** A creator's folder of takes (one take's, with its id) or of films (X43). */
export const folderOf = (user: string, what: { take: string } | "films") => (what === "films" ? `u/${user}/films/` : `u/${user}/takes/${what.take}/`);

/** Whether a key lies inside a folder: a plain path below it, with no empty, `.` or `..` part and no backslash. */
export function isUnder(key: string, folder: string): boolean {
  const rest = key.startsWith(folder) ? key.slice(folder.length) : "";
  return rest !== "" && !rest.includes("\\") && rest.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

function setting(name: "R2_ACCOUNT_ID" | "R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY" | "R2_BUCKET"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const bucket = () => setting("R2_BUCKET");

/** The app's keys, from its environment. */
const keys = (): R2Keys => ({ account: setting("R2_ACCOUNT_ID"), keyId: setting("R2_ACCESS_KEY_ID"), secret: setting("R2_SECRET_ACCESS_KEY"), bucket: bucket() });

function client(): AwsClient {
  // Two retries, not aws4fetch's ten: a route does not wait half a minute for R2.
  return new AwsClient({ accessKeyId: setting("R2_ACCESS_KEY_ID"), secretAccessKey: setting("R2_SECRET_ACCESS_KEY"), service: "s3", region: "auto", retries: 2 });
}

/** A signed read of two hours. With `download`, a browser saves the file under that name instead of showing it. */
export async function signGet(key: string, download?: string): Promise<string> {
  return signed(keys(), "GET", key, READ_SECONDS, download ? { query: { "response-content-disposition": `attachment; filename="${download.replace(/["\\]/g, "")}"` } } : {});
}

/**
 * A signed PUT for an upload straight from the creator's browser, of exactly `bytes` bytes of `type`: both are
 * signed into the address, so R2 refuses a body of another size or type (proved on R2, Task 7 fix round 1).
 */
export async function signPut(key: string, bytes: number, type: string): Promise<string> {
  return signed(keys(), "PUT", key, UPLOAD_SECONDS, { headers: { "content-length": String(bytes), "content-type": type } });
}

/** How many bytes of an object are stored; null when there is none. */
export async function sizeOf(key: string): Promise<number | null> {
  const response = await client().fetch(addressOf(keys(), key), { method: "HEAD" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`R2 answered ${response.status} to a HEAD of ${key}`);
  return Number(response.headers.get("content-length"));
}

const unescaped = (text: string) => text.replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[name] ?? "");

/**
 * The keys of every object under a folder (a prefix ending in `/`, as `folderOf` gives one), in R2's order: ListObjectsV2,
 * page after page (R2 gives a thousand a page).
 */
export async function objectsUnder(folder: string): Promise<string[]> {
  if (!folder.endsWith("/")) throw new Error(`${folder} is not a folder`);
  const found: string[] = [];
  let next: string | null = null;
  do {
    const url = addressOf(keys(), "");
    url.pathname = url.pathname.replace(/\/$/, ""); // the bucket itself
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", folder);
    if (next !== null) url.searchParams.set("continuation-token", next);
    const response = await client().fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`R2 answered ${response.status} to a list of ${folder}`);
    const xml = await response.text();
    found.push(...[...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map((match) => unescaped(match[1]!)));
    const token = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)?.[1];
    next = /<IsTruncated>true<\/IsTruncated>/.test(xml) && token ? unescaped(token) : null;
  } while (next !== null);
  return found;
}

/**
 * At most `most` of the objects under a prefix, each with when it was last written, in key order from just after `after` (all of
 * them, from the start, without it): ListObjectsV2, page after page. For a sweep, which looks at a bounded part of a creator's
 * folder at a time.
 */
export async function listedUnder(prefix: string, { most, after }: { most: number; after?: string }): Promise<{ key: string; modified: number }[]> {
  const found: { key: string; modified: number }[] = [];
  let next: string | null = null;
  do {
    const url = addressOf(keys(), "");
    url.pathname = url.pathname.replace(/\/$/, "");
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", prefix);
    url.searchParams.set("max-keys", String(Math.min(1000, most - found.length)));
    if (next !== null) url.searchParams.set("continuation-token", next);
    else if (after) url.searchParams.set("start-after", after);
    const response = await client().fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`R2 answered ${response.status} to a list of ${prefix}`);
    const xml = await response.text();
    for (const [, item] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = item!.match(/<Key>([^<]*)<\/Key>/)?.[1];
      const modified = Date.parse(item!.match(/<LastModified>([^<]*)<\/LastModified>/)?.[1] ?? "");
      if (key !== undefined) found.push({ key: unescaped(key), modified: Number.isNaN(modified) ? 0 : modified });
    }
    const token = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)?.[1];
    next = /<IsTruncated>true<\/IsTruncated>/.test(xml) && token && found.length < most ? unescaped(token) : null;
  } while (next !== null);
  return found.slice(0, most);
}

/** Deletes an object. One that is not there is no failure: S3's DELETE answers 204 for it, and a 404 is taken as gone. */
export async function removeObject(key: string): Promise<void> {
  const response = await client().fetch(addressOf(keys(), key), { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error(`R2 answered ${response.status} to a delete of ${key}`);
}
