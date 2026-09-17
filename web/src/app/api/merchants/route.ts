import { NextResponse } from "next/server";
import { z } from "zod";
import { isAddress, getAddress } from "viem";
import { prisma } from "@/lib/db";

const schema = z.object({
  name: z.string().min(1),
  walletAddress: z.string().refine((a) => isAddress(a), "invalid wallet address"),
});

export async function GET() {
  const merchants = await prisma.merchant.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(merchants);
}

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  const wallet = getAddress(body.data.walletAddress);
  const merchant = await prisma.merchant.upsert({
    where: { walletAddress: wallet },
    create: { name: body.data.name, walletAddress: wallet },
    update: { name: body.data.name },
  });
  return NextResponse.json(merchant, { status: 201 });
}
