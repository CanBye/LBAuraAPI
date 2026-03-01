import { Router, Request, Response } from "express";
import {
  getPresence,
  getAllPresences,
  getMonitoredCount,
  setKV,
  deleteKV,
  getKV,
  getUserIdByApiKey,
  getKVCount,
} from "./store";
import { getClient, enrichUserData } from "./bot";
import { ApiResponse } from "./types";

const router = Router();

const KV_MAX_KEY_LENGTH = 255;
const KV_MAX_VALUE_LENGTH = 30000;
const KV_MAX_PAIRS = 512;

async function requireAuth(req: Request, res: Response): Promise<string | null> {
  const apiKey = req.headers.authorization;
  if (!apiKey) {
    res.status(401).json({ success: false, error: { message: "Missing Authorization header", code: "UNAUTHORIZED" } });
    return null;
  }
  const userId = await getUserIdByApiKey(apiKey);
  if (!userId) {
    res.status(403).json({ success: false, error: { message: "Invalid API key", code: "FORBIDDEN" } });
    return null;
  }
  return userId;
}

router.get("/v1/users/:user_id", async (req: Request, res: Response) => {
  const { user_id } = req.params;

  if (!/^\d+$/.test(user_id)) {
    return res.status(400).json({
      success: false,
      error: { message: "Invalid user ID format", code: "INVALID_ID" },
    } as ApiResponse);
  }

  const presence = await getPresence(user_id);
  if (!presence) {
    return res.status(404).json({
      success: false,
      error: { message: "User not found or not being monitored", code: "NOT_FOUND" },
    } as ApiResponse);
  }

  if (!presence.discord_user.avatar_decoration_data) {
    await enrichUserData(user_id);
    const enriched = await getPresence(user_id);
    if (enriched) return res.json({ success: true, data: enriched } as ApiResponse);
  }

  return res.json({ success: true, data: presence } as ApiResponse);
});

router.get("/v1/users", async (req: Request, res: Response) => {
  const idsParam = req.query.ids as string;
  if (!idsParam) {
    return res.status(400).json({
      success: false,
      error: { message: "Provide ?ids=id1,id2,id3", code: "MISSING_IDS" },
    } as ApiResponse);
  }

  const ids = idsParam.split(",").filter((id) => /^\d+$/.test(id));
  if (ids.length === 0 || ids.length > 50) {
    return res.status(400).json({
      success: false,
      error: { message: "Provide 1-50 valid user IDs", code: "INVALID_IDS" },
    } as ApiResponse);
  }

  const presences: Record<string, any> = {};
  for (const id of ids) {
    const p = await getPresence(id);
    if (p) presences[id] = p;
  }

  return res.json({ success: true, data: presences } as ApiResponse);
});

router.put("/v1/users/:user_id/kv/:key", async (req: Request, res: Response) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  if (userId !== req.params.user_id) {
    return res.status(403).json({
      success: false,
      error: { message: "Cannot modify another user's KV", code: "FORBIDDEN" },
    } as ApiResponse);
  }

  const { key } = req.params;

  if (!/^[a-zA-Z0-9_]+$/.test(key) || key.length > KV_MAX_KEY_LENGTH) {
    return res.status(400).json({
      success: false,
      error: { message: "Invalid key format", code: "INVALID_KEY" },
    } as ApiResponse);
  }

  let value = "";
  if (typeof req.body === "string") {
    value = req.body;
  } else if (typeof req.body === "object") {
    value = JSON.stringify(req.body);
  }

  if (value.length > KV_MAX_VALUE_LENGTH) {
    return res.status(400).json({
      success: false,
      error: { message: `Value exceeds ${KV_MAX_VALUE_LENGTH} character limit`, code: "VALUE_TOO_LONG" },
    } as ApiResponse);
  }

  const count = await getKVCount(userId);
  if (count >= KV_MAX_PAIRS) {
    return res.status(400).json({
      success: false,
      error: { message: `Maximum of ${KV_MAX_PAIRS} KV pairs reached`, code: "KV_LIMIT" },
    } as ApiResponse);
  }

  await setKV(userId, key, value);
  return res.json({ success: true } as ApiResponse);
});

router.patch("/v1/users/:user_id/kv", async (req: Request, res: Response) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  if (userId !== req.params.user_id) {
    return res.status(403).json({
      success: false,
      error: { message: "Cannot modify another user's KV", code: "FORBIDDEN" },
    } as ApiResponse);
  }

  if (typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({
      success: false,
      error: { message: "Body must be a key-value object", code: "INVALID_BODY" },
    } as ApiResponse);
  }

  for (const [key, value] of Object.entries(req.body)) {
    if (typeof value !== "string") continue;
    if (/^[a-zA-Z0-9_]+$/.test(key) && key.length <= KV_MAX_KEY_LENGTH && value.length <= KV_MAX_VALUE_LENGTH) {
      await setKV(userId, key, value);
    }
  }

  return res.json({ success: true } as ApiResponse);
});

router.delete("/v1/users/:user_id/kv/:key", async (req: Request, res: Response) => {
  const userId = await requireAuth(req, res);
  if (!userId) return;

  if (userId !== req.params.user_id) {
    return res.status(403).json({
      success: false,
      error: { message: "Cannot modify another user's KV", code: "FORBIDDEN" },
    } as ApiResponse);
  }

  await deleteKV(userId, req.params.key);
  return res.json({ success: true } as ApiResponse);
});

router.get("/v1/health", async (_req: Request, res: Response) => {
  const client = getClient();
  return res.json({
    success: true,
    data: {
      status: "ok",
      uptime: process.uptime(),
      guilds: client?.guilds?.cache?.size || 0,
      monitored_users: getMonitoredCount(),
      memory: process.memoryUsage(),
      timestamp: Date.now(),
    },
  } as ApiResponse);
});

router.get("/:user_id.:ext", async (req: Request, res: Response) => {
  const { user_id, ext } = req.params;
  const validExts = ["png", "gif", "webp", "jpg", "jpeg"];

  if (!validExts.includes(ext) || !/^\d+$/.test(user_id)) {
    return res.status(400).json({
      success: false,
      error: { message: "Invalid request", code: "BAD_REQUEST" },
    } as ApiResponse);
  }

  const presence = await getPresence(user_id);
  if (!presence || !presence.discord_user.avatar) {
    return res.status(404).json({
      success: false,
      error: { message: "User or avatar not found", code: "NOT_FOUND" },
    } as ApiResponse);
  }

  const avatarUrl = `https://cdn.discordapp.com/avatars/${user_id}/${presence.discord_user.avatar}.${ext}`;
  return res.redirect(302, avatarUrl);
});

export default router;
