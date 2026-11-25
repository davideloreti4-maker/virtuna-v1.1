/**
 * stand-ins.ts — the app's three boundaries with the worker, for the suite, at `fetch`:
 *   - Supabase's REST API over the two edit tables, in memory, with the tables' grants: a session reads its own
 *     rows and writes nothing; the service role reads and writes everything. Defaults and the `updated_at`
 *     trigger are as the migrations have them, and so is X70's key: a job's (take, creator) must be a take's.
 *     A DELETE by the service role removes the rows its filters match, a take's jobs with it, as the key cascades (part 3,
 *     Task 11: a reference dropped). A filter may name a key of a JSON column (`input->>reference`); a read can be refused.
 *     The editor's `edits` and `edit_turns` (a turn keyed on `(edit_id, n)`, an edit only on its creator's take), and
 *     `threads` and `messages` for its chat (plan 2026-11-24-editor-screens-a, Task 1). A write or an update of these is
 *     held to what their migrations hold it to, so that a route cannot pass here and fail on the database: the columns that
 *     may not be null (23502), the editor's checks (23514), the turns' key (23505), a turn's edit (23503); one refused row
 *     and the statement changes nothing. A DELETE takes an edit's turns and a take's edits with it, and an edit lets go of a
 *     job or a thread that is gone. `updated_at` only where a table has it, stamped only where a trigger does. A row a test
 *     puts in with `put` is not checked.
 *   - The bucket: a HEAD answers an object's size, or 404. For a reference (part 3, Task 11): a PUT at a signed address
 *     stores the body; a GET at a signed address reads an object back; a list of a folder (ListObjectsV2, `pageSize` keys a
 *     page) and a DELETE, each signed in its header; each can be told to fail.
 *   - The worker's `POST /start` (X64), behind Modal's proxy auth (X81): 401 from the proxy without the workspace's
 *     proxy token, 401 without the secret, 404 for a job that is not queued, else 202; or, as told, another status,
 *     no answer at all, no answer in time, or a 500 after it took the job all the same. Its `POST /stills` with a sheet
 *     (part 3, Task 6), behind the same two checks: the sheet, or its own failure as told.
 * Real supabase-js and aws4fetch talk to them. Each is proved for real by `scripts/edit-worker-proof.ts`, and what a
 * reference adds by `scripts/edit-reference-proof.ts`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "@/types/database.types";

export const SUPABASE_URL = "http://supabase.test";
export const SERVICE_KEY = "service-key";
export const R2_ACCOUNT = "account0";
export const BUCKET = "edit-media";
export const WORKER_URL = "https://worker.test";
export const WORKER_SECRET = "a-shared-secret";
/** The workspace's proxy token, which Modal's proxy asks for before the worker sees a call (X81). */
export const PROXY_KEY = "wk-stand-in";
export const PROXY_SECRET = "ws-stand-in";

type Db = SupabaseClient<Database>;
type Row = Record<string, unknown>;
type Table = "edit_takes" | "edit_jobs" | "edits" | "edit_turns" | "threads" | "messages";
export interface Call {
  method: string;
  table: string;
  query: URLSearchParams;
  role: string;
}

const DEFAULTS: Record<Table, () => Row> = {
  edit_takes: () => ({ status: "uploading", facts: null, words: null, analysis: null, error: null }),
  edit_jobs: () => ({ take_id: null, input: null, status: "queued", stage: null, progress: 0, result: null, error: null, call_id: null, started_at: null, finished_at: null }),
  edits: () => ({ thread_id: null, look: null, style: null, head: null, export_job: null, export_turn: null }),
  edit_turns: () => ({ request: null, at: null, findings: [], kept: [], doc: null }),
  threads: () => ({ reading_id: null, title: null, pinned_at: null, active_audience_id: null, sim_seals: {} }),
  messages: () => ({ body: [] }),
};
/** The tables keyed on something other than an `id` of their own. */
const NO_ID: ReadonlySet<Table> = new Set(["edit_turns"]);
/** The tables with no `updated_at`; and those where a trigger stamps it on every update (`threads` has the column and no trigger: the app bumps it). */
const NO_UPDATED_AT: ReadonlySet<Table> = new Set(["edit_turns", "messages"]);
const STAMPED: ReadonlySet<Table> = new Set(["edit_takes", "edit_jobs", "edits"]);

/** The columns that may not be null, in the editor's tables and its chat's: a write that leaves one out (it has no default) or sets it to null is refused. */
const REQUIRED: Partial<Record<Table, string[]>> = {
  edits: ["user_id", "take_id", "title"],
  edit_turns: ["edit_id", "n", "kind", "say", "findings", "kept"],
  threads: ["user_id", "type"],
  messages: ["thread_id", "role"],
};

/** Null, or a number from `low` to `high`; and the same of a text's length, in characters as `char_length` counts them. */
const within = (value: unknown, low: number, high: number) => value == null || (typeof value === "number" && value >= low && value <= high);
const long = (value: unknown, low: number, high: number) => value == null || within([...String(value)].length, low, high);

/**
 * The checks of the editor's two tables, as `20261124210000_edits_turns.sql` writes them: the columns each reads, its name
 * in the database, and whether a row passes. A null passes a check, as in SQL; what may not be null is in `REQUIRED`.
 */
const CHECKS: Partial<Record<Table, { on: string[]; name: string; holds: (row: Row) => boolean }[]>> = {
  edits: [
    { on: ["title"], name: "edits_title_check", holds: (row) => long(row.title, 1, 200) },
    { on: ["look"], name: "edits_look_check", holds: (row) => row.look == null || /^[a-z][a-z-]{0,39}$/.test(String(row.look)) },
    { on: ["head"], name: "edits_head_check", holds: (row) => within(row.head, 1, 300) },
    { on: ["export_turn"], name: "edits_export_turn_check", holds: (row) => within(row.export_turn, 1, 300) },
  ],
  edit_turns: [
    { on: ["n"], name: "edit_turns_n_check", holds: (row) => within(row.n, 1, 300) },
    { on: ["kind"], name: "edit_turns_kind_check", holds: (row) => row.kind == null || ["cut", "change", "direct", "said"].includes(String(row.kind)) },
    { on: ["request"], name: "edit_turns_request_check", holds: (row) => long(row.request, 0, 500) },
    { on: ["at"], name: "edit_turns_at_check", holds: (row) => within(row.at, 0, 5400) },
    { on: ["kind", "doc"], name: "edit_turns_said_has_no_doc", holds: (row) => row.kind == null || (row.kind === "said") === (row.doc == null) },
  ],
};

const json = (status: number, body: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * A row's value for a filter's column: the column, or for `column->>key` a key of a JSON column as text, as PostgREST reads it
 * (null when the column or the key is missing).
 */
function valueAt(row: Row, column: string): unknown {
  const [name = "", key] = column.split("->>");
  if (key === undefined) return row[name];
  const json = row[name];
  const value = json !== null && typeof json === "object" ? (json as Row)[key] : undefined;
  return value === undefined || value === null ? null : typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * Whether a row passes one PostgREST filter, like `eq.ready`, `in.(a,b)`, `lt.<time>`, `gte.10` or `is.null`. A number
 * compares as a number, anything else as a time.
 */
function passes(value: unknown, filter: string): boolean {
  const [op, ...rest] = filter.split(".");
  const arg = rest.join(".");
  const order = (v: unknown) => (typeof v === "number" ? v : new Date(String(v)).getTime());
  const against = (v: unknown) => (typeof v === "number" ? Number(arg) : new Date(arg).getTime());
  switch (op) {
    case "eq":
      return String(value) === arg;
    case "neq":
      return String(value) !== arg;
    case "in":
      return arg.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, "")).includes(String(value));
    case "is":
      return arg === "null" ? value === null : String(value) === arg;
    case "lt":
      return order(value) < against(value);
    case "lte":
      return order(value) <= against(value);
    case "gt":
      return order(value) > against(value);
    case "gte":
      return order(value) >= against(value);
    default:
      throw new Error(`the stand-in knows no filter "${filter}"`);
  }
}

export class Rest {
  readonly tables: Record<Table, Row[]> = { edit_takes: [], edit_jobs: [], edits: [], edit_turns: [], threads: [], messages: [] };
  readonly calls: Call[] = [];
  /** A read the database is to refuse, as a server error: by table and query (part 3, Task 11). */
  failingRead: ((read: { table: string; query: URLSearchParams }) => boolean) | null = null;
  /** A write the database is to refuse, as a server error: by method, table and what it would write. */
  failing: ((write: { method: string; table: string; body: Row }) => boolean) | null = null;

  /** A row as the database would hold it, put in by the test, unchecked. A keyed table's row has no id of its own. */
  put(table: Table, row: Row): Row {
    const at = new Date().toISOString();
    const full = { ...(NO_ID.has(table) ? {} : { id: randomUUID() }), ...DEFAULTS[table](), created_at: at, ...(NO_UPDATED_AT.has(table) ? {} : { updated_at: at }), ...row };
    this.tables[table].push(full);
    return full;
  }

  row(table: Table, id: string): Row | undefined {
    return this.tables[table].find((row) => row.id === id);
  }

  async handle(url: URL, init: RequestInit): Promise<Response> {
    const table = url.pathname.replace("/rest/v1/", "") as Table;
    if (!(table in this.tables)) return json(404, { code: "PGRST205", message: `no table ${table}` });
    const headers = new Headers(init.headers);
    const token = (headers.get("authorization") ?? "").replace(/^Bearer /, "");
    const role = token === SERVICE_KEY ? "service" : token.startsWith("user:") ? token : "anon";
    const method = (init.method ?? "GET").toUpperCase();
    this.calls.push({ method, table, query: url.searchParams, role });
    if (role === "anon") return json(401, { code: "42501", message: `permission denied for table ${table}` });
    if (method !== "GET" && role !== "service") return json(403, { code: "42501", message: `permission denied for table ${table}` });
    const select = url.searchParams.get("select") ?? "*";
    const ITEM = "([a-z_]+:)?[a-z_]+(->>?[a-z_]+)?";
    if (select !== "*" && !new RegExp(`^${ITEM}(,${ITEM})*$`).test(select)) throw new Error("the stand-in answers select=*, plain columns, or `alias:column->key` only");
    // A plain column; or, named by an alias, a key of a JSON column as JSON (`->`) or as text (`->>`), as PostgREST gives them.
    const at = (row: Row, path: string): unknown => {
      if (path.includes("->>")) return valueAt(row, path);
      const [name = "", key] = path.split("->");
      if (key === undefined) return row[name];
      const json = row[name];
      return json !== null && typeof json === "object" ? ((json as Row)[key] ?? null) : null;
    };
    const columns = (row: Row): Row =>
      select === "*" ? row : Object.fromEntries(select.split(",").map((item) => (item.includes(":") ? [item.split(":")[0]!, at(row, item.split(":")[1]!)] : [item, at(row, item)])));

    const filters = [...url.searchParams].filter(([key]) => !["select", "order", "limit", "columns"].includes(key));
    const own = (row: Row) => role === "service" || row.user_id === role.slice("user:".length);
    const matching = () => this.tables[table].filter((row) => own(row) && filters.every(([key, filter]) => passes(valueAt(row, key), filter)));
    const wantsOne = headers.get("accept") === "application/vnd.pgrst.object+json";
    const answer = (status: number, rows: Row[]) => {
      if (!wantsOne) return json(status, rows);
      return rows.length === 1 ? json(status, rows[0]) : json(406, { code: "PGRST116", message: `${rows.length} rows` });
    };

    if (method === "GET" && this.failingRead?.({ table, query: url.searchParams })) return json(500, { code: "XX000", message: "the stand-in was told to refuse this read" });
    if (method === "GET") {
      let rows = matching();
      const order = url.searchParams.get("order");
      if (order) {
        const [key = "", direction] = order.split(".");
        const compare = (a: unknown, b: unknown) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b)));
        rows = [...rows].sort((a, b) => compare(a[key], b[key]) * (direction === "desc" ? -1 : 1));
      }
      const limit = url.searchParams.get("limit");
      return answer(200, (limit ? rows.slice(0, Number(limit)) : rows).map(columns));
    }
    if (method === "DELETE") return this.remove(table, filters, role, wantsOne);
    const body = JSON.parse(String(init.body)) as Row | Row[];
    if (this.failing && (Array.isArray(body) ? body : [body]).some((row) => this.failing?.({ method, table, body: row }))) {
      return json(500, { code: "XX000", message: "the stand-in was told to refuse this write" });
    }
    if (method === "POST") {
      const made: Row[] = [];
      for (const row of Array.isArray(body) ? body : [body]) {
        const refused = this.refusal(table, { ...DEFAULTS[table](), ...row });
        if (refused) {
          this.drop(table, made); // one statement: the rows made before the one refused are not kept
          return refused;
        }
        made.push(this.put(table, row));
      }
      return answer(201, made);
    }
    if (method === "PATCH") {
      const rows = matching();
      const set = body as Row;
      for (const row of rows) {
        const refused = this.refusal(table, { ...row, ...set }, { sets: Object.keys(set), was: row });
        if (refused) return refused; // one statement: no row is changed
      }
      const at = new Date().toISOString();
      for (const row of rows) Object.assign(row, set, STAMPED.has(table) ? { updated_at: at } : {}); // the trigger: the database's clock on every update
      return answer(200, rows);
    }
    throw new Error(`the stand-in answers no ${method}`);
  }

  /**
   * Why the database would refuse a row, as PostgREST answers it, or null when it would take it: a column that may not be
   * null (23502), a check (23514), the turns' key (23505), a key to another table's row (X70's, an edit's take, a turn's
   * edit: 23503), in the order Postgres finds them. For an update, `sets` names the columns it sets and `was` is the row
   * before it: only the rules on those columns are asked, as an update cannot break a rule on a column it leaves alone.
   * (So a row a test put in past the checks can still be updated.)
   */
  private refusal(table: Table, row: Row, update?: { sets: string[]; was: Row }): Response | null {
    const touches = (...columns: string[]) => !update || columns.some((column) => update.sets.includes(column));
    for (const column of REQUIRED[table] ?? []) {
      if (touches(column) && row[column] == null) return json(400, { code: "23502", message: `null value in column "${column}" of relation "${table}" violates not-null constraint` });
    }
    for (const check of CHECKS[table] ?? []) {
      if (touches(...check.on) && !check.holds(row)) return json(400, { code: "23514", message: `new row for relation "${table}" violates check constraint "${check.name}"` });
    }
    if (table === "edit_turns" && touches("edit_id", "n") && this.tables.edit_turns.some((turn) => turn !== update?.was && turn.edit_id === row.edit_id && turn.n === row.n)) {
      return json(409, { code: "23505", message: 'duplicate key value violates unique constraint "edit_turns_pkey"' });
    }
    const key = (name: string) => json(409, { code: "23503", message: `insert or update on table "${table}" violates foreign key constraint "${name}"` });
    const ownTake = () => this.tables.edit_takes.some((take) => take.id === row.take_id && take.user_id === row.user_id);
    if (table === "edit_jobs" && touches("take_id", "user_id") && row.take_id != null && !ownTake()) return key("edit_jobs_take_owner_fkey");
    if (table === "edits" && touches("take_id", "user_id") && !ownTake()) return key("edits_take_owner_fkey");
    if (table === "edit_turns" && touches("edit_id") && !this.tables.edits.some((edit) => edit.id === row.edit_id)) return key("edit_turns_edit_id_fkey");
    return null;
  }

  /** A DELETE: the service role's only (a session deletes nothing), of the rows its filters match. */
  private remove(table: Table, filters: [string, string][], role: string, wantsOne: boolean): Response {
    if (role !== "service") return json(403, { code: "42501", message: `permission denied for table ${table}` });
    if (this.failing?.({ method: "DELETE", table, body: {} })) return json(500, { code: "XX000", message: "the stand-in was told to refuse this write" });
    const gone = this.tables[table].filter((row) => filters.every(([key, filter]) => passes(valueAt(row, key), filter)));
    this.drop(table, gone);
    return wantsOne && gone.length === 1 ? json(200, gone[0]) : json(200, gone);
  }

  /** Takes rows out of a table, and with them what the keys take (ON DELETE CASCADE) or let go of (ON DELETE SET NULL). */
  private drop(table: Table, gone: Row[]): void {
    if (gone.length === 0) return;
    const rows = this.tables[table];
    rows.splice(0, rows.length, ...rows.filter((row) => !gone.includes(row)));
    // The rows of another table that hold a key to one of the rows gone.
    const their = (other: Table, is: (row: Row, parent: Row) => boolean) => this.tables[other].filter((row) => gone.some((parent) => is(row, parent)));
    const at = new Date().toISOString();
    if (table === "edit_takes") {
      // X70's key and the edits' key on a take and its creator, ON DELETE CASCADE: a take's jobs and its edits go with it.
      this.drop("edit_jobs", their("edit_jobs", (job, take) => job.take_id === take.id && job.user_id === take.user_id));
      this.drop("edits", their("edits", (edit, take) => edit.take_id === take.id && edit.user_id === take.user_id));
    }
    // An edit's turns go with it (ON DELETE CASCADE).
    if (table === "edits") this.drop("edit_turns", their("edit_turns", (turn, edit) => turn.edit_id === edit.id));
    // An edit lets go of its export's job, or of its thread, when that is gone (ON DELETE SET NULL; an update, so the trigger stamps it).
    if (table === "edit_jobs") for (const edit of their("edits", (edit, job) => edit.export_job === job.id)) Object.assign(edit, { export_job: null, updated_at: at });
    if (table === "threads") for (const edit of their("edits", (edit, thread) => edit.thread_id === thread.id)) Object.assign(edit, { thread_id: null, updated_at: at });
  }
}

export class Bucket {
  /** Object sizes by key. */
  readonly objects = new Map<string, number>();
  /** The bytes of an object put with them (part 3, Task 11: a reference's sheet); any other reads as zeros of its size. */
  readonly contents = new Map<string, Uint8Array>();
  /** What R2 answers a GET of an object with, in place of it: a status to fail with. */
  failGet: number | null = null;
  /** What R2 answers a HEAD with, when not the object's size: a status to fail with. */
  failWith: number | null = null;
  /** What R2 answers a PUT, a list or a DELETE with, in place of doing it: a status to fail with. */
  failPut: number | null = null;
  failList: number | null = null;
  failDelete: number | null = null;
  /** How many keys a list gives a page (R2's own is a thousand, and fewer when `max-keys` asks for fewer). */
  pageSize = 1000;
  /** When each object was last written, for a list's `LastModified`: the moment of the list, unless a test says otherwise. */
  readonly modified = new Map<string, Date>();
  /** Each PUT asked: its key, its type, and the headers signed into its address. */
  readonly puts: { key: string; type: string | null; signedHeaders: string | null }[] = [];

  async handle(url: URL, init: RequestInit): Promise<Response> {
    const [bucket, ...key] = url.pathname.slice(1).split("/");
    const method = (init.method ?? "GET").toUpperCase();
    if (bucket !== BUCKET) throw new Error(`the bucket stand-in answers in ${BUCKET} only`);
    const name = key.map(decodeURIComponent).join("/");
    const headers = new Headers(init.headers);
    if (method === "PUT") return this.put(url, name, headers, init.body);
    if (method === "GET" && name !== "" && url.searchParams.get("X-Amz-Signature")) {
      // A read at an address signed in its query, as `signGet` signs one.
      if (this.failGet) return new Response("<Error><Code>InternalError</Code></Error>", { status: this.failGet });
      const size = this.objects.get(name);
      if (size === undefined) return new Response("<Error><Code>NoSuchKey</Code></Error>", { status: 404 });
      return new Response(Buffer.from(this.contents.get(name) ?? new Uint8Array(size)), { status: 200 });
    }
    if (!headers.get("authorization")?.startsWith("AWS4-HMAC-SHA256 ")) return new Response(null, { status: 403 });
    if (method === "HEAD") {
      if (this.failWith) return new Response(null, { status: this.failWith });
      const size = this.objects.get(name);
      return size === undefined ? new Response(null, { status: 404 }) : new Response(null, { status: 200, headers: { "content-length": String(size) } });
    }
    if (method === "GET" && name === "" && url.searchParams.get("list-type") === "2") return this.list(url.searchParams);
    if (method === "DELETE" && name !== "") {
      if (this.failDelete) return new Response("<Error><Code>InternalError</Code></Error>", { status: this.failDelete });
      this.objects.delete(name);
      this.contents.delete(name);
      return new Response(null, { status: 204 });
    }
    throw new Error(`the bucket stand-in answers no ${method} ${url.pathname}${url.search}`);
  }

  /** A PUT at an address signed in its query, as the app signs an upload: stored at the body's size. */
  private async put(url: URL, key: string, headers: Headers, body: BodyInit | null | undefined): Promise<Response> {
    if (!url.searchParams.get("X-Amz-Signature")) return new Response(null, { status: 403 });
    this.puts.push({ key, type: headers.get("content-type"), signedHeaders: url.searchParams.get("X-Amz-SignedHeaders") });
    if (this.failPut) return new Response("<Error><Code>InternalError</Code></Error>", { status: this.failPut });
    const bytes = new Uint8Array(await new Response(body).arrayBuffer());
    this.objects.set(key, bytes.byteLength);
    this.contents.set(key, bytes);
    return new Response(null, { status: 200 });
  }

  /** ListObjectsV2 of a prefix, in key order, `pageSize` a page, continued by the token of the page before. */
  private list(query: URLSearchParams): Response {
    if (this.failList) return new Response("<Error><Code>InternalError</Code></Error>", { status: this.failList });
    // The continuation token is the last key given (S3's is opaque); it takes the place of `start-after`.
    const prefix = query.get("prefix") ?? "";
    const after = query.get("continuation-token") ?? query.get("start-after") ?? "";
    const keys = [...this.objects.keys()].filter((key) => key.startsWith(prefix) && key > after).sort();
    const page = keys.slice(0, Math.min(this.pageSize, Number(query.get("max-keys") ?? 1000)));
    const more = page.length < keys.length;
    const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    const written = (key: string) => (this.modified.get(key) ?? new Date()).toISOString();
    const contents = page.map((key) => `<Contents><Key>${escape(key)}</Key><LastModified>${written(key)}</LastModified><Size>${this.objects.get(key)}</Size></Contents>`).join("");
    const xml = `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Name>${BUCKET}</Name><Prefix>${escape(prefix)}</Prefix><KeyCount>${page.length}</KeyCount><IsTruncated>${more}</IsTruncated>${more ? `<NextContinuationToken>${escape(page.at(-1)!)}</NextContinuationToken>` : ""}${contents}</ListBucketResult>`;
    return new Response(xml, { status: 200, headers: { "content-type": "application/xml" } });
  }
}

export class Worker {
  /** The jobs started, in order. */
  readonly started: string[] = [];
  /** How the worker answers: as it should, with another status, not at all, not in time, or 500 after taking the job. */
  answer: "202" | 500 | "down" | "timeout" | "took it, then 500" = "202";
  /** Each `/stills` call's body, in order; and how `/stills` answers: a sheet, or its own failure. */
  readonly stillsAsked: { user: string; edit: unknown; frames: number[]; sheet?: boolean }[] = [];
  stills: "sheet" | 500 = "sheet";

  constructor(private readonly rest: Rest) {}

  handle(url: URL, init: RequestInit): Response {
    if (this.answer === "down") throw new TypeError("fetch failed");
    if (this.answer === "timeout") throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); // what fetch throws when AbortSignal.timeout fires
    const headers = new Headers(init.headers);
    if (headers.get("modal-key") !== PROXY_KEY || headers.get("modal-secret") !== PROXY_SECRET) {
      return new Response("modal-http: missing credentials for proxy authorization", { status: 401 });
    }
    if (url.pathname === "/stills" && init.method === "POST") return this.stillsOf(headers, init);
    if (url.pathname !== "/start" || init.method !== "POST") return json(405, { detail: "Method Not Allowed" });
    if (headers.get("authorization") !== `Bearer ${WORKER_SECRET}`) return json(401, { error: "not allowed" });
    if (this.answer === 500) return json(500, { error: "the worker failed" });
    const job = (JSON.parse(String(init.body)) as { job?: string }).job ?? "";
    const row = this.rest.row("edit_jobs", job);
    if (row?.status !== "queued") return json(404, { error: `no queued job ${job}` });
    this.started.push(job);
    if (this.answer === "took it, then 500") {
      Object.assign(row, { status: "running", stage: "sizing", started_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      return json(500, { error: "the answer was lost" });
    }
    return json(202, { call: `fc-${this.started.length}` });
  }

  /** `POST /stills` with a sheet (the app asks for none since Task 9c; scripts may): `SHEET`, or the worker's own failure. */
  private stillsOf(headers: Headers, init: RequestInit): Response {
    if (headers.get("authorization") !== `Bearer ${WORKER_SECRET}`) return json(401, { error: "not allowed" });
    this.stillsAsked.push(JSON.parse(String(init.body)));
    return this.stills === 500 ? json(500, { error: "the stills failed on our side; try again" }) : json(200, { sheet: SHEET });
  }
}

/** The sheet the worker's `/stills` stand-in draws: a JPEG's base64, made up. */
export const SHEET = Buffer.from("a sheet of twelve frames").toString("base64");

/** The three stand-ins, the `fetch` that reaches them, and Supabase clients that use it. */
export function standIns() {
  const rest = new Rest();
  const bucket = new Bucket();
  const worker = new Worker(rest);
  const fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input));
    const merged: RequestInit = request ? { method: request.method, headers: request.headers, ...init } : init;
    if (url.origin === SUPABASE_URL) return rest.handle(url, merged);
    if (url.host === `${R2_ACCOUNT}.eu.r2.cloudflarestorage.com`) return bucket.handle(url, merged);
    if (url.host === new URL(WORKER_URL).host) return worker.handle(url, merged); // at https, or http as development may have it
    throw new Error(`nothing stands in for ${url.origin}`);
  };
  const client = (key: string, authorization?: string): Db =>
    createClient<Database>(SUPABASE_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch, headers: authorization ? { Authorization: authorization } : {} },
    });
  /** The app's server client for a signed-in creator (or for nobody, with null): reads through the grants. */
  const session = (user: { id: string; is_anonymous?: boolean } | null): Db => {
    const db = client("anon-key", user ? `Bearer user:${user.id}` : undefined);
    Object.assign(db.auth, { getUser: async () => ({ data: { user }, error: null }) });
    return db;
  };
  return { rest, bucket, worker, fetch, session, service: () => client(SERVICE_KEY) };
}

/** The environment the app reads its R2 and worker settings from, for the suite. */
export const ENV = {
  R2_ACCOUNT_ID: R2_ACCOUNT,
  R2_ACCESS_KEY_ID: "key-id",
  R2_SECRET_ACCESS_KEY: "key-secret",
  R2_BUCKET: BUCKET,
  EDIT_WORKER_URL: WORKER_URL,
  EDIT_WORKER_SECRET: WORKER_SECRET,
  EDIT_WORKER_PROXY_KEY: PROXY_KEY,
  EDIT_WORKER_PROXY_SECRET: PROXY_SECRET,
};
