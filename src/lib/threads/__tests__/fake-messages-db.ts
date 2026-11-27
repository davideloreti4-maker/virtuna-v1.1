/**
 * fake-messages-db.ts — an in-memory stand-in for the Supabase client, for tests that need the
 * real message helpers to read back what they wrote (the database is the I/O boundary).
 *
 * It holds `messages` and `threads` rows and answers the query-builder calls the helpers and the
 * tool routes make: select, eq, is, order, limit, insert, update, single, maybeSingle, and a bare
 * await. Any other table is empty. `failOn` makes the next matching operation return an error, the
 * way a database failure reaches the client.
 */

type Row = Record<string, unknown>;
type Op = "select" | "insert" | "update";

export interface FakeMessagesDb {
  client: { from: (table: string) => unknown; auth?: unknown };
  tables: Record<string, Row[]>;
  /** The user rows of a thread, oldest first. */
  userRows: (threadId: string) => Row[];
  /** Make the next `op` on `table` fail. */
  failOn: (table: string, op: Op) => void;
}

export function fakeMessagesDb(): FakeMessagesDb {
  const tables: Record<string, Row[]> = { messages: [], threads: [] };
  const failures: { table: string; op: Op }[] = [];
  let seq = 0;

  const takeFailure = (table: string, op: Op) => {
    const i = failures.findIndex((f) => f.table === table && f.op === op);
    if (i === -1) return false;
    failures.splice(i, 1);
    return true;
  };

  function from(table: string) {
    let op: Op = "select";
    let payload: Row | null = null;
    const filters: ((r: Row) => boolean)[] = [];
    let orderBy: { col: string; ascending: boolean } | null = null;
    let limitTo: number | null = null;

    const run = (): { data: Row[] | null; error: { message: string } | null } => {
      if (takeFailure(table, op)) return { data: null, error: { message: `fake ${op} failure on ${table}` } };
      const rows = (tables[table] ??= []);
      if (op === "insert") {
        seq += 1;
        const row = { id: `${table}-${seq}`, created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(), ...payload };
        rows.push(row);
        return { data: [row], error: null };
      }
      let hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op === "update") {
        for (const r of hit) Object.assign(r, payload);
        return { data: hit, error: null };
      }
      if (orderBy) {
        const { col, ascending } = orderBy;
        hit = [...hit].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (ascending ? 1 : -1));
      }
      if (limitTo !== null) hit = hit.slice(0, limitTo);
      return { data: hit, error: null };
    };

    const builder = {
      select: () => builder,
      insert: (row: Row) => {
        op = "insert";
        payload = row;
        return builder;
      },
      update: (patch: Row) => {
        op = "update";
        payload = patch;
        return builder;
      },
      eq: (col: string, value: unknown) => {
        filters.push((r) => r[col] === value);
        return builder;
      },
      is: (col: string, value: unknown) => {
        filters.push((r) => (r[col] ?? null) === value);
        return builder;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        orderBy = { col, ascending: opts?.ascending ?? true };
        return builder;
      },
      limit: (n: number) => {
        limitTo = n;
        return builder;
      },
      single: async () => {
        const { data, error } = run();
        if (error) return { data: null, error };
        return data && data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: "not one row" } };
      },
      maybeSingle: async () => {
        const { data, error } = run();
        if (error) return { data: null, error };
        return { data: data?.[0] ?? null, error: null };
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    };
    return builder;
  }

  return {
    client: { from },
    tables,
    userRows: (threadId) => tables.messages!.filter((r) => r.thread_id === threadId && r.role === "user"),
    failOn: (table, op) => failures.push({ table, op }),
  };
}
