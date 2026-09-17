import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { expireOverdueInvoices } from "@/lib/expire";

type Ctx = { params: { id: string } };

export async function GET(_: Request, { params }: Ctx) {
  await expireOverdueInvoices();
  const inv = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { merchant: true, payment: true },
  });
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(serialize([inv])[0]);
}

/** Cancel an invoice that has not been paid */
export async function DELETE(_: Request, { params }: Ctx) {
  const inv = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (inv.status === "PAID") {
    return NextResponse.json({ error: "invoice already paid" }, { status: 409 });
  }
  const updated = await prisma.invoice.update({
    where: { id: inv.id },
    data: { status: "CANCELLED" },
  });
  return NextResponse.json(updated);
}
