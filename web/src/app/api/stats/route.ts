import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { expireOverdueInvoices } from "@/lib/expire";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const merchantId = searchParams.get("merchantId") ?? undefined;
  await expireOverdueInvoices(merchantId);
  const [all, paid] = await Promise.all([
    prisma.invoice.findMany({ where: { merchantId }, select: { status: true, amount: true } }),
    prisma.payment.findMany({ where: { invoice: { merchantId } }, select: { amount: true } }),
  ]);
  const sum = (xs: { amount: string }[]) =>
    xs.reduce((a, x) => a + BigInt(x.amount), 0n).toString();
  return NextResponse.json({
    total: all.length,
    paid: all.filter((i) => i.status === "PAID").length,
    pending: all.filter((i) => i.status === "PENDING").length,
    totalReceived: sum(paid),
    totalOutstanding: sum(all.filter((i) => i.status === "PENDING")),
  });
}
