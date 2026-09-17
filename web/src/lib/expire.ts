import { prisma } from "./db";

/**
 * Flip overdue PENDING invoices to EXPIRED. One cheap updateMany, called from the read
 * paths (list, detail, indexer) so nothing needs a scheduler. The contract has no notion
 * of expiry, so /pay also refuses EXPIRED invoices client-side.
 */
export async function expireOverdueInvoices(merchantId?: string) {
  const { count } = await prisma.invoice.updateMany({
    where: { status: "PENDING", dueAt: { lt: new Date() }, merchantId },
    data: { status: "EXPIRED" },
  });
  return count;
}
