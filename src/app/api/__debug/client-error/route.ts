// TEMPORARY DEBUG ROUTE — capture client-side crash stacks in the dev terminal.
// Remove after the Develop-click WSOD is root-caused (Phase 05 UAT).
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  // eslint-disable-next-line no-console
  console.error(
    "\n========== [CLIENT-ERROR CAPTURE] ==========\n" +
      `kind:    ${body.kind ?? "?"}\n` +
      `message: ${body.message ?? "?"}\n` +
      `name:    ${body.name ?? "?"}\n` +
      `url:     ${body.url ?? "?"}\n` +
      `stack:\n${body.stack ?? "(no stack)"}\n` +
      "============================================\n"
  );
  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
