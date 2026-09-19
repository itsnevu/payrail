import { createPublicClient, http, parseEventLogs, getAddress, type Hash, type PublicClient } from "viem";
import { paymentProcessorAbi } from "./chain";
import { CHAINS, chainName, requireChain } from "./chains";
import { prisma } from "./db";
import { notifyMerchant } from "./push";
import { formatUsdc } from "./usdc";

/**
 * One public client per chain, created lazily and reused. The server always talks to
 * `serverRpc` (never the browser relay, which would loop back into this same app).
 */
const clients = new Map<number, PublicClient>();
export function publicClientFor(chainId: number): PublicClient {
  let c = clients.get(chainId);
  if (!c) {
    const cfg = requireChain(chainId);
    c = createPublicClient({ chain: cfg.chain, transport: http(cfg.serverRpc) });
    clients.set(chainId, c);
  }
  return c;
}

/** Confirmations before PAID. Per chain via CONFIRMATIONS_<id>, else the global CONFIRMATIONS. */
export function confirmationsFor(chainId: number): bigint {
  const perChain = process.env[`CONFIRMATIONS_${chainId}`];
  return BigInt(perChain || process.env.CONFIRMATIONS || "1");
}

type PaymentLog = {
  invoiceId: `0x${string}`;
  salt: `0x${string}`;
  payer: `0x${string}`;
  merchant: `0x${string}`;
  amount: bigint;
  timestamp: bigint;
};

/**
 * Apply one PaymentReceived event (seen on `chainId`) to the database.
 * Idempotent: safe to call repeatedly for the same tx.
 */
export async function applyPaymentLog(
  chainId: number,
  log: PaymentLog,
  txHash: Hash,
  blockNumber: bigint
): Promise<{ ok: boolean; reason?: string; invoiceId?: string }> {
  const invoice = await prisma.invoice.findUnique({
    where: { onchainId: log.invoiceId.toLowerCase() },
    include: { merchant: true, payment: true },
  });
  if (!invoice) return { ok: false, reason: "no invoice found for this onchainId" };
  if (invoice.payment) return { ok: true, invoiceId: invoice.id }; // already processed

  // The key binds (salt, merchant, amount) but not the chain: the same terms hash to the
  // same key everywhere. A payment on the wrong network must never close the invoice.
  if (invoice.chainId !== chainId) {
    return { ok: false, reason: `invoice is on ${chainName(invoice.chainId)}, payment was on ${chainName(chainId)}` };
  }

  // Re-check terms anyway: defense in depth against a bad deployment or a wrong ABI.
  if (getAddress(log.merchant) !== getAddress(invoice.merchant.walletAddress)) {
    return { ok: false, reason: "merchant mismatch" };
  }
  if (log.amount !== BigInt(invoice.amount)) {
    return { ok: false, reason: `amount mismatch: ${log.amount} != ${invoice.amount}` };
  }

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        chainId,
        txHash,
        payer: getAddress(log.payer),
        amount: log.amount.toString(),
        blockNumber,
        paidAt: new Date(Number(log.timestamp) * 1000),
      },
    }),
    prisma.invoice.update({ where: { id: invoice.id }, data: { status: "PAID" } }),
  ]);

  // Tell the merchant's devices. Never lets a push failure fail the verification.
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  notifyMerchant(invoice.merchantId, {
    title: "Invoice paid",
    body: `${invoice.customerName || invoice.description}: ${formatUsdc(log.amount)} USDC received on ${chainName(chainId)}`,
    url: `${base}/invoices/${invoice.id}`,
    tag: `invoice-${invoice.id}`,
  }).catch((e) => console.warn("[push] notify failed", e));

  return { ok: true, invoiceId: invoice.id };
}

/**
 * Verify one transaction by hash on the invoice's chain (called by the frontend after paying).
 */
export async function verifyTx(chainId: number, txHash: Hash, expectedInvoiceOnchainId: string) {
  const cfg = requireChain(chainId);
  const client = publicClientFor(chainId);
  const confirmations = confirmationsFor(chainId);

  const receipt = await client.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (!receipt) return { ok: false, reason: "transaction not found or not mined yet", pending: true };
  if (receipt.status !== "success") return { ok: false, reason: "transaction reverted" };

  const latest = await client.getBlockNumber();
  if (latest - receipt.blockNumber + 1n < confirmations) {
    return { ok: false, reason: "waiting for confirmations", pending: true };
  }

  const logs = parseEventLogs({
    abi: paymentProcessorAbi,
    eventName: "PaymentReceived",
    logs: receipt.logs.filter((l) => getAddress(l.address) === getAddress(cfg.paymentProcessor)),
  });

  const match = logs.find(
    (l) => (l.args as PaymentLog).invoiceId.toLowerCase() === expectedInvoiceOnchainId.toLowerCase()
  );
  if (!match) return { ok: false, reason: "no PaymentReceived event for this invoice in the tx" };

  return applyPaymentLog(chainId, match.args as PaymentLog, txHash, receipt.blockNumber);
}

export type IndexerResult = { chainId: number; scanned: number; applied: number; from: bigint; to: bigint };

/**
 * Indexer for one chain: scan PaymentReceived logs from the last stored block to the head.
 * Each chain keeps its own cursor (IndexerState.chainId). Catches payments made outside the
 * UI (straight from a wallet or script).
 */
export async function runIndexerFor(chainId: number, maxRange = 2000n): Promise<IndexerResult> {
  const cfg = requireChain(chainId);
  const client = publicClientFor(chainId);
  const confirmations = confirmationsFor(chainId);

  const head = await client.getBlockNumber();
  const safeHead = head - confirmations + 1n;

  const state = await prisma.indexerState.findUnique({ where: { chainId } });
  let from = state ? state.lastBlock + 1n : safeHead > 5000n ? safeHead - 5000n : 0n;
  if (from > safeHead) return { chainId, scanned: 0, applied: 0, from, to: safeHead };

  let applied = 0;
  let cursor = from;
  while (cursor <= safeHead) {
    const to = cursor + maxRange - 1n > safeHead ? safeHead : cursor + maxRange - 1n;
    const logs = await client.getContractEvents({
      address: cfg.paymentProcessor,
      abi: paymentProcessorAbi,
      eventName: "PaymentReceived",
      fromBlock: cursor,
      toBlock: to,
    });
    for (const l of logs) {
      const r = await applyPaymentLog(chainId, l.args as PaymentLog, l.transactionHash!, l.blockNumber!);
      if (r.ok) applied++;
    }
    cursor = to + 1n;
  }

  await prisma.indexerState.upsert({
    where: { chainId },
    create: { chainId, lastBlock: safeHead },
    update: { lastBlock: safeHead },
  });
  return { chainId, scanned: Number(safeHead - from + 1n), applied, from, to: safeHead };
}

/**
 * Run the indexer on every enabled chain (or one, when given). A failing chain does not stop
 * the others: its error is returned in place of a result.
 */
export async function runIndexer(chainId?: number, maxRange = 2000n): Promise<(IndexerResult | { chainId: number; error: string })[]> {
  const ids = chainId != null ? [chainId] : CHAINS.filter((c) => c.paymentProcessor && c.usdc).map((c) => c.id);
  return Promise.all(
    ids.map((id) =>
      runIndexerFor(id, maxRange).catch((e: unknown) => ({ chainId: id, error: e instanceof Error ? e.message : String(e) }))
    )
  );
}
