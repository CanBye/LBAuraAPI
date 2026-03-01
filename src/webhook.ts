import { config } from "./config";
import { LanyardPresence, WebhookPayload } from "./types";

export async function sendWebhook(
  event: string,
  userId: string,
  data: LanyardPresence
): Promise<void> {
  if (!config.webhookUrl) return;

  const payload: WebhookPayload = {
    event,
    user_id: userId,
    timestamp: Date.now(),
    data,
  };

  try {
    await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[Webhook] Failed to send:", (err as Error).message);
  }
}
