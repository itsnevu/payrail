// End-to-end check against a running local stack (hardhat node + `npm run dev`).
// 1. registers a merchant and creates an invoice through the API
// 2. an attacker tries to grief the invoice on chain (wrong merchant, 1 unit)
// 3. the real buyer approves and pays with the exact terms
// 4. posts the txHash to /verify and expects PAID
// Run: node scripts/e2e-local.mjs
import { createWalletClient, createPublicClient, http, parseAbi, keccak256, toBytes, encodeAbiParameters } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { readFileSync } from "node:fs";

const APP = process.env.APP_URL || "http://localhost:3000";
const dep = JSON.parse(readFileSync(new URL("../src/lib/deployment.json", import.meta.url), "utf8"));

// hardhat default accounts #1 (merchant), #2 (buyer), #0 (attacker; funded by the deploy script)
const MERCHANT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const BUYER_PK = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
const ATTACKER_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const erc20 = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);
const pp = parseAbi([
  "function pay(bytes32 salt, address merchant, uint256 amount)",
  "function isPaid(bytes32 invoiceId) view returns (bool)",
  "function invoiceKey(bytes32 salt, address merchant, uint256 amount) pure returns (bytes32)",
]);

const pub = createPublicClient({ chain: hardhat, transport: http() });
const wallet = (pk) => createWalletClient({ account: privateKeyToAccount(pk), chain: hardhat, transport: http() });
const buyer = wallet(BUYER_PK);
const attacker = wallet(ATTACKER_PK);

const json = (r) => r.json();
const post = (path, body) =>
  fetch(`${APP}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(json);

const assert = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exit(1); } console.log("ok  ", msg); };

// 1. merchant + invoice
const m = await post("/api/merchants", { name: "E2E Merchant", walletAddress: MERCHANT });
const inv = await post("/api/invoices", { merchantId: m.id, description: "e2e v2", amount: "12.50" });
const amount = BigInt(inv.amount);
const salt = keccak256(toBytes(inv.id));
const expectedKey = keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "address" }, { type: "uint256" }], [salt, MERCHANT, amount]));
assert(inv.onchainId === expectedKey.toLowerCase(), "backend onchainId equals keccak256(abi.encode(salt, merchant, amount))");
const chainKey = await pub.readContract({ address: dep.paymentProcessor, abi: pp, functionName: "invoiceKey", args: [salt, MERCHANT, amount] });
assert(chainKey.toLowerCase() === inv.onchainId, "contract invoiceKey agrees with backend");

// 2. griefing attempt: attacker pays 1 unit to themselves with the real salt
await pub.waitForTransactionReceipt({ hash: await attacker.writeContract({ address: dep.usdc, abi: erc20, functionName: "approve", args: [dep.paymentProcessor, 1n] }) });
const griefTx = await attacker.writeContract({ address: dep.paymentProcessor, abi: pp, functionName: "pay", args: [salt, attacker.account.address, 1n] });
await pub.waitForTransactionReceipt({ hash: griefTx });
assert((await pub.readContract({ address: dep.paymentProcessor, abi: pp, functionName: "isPaid", args: [inv.onchainId] })) === false, "griefing tx did not mark the real invoice paid on chain");
const griefVerify = await fetch(`${APP}/api/invoices/${inv.id}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txHash: griefTx }) });
assert(griefVerify.status === 400, `backend rejects the griefing tx (status ${griefVerify.status})`);
assert((await fetch(`${APP}/api/invoices/${inv.id}`).then(json)).status === "PENDING", "invoice still PENDING after griefing attempt");

// 3. real payment
const before = await pub.readContract({ address: dep.usdc, abi: erc20, functionName: "balanceOf", args: [MERCHANT] });
await pub.waitForTransactionReceipt({ hash: await buyer.writeContract({ address: dep.usdc, abi: erc20, functionName: "approve", args: [dep.paymentProcessor, amount] }) });
const payTx = await buyer.writeContract({ address: dep.paymentProcessor, abi: pp, functionName: "pay", args: [salt, MERCHANT, amount] });
await pub.waitForTransactionReceipt({ hash: payTx });
const after = await pub.readContract({ address: dep.usdc, abi: erc20, functionName: "balanceOf", args: [MERCHANT] });
assert(after - before === amount, "merchant received exactly the invoice amount");
assert((await pub.readContract({ address: dep.usdc, abi: erc20, functionName: "balanceOf", args: [dep.paymentProcessor] })) === 0n, "contract balance is zero");

// 4. verify
let v;
for (let i = 0; i < 10; i++) {
  const r = await fetch(`${APP}/api/invoices/${inv.id}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txHash: payTx }) });
  v = { status: r.status, body: await r.json() };
  if (r.status !== 202) break;
  await new Promise((res) => setTimeout(res, 1000));
}
assert(v.status === 200 && v.body.ok, `verify returned 200 ok (${JSON.stringify(v.body).slice(0, 120)})`);
const final = await fetch(`${APP}/api/invoices/${inv.id}`).then(json);
assert(final.status === "PAID" && final.payment?.txHash === payTx, "invoice is PAID with the right txHash");

// replay: same tx again is idempotent
const again = await post(`/api/invoices/${inv.id}/verify`, { txHash: payTx });
assert(again.ok === true, "re-verifying the same tx is idempotent");
console.log("\nE2E passed");
