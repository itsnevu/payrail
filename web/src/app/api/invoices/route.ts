import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { toUnits, toOnchainId } from "@/lib/usdc";
import { serialize } from "@/lib/serialize";
import { expireOverdueInvoices } from "@/lib/expire";

const schema = z.object({
  merchantId: z.string().min(1),
  description: z.string().min(1).max(500),
  customerName: z.string().max(200).optional(),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, "invalid amount format (max 6 decimals)"),
  dueAt: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const merchantId = searchParams.get("merchantId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  await expireOverdueInvoices(merchantId);
  const invoices = await prisma.invoice.findMany({
    where: { merchantId, status },
    include: { merchant: true, payment: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(serialize(invoices));
}

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  const { merchantId, description, customerName, amount, dueAt } = body.data;

  const units = toUnits(amount);
  if (units <= 0n) return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) return NextResponse.json({ error: "merchant not found" }, { status: 404 });

  // Create the record first to get an id, then derive onchainId = keccak256(abi.encode(keccak256(id), merchant, amount)).
  const created = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        merchantId,
        description,
        customerName,
        amount: units.toString(),
        dueAt: dueAt ? new Date(dueAt) : null,
        onchainId: `pending-${Date.now()}-${Math.random()}`,
      },
    });
    return tx.invoice.update({
      where: { id: inv.id },
      data: { onchainId: toOnchainId(inv.id, merchant.walletAddress as `0x${string}`, units).toLowerCase() },
      include: { merchant: true, payment: true },
    });
  });

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.json(
    { ...serialize([created])[0], paymentLink: `${base}/pay/${created.id}` },
    { status: 201 }
  );
}
