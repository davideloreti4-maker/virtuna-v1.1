/**
 * A recording stand-in for the Supabase client: the database is the I/O boundary, so it is the one thing
 * stood in for. A small in-memory PostgREST over `piece_posts`, enough for the calls the repository
 * makes, after the stand-in of `src/app/api/threads/library/__tests__/route.test.ts`:
 *
 * - it filters (`eq`, `is`, `in`, `gt`, `gte`, `lt`, `lte`, an `or` tree), orders (nulls as Postgres
 *   puts them), limits, counts and projects rows the way the real one does for these calls;
 * - it refuses a column the table does not have (the columns are read from the migration itself);
 * - on insert it fills the migration's defaults, refuses a missing NOT NULL column, and holds the
 *   one-post-per-piece unique index (`23505`), which is partial: it holds live rows only;
 * - it stores and returns times as PostgREST writes a `timestamptz` (microseconds and an offset);
 * - it records every call (table, action, columns, filters, values).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type Row = Record<string, unknown>;
export interface Filter {
  op: "eq" | "is" | "in" | "gt" | "gte" | "lt" | "lte";
  column: string;
  value: unknown;
}
export interface Call {
  table: string;
  action: "select" | "insert" | "update" | "delete";
  /** The select list; on a write, its returning list (null when nothing is returned). */
  columns: string | null;
  count: string | null;
  head: boolean;
  filters: Filter[];
  or: string[];
  order: Array<[string, boolean]>;
  limit: number | null;
  values: Row | Row[] | null;
  single: "single" | "maybe" | null;
}
interface PgError {
  code: string;
  message: string;
}

export const MIGRATION = join(process.cwd(), "supabase/migrations/20261124130606_piece_posts.sql");

/** The table's columns, in the migration's order, read from its `create table`. */
export function migrationColumns(): string[] {
  const sql = readFileSync(MIGRATION, "utf8").replace(/--.*$/gm, "");
  const body = /create table if not exists public\.piece_posts \(([\s\S]*?)\n\);/i.exec(sql)?.[1];
  if (!body) throw new Error("stand-in: no create table in the migration");
  return body
    .split("\n")
    .map((line) => /^\s*([a-z_]+)\s+(uuid|text|smallint|bigint|jsonb|timestamptz)\b/.exec(line)?.[1])
    .filter((c): c is string => Boolean(c));
}

const TIME_COLUMNS = new Set(["said_at", "posted_at", "read_at", "settled_at", "last_attempt_at", "removed_at", "created_at", "updated_at"]);
const REQUIRED = ["user_id", "piece_key", "piece_kind", "said_number", "said_measure", "post_url"];
const NO_CHAT = "00000000-0000-0000-0000-000000000000";

/** A time as PostgREST returns a `timestamptz`: "2026-11-24T12:00:00.000000+00:00". */
function stored(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`stand-in: "${value}" is not a time`);
  return `${new Date(ms).toISOString().slice(0, 23)}000+00:00`;
}

const compare = (column: string, a: unknown, b: unknown): number => {
  if (TIME_COLUMNS.has(column)) return Date.parse(String(a)) - Date.parse(String(b));
  if (typeof a === "number" || typeof b === "number") return Number(a) - Number(b);
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
};

type Cond = { kind: "and" | "or"; parts: Cond[] } | { kind: "op"; column: string; op: string; value: string };

/** Split a PostgREST logic tree's items on top-level commas. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (depth === 0 && ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}
function parseCond(term: string): Cond {
  const group = /^(and|or)\(([\s\S]*)\)$/.exec(term);
  if (group) return { kind: group[1] as "and" | "or", parts: splitTop(group[2]!).map(parseCond) };
  const m = /^(\w+)\.(eq|neq|lt|lte|gt|gte|is)\.([\s\S]*)$/.exec(term);
  if (!m) throw new Error(`stand-in: PostgREST cannot parse "${term}"`);
  // A value in double quotes is taken without them (PostgREST's way to hold `:` `.` `,` in a value).
  const raw = m[3]!;
  const value = raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
  return { kind: "op", column: m[1]!, op: m[2]!, value };
}
const columnsOfCond = (c: Cond): string[] => (c.kind === "op" ? [c.column] : c.parts.flatMap(columnsOfCond));
function holds(row: Row, c: Cond): boolean {
  if (c.kind !== "op") return c.kind === "and" ? c.parts.every((p) => holds(row, p)) : c.parts.some((p) => holds(row, p));
  const v = row[c.column];
  if (c.op === "is") return c.value === "null" ? v == null : String(v) === c.value;
  if (v == null) return false;
  const d = compare(c.column, v, c.value);
  return { eq: d === 0, neq: d !== 0, lt: d < 0, lte: d <= 0, gt: d > 0, gte: d >= 0 }[c.op as "eq"];
}
function passes(row: Row, f: Filter): boolean {
  const v = row[f.column];
  if (f.op === "is") return f.value === null ? v == null : v === f.value;
  if (f.op === "in") return (f.value as unknown[]).includes(v);
  if (v == null) return false;
  const d = compare(f.column, v, f.value);
  return { eq: d === 0, gt: d > 0, gte: d >= 0, lt: d < 0, lte: d <= 0 }[f.op];
}

export function fakeDb() {
  const columns = migrationColumns();
  const state = {
    rows: [] as Row[],
    calls: [] as Call[],
    now: new Date("2026-11-24T12:00:00.000Z"),
    /** The next call answers this error instead of running. */
    failNext: null as PgError | null,
    nextId: 1,
  };

  const unknownColumn = (used: string[]): PgError | null => {
    const bad = used.find((c) => !columns.includes(c));
    return bad ? { code: "42703", message: `column piece_posts.${bad} does not exist` } : null;
  };
  const fieldsOf = (list: string | null): string[] =>
    list === null || list.trim() === "*" ? columns : list.split(",").map((s) => s.trim()).filter(Boolean);
  const project = (rows: Row[], list: string | null): Row[] =>
    rows.map((row) => Object.fromEntries(fieldsOf(list).map((c) => [c, structuredClone(row[c] ?? null)])));

  const withDefaults = (values: Row): Row => {
    const now = stored(state.now.toISOString());
    const id = `00000000-0000-4000-8000-${(state.nextId++).toString(16).padStart(12, "0")}`;
    const base: Row = Object.fromEntries(columns.map((c) => [c, null]));
    Object.assign(base, { id, platform: "tiktok", reads: [], attempts: 0, created_at: now, updated_at: now });
    for (const [k, v] of Object.entries(values)) base[k] = TIME_COLUMNS.has(k) && v !== null ? stored(v) : structuredClone(v);
    return base;
  };
  const pieceOf = (r: Row) => `${String(r.user_id)}|${String(r.thread_id ?? NO_CHAT)}|${String(r.piece_key)}`;

  type Result = { data: unknown; error: PgError | null; count: number | null };
  const run = (q: Call): Result => {
    if (state.failNext) {
      const error = state.failNext;
      state.failNext = null;
      return { data: null, error, count: null };
    }
    if (q.table !== "piece_posts") return { data: null, error: { code: "42P01", message: `relation ${q.table} does not exist` }, count: null };
    const conds = q.or.map((s) => ({ kind: "or" as const, parts: splitTop(s).map(parseCond) }));
    const written = q.values === null ? [] : (Array.isArray(q.values) ? q.values : [q.values]).flatMap((v) => Object.keys(v));
    const bad = unknownColumn([
      ...(q.columns === null ? [] : fieldsOf(q.columns)),
      ...q.filters.map((f) => f.column),
      ...q.order.map(([c]) => c),
      ...conds.flatMap(columnsOfCond),
      ...written,
    ]);
    if (bad) return { data: null, error: bad, count: null };

    let rows: Row[];
    if (q.action === "insert") {
      const incoming = (Array.isArray(q.values) ? q.values : [q.values!]).map(withDefaults);
      const missing = incoming.flatMap((r) => REQUIRED.filter((c) => r[c] == null));
      if (missing.length) return { data: null, error: { code: "23502", message: `null value in column "${missing[0]}" violates not-null constraint` }, count: null };
      // The unique index is partial (`where removed_at is null`): only live rows hold a piece.
      const live = (r: Row) => r.removed_at == null;
      const taken = new Set(state.rows.filter(live).map(pieceOf));
      for (const r of incoming.filter(live)) {
        if (taken.has(pieceOf(r))) {
          return { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "piece_posts_one_per_piece"' }, count: null };
        }
        taken.add(pieceOf(r));
      }
      state.rows.push(...incoming);
      rows = incoming;
    } else {
      const matching = state.rows.filter((row) => q.filters.every((f) => passes(row, f)) && conds.every((c) => holds(row, c)));
      if (q.action === "update") {
        for (const row of matching) {
          for (const [k, v] of Object.entries(q.values as Row)) row[k] = TIME_COLUMNS.has(k) && v !== null ? stored(v) : structuredClone(v);
        }
      }
      if (q.action === "delete") state.rows = state.rows.filter((row) => !matching.includes(row));
      rows = [...matching].sort((a, b) => {
        for (const [column, ascending] of q.order) {
          const av = a[column];
          const bv = b[column];
          if (av == null || bv == null) {
            if (av == null && bv == null) continue;
            return (av == null ? 1 : -1) * (ascending ? 1 : -1); // NULLS LAST ascending, FIRST descending
          }
          const d = compare(column, av, bv);
          if (d !== 0) return ascending ? d : -d;
        }
        return 0;
      });
      if (q.limit !== null) rows = rows.slice(0, q.limit);
    }

    const count = q.count ? rows.length : null;
    const data = q.head || (q.action !== "select" && q.columns === null) ? null : project(rows, q.columns);
    if (q.single && Array.isArray(data)) {
      if (data.length > 1 || (q.single === "single" && data.length === 0)) {
        return { data: null, error: { code: "PGRST116", message: `JSON object requested, ${data.length} rows returned` }, count: null };
      }
      return { data: data[0] ?? null, error: null, count };
    }
    return { data, error: null, count };
  };

  const from = (table: string) => {
    const q: Call = { table, action: "select", columns: null, count: null, head: false, filters: [], or: [], order: [], limit: null, values: null, single: null };
    state.calls.push(q);
    const add = (op: Filter["op"], column: string, value: unknown) => {
      q.filters.push({ op, column, value });
      return builder;
    };
    const builder = {
      select(list = "*", opts?: { count?: string; head?: boolean }) {
        q.columns = list;
        q.count = opts?.count ?? null;
        q.head = opts?.head ?? false;
        return builder;
      },
      insert(values: Row | Row[]) {
        q.action = "insert";
        q.values = values;
        return builder;
      },
      update(values: Row) {
        q.action = "update";
        q.values = values;
        return builder;
      },
      delete() {
        q.action = "delete";
        return builder;
      },
      eq: (column: string, value: unknown) => add("eq", column, value),
      is: (column: string, value: unknown) => add("is", column, value),
      in: (column: string, values: readonly unknown[]) => add("in", column, [...values]),
      gt: (column: string, value: unknown) => add("gt", column, value),
      gte: (column: string, value: unknown) => add("gte", column, value),
      lt: (column: string, value: unknown) => add("lt", column, value),
      lte: (column: string, value: unknown) => add("lte", column, value),
      or(filters: string) {
        q.or.push(filters);
        return builder;
      },
      order(column: string, opts?: { ascending?: boolean }) {
        q.order.push([column, opts?.ascending ?? true]);
        return builder;
      },
      limit(n: number) {
        q.limit = n;
        return builder;
      },
      single() {
        q.single = "single";
        return builder;
      },
      maybeSingle() {
        q.single = "maybe";
        return builder;
      },
      then<A, B>(onFulfilled?: (v: Result) => A, onRejected?: (e: unknown) => B) {
        return new Promise<Result>((resolve) => resolve(run(q))).then(onFulfilled, onRejected);
      },
    };
    return builder;
  };

  /** Put rows in as if they were stored (defaults filled, times in PostgREST's form). */
  const seed = (...rows: Row[]) => {
    for (const r of rows) state.rows.push(withDefaults(r));
  };

  const client = { from } as unknown as SupabaseClient<Database>;
  return { client, state, seed };
}
