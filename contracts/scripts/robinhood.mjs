#!/usr/bin/env node
/**
 * One-shot deploy of PaymentProcessor to Robinhood Chain.
 *
 *   npm run go:robinhood            mainnet, chain 4663
 *   npm run go:robinhood-testnet    testnet, chain 46630
 *   … -- --dry-run                  only check RPC, gas and token; deploy nothing
 *
 * The only thing you must provide is DEPLOYER_PRIVATE_KEY in contracts/.env (a wallet with
 * a little ETH on that chain). Everything else is handled here:
 *
 *   1. picks a working RPC: the public endpoint, or, when an ISP filter answers instead of
 *      the chain, a local forwarder that reaches Cloudflare by IP with the right SNI
 *   2. checks the deployer has ETH for gas
 *   3. finds the 6-decimal dollar token to bill in (USDC_ADDRESS_ROBINHOOD* from .env wins;
 *      otherwise the known candidates are probed on chain for symbol/decimals/code)
 *   4. runs scripts/deploy.ts through hardhat on that RPC
 *   5. tries to verify the source on Blockscout (non-fatal)
 *
 * Nothing here is interactive. No dependencies beyond Node 18 and the hardhat toolchain
 * already in this folder.
 */
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const TESTNET = process.argv.includes("--testnet");
// --dry-run: check RPC, gas and token, then stop before deploying.
const DRY = process.argv.includes("--dry-run");

const NET = TESTNET
  ? {
      name: "robinhoodTestnet",
      chainId: 46630,
      rpcHost: "rpc.testnet.chain.robinhood.com",
      explorer: "https://explorer.testnet.chain.robinhood.com",
      envKey: "USDC_ADDRESS_ROBINHOODTESTNET",
      rpcEnv: "ROBINHOOD_TESTNET_RPC_URL",
      // Test USDC (6 decimals, symbol USDC) deployed by the halon repo's DeployAll script.
      candidates: ["0x13FD816D2b558Cea086754C990D722514c004049"],
      gasHint: "Bridge a little Sepolia ETH to Robinhood Chain Testnet, or ask the Robinhood Chain faucet.",
    }
  : {
      name: "robinhoodMainnet",
      chainId: 4663,
      rpcHost: "rpc.mainnet.chain.robinhood.com",
      explorer: "https://robinhoodchain.blockscout.com",
      envKey: "USDC_ADDRESS_ROBINHOODMAINNET",
      rpcEnv: "ROBINHOOD_RPC_URL",
      // USDG (Global Dollar, 6 decimals): the dollar stablecoin the halon repo settles in on
      // Robinhood Chain mainnet. Put a Circle USDC address in .env to bill in USDC instead.
      candidates: ["0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"],
      gasHint: "Bridge a little ETH to Robinhood Chain (Arbitrum Orbit bridge) for the deployer.",
    };

// Cloudflare edge that fronts rpc.*.chain.robinhood.com; SNI selects the host.
const CF_IP = process.env.RPC_PROXY_UPSTREAM_IP || "104.20.46.209";

// ── .env ────────────────────────────────────────────────────────────────────
function loadEnv() {
  const p = path.join(ROOT, ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const log = (...a) => console.log("[robinhood]", ...a);
const die = (msg) => { console.error("\n[robinhood] ✗", msg, "\n"); process.exit(1); };

const PK = process.env.DEPLOYER_PRIVATE_KEY || "";
if (!/^0x[0-9a-fA-F]{64}$/.test(PK)) {
  die("DEPLOYER_PRIVATE_KEY is missing. Open contracts/.env and set it to the 0x… private key of a wallet that holds a little ETH on Robinhood Chain. Nothing else is required.");
}

// ── JSON-RPC helpers ─────────────────────────────────────────────────────────
function rpcDirect(url, method, params = []) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === "https:" ? https : http;
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
    const req = mod.request(
      { host: u.hostname, port: u.port || (u.protocol === "https:" ? 443 : 80), path: u.pathname, method: "POST",
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) }, timeout: 15000 },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { const j = JSON.parse(data); j.error ? reject(new Error(j.error.message)) : resolve(j.result); }
          catch { reject(new Error(`non-JSON answer (${res.statusCode}): likely an ISP filter page`)); }
        });
      }
    );
    req.on("error", reject); req.on("timeout", () => req.destroy(new Error("timeout")));
    req.end(body);
  });
}

/** Local forwarder: plain HTTP in, HTTPS to the Cloudflare IP with SNI = the real host. */
function startForwarder(host) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const body = Buffer.concat(chunks);
        const up = https.request(
          { host: CF_IP, servername: host, port: 443, method: "POST", path: "/",
            headers: { host, "content-type": "application/json", accept: "application/json", "content-length": body.length }, timeout: 30000 },
          (r) => { res.writeHead(r.statusCode || 502, { "content-type": "application/json" }); r.pipe(res); }
        );
        up.on("error", (e) => { res.writeHead(502, { "content-type": "application/json" }); res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32603, message: e.message } })); });
        up.end(body);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function chainIdOf(url) {
  try { return Number(await rpcDirect(url, "eth_chainId")); } catch { return null; }
}

// ── 1. RPC ──────────────────────────────────────────────────────────────────
let forwarder = null;
async function pickRpc() {
  const tried = [];
  const env = process.env[NET.rpcEnv];
  for (const url of [env, `https://${NET.rpcHost}`].filter(Boolean)) {
    const id = await chainIdOf(url);
    tried.push(`${url} → ${id ?? "no answer"}`);
    if (id === NET.chainId) return url;
  }
  log("public RPC is not reachable as the chain (ISP filter?), starting a local forwarder …");
  forwarder = await startForwarder(NET.rpcHost);
  const id = await chainIdOf(forwarder.url);
  tried.push(`${forwarder.url} (→ ${CF_IP} sni ${NET.rpcHost}) → ${id ?? "no answer"}`);
  if (id === NET.chainId) return forwarder.url;
  die(`no RPC answers as chain ${NET.chainId}:\n  ${tried.join("\n  ")}\nSet ${NET.rpcEnv} in contracts/.env to a provider URL that works from this network.`);
}

// ── helpers on top of RPC ───────────────────────────────────────────────────
async function call(url, to, data) { return rpcDirect(url, "eth_call", [{ to, data }, "latest"]); }
function decodeString(hex) {
  if (!hex || hex === "0x") return "";
  const b = Buffer.from(hex.slice(2), "hex");
  if (b.length === 32) return b.toString("utf8").replace(/\0+$/, ""); // bytes32-style symbol
  const len = Number(BigInt("0x" + b.subarray(32, 64).toString("hex")));
  return b.subarray(64, 64 + len).toString("utf8");
}
async function tokenInfo(url, addr) {
  const code = await rpcDirect(url, "eth_getCode", [addr, "latest"]);
  if (!code || code === "0x") return { addr, ok: false, why: "no code at this address" };
  let symbol = "?", decimals = null;
  try { symbol = decodeString(await call(url, addr, "0x95d89b41")); } catch {}
  try { decimals = Number(BigInt(await call(url, addr, "0x313ce567"))); } catch {}
  if (decimals !== 6) return { addr, symbol, decimals, ok: false, why: `decimals is ${decimals}, Payrail assumes 6` };
  return { addr, symbol, decimals, ok: true };
}

function addressFromPk(pk) {
  // Derive the deployer address with hardhat's own ethers, to avoid a second dependency.
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["-e", `const {Wallet}=require("ethers");process.stdout.write(new Wallet(process.argv[1]).address)`, pk], { cwd: ROOT, env: { ...process.env, NODE_PATH: path.join(ROOT, "node_modules") } });
    let out = ""; child.stdout.on("data", (c) => (out += c)); child.on("close", () => resolve(out.trim()));
  });
}

function run(cmd, args, extraEnv) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, ...extraEnv } });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  log(`target: ${NET.name} (chain ${NET.chainId})`);
  const rpc = await pickRpc();
  log(`rpc: ${rpc}`);

  // 2. gas
  const deployer = await addressFromPk(PK);
  if (!/^0x[0-9a-fA-F]{40}$/.test(deployer)) die("could not derive the deployer address; run `npm install` in contracts/ first.");
  const balWei = BigInt(await rpcDirect(rpc, "eth_getBalance", [deployer, "latest"]));
  const eth = Number(balWei) / 1e18;
  log(`deployer: ${deployer}  balance: ${eth.toFixed(6)} ETH`);
  if (balWei === 0n && !DRY) die(`deployer has 0 ETH on chain ${NET.chainId}; it cannot pay gas. ${NET.gasHint}`);

  // 3. token
  const fromEnv = process.env[NET.envKey] || process.env.USDC_ADDRESS;
  const candidates = [fromEnv, ...NET.candidates].filter((a) => a && /^0x[0-9a-fA-F]{40}$/.test(a));
  let token = null;
  for (const a of candidates) {
    const info = await tokenInfo(rpc, a);
    log(`token ${a}: ${info.ok ? `${info.symbol}, ${info.decimals} decimals ✓` : `rejected (${info.why})`}`);
    if (info.ok) { token = info; break; }
  }
  if (!token) die(`no usable 6-decimal token found. Set ${NET.envKey} in contracts/.env to the stablecoin contract on this chain.`);
  if (!/USDC/i.test(token.symbol)) {
    log(`NOTE: billing token is ${token.symbol}, not USDC. The app labels amounts "USDC"; set ${NET.envKey} to a USDC contract if you need USDC specifically.`);
  }

  if (DRY) { log(`dry run: would deploy with token ${token.addr} on ${rpc}. Nothing sent.`); forwarder?.server.close(); process.exit(balWei === 0n ? 2 : 0); }

  // 4. deploy (deploy.ts re-checks the token has code and writes both deployment records)
  log("deploying PaymentProcessor …");
  const code = await run("npx", ["hardhat", "run", "scripts/deploy.ts", "--network", NET.name], {
    [NET.rpcEnv]: rpc,
    [NET.envKey]: token.addr,
  });
  if (code !== 0) die("hardhat deploy failed (see output above).");

  const rec = JSON.parse(readFileSync(path.join(ROOT, "deployments", `${NET.chainId}.json`), "utf8"));

  // 5. verify (Blockscout is sometimes behind a Cloudflare challenge; never fatal)
  log("verifying on Blockscout …");
  const v = await run("npx", ["hardhat", "verify", "--network", NET.name, rec.paymentProcessor, rec.usdc], { [NET.rpcEnv]: rpc });
  if (v !== 0) log("verification did not complete; re-run later:\n  npx hardhat verify --network " + NET.name + " " + rec.paymentProcessor + " " + rec.usdc);

  console.log(`
────────────────────────────────────────────────────────────
  Deployed on ${NET.name} (chain ${NET.chainId})
  PaymentProcessor  ${rec.paymentProcessor}
  Token             ${rec.usdc}  (${token.symbol})
  Explorer          ${NET.explorer}/address/${rec.paymentProcessor}

  Written: contracts/deployments/${NET.chainId}.json  (commit it)
           web/src/lib/deployments.json               (entry "${NET.chainId}")

  Next:
    cd ../web && npm run build   # or restart the dev server / pm2
    The chain now appears in the invoice form and in GET /api/chains.
────────────────────────────────────────────────────────────`);
  forwarder?.server.close();
  process.exit(0);
})().catch((e) => die(e.message || String(e)));
