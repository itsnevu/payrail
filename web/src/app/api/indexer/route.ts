import { NextResponse } from "next/server";
import { runIndexer } from "@/lib/verify";

/**
 * POST /api/indexer[?chainId=4663]  (header: x-indexer-secret)
 * Run from cron (e.g. every 30 seconds) to catch payments that bypassed the UI (straight
 * from a wallet or script). Idempotent. Without `chainId` every enabled chain is scanned;
 * each chain keeps its own cursor, and one failing chain does not stop the others.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-indexer-secret");
  if (!process.env.INDEXER_SECRET || secret !== process.env.INDEXER_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const chainId = searchParams.get("chainId") ? Number(searchParams.get("chainId")) : undefined;
  try {
    const results = await runIndexer(chainId);
    const chains = results.map((r) =>
      "error" in r ? r : { ...r, from: r.from.toString(), to: r.to.toString() }
    );
    const ok = chains.every((c) => !("error" in c));
    return NextResponse.json({ ok, chains }, { status: ok ? 200 : 207 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
