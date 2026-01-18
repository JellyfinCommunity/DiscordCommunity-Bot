import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client, Collection, GatewayIntentBits, REST, Routes, MessageFlags } from 'discord.js';
import { initializeReminders } from './reminderManager.js';
import { initializeUpdateMonitor } from './updateMonitor.js';
const { initRedditFeed } = require('./redditRssFeed');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// Client with correct intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

client.commands = new Collection();

const commands = [];
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

// Load command files
for (const file of commandFiles) {
  const commandModule = await import(`./commands/${file}`);
  const command = commandModule.default;
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

// Register slash commands
const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);

  // Initialize Reddit RSS feed monitor
  const redditChannelId = process.env.REDDIT_CHANNEL_ID || 'YOUR_CHANNEL_ID';
  initRedditFeed(client, redditChannelId);   
  

  // Initialize reminder system
  await initializeReminders(client);

  // Initialize update monitor
  await initializeUpdateMonitor(client);

  try {
    console.log('📥 Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered.');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
});

// Handle slash commands and autocomplete
client.on('interactionCreate', async interaction => {
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'There was an error executing that command.', flags: MessageFlags.Ephemeral });
    }
  } else if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(error);
    }
  }
});

// Handle piracy keyword detection
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const hasPiracy = hasPiracyKeywords(message.content);
  if (hasPiracy) {
    const command = client.commands.get("piracy");
    if (command) {
      await command.execute(message);
    }
  }
});

// Keyword check
function hasPiracyKeywords(text) {
  const lowerText = text.trim().toLowerCase();
  const piracyKeywords = [
    "1fichier", "123movies", "1337x", "alldebrid", "anonfiles",
    "aria2", "bayfiles", "bdrip", "bluray rip", "camrip", "codex", "crack", "cracked",
    "deluge", "doodstream", "dvdrip", "ettv", "eztv", "eztvx", "fitgirl",
    "flixtor", "flixhq", "fmovies", "gofile", "gogoanime", "gomovies", "igg-games",
    "indexer", "jdownloader", "katcr", "keygen", "kickasstorrents", "lookmovie",
    "mediafire", "mega link", "monova", "myflixer", "nzb", "openload", "p2p", "peerflix",
    "popcorn time", "primewire", "projectfreetv", "prostylex", "putlocker", "qbittorrent",
    "rarbg", "real-debrid", "repack", "skidrow", "soap2day", "solarmovie", "streamsb",
    "streamtape", "torrent", "torrentgalaxy", "torrentleech", "tpb", "transmission",
    "uptobox", "utorrent", "vidcloud", "warez", "yesmovies", "yify", "yts.mx", "zippyshare"
  ];

  return piracyKeywords.some(keyword => lowerText.includes(keyword));
}

client.login(TOKEN);