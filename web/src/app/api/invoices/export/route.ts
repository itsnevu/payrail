import { prisma } from "@/lib/db";
import { formatUsdc } from "@/lib/usdc";

/** GET /api/invoices/export?merchantId=... -> CSV file */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const merchantId = searchParams.get("merchantId") ?? undefined;
  const rows = await prisma.invoice.findMany({
    where: { merchantId },
    include: { merchant: true, payment: true },
    orderBy: { createdAt: "desc" },
  });

  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = [
    "invoice_id", "created_at", "merchant", "merchant_wallet", "customer", "description",
    "amount_usdc", "status", "paid_at", "payer", "tx_hash", "block_number",
  ];
  const lines = rows.map((r) =>
    [
      r.id, r.createdAt.toISOString(), r.merchant.name, r.merchant.walletAddress,
      r.customerName, r.description, formatUsdc(r.amount), r.status,
      r.payment?.paidAt.toISOString(), r.payment?.payer, r.payment?.txHash,
      r.payment?.blockNumber?.toString(),
    ].map(esc).join(",")
  );

  const csv = [header.join(","), ...lines].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payrail-invoices-${Date.now()}.csv"`,
    },
  });
}
