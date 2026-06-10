import webpush from "web-push";
import { db } from "@/lib/db";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:support@brightears.io", pub, priv);
  configured = true;
  return true;
}

/** Push to every device the business owner registered. Dead endpoints are pruned. */
export async function pushToBusiness(
  businessId: string,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  if (!ensureConfigured()) return;
  const subs = await db.pushSubscription.findMany({ where: { businessId } });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => null);
        }
      }
    }),
  );
}
