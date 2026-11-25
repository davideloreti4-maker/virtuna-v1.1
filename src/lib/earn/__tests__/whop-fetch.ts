/**
 * A recording stand-in for `fetch` toward Whop (the network is the I/O boundary; nobody calls Whop from
 * a test, not the live service and not its sandbox). Each call is recorded as it was sent (address,
 * method, headers, the JSON body read back) and answered by the first route that matches its method and
 * path; a call no route answers fails the test loudly. Every id, key and username is made up.
 */
export interface SentCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  hasSignal: boolean;
}

export type Answer = { status: number; json?: unknown; text?: string } | "network-error" | "hang";

export interface Route {
  method: string;
  /** The path after the base address, e.g. "/affiliates" or a pattern. */
  path: string | RegExp;
  answer: Answer | ((call: SentCall) => Answer);
}

export const TEST_BASE = "https://whop.example.test/api/v1";
export const TEST_KEY = "test-key-not-real";
export const TEST_COMPANY = "biz_test1";

export function whopFetch(routes: Route[] = []) {
  const calls: SentCall[] = [];
  const http = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => (headers[key] = value));
    const call: SentCall = {
      url,
      method: (init?.method ?? "GET").toUpperCase(),
      headers,
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      hasSignal: init?.signal instanceof AbortSignal,
    };
    calls.push(call);
    const path = url.startsWith(TEST_BASE) ? url.slice(TEST_BASE.length) : url;
    const route = routes.find((r) => r.method === call.method && (typeof r.path === "string" ? r.path === path : r.path.test(path)));
    if (!route) throw new Error(`whop stand-in: nothing answers ${call.method} ${url}`);
    const answer = typeof route.answer === "function" ? route.answer(call) : route.answer;
    if (answer === "network-error") throw new TypeError("fetch failed");
    if (answer === "hang") {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
      });
    }
    const body = answer.text ?? JSON.stringify(answer.json ?? {});
    return new Response(body, { status: answer.status, headers: { "Content-Type": "application/json" } });
  };
  return { http, calls };
}

/** Whop's affiliate object as ruling 12 documents it. */
export function affiliateJson(over: Partial<{ id: string; username: string | null; earned: unknown }> = {}) {
  return {
    id: over.id ?? "aff_test1",
    status: "active",
    total_referrals_count: 3,
    total_referral_earnings_usd: "earned" in over ? over.earned : "12.50",
    user: { id: "user_test1", name: "Nia Carter", username: over.username === undefined ? "nia.cooks" : over.username },
  };
}
