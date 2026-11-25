import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { parseEdit } from "@/lib/edit";
import { DevEdit } from "./dev-edit";

/**
 * /dev-edit — a DEV-ONLY page that plays a hand-written edit, to look at the edit tool while it
 * is built. It reads `.scratch/media/demo.json` (outside git): `{ edit, files }`, the files being
 * names in `.scratch/media/`. `?demo=<name>` reads `.scratch/media/<name>.json` instead. With
 * `?bare=1` it shows the film alone at its full size and without controls, for comparing the
 * preview with a rendered still. 404s outside development.
 */
export const dynamic = "force-dynamic";

export default async function DevEditPage({ searchParams }: { searchParams: Promise<{ bare?: string; demo?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { bare, demo: name = "demo" } = await searchParams;
  if (!/^[a-z0-9-]{1,40}$/.test(name)) notFound(); // a name, never a path
  const demo = await readFile(join(process.cwd(), ".scratch", "media", `${name}.json`), "utf8").then(
    (text) => JSON.parse(text) as { edit: unknown; files: Record<string, string> },
    () => null,
  );
  if (!demo) return <p style={{ padding: 24, fontFamily: "system-ui" }}>No edit to play: .scratch/media/{name}.json is not there.</p>;
  const urls = Object.fromEntries(Object.entries(demo.files).map(([id, file]) => [id, `/api/dev-edit/media/${file}`]));
  return <DevEdit edit={parseEdit(demo.edit)} urls={urls} bare={bare === "1"} />;
}
