// Simple loop that calls /api/indexer every N seconds (a stand-in for cron during development).
// Run: node scripts/indexer-loop.mjs
const URL = process.env.APP_URL || "http://localhost:3000";
const SECRET = process.env.INDEXER_SECRET || "change-me";
const INTERVAL = Number(process.env.INDEXER_INTERVAL_MS || 15000);

async function tick() {
  try {
    const r = await fetch(`${URL}/api/indexer`, { method: "POST", headers: { "x-indexer-secret": SECRET } });
    const j = await r.json();
    console.log(new Date().toISOString(), r.status, JSON.stringify(j));
  } catch (e) {
    console.error("indexer error:", e.message);
  }
}
tick();
setInterval(tick, INTERVAL);
