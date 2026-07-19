import webpush from "web-push";
import * as storage from "./storage";

type RecipientType = "client" | "desmanche" | "guincho" | "admin";

export type PushMessage = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:contato@centraldosdesmanches.com.br";
const configured = Boolean(publicKey && privateKey);

if (configured) {
  webpush.setVapidDetails(subject, publicKey!, privateKey!);
}

export function getPushPublicKey() {
  return configured ? publicKey! : null;
}

export async function sendPushNotification(userId: string, userType: RecipientType, message: PushMessage) {
  if (!configured) return { sent: 0, configured: false };

  const subscriptions = await storage.getPushSubscriptions(userId, userType);
  let sent = 0;
  await Promise.all(subscriptions.map(async (subscription: { endpoint: string; p256dh: string; auth: string }) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(message),
        { TTL: 60 * 60 },
      );
      sent += 1;
    } catch (error: any) {
      // Browsers return 404/410 when the user removed the subscription.
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await storage.removePushSubscription(subscription.endpoint);
        return;
      }
      console.error("Push notification error:", error?.message || error);
    }
  }));

  return { sent, configured: true };
}
