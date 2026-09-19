// Simple loop that calls /api/indexer every N seconds (a stand-in for cron during development).
// Run: node scripts/indexer-loop.mjs            (every enabled chain)
//      CHAIN_ID=4663 node scripts/indexer-loop.mjs (one chain)
const URL = process.env.APP_URL || "http://localhost:3000";
const SECRET = process.env.INDEXER_SECRET || "change-me";
const INTERVAL = Number(process.env.INDEXER_INTERVAL_MS || 15000);
const QUERY = process.env.CHAIN_ID ? `?chainId=${process.env.CHAIN_ID}` : "";

async function tick() {
  try {
    const r = await fetch(`${URL}/api/indexer${QUERY}`, { method: "POST", headers: { "x-indexer-secret": SECRET } });
    const j = await r.json();
    console.log(new Date().toISOString(), r.status, JSON.stringify(j));
  } catch (e) {
    console.error("indexer error:", e.message);
  }
}
tick();
setInterval(tick, INTERVAL);
