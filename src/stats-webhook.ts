import { config } from "./config";
import { getMonitoredCount, getAllPresences } from "./store";
import { getClient } from "./bot";
import { getSocketCount } from "./socket";

let statsMessageId: string | null = null;
let startTime = Date.now();

function buildStatsEmbed() {
  const client = getClient();
  const presences = getAllPresences();
  const total = Object.keys(presences).length;

  let online = 0, idle = 0, dnd = 0, offline = 0;
  let spotifyCount = 0, activityCount = 0, mobileCount = 0, desktopCount = 0, webCount = 0;

  for (const p of Object.values(presences)) {
    switch (p.discord_status) {
      case "online": online++; break;
      case "idle": idle++; break;
      case "dnd": dnd++; break;
      default: offline++; break;
    }
    if (p.listening_to_spotify) spotifyCount++;
    if (p.activities.some(a => a.type !== 4 && a.name !== "Spotify")) activityCount++;
    if (p.active_on_discord_mobile) mobileCount++;
    if (p.active_on_discord_desktop) desktopCount++;
    if (p.active_on_discord_web) webCount++;
  }

  const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(uptimeSec / 3600);
  const m = Math.floor((uptimeSec % 3600) / 60);
  const s = uptimeSec % 60;
  const uptimeStr = `${h}h ${m}m ${s}s`;

  const mem = process.memoryUsage();
  const memMB = (mem.heapUsed / 1024 / 1024).toFixed(1);

  const guilds = client?.guilds?.cache?.size || 0;
  const wsConnections = getSocketCount();

  return {
    embeds: [{
      title: "📊 LBAuraAPI Stats",
      color: 0x5865f2,
      fields: [
        {
          name: "👥 Users",
          value: `**${total}** monitored`,
          inline: true,
        },
        {
          name: "🏠 Guilds",
          value: `**${guilds}**`,
          inline: true,
        },
        {
          name: "🔌 WebSocket",
          value: `**${wsConnections}** client(s)`,
          inline: true,
        },
        {
          name: "Status Breakdown",
          value: [
            `🟢 Online: **${online}**`,
            `🟡 Idle: **${idle}**`,
            `🔴 DND: **${dnd}**`,
            `⚫ Offline: **${offline}**`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "Activity",
          value: [
            `🎵 Spotify: **${spotifyCount}**`,
            `🎮 Playing: **${activityCount}**`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "Platforms",
          value: [
            `🖥️ Desktop: **${desktopCount}**`,
            `🌐 Web: **${webCount}**`,
            `📱 Mobile: **${mobileCount}**`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "⏱️ Uptime",
          value: uptimeStr,
          inline: true,
        },
        {
          name: "💾 Memory",
          value: `${memMB} MB`,
          inline: true,
        },
        {
          name: "🔗 API",
          value: `\`${config.apiBaseUrl}\``,
          inline: true,
        },
      ],
      footer: { text: "LBAuraAPI — Auto Stats" },
      timestamp: new Date().toISOString(),
    }],
  };
}

async function sendOrUpdateStats(): Promise<void> {
  if (!config.statsWebhookUrl) return;

  const body = buildStatsEmbed();

  try {
    // Try to edit existing message
    if (statsMessageId) {
      const editUrl = `${config.statsWebhookUrl}/messages/${statsMessageId}`;
      const res = await fetch(editUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      // If edit fails (message deleted etc.), send new one
      statsMessageId = null;
    }

    // Send new message
    const res = await fetch(`${config.statsWebhookUrl}?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "LBAuraAPI Stats",
        avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
        ...body,
      }),
    });

    if (res.ok) {
      const data = await res.json() as any;
      statsMessageId = data.id;
    }
  } catch (err) {
    console.error("[Stats] Webhook failed:", (err as Error).message);
  }
}

export function initStatsWebhook(): void {
  if (!config.statsWebhookUrl) {
    console.log("[Stats] No STATS_WEBHOOK_URL set, skipping stats webhook");
    return;
  }

  startTime = Date.now();

  // Send initial stats after 10 seconds (wait for bot to index)
  setTimeout(() => {
    sendOrUpdateStats();
  }, 10_000);

  setInterval(() => {
    sendOrUpdateStats();
  }, config.statsIntervalMs);

  console.log(`[Stats] Webhook active, updating every ${config.statsIntervalMs / 1000}s`);
}
