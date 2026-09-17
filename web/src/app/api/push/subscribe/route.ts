import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { pushEnabled } from "@/lib/push";

const schema = z.object({
  merchantId: z.string().min(1),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }),
});

/** GET: is push configured on this server? The client hides the button otherwise. */
export function GET() {
  return NextResponse.json({ enabled: pushEnabled, publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null });
}

/** POST: save (or re-point) a browser's subscription for a merchant. */
export async function POST(req: Request) {
  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  const { merchantId, subscription } = body.data;
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) return NextResponse.json({ error: "merchant not found" }, { status: 404 });

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      merchantId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: req.headers.get("user-agent"),
    },
    update: { merchantId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
  });
  return NextResponse.json({ ok: true });
}

/** DELETE: forget a subscription (user turned notifications off). */
export async function DELETE(req: Request) {
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return NextResponse.json({ ok: true });
}
