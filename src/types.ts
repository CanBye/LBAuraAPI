export interface SpotifyData {
  track_id: string | null;
  timestamps: { start: number; end: number };
  song: string;
  artist: string;
  album_art_url: string;
  album: string;
}

export interface AvatarDecorationData {
  asset: string;
  sku_id: string;
  expires_at: number | null;
}

export interface CollectiblesData {
  nameplate: {
    asset: string;
    sku_id: string;
    label: string;
    palette: string;
    expires_at: number | null;
  } | null;
}

export interface DisplayNameStyle {
  font_id: number;
  effect_id: number;
  colors: number[];
}

export interface PrimaryGuild {
  identity_guild_id: string | null;
  identity_enabled: boolean | null;
  tag: string | null;
  badge: string | null;
}

export interface ProfileEffect {
  id: string;
  expires_at: number | null;
}

export interface ProfileBadge {
  id: string;
  description: string;
  icon: string;
  link: string | null;
}

export interface ConnectedAccount {
  type: string;
  id: string;
  name: string;
  verified: boolean;
  metadata?: Record<string, string>;
}

export interface ProfileMetadata {
  bio: string | null;
  pronouns: string | null;
  banner: string | null;
  accent_color: number | null;
  theme_colors: [number, number] | null;
  popout_animation_particle_type: string | null;
  emoji: { name: string; id: string | null; animated: boolean } | null;
  profile_effect: ProfileEffect | null;
}

export interface GameWidget {
  id: string;
  updated_at: string;
  data: {
    type: string;
    games?: Array<{
      game_id: string;
      comment?: string;
      tags?: string[];
    }>;
    application_id?: string;
  };
}

export interface DiscordUser {
  username: string;
  public_flags: number;
  id: string;
  discriminator: string;
  avatar: string | null;
  display_name: string | null;
  global_name: string | null;
  avatar_decoration_data: AvatarDecorationData | null;
  collectibles: CollectiblesData | null;
  display_name_styles: DisplayNameStyle | null;
  primary_guild: PrimaryGuild | null;
  banner: string | null;
  banner_color: string | null;
  accent_color: number | null;
  bot: boolean;
  system: boolean;
  premium_type: number | null;
}

export interface UserProfile {
  bio: string | null;
  pronouns: string | null;
  theme_colors: [number, number] | null;
  profile_effect: ProfileEffect | null;
  popout_animation_particle_type: string | null;
  emoji: { name: string; id: string | null; animated: boolean } | null;
}

export interface Activity {
  type: number;
  timestamps?: { start?: number; end?: number };
  sync_id?: string;
  state?: string;
  session_id?: string;
  party?: { id?: string; size?: [number, number] };
  name: string;
  id: string;
  flags?: number;
  details?: string;
  created_at: number;
  assets?: {
    small_text?: string;
    small_image?: string;
    large_text?: string;
    large_image?: string;
  };
  application_id?: string;
  buttons?: string[];
  emoji?: { name: string; id?: string; animated?: boolean } | null;
}

export interface GuildMemberInfo {
  nick: string | null;
  roles: Array<{ id: string; name: string; color: string }>;
  joined_at: string | null;
  premium_since: string | null; // Boost date
  avatar: string | null;
}

export interface LanyardPresence {
  active_on_discord_mobile: boolean;
  active_on_discord_desktop: boolean;
  active_on_discord_web: boolean;
  listening_to_spotify: boolean;
  kv: Record<string, string>;
  spotify: SpotifyData | null;
  discord_user: DiscordUser;
  discord_status: "online" | "idle" | "dnd" | "offline";
  activities: Activity[];
  // Extended data (beyond Lanyard)
  user_profile: UserProfile | null;
  connected_accounts: ConnectedAccount[];
  profile_badges: ProfileBadge[];
  premium_since: string | null;
  premium_guild_since: string | null;
  guild_member: GuildMemberInfo | null;
  game_widgets: GameWidget[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: { message: string; code: string };
}

export enum OpCode {
  Event = 0,
  Hello = 1,
  Initialize = 2,
  Heartbeat = 3,
}

export interface SocketMessage {
  op: OpCode;
  d?: any;
  t?: string;
  seq?: number;
}

export interface InitializePayload {
  subscribe_to_ids?: string[];
  subscribe_to_id?: string;
  subscribe_to_all?: boolean;
}

export interface WebhookPayload {
  event: string;
  user_id: string;
  timestamp: number;
  data: LanyardPresence;
}
