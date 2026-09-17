import webpush from "web-push";
import { prisma } from "./db";

/**
 * Web Push. Needs VAPID keys in the environment (generate once with
 * `npx web-push generate-vapid-keys`):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https:)
 * Without them every call is a no-op, so the app works unchanged in dev.
 */
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@payrail.app";

export const pushEnabled = Boolean(PUBLIC_KEY && PRIVATE_KEY);
if (pushEnabled) webpush.setVapidDetails(SUBJECT, PUBLIC_KEY!, PRIVATE_KEY!);

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Send to every device subscribed for a merchant. Dead subscriptions (404/410) are pruned. */
export async function notifyMerchant(merchantId: string, payload: PushPayload) {
  if (!pushEnabled) return { sent: 0 };
  const subs = await prisma.pushSubscription.findMany({ where: { merchantId } });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 },
        );
        sent++;
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          console.warn("[push] send failed", status, e);
        }
      }
    }),
  );
  return { sent };
}
