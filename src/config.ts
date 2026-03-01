import dotenv from "dotenv";
dotenv.config();

export const config = {
  botToken: process.env.BOT_TOKEN || "",
  port: parseInt(process.env.PORT || "4001"),
  apiHost: process.env.API_HOST || "0.0.0.0",
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || "4001"}`,
  webhookUrl: process.env.WEBHOOK_URL || "",
  statsWebhookUrl: process.env.STATS_WEBHOOK_URL || "",
  statsIntervalMs: parseInt(process.env.STATS_INTERVAL_MS || "300000"),
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
  },
};
