import { NextResponse } from "next/server";
import { runIndexer } from "@/lib/verify";

/**
 * POST /api/indexer  (header: x-indexer-secret)
 * Run from cron (e.g. every 30 seconds) to catch payments that
 * bypassed the UI (straight from a wallet or script). Idempotent.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-indexer-secret");
  if (!process.env.INDEXER_SECRET || secret !== process.env.INDEXER_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const r = await runIndexer();
    return NextResponse.json({ ...r, from: r.from.toString(), to: r.to.toString() });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
