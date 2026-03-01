import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { OpCode, SocketMessage, InitializePayload, LanyardPresence } from "./types";
import { getPresence, getAllPresences } from "./store";
import zlib from "zlib";

interface ClientState {
  ws: WebSocket;
  subscribedIds: Set<string>;
  subscribeAll: boolean;
  heartbeatInterval: NodeJS.Timeout | null;
  lastHeartbeat: number;
  seq: number;
  useCompression: boolean;
  isAlive: boolean;
}

const clients = new Map<WebSocket, ClientState>();
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 45000;

export function initWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/socket" });

  wss.on("connection", (ws, req) => {
    const useCompression = req.url?.includes("compression=zlib_json") || false;

    const state: ClientState = {
      ws,
      subscribedIds: new Set(),
      subscribeAll: false,
      heartbeatInterval: null,
      lastHeartbeat: Date.now(),
      seq: 0,
      useCompression,
      isAlive: true,
    };

    clients.set(ws, state);

    sendToClient(state, {
      op: OpCode.Hello,
      d: { heartbeat_interval: HEARTBEAT_INTERVAL },
    });

    state.heartbeatInterval = setInterval(() => {
      if (Date.now() - state.lastHeartbeat > HEARTBEAT_TIMEOUT) {
        ws.close(4000, "heartbeat_timeout");
        return;
      }
    }, HEARTBEAT_INTERVAL);

    ws.on("message", async (data) => {
      try {
        const message: SocketMessage = JSON.parse(data.toString());
        await handleSocketMessage(state, message);
      } catch {
        ws.close(4006, "invalid_payload");
      }
    });

    ws.on("close", () => {
      if (state.heartbeatInterval) clearInterval(state.heartbeatInterval);
      clients.delete(ws);
    });

    ws.on("error", () => {
      if (state.heartbeatInterval) clearInterval(state.heartbeatInterval);
      clients.delete(ws);
    });
  });

  console.log("[WebSocket] Server initialized");
  return wss;
}

async function handleSocketMessage(state: ClientState, message: SocketMessage): Promise<void> {
  switch (message.op) {
    case OpCode.Initialize: {
      if (!message.d) {
        state.ws.close(4005, "requires_data_object");
        return;
      }

      const payload = message.d as InitializePayload;

      if (payload.subscribe_to_all) {
        state.subscribeAll = true;
        const allPresences = await getAllPresences();
        sendToClient(state, {
          op: OpCode.Event,
          t: "INIT_STATE",
          seq: ++state.seq,
          d: allPresences,
        });
      } else if (payload.subscribe_to_id) {
        state.subscribedIds.add(payload.subscribe_to_id);
        const presence = await getPresence(payload.subscribe_to_id);
        sendToClient(state, {
          op: OpCode.Event,
          t: "INIT_STATE",
          seq: ++state.seq,
          d: presence || {},
        });
      } else if (payload.subscribe_to_ids) {
        const presences: Record<string, LanyardPresence> = {};
        for (const id of payload.subscribe_to_ids) {
          state.subscribedIds.add(id);
          const presence = await getPresence(id);
          if (presence) presences[id] = presence;
        }
        sendToClient(state, {
          op: OpCode.Event,
          t: "INIT_STATE",
          seq: ++state.seq,
          d: presences,
        });
      } else {
        state.ws.close(4006, "invalid_payload");
      }
      break;
    }

    case OpCode.Heartbeat: {
      state.lastHeartbeat = Date.now();
      state.isAlive = true;
      break;
    }

    default: {
      state.ws.close(4004, "unknown_opcode");
    }
  }
}

function sendToClient(state: ClientState, message: SocketMessage): void {
  if (state.ws.readyState !== WebSocket.OPEN) return;

  const payload = JSON.stringify(message);

  if (state.useCompression) {
    zlib.deflate(payload, (err, buffer) => {
      if (!err && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(buffer);
      }
    });
  } else {
    state.ws.send(payload);
  }
}

export function broadcastPresenceUpdate(userId: string, presence: LanyardPresence): void {
  for (const [, state] of clients) {
    if (state.subscribeAll || state.subscribedIds.has(userId)) {
      sendToClient(state, {
        op: OpCode.Event,
        t: "PRESENCE_UPDATE",
        seq: ++state.seq,
        d: { ...presence, user_id: userId },
      });
    }
  }
}

export function getSocketCount(): number {
  return clients.size;
}
