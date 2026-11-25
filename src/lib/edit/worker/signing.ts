/**
 * signing.ts — how the edit tool signs an address of its R2 bucket (X43, X77), with the keys it is given: no setting
 * is read here. The app signs with its own keys through r2.ts, which is server only; a script on this machine (the
 * part 2 proof) signs with keys it loaded itself.
 *
 * The bucket is in Cloudflare's EU jurisdiction, so its S3 address is `<account>.eu.r2.cloudflarestorage.com`,
 * addressed by path.
 */
import { AwsV4Signer } from "aws4fetch";

/** How long a signed read lasts (X43): a render of three minutes reads its files long after it was asked. */
export const READ_SECONDS = 2 * 60 * 60;

export interface R2Keys {
  account: string;
  keyId: string;
  secret: string;
  bucket: string;
}

/** A key's address in the bucket, each part of it encoded. */
export function addressOf(keys: R2Keys, key: string): URL {
  return new URL(`https://${keys.account}.eu.r2.cloudflarestorage.com/${keys.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`);
}

/** An address signed in its query, with every header given signed into it (`allHeaders`: aws4fetch leaves `content-length` and `content-type` out by default). */
export async function signed(
  keys: R2Keys,
  method: "GET" | "PUT",
  key: string,
  seconds: number,
  { query = {}, headers = {} }: { query?: Record<string, string>; headers?: Record<string, string> } = {},
): Promise<string> {
  const url = addressOf(keys, key);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  url.searchParams.set("X-Amz-Expires", String(seconds));
  const signer = new AwsV4Signer({
    method, url: url.href, headers, accessKeyId: keys.keyId, secretAccessKey: keys.secret,
    service: "s3", region: "auto", signQuery: true, allHeaders: true,
  });
  return (await signer.sign()).url.href;
}
