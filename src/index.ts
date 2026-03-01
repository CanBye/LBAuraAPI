import express from "express";
import http from "http";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { config } from "./config";
import { initBot } from "./bot";
import { initWebSocket } from "./socket";
import apiRouter from "./api";
import { swaggerDocument } from "./swagger";
import { initStatsWebhook } from "./stats-webhook";

async function main() {
  console.log("✨ LBAuraAPI - Starting...\n");

  const app = express();
  app.use(cors());
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json());
  app.use(express.text());

  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: { message: "Too many requests", code: "RATE_LIMITED" },
      },
    })
  );

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use("/demo", express.static(path.join(__dirname, "..", "public")));
  app.use(apiRouter);

  app.get("/", (_req, res) => {
    res.json({
      message: "LBAuraAPI",
      docs: "/docs",
      api: "/v1/users/:user_id",
      health: "/v1/health",
      socket: config.apiBaseUrl.replace(/^http/, "ws") + "/socket",
    });
  });

  const server = http.createServer(app);
  initWebSocket(server);

  server.listen(config.port, config.apiHost, () => {
    console.log(`[API] Running on http://${config.apiHost}:${config.port}`);
    console.log(`[API] Docs at ${config.apiBaseUrl}/docs`);
    console.log(`[WS]  Socket at ${config.apiBaseUrl.replace(/^http/, "ws")}/socket`);
  });

  if (config.botToken) {
    await initBot();
    initStatsWebhook();
  } else {
    console.warn("[Bot] No BOT_TOKEN provided, running in API-only mode");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
