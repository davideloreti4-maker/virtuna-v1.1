/**
 * A recording stand-in for the three other tables the posted server code reads (`threads`, `messages`,
 * `analysis_results`): the database is the I/O boundary. A small in-memory PostgREST, enough for the calls
 * `piece-said.ts` makes: `eq`, `is`, `in`, `contains` (jsonb containment, as Postgres's `@>`), `order`
 * (nulls as Postgres puts them), `limit`, `maybeSingle`, a select list projected as PostgREST does. It
 * refuses a column the table does not have (`src/types/database.types.ts`, abridged) and records every
 * call. `withPosts` joins it to `fake-db.ts` so one client answers every table, as the service client does.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type Row = Record<string, unknown>;
export interface TableFilter {
  op: "eq" | "is" | "in" | "contains";
  column: string;
  value: unknown;
}
export interface TableCall {
  table: string;
  columns: string;
  filters: TableFilter[];
  order: Array<[string, boolean]>;
  limit: number | null;
  single: boolean;
}

export const TABLE_COLUMNS: Record<string, readonly string[]> = {
  threads: ["id", "user_id", "type", "reading_id", "title", "created_at", "updated_at", "pinned_at", "sim_seals", "active_audience_id"],
  messages: ["id", "thread_id", "role", "body", "created_at"],
  analysis_results: [
    "id",
    "user_id",
    "deleted_at",
    "created_at",
    "heatmap",
    "variants",
    "personas",
    "verbatim",
    "overall_score",
    "engine_version",
    "input_mode",
    "video_storage_path",
  ],
};

/** jsonb `a @> b`: every key of an object in `b` is in `a` and contains its value; arrays by element. */
function containsJson(a: unknown, b: unknown): boolean {
  if (b !== null && typeof b === "object" && !Array.isArray(b)) {
    if (a === null || typeof a !== "object" || Array.isArray(a)) return false;
    return Object.entries(b).every(([k, v]) => Object.prototype.hasOwnProperty.call(a, k) && containsJson((a as Row)[k], v));
  }
  if (Array.isArray(b)) return Array.isArray(a) && b.every((v) => a.some((x) => containsJson(x, v)));
  return a === b;
}

function passes(row: Row, f: TableFilter): boolean {
  const v = row[f.column];
  switch (f.op) {
    case "eq":
      return v != null && v === f.value;
    case "is":
      return f.value === null ? v == null : v === f.value;
    case "in":
      return (f.value as unknown[]).includes(v);
    case "contains":
      return containsJson(v, f.value);
  }
}

const compare = (a: unknown, b: unknown): number => {
  const ta = typeof a === "string" ? Date.parse(a) : Number.NaN;
  const tb = typeof b === "string" ? Date.parse(b) : Number.NaN;
  if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
};

export function fakeTables() {
  const state = {
    tables: { threads: [], messages: [], analysis_results: [] } as { threads: Row[]; messages: Row[]; analysis_results: Row[] } & Record<string, Row[]>,
    calls: [] as TableCall[],
    /** A call to this table answers an error instead of running. */
    failOn: null as string | null,
  };

  const run = (q: TableCall) => {
    if (state.failOn === q.table) return { data: null, error: { message: "connection reset by peer" } };
    const known = TABLE_COLUMNS[q.table];
    if (!known) return { data: null, error: { message: `relation ${q.table} does not exist` } };
    const fields = q.columns.split(",").map((s) => s.trim()).filter(Boolean);
    const bad = [...fields, ...q.filters.map((f) => f.column), ...q.order.map(([c]) => c)].find((c) => !known.includes(c));
    if (bad) return { data: null, error: { message: `column ${q.table}.${bad} does not exist` } };
    const rows = (state.tables[q.table] ?? [])
      .filter((row) => q.filters.every((f) => passes(row, f)))
      .sort((a, b) => {
        for (const [column, ascending] of q.order) {
          const av = a[column];
          const bv = b[column];
          if (av == null || bv == null) {
            if (av == null && bv == null) continue;
            return (av == null ? 1 : -1) * (ascending ? 1 : -1);
          }
          const d = compare(av, bv);
          if (d !== 0) return ascending ? d : -d;
        }
        return 0;
      })
      .slice(0, q.limit ?? undefined)
      .map((row) => Object.fromEntries(fields.map((c) => [c, structuredClone(row[c] ?? null)])));
    if (q.single) {
      if (rows.length > 1) return { data: null, error: { message: `JSON object requested, ${rows.length} rows returned` } };
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  };

  const from = (table: string) => {
    const q: TableCall = { table, columns: "", filters: [], order: [], limit: null, single: false };
    state.calls.push(q);
    const add = (op: TableFilter["op"], column: string, value: unknown) => {
      q.filters.push({ op, column, value });
      return builder;
    };
    const builder = {
      select(columns: string) {
        q.columns = columns;
        return builder;
      },
      eq: (column: string, value: unknown) => add("eq", column, value),
      is: (column: string, value: unknown) => add("is", column, value),
      in: (column: string, values: readonly unknown[]) => add("in", column, [...values]),
      contains: (column: string, value: unknown) => add("contains", column, value),
      order(column: string, opts?: { ascending?: boolean }) {
        q.order.push([column, opts?.ascending ?? true]);
        return builder;
      },
      limit(n: number) {
        q.limit = n;
        return builder;
      },
      maybeSingle() {
        q.single = true;
        return builder;
      },
      then<A, B>(onFulfilled?: (v: ReturnType<typeof run>) => A, onRejected?: (e: unknown) => B) {
        return new Promise<ReturnType<typeof run>>((resolve) => resolve(run(q))).then(onFulfilled, onRejected);
      },
    };
    return builder;
  };

  const client = { from } as unknown as SupabaseClient<Database>;
  return { client, state, from };
}

/** One client over both stand-ins: `piece_posts` from `fake-db.ts`, every other table from these. */
export function withPosts(posts: SupabaseClient<Database>, tables: ReturnType<typeof fakeTables>): SupabaseClient<Database> {
  return {
    from: (table: string) => (table === "piece_posts" ? posts.from("piece_posts") : tables.from(table)),
  } as unknown as SupabaseClient<Database>;
}
