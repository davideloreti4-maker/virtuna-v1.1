/**
 * A recording stand-in for the database behind the Earn and Settings code: the tables those pages read
 * and the auth calls they make (the database is the I/O boundary). A small in-memory PostgREST, enough for
 * the calls made: `select` (a column list or `*`; with `{ count: "exact", head: true }`), `eq`, `neq` (SQL's
 * `<>`: a null never matches), `order` (with `nullsFirst`), `limit`, `maybeSingle`, `single`,
 * `insert(...).select(...).single()` and `update(...).eq(...).select(...)`. It refuses a column the table does
 * not have (`src/types/database.types.ts`, abridged), keeps `referral_codes`' two unique keys (`code`,
 * `user_id`: a second row answers Postgres's 23505), `referral_clicks`' one (`referred_user_id` with
 * `referral_code`) and the checks of step B's migration on its two Whop columns (23514), and records every
 * call with the client that sent it.
 *
 * `serviceClient()` adds what the service role reaches and the session's key does not:
 * `auth.admin.getUserById`, answered from `state.accounts` (a missing account answers 404, as GoTrue does).
 *
 * Two switches, both off unless a test turns them on:
 * - `state.sessionAs` (an account's id): the session client reaches only the rows that name that account,
 *   as a session does; the service client reaches every row, as the service role does. A test of who reads
 *   or writes a row turns it on: with it off a session reaches everything, which shows nothing.
 * - `state.serverWritesOnly`: the two referral tables take a new row from the service client only, and a
 *   Whop account is held by one row (a second answers 23505). The server writes these rows itself, so the
 *   code is tested with the switch on and off and must answer the same.
 * Every id, code and name is made up.
 */
import { WHOP_AFFILIATE_ID_PATTERN, WHOP_USERNAME_PATTERN } from "../earn";

type Row = Record<string, unknown>;

export interface Call {
  table: string;
  op: "select" | "insert" | "update";
  columns: string;
  filters: Array<[string, unknown]>;
  values?: Row;
  neq?: Array<[string, unknown]>;
  order?: Array<[string, boolean]>;
  limit?: number;
  /** Which client sent it. */
  client?: "session" | "service";
}

const COLUMNS: Record<string, readonly string[]> = {
  referral_codes: ["id", "user_id", "code", "created_at", "whop_username", "whop_affiliate_id"],
  referral_clicks: ["id", "referral_code", "referrer_user_id", "referred_user_id", "clicked_at", "referrer_url", "user_agent", "ip_hash"],
  referral_conversions: ["id", "referrer_user_id", "referred_user_id", "referral_code", "whop_membership_id", "bonus_cents", "converted_at", "metadata"],
  user_settings: ["id", "user_id", "display_name", "company", "role", "avatar_url"],
  creator_profiles: ["id", "user_id", "display_name", "tiktok_handle"],
  user_subscriptions: ["id", "user_id", "virtuna_tier", "status", "whop_user_id", "whop_membership_id", "whop_product_id", "is_trial", "trial_started_at", "trial_ends_at", "trial_used_at"],
  connected_accounts: ["id", "user_id", "platform", "handle", "display_name", "is_primary", "connection_method", "last_synced_at", "created_at"],
};
const UNIQUE: Record<string, readonly string[]> = { referral_codes: ["code", "user_id"] };
/** Unique together (a null never clashes, as in SQL). */
const UNIQUE_TOGETHER: Record<string, readonly (readonly string[])[]> = { referral_clicks: [["referred_user_id", "referral_code"]] };
/** Unique where set, with `state.serverWritesOnly` on. */
const UNIQUE_WHERE_SET: Record<string, readonly string[]> = { referral_codes: ["whop_username", "whop_affiliate_id"] };
/** With `state.sessionAs` on: the column that must hold the session's own account id, to read a row and to add one. */
const OWN: Record<string, { select: string; insert: string }> = {
  referral_codes: { select: "user_id", insert: "user_id" },
  referral_clicks: { select: "referrer_user_id", insert: "referred_user_id" },
};
/** The checks of `20261124203943_referral_codes_whop.sql` (a null passes, as in SQL). */
const CHECKS: Record<string, Record<string, RegExp>> = {
  referral_codes: { whop_username: WHOP_USERNAME_PATTERN, whop_affiliate_id: WHOP_AFFILIATE_ID_PATTERN },
};

export interface AuthUser {
  id: string;
  is_anonymous?: boolean;
  created_at?: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}
export interface Account {
  id: string;
  created_at: string;
}

export function fakeReferralDb() {
  const state = {
    tables: Object.fromEntries(Object.keys(COLUMNS).map((t) => [t, [] as Row[]])) as Record<string, Row[]>,
    calls: [] as Call[],
    /** The signed-in user the session client's `auth.getUser` answers. */
    user: null as AuthUser | null,
    authCalls: 0,
    /** Accounts `auth.admin.getUserById` knows. */
    accounts: [] as Account[],
    adminCalls: [] as string[],
    /** getUserById answers this error for every id (not a 404). */
    adminFails: false,
    /** getUserById answers this error for these ids only. */
    adminFailsFor: [] as string[],
    /** A call to this table answers an error instead of running. */
    failOn: null as string | null,
    /** A call to this table never answers. */
    hangOn: null as string | null,
    /** The next this-many inserts into referral_codes answer 23505 (a code another account took first). */
    codeTaken: 0,
    /** The next insert into referral_codes answers this error code instead of running. */
    insertError: null as string | null,
    /**
     * The account the session client acts as (null: off, it reaches every row). On: it reads only its own
     * `referral_codes` row and the `referral_clicks` rows that name it as the referrer, adds no row that
     * names another account, and changes none.
     */
    sessionAs: null as string | null,
    /** The referral tables take a new row from the service client only; one Whop account per row. */
    serverWritesOnly: false,
  };

  type Opts = { single: boolean; head: boolean; count: boolean; order: Array<[string, boolean, boolean]>; limit: number | null };
  type Result = { data: unknown; count: number | null; error: { message: string; code: string } | null };
  const fail = (message: string, code: string): Result => ({ data: null, count: null, error: { message, code } });

  function run(call: Call, opts: Opts): Result {
    if (state.failOn === call.table) return fail("connection reset by peer", "08006");
    const known = COLUMNS[call.table];
    if (!known) return fail(`relation ${call.table} does not exist`, "42P01");
    const fields =
      call.columns.trim() === "*"
        ? [...known]
        : call.columns
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);
    const named = [
      ...fields,
      ...call.filters.map(([c]) => c),
      ...(call.neq ?? []).map(([c]) => c),
      ...opts.order.map(([c]) => c),
      ...Object.keys(call.values ?? {}),
    ];
    const bad = named.find((c) => !known.includes(c));
    if (bad) return fail(`column ${call.table}.${bad} does not exist`, "42703");
    const rows = state.tables[call.table]!;
    /** Set when this call is a session's and `state.sessionAs` is on: the columns that must name it. */
    const held = call.client === "session" && state.sessionAs !== null ? OWN[call.table] : undefined;
    const denied = () => fail(`new row violates row-level security policy for table "${call.table}"`, "42501");
    /** A Whop account another row already holds (`state.serverWritesOnly`). */
    const whopClash = (values: Row, own: readonly Row[]) =>
      state.serverWritesOnly
        ? (UNIQUE_WHERE_SET[call.table] ?? []).find((key) => values[key] != null && rows.some((r) => !own.includes(r) && r[key] === values[key]))
        : undefined;
    const project = (row: Row): Row => Object.fromEntries(fields.map((c) => [c, structuredClone(row[c] ?? null)]));
    const checked = (values: Row) => {
      for (const [column, pattern] of Object.entries(CHECKS[call.table] ?? {})) {
        const v = values[column];
        if (v !== undefined && v !== null && !(typeof v === "string" && pattern.test(v))) {
          return fail(`new row for relation "${call.table}" violates check constraint "${call.table}_${column}_form"`, "23514");
        }
      }
      return null;
    };

    if (call.op === "insert") {
      if (call.table === "referral_codes" && state.insertError) {
        const code = state.insertError;
        state.insertError = null;
        return fail("insert refused", code);
      }
      if (call.table === "referral_codes" && state.codeTaken > 0) {
        state.codeTaken -= 1;
        return fail('duplicate key value violates unique constraint "referral_codes_code_key"', "23505");
      }
      const values = call.values!;
      if (held && (state.serverWritesOnly || values[held.insert] !== state.sessionAs)) return denied();
      const refused = checked(values);
      if (refused) return refused;
      const clash = (UNIQUE[call.table] ?? []).find((key) => rows.some((r) => r[key] === values[key])) ?? whopClash(values, []);
      if (clash) return fail(`duplicate key value violates unique constraint "${call.table}_${clash}_key"`, "23505");
      const together = (UNIQUE_TOGETHER[call.table] ?? []).find((keys) => keys.every((k) => values[k] != null) && rows.some((r) => keys.every((k) => r[k] === values[k])));
      if (together) return fail(`duplicate key value violates unique constraint "${call.table}_${together.join("_")}_key"`, "23505");
      const stored: Row = { id: `row-${rows.length + 1}`, created_at: "2026-11-24T10:00:00.000Z", ...values };
      rows.push(stored);
      const out = project(stored);
      return { data: opts.single ? out : [out], count: null, error: null };
    }

    const matched = rows
      .filter((row) => !held || row[held.select] === state.sessionAs)
      .filter((row) => call.filters.every(([c, v]) => row[c] != null && row[c] === v))
      .filter((row) => (call.neq ?? []).every(([c, v]) => row[c] != null && row[c] !== v))
      .sort((a, b) => {
        for (const [c, asc, nullsFirst] of opts.order) {
          if (a[c] == null || b[c] == null) {
            if (a[c] == null && b[c] == null) continue;
            return (a[c] == null) === nullsFirst ? -1 : 1;
          }
          const d = String(a[c]) < String(b[c]) ? -1 : String(a[c]) > String(b[c]) ? 1 : 0;
          if (d !== 0) return asc ? d : -d;
        }
        return 0;
      });

    if (call.op === "update") {
      const refused = checked(call.values!);
      if (refused) return refused;
      // A session changes no row of the referral tables.
      if (held) return { data: opts.single ? null : [], count: null, error: null };
      const taken = whopClash(call.values!, matched);
      if (taken) return fail(`duplicate key value violates unique constraint "${call.table}_${taken}_key"`, "23505");
      for (const row of matched) Object.assign(row, call.values);
      const out = matched.map(project);
      return { data: opts.single ? (out[0] ?? null) : out, count: null, error: null };
    }

    const count = opts.count ? matched.length : null;
    if (opts.head) return { data: null, count, error: null };
    const limited = opts.limit === null ? matched : matched.slice(0, opts.limit);
    const out = limited.map(project);
    if (opts.single) {
      if (out.length > 1) return fail(`JSON object requested, ${out.length} rows returned`, "PGRST116");
      return { data: out[0] ?? null, count, error: null };
    }
    return { data: out, count, error: null };
  }

  function fromAs(client: "session" | "service") {
    return function from(table: string) {
      const call: Call = { table, op: "select", columns: "", filters: [], client };
      const opts: Opts = { single: false, head: false, count: false, order: [], limit: null };
      state.calls.push(call);
      const builder = {
        select(columns = "*", o?: { count?: string; head?: boolean }) {
          call.columns = columns;
          opts.head = o?.head ?? false;
          opts.count = o?.count === "exact";
          return builder;
        },
        insert(values: Row) {
          call.op = "insert";
          call.values = values;
          return builder;
        },
        update(values: Row) {
          call.op = "update";
          call.values = values;
          return builder;
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          return builder;
        },
        neq(column: string, value: unknown) {
          (call.neq ??= []).push([column, value]);
          return builder;
        },
        order(column: string, o?: { ascending?: boolean; nullsFirst?: boolean }) {
          const ascending = o?.ascending ?? true;
          // PostgreSQL's default: nulls come last ascending, first descending.
          opts.order.push([column, ascending, o?.nullsFirst ?? !ascending]);
          (call.order ??= []).push([column, ascending]);
          return builder;
        },
        limit(n: number) {
          opts.limit = n;
          call.limit = n;
          return builder;
        },
        maybeSingle() {
          opts.single = true;
          return builder;
        },
        single() {
          opts.single = true;
          return builder;
        },
        then<A, B>(onFulfilled?: (v: Result) => A, onRejected?: (e: unknown) => B) {
          if (state.hangOn === table) return new Promise<Result>(() => {}).then(onFulfilled, onRejected);
          return Promise.resolve()
            .then(() => run(call, opts))
            .then(onFulfilled, onRejected);
        },
      };
      return builder;
    };
  }

  const from = fromAs("session");

  const auth = {
    getUser: async () => {
      state.authCalls += 1;
      return { data: { user: state.user }, error: null };
    },
  };

  /** The session client: the user's own key. */
  const sessionClient = () => ({ auth, from });

  /** The service client: also reaches `auth.admin`. */
  const serviceClient = () => ({
    from: fromAs("service"),
    auth: {
      admin: {
        getUserById: async (id: string) => {
          state.adminCalls.push(id);
          if (state.adminFails || state.adminFailsFor.includes(id)) return { data: { user: null }, error: { message: "upstream unavailable", status: 503 } };
          const account = state.accounts.find((a) => a.id === id);
          if (!account) return { data: { user: null }, error: { message: "User not found", status: 404, code: "user_not_found" } };
          return { data: { user: { id: account.id, created_at: account.created_at, email: `${account.id}@example.test` } }, error: null };
        },
      },
    },
  });

  return { state, from, sessionClient, serviceClient };
}

export type FakeReferralDb = ReturnType<typeof fakeReferralDb>;
