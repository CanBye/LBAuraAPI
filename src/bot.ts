import {
  Client,
  GatewayIntentBits,
  Presence,
  ActivityType,
} from "discord.js";
import { config } from "./config";
import { setPresence, getKV } from "./store";
import {
  LanyardPresence, SpotifyData, Activity, DiscordUser,
  AvatarDecorationData, CollectiblesData, DisplayNameStyle,
  PrimaryGuild, UserProfile, ConnectedAccount, ProfileBadge,
  GameWidget, ProfileEffect,
} from "./types";
import { broadcastPresenceUpdate } from "./socket";
import { sendWebhook } from "./webhook";
import { handleCommand } from "./bot-commands";

let client: Client;

const enrichCache = new Map<string, { data: any; profile: any; member: any; ts: number }>();
const ENRICH_TTL = 5 * 60 * 1000;

export function getClient(): Client {
  return client;
}

// Fetch full user data + profile from Discord REST API
async function fetchEnrichedData(userId: string): Promise<{ user: any; profile: any; member: any }> {
  const cached = enrichCache.get(userId);
  if (cached && Date.now() - cached.ts < ENRICH_TTL) {
    return { user: cached.data, profile: cached.profile, member: cached.member };
  }

  let userData: any = null;
  let profileData: any = null;
  let memberData: any = null;

  try {
    userData = await client.rest.get(`/users/${userId}`) as any;
  } catch { }

  try {
    profileData = await client.rest.get(`/users/${userId}/profile`, {
      query: new URLSearchParams({
        with_mutual_guilds: "false",
        with_mutual_friends: "false",
        with_mutual_friends_count: "false",
      }),
    }) as any;
  } catch { }

  try {
    for (const [, guild] of client.guilds.cache) {
      const member = guild.members.cache.get(userId);
      if (member) {
        memberData = {
          nick: member.nickname,
          roles: member.roles.cache.map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
          joined_at: member.joinedAt?.toISOString() || null,
          premium_since: member.premiumSince?.toISOString() || null, // Boost date!
          avatar: member.avatar,
          communication_disabled_until: member.communicationDisabledUntil?.toISOString() || null,
        };
        break;
      }
    }
  } catch { }

  enrichCache.set(userId, { data: userData, profile: profileData, member: memberData, ts: Date.now() });
  return { user: userData, profile: profileData, member: memberData };
}

export async function enrichUserData(userId: string): Promise<void> {
  const { getPresence: getPres, setPresence: setPres } = await import("./store");
  const presence = getPres(userId);
  if (!presence) return;

  const { user: apiUser, profile, member } = await fetchEnrichedData(userId);
  if (apiUser) applyUserEnrichment(presence, apiUser);
  if (profile) applyProfileEnrichment(presence, profile);
  if (member) {
    presence.guild_member = member;
    if (member.premium_since) presence.premium_guild_since = member.premium_since;
  }
  setPres(userId, presence);
}

function applyUserEnrichment(presence: LanyardPresence, api: any): void {
  const u = presence.discord_user;

  if (api.public_flags != null) u.public_flags = api.public_flags;
  if (api.banner) u.banner = api.banner;
  if (api.banner_color) u.banner_color = api.banner_color;
  if (api.accent_color != null) u.accent_color = api.accent_color;

  if (api.avatar_decoration_data) {
    u.avatar_decoration_data = {
      asset: api.avatar_decoration_data.asset,
      sku_id: api.avatar_decoration_data.sku_id,
      expires_at: api.avatar_decoration_data.expires_at || null,
    };
  }

  if (api.collectibles) {
    u.collectibles = {
      nameplate: api.collectibles.nameplate ? {
        asset: api.collectibles.nameplate.asset,
        sku_id: api.collectibles.nameplate.sku_id,
        label: api.collectibles.nameplate.label,
        palette: api.collectibles.nameplate.palette,
        expires_at: api.collectibles.nameplate.expires_at || null,
      } : null,
    };
  }

  if (api.display_name_styles) {
    u.display_name_styles = {
      font_id: api.display_name_styles.font_id || 0,
      effect_id: api.display_name_styles.effect_id || 0,
      colors: api.display_name_styles.colors || [],
    };
  }

  if (api.primary_guild) {
    u.primary_guild = {
      identity_guild_id: api.primary_guild.identity_guild_id || null,
      identity_enabled: api.primary_guild.identity_enabled ?? null,
      tag: api.primary_guild.tag || null,
      badge: api.primary_guild.badge || null,
    };
  }

  if (api.premium_type != null) u.premium_type = api.premium_type;
}

function applyProfileEnrichment(presence: LanyardPresence, profile: any): void {
  if (profile.user_profile) {
    presence.user_profile = {
      bio: profile.user_profile.bio || null,
      pronouns: profile.user_profile.pronouns || null,
      theme_colors: profile.user_profile.theme_colors || null,
      profile_effect: profile.user_profile.profile_effect ? {
        id: profile.user_profile.profile_effect.id,
        expires_at: profile.user_profile.profile_effect.expires_at || null,
      } : null,
      popout_animation_particle_type: profile.user_profile.popout_animation_particle_type || null,
      emoji: profile.user_profile.emoji ? {
        name: profile.user_profile.emoji.name,
        id: profile.user_profile.emoji.id || null,
        animated: profile.user_profile.emoji.animated || false,
      } : null,
    };
  }

  if (profile.connected_accounts) {
    presence.connected_accounts = profile.connected_accounts.map((c: any) => ({
      type: c.type,
      id: c.id,
      name: c.name,
      verified: c.verified || false,
      metadata: c.metadata || undefined,
    }));
  }

  if (profile.badges) {
    presence.profile_badges = profile.badges.map((b: any) => ({
      id: b.id,
      description: b.description,
      icon: b.icon,
      link: b.link || null,
    }));
  }

  if (profile.premium_since) presence.premium_since = profile.premium_since;
  if (profile.premium_guild_since) presence.premium_guild_since = profile.premium_guild_since;
  if (profile.premium_type != null) presence.discord_user.premium_type = profile.premium_type;

  if (profile.widgets) {
    presence.game_widgets = profile.widgets.map((w: any) => ({
      id: w.id,
      updated_at: w.updated_at,
      data: w.data,
    }));
  }

  if (profile.user) {
    const pu = profile.user;
    if (pu.avatar_decoration_data && !presence.discord_user.avatar_decoration_data) {
      presence.discord_user.avatar_decoration_data = {
        asset: pu.avatar_decoration_data.asset,
        sku_id: pu.avatar_decoration_data.sku_id,
        expires_at: pu.avatar_decoration_data.expires_at || null,
      };
    }
    if (pu.primary_guild && !presence.discord_user.primary_guild) {
      presence.discord_user.primary_guild = {
        identity_guild_id: pu.primary_guild.identity_guild_id || null,
        identity_enabled: pu.primary_guild.identity_enabled ?? null,
        tag: pu.primary_guild.tag || null,
        badge: pu.primary_guild.badge || null,
      };
    }
    if (pu.banner && !presence.discord_user.banner) presence.discord_user.banner = pu.banner;
    if (pu.public_flags) presence.discord_user.public_flags = pu.public_flags;
  }
}

export async function initBot(): Promise<Client> {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  client.once("ready", () => {
    console.log(`[Bot] Logged in as ${client.user?.tag}`);
    console.log(`[Bot] Monitoring ${client.guilds.cache.size} guild(s)`);
    indexAllPresences();
  });

  client.on("presenceUpdate", async (_old, newPresence) => {
    if (!newPresence || !newPresence.user) return;
    await handlePresenceUpdate(newPresence, true);
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    await handleCommand(message);
  });

  await client.login(config.botToken);
  return client;
}

async function indexAllPresences(): Promise<void> {
  let count = 0;
  for (const [, guild] of client.guilds.cache) {
    for (const [, member] of guild.members.cache) {
      if (member.presence) {
        await handlePresenceUpdate(member.presence, false);
        count++;
      }
    }
  }
  console.log(`[Bot] Indexed ${count} presence(s)`);
}

async function handlePresenceUpdate(presence: Presence, enrich = true): Promise<void> {
  const user = presence.user;
  if (!user) return;

  const userId = user.id;
  const kv = await getKV(userId);

  const spotifyActivity = presence.activities.find(
    (a) => a.type === ActivityType.Listening && a.name === "Spotify"
  );

  let spotify: SpotifyData | null = null;
  if (spotifyActivity) {
    spotify = {
      track_id: spotifyActivity.syncId || null,
      timestamps: {
        start: spotifyActivity.timestamps?.start?.getTime() || 0,
        end: spotifyActivity.timestamps?.end?.getTime() || 0,
      },
      song: spotifyActivity.details || "",
      artist: spotifyActivity.state || "",
      album_art_url: spotifyActivity.assets?.largeImageURL() || "",
      album: spotifyActivity.assets?.largeText || "",
    };
  }

  const activities: Activity[] = presence.activities.map((a) => ({
    type: a.type,
    timestamps: {
      start: a.timestamps?.start?.getTime(),
      end: a.timestamps?.end?.getTime(),
    },
    sync_id: a.syncId || undefined,
    state: a.state || undefined,
    session_id: undefined,
    party: a.party ? {
      id: a.party.id || undefined,
      size: a.party.size ? [a.party.size[0], a.party.size[1]] as [number, number] : undefined,
    } : undefined,
    name: a.name,
    id: (a as any).id || `custom:${Date.now()}`,
    flags: a.flags?.bitfield,
    details: a.details || undefined,
    created_at: a.createdTimestamp,
    assets: a.assets ? {
      small_text: a.assets.smallText || undefined,
      small_image: a.assets.smallImageURL() || undefined,
      large_text: a.assets.largeText || undefined,
      large_image: a.assets.largeImageURL() || undefined,
    } : undefined,
    application_id: a.applicationId || undefined,
    buttons: a.buttons?.map(b => (b as any).label || String(b)) || undefined,
    emoji: a.emoji ? {
      name: a.emoji.name || "",
      id: a.emoji.id || undefined,
      animated: a.emoji.animated || undefined,
    } : undefined,
  }));

  const discordUser: DiscordUser = {
    username: user.username,
    public_flags: user.flags?.bitfield || 0,
    id: user.id,
    discriminator: user.discriminator || "0",
    avatar: user.avatar,
    display_name: user.displayName || null,
    global_name: user.globalName || null,
    avatar_decoration_data: null,
    collectibles: null,
    display_name_styles: null,
    primary_guild: null,
    banner: user.banner || null,
    banner_color: null,
    accent_color: user.accentColor || null,
    bot: user.bot || false,
    system: user.system || false,
    premium_type: null,
  };

  const lanyardPresence: LanyardPresence = {
    active_on_discord_mobile: presence.clientStatus?.mobile !== undefined,
    active_on_discord_desktop: presence.clientStatus?.desktop !== undefined,
    active_on_discord_web: presence.clientStatus?.web !== undefined,
    listening_to_spotify: spotify !== null,
    kv,
    spotify,
    discord_user: discordUser,
    discord_status: (presence.status as any) || "offline",
    activities,
    user_profile: null,
    connected_accounts: [],
    profile_badges: [],
    premium_since: null,
    premium_guild_since: null,
    guild_member: null,
    game_widgets: [],
  };

  if (enrich) {
    try {
      const { user: apiUser, profile, member } = await fetchEnrichedData(userId);
      if (apiUser) applyUserEnrichment(lanyardPresence, apiUser);
      if (profile) applyProfileEnrichment(lanyardPresence, profile);
      if (member) {
        lanyardPresence.guild_member = member;
        if (member.premium_since) lanyardPresence.premium_guild_since = member.premium_since;
      }
    } catch { }
  }

  setPresence(userId, lanyardPresence);
  broadcastPresenceUpdate(userId, lanyardPresence);
  sendWebhook("PRESENCE_UPDATE", userId, lanyardPresence);
}
