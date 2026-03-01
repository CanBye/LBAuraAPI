# LBAuraAPI

Discord presence tracking API with extended features. A powerful alternative to Lanyard with additional user profile data, badges, decorations, and more.

## Features

- Real-time Discord presence tracking
- WebSocket support for live updates
- Extended user profile data (bio, pronouns, badges, decorations)
- Spotify integration
- Key-value storage per user
- Bulk user queries
- Discord bot commands
- Rate limiting & security
- Swagger API documentation
- Stats webhook for monitoring

## Quick Start

### Installation

```bash
npm install
```

### Configuration

Create a `.env` file:

```env
BOT_TOKEN=your_discord_bot_token
PORT=4001
API_HOST=0.0.0.0
API_BASE_URL=http://localhost:4001
WEBHOOK_URL=
STATS_WEBHOOK_URL=
STATS_INTERVAL_MS=300000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Running

```bash
npm run build
npm start
```

For development:

```bash
npm run dev
```

## API Endpoints

### Get User Presence

```
GET /v1/users/:user_id
```

Returns full presence data including activities, Spotify, profile decorations, and badges.

### Bulk User Query

```
GET /v1/users?ids=id1,id2,id3
```

Get multiple user presences at once (max 50).

### Health Check

```
GET /v1/health
```

Returns API status, uptime, and statistics.

### Key-Value Storage

```
PUT /v1/users/:user_id/kv/:key
DELETE /v1/users/:user_id/kv/:key
PATCH /v1/users/:user_id/kv
```

Store custom data per user (requires API key).

### Avatar Shortcut

```
GET /:user_id.png
GET /:user_id.gif
```

Direct redirect to user's Discord avatar.

## WebSocket

Connect to `ws://your-api-url/socket` for real-time presence updates.

### Initialize Connection

```json
{
  "op": 2,
  "d": {
    "subscribe_to_id": "USER_ID"
  }
}
```

Or subscribe to multiple users:

```json
{
  "op": 2,
  "d": {
    "subscribe_to_ids": ["USER_ID_1", "USER_ID_2"]
  }
}
```

### Heartbeat

Send every 30 seconds:

```json
{
  "op": 3
}
```

## Discord Bot Commands

- `.me` - Get your API URL and profile links
- `.apikey` - Generate your API key (sent via DM)
- `.set <key> <value>` - Set a KV pair
- `.del <key>` - Delete a KV pair
- `.help` - Show command list

## Documentation

Visit `/docs` for interactive Swagger documentation.

## Extended Data

Beyond basic presence, LBAuraAPI provides:

- Avatar decorations & expiry dates
- Profile badges & collectibles
- Display name styles & effects
- Primary guild (clan) info
- Connected accounts
- Premium status & boost dates
- Game widgets
- Guild member data

## License

MIT

## Links

- [GitHub Repository](https://github.com/CanBye/LBAuraAPI)
- API Documentation: `/docs`
- Demo Page: `/demo`
