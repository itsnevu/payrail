import { NextResponse } from "next/server";
import { z } from "zod";
import { isHash } from "viem";
import { prisma } from "@/lib/db";
import { verifyTx } from "@/lib/verify";
import { serialize } from "@/lib/serialize";

const schema = z.object({ txHash: z.string().refine((h) => isHash(h), "invalid txHash") });

/**
 * POST /api/invoices/:id/verify  { txHash }
 * Called by the frontend after the buyer sends the tx. The backend reads the onchain
 * receipt, matches the PaymentReceived event to the invoice, then sets PAID.
 * 200 = matched and PAID. 202 = not final yet (pending confirmations or not mined), retry.
 * 400 = definitively rejected (reverted, wrong event, terms mismatch), do not retry.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const inv = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Verified on the invoice's own chain: a tx hash from another network can never match.
  const result = await verifyTx(inv.chainId, body.data.txHash as `0x${string}`, inv.onchainId);
  const fresh = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { merchant: true, payment: true },
  });
  // 200 matched, 202 undecidable yet (retry), 400 definitively rejected (do not retry).
  const status = result.ok ? 200 : "pending" in result && result.pending ? 202 : 400;
  return NextResponse.json({ ...result, invoice: serialize([fresh])[0] }, { status });
}
