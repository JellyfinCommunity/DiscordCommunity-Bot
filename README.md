<p align="center">
  <img src="https://i.ibb.co/PzmPtyWQ/github-banner.jpg" alt="JellyfinCommunity" width="100%">
</p>

<p align="center">
  <a href="https://discord.gg/wH6Z75Yaeb">
    <img alt="JellyfinCommunity" src="https://img.shields.io/badge/Discord-Streamyfin-blue?style=flat-square&logo=discord">
      <a href="https://www.reddit.com/r/JellyfinCommunity/">
    <img alt="JellyfinCommunity" src="https://img.shields.io/badge/Reddit-JellyfinCommunity-orange?style=flat-square&logo=reddit">
  </a>
</p>

A Discord bot for the [JellyfinCommunity Discord Server](https://discord.gg/MTM8dkjr93) providing easy access to community-developed clients, plugins, and services.

## ✨ Features

- 📚 Quick access to official Jellyfin resources  
- 🧩 Modular command structure  
- ⚡ Simple setup and configuration  
- 🔄 Fully compatible with modern Discord.js  
- 📱 Comprehensive community project information system
- 🖼️ Rich embeds with project logos and visual branding
- ⏰ Reminder system with persistent storage  
- 🚫 Anti-piracy keyword detection and education

## 📋 Requirements

| Requirement | Details |
|-------------|---------|
| Node.js | v16 or newer |
| Discord Bot Token | [Create one here](https://discord.com/developers/applications) |
| Permissions | Send Messages |
| Docker | *Optional* |

## 🚀 Installation
```bash
git clone https://github.com/JellyfinCommunity/DiscordCommunity-Bot.git
cd DiscordCommunity-Bot
npm install
```

## ⚙️ Configuration

Create a `.env` file in the root directory:
```env
TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
GUILD_ID=your_guild_id_here
```

### Environment Variables

- `TOKEN`: Your Discord bot token
- `CLIENT_ID`: Your Discord application ID  
- `GUILD_ID`: The Discord server ID where commands will be registered

## 📖 Usage
```bash
npm start
```

## 🤖 Available Commands

### Third-Party Client Management
- **`/clients`** - Lists all third-party Jellyfin clients with developer info and release tags
- **`/clients [client-name]`** - Shows detailed information for a specific client (with autocomplete)

### Plugin Management  
- **`/plugins`** - Lists all available community plugins with descriptions
- **`/plugins [plugin-name]`** - Shows detailed plugin information (with autocomplete)

### Service Management
- **`/services`** - Lists all community services with status links
- **`/services [service-name]`** - Shows detailed service information (with autocomplete)

### General Commands
- **`/jellyfin`** - Official Jellyfin server information and links
- **`/docs`** - Documentation and helpful links
- **`/api-docs`** - API documentation resources
- **`/awesome-jellyfin`** - Curated awesome-jellyfin resources
- **`/privatebin`** - PrivateBin service information
- **`/remindme`** - Set personal reminders

### Data Categories

#### 🔧 **Third-Party Clients** (Blue embeds)
- Community-developed Jellyfin clients and applications
- Displays developer names as plain text (no pings/mentions)
- Shows logos when available in project data
- Examples: Streamyfin, AFinity

#### 🔧 **Community Plugins** (Green embeds)  
- Enhancement plugins and extensions created by the community
- Includes descriptions and repository links
- Shows logos when available in project data
- Examples: Jellyfin Enhanced, KefinTweaks

#### ⚙️ **Community Services** (Orange embeds)
- Infrastructure tools and services built by the community 
- Includes optional status page links
- Shows logos when available in project data
- Examples: Anchorr Discord bot, Streamystats analytics

### JSON-Based Configuration

All project data is managed through `data.json`:

```json
{
  "third_party_clients": [
    {
      "id": "streamyfin",
      "name": "Streamyfin", 
      "description": "Modern Jellyfin client for iOS",
      "logo": "https://example.com/logo.png",
      "developers": [
        {
          "name": "DevName",
          "link": "https://github.com/devname"
        }
      ],
      "repo": "https://github.com/streamyfin/streamyfin",
      "lastRelease": {
        "tag": "v1.0.0",
        "url": "https://github.com/streamyfin/streamyfin/releases/tag/v1.0.0",
        "published_at": "2024-01-01T00:00:00Z"
      }
    }
  ],
  "plugins": [...],
  "services": [...]
}
```

#### Optional Logo Support
- Add `"logo"`, `"icon"`, or `"image"` fields to any project
- URLs will be displayed as embed thumbnails
- Graceful fallback to text-only embeds if no logo is provided
- No breaking changes to existing data structure

#### Developer Display
- Developer names are shown as plain text
- No Discord mentions or pings are generated
- Links to developer profiles remain clickable in repository context

## 🛡️ Anti-Piracy Features

The bot automatically detects piracy-related keywords in messages and responds with educational information about legal alternatives and the importance of supporting developers.

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## 💜 Credits

Special thanks to [@retardgerman](https://github.com/retardgerman) for founding this project and writing the majority of the bot. His vision and development have been the heart in shaping its features and direction.
