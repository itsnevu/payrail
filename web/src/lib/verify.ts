import { createPublicClient, http, parseEventLogs, getAddress, type Hash } from "viem";
import { chain, RPC_URL, PAYMENT_PROCESSOR_ADDRESS, paymentProcessorAbi } from "./chain";
import { prisma } from "./db";
import { notifyMerchant } from "./push";
import { formatUsdc } from "./usdc";

export const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });

const CONFIRMATIONS = BigInt(process.env.CONFIRMATIONS || "1");

type PaymentLog = {
  invoiceId: `0x${string}`;
  salt: `0x${string}`;
  payer: `0x${string}`;
  merchant: `0x${string}`;
  amount: bigint;
  timestamp: bigint;
};

/**
 * Apply one PaymentReceived event to the database.
 * Idempotent: safe to call repeatedly for the same tx.
 */
export async function applyPaymentLog(
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

  // The key already binds (salt, merchant, amount), so a matching invoiceId implies matching
  // terms. Re-check anyway: defense in depth against a bad deployment or a wrong ABI.
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
    body: `${invoice.customerName || invoice.description}: ${formatUsdc(log.amount)} USDC received`,
    url: `${base}/invoices/${invoice.id}`,
    tag: `invoice-${invoice.id}`,
  }).catch((e) => console.warn("[push] notify failed", e));

  return { ok: true, invoiceId: invoice.id };
}

/**
 * Verify one transaction by hash (called by the frontend after paying).
 */
export async function verifyTx(txHash: Hash, expectedInvoiceOnchainId: string) {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (!receipt) return { ok: false, reason: "transaction not found or not mined yet", pending: true };
  if (receipt.status !== "success") return { ok: false, reason: "transaction reverted" };

  const latest = await publicClient.getBlockNumber();
  if (latest - receipt.blockNumber + 1n < CONFIRMATIONS) {
    return { ok: false, reason: "waiting for confirmations", pending: true };
  }

  const logs = parseEventLogs({
    abi: paymentProcessorAbi,
    eventName: "PaymentReceived",
    logs: receipt.logs.filter(
      (l) => getAddress(l.address) === getAddress(PAYMENT_PROCESSOR_ADDRESS)
    ),
  });

  const match = logs.find(
    (l) => (l.args as PaymentLog).invoiceId.toLowerCase() === expectedInvoiceOnchainId.toLowerCase()
  );
  if (!match) return { ok: false, reason: "no PaymentReceived event for this invoice in the tx" };

  return applyPaymentLog(match.args as PaymentLog, txHash, receipt.blockNumber);
}

/**
 * Indexer: scan PaymentReceived logs from the last stored block to the head.
 * Called by cron or manually via /api/indexer. Catches payments made
 * outside the UI (e.g. straight from a wallet or script).
 */
export async function runIndexer(maxRange = 2000n) {
  const head = await publicClient.getBlockNumber();
  const safeHead = head - CONFIRMATIONS + 1n;

  const state = await prisma.indexerState.findUnique({ where: { id: 1 } });
  let from = state ? state.lastBlock + 1n : safeHead > 5000n ? safeHead - 5000n : 0n;
  if (from > safeHead) return { scanned: 0, applied: 0, from, to: safeHead };

  let applied = 0;
  let cursor = from;
  while (cursor <= safeHead) {
    const to = cursor + maxRange - 1n > safeHead ? safeHead : cursor + maxRange - 1n;
    const logs = await publicClient.getContractEvents({
      address: PAYMENT_PROCESSOR_ADDRESS,
      abi: paymentProcessorAbi,
      eventName: "PaymentReceived",
      fromBlock: cursor,
      toBlock: to,
    });
    for (const l of logs) {
      const r = await applyPaymentLog(l.args as PaymentLog, l.transactionHash!, l.blockNumber!);
      if (r.ok) applied++;
    }
    cursor = to + 1n;
  }

  await prisma.indexerState.upsert({
    where: { id: 1 },
    create: { id: 1, lastBlock: safeHead },
    update: { lastBlock: safeHead },
  });
  return { scanned: Number(safeHead - from + 1n), applied, from, to: safeHead };
}
