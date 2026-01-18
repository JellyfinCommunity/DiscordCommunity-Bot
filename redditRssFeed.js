// Import RSS Parser
const Parser = require('rss-parser');
const parser = new Parser();

// Configuration
const REDDIT_RSS_URL = 'https://www.reddit.com/r/JellyfinCommunity/new/.rss';
const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes (in milliseconds)

// Store to track already posted items (to avoid duplicates)
let postedItems = new Set();

/**
 * Initialize the Reddit RSS feed monitor
 * @param {Client} client - Discord.js client instance
 * @param {string} channelId - Discord channel ID where posts should be sent
 */
async function initRedditFeed(client, channelId) {
    console.log('Starting Reddit RSS feed monitor...');
    
    // Get the target Discord channel
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
        console.error(`Channel ${channelId} not found!`);
        return;
    }

    // Initial load - populate the postedItems set without posting
    try {
        const feed = await parser.parseURL(REDDIT_RSS_URL);
        feed.items.forEach(item => {
            postedItems.add(item.link);
        });
        console.log(`Loaded ${postedItems.size} existing Reddit posts (won't be reposted)`);
    } catch (error) {
        console.error('Error during initial RSS feed load:', error);
    }

    // Start periodic checking
    setInterval(async () => {
        await checkForNewPosts(channel);
    }, CHECK_INTERVAL);

    console.log(`Reddit feed monitor active. Checking every ${CHECK_INTERVAL / 1000 / 60} minutes.`);
}

/**
 * Check RSS feed for new posts and send them to Discord
 * @param {TextChannel} channel - Discord channel to post to
 */
async function checkForNewPosts(channel) {
    try {
        const feed = await parser.parseURL(REDDIT_RSS_URL);
        
        // Process items in reverse order (oldest first) to maintain chronological order
        const newItems = feed.items
            .filter(item => !postedItems.has(item.link))
            .reverse();

        if (newItems.length > 0) {
            console.log(`Found ${newItems.length} new Reddit post(s)`);
        }

        for (const item of newItems) {
            // Mark as posted immediately to avoid duplicates
            postedItems.add(item.link);

            // Create Discord embed message
            const embed = {
                color: 0x0099ff, // Blue color
                title: item.title,
                url: item.link,
                author: {
                    name: item.author || 'Unknown',
                },
                description: cleanDescription(item.contentSnippet || item.content),
                timestamp: new Date(item.pubDate),
                footer: {
                    text: 'r/JellyfinCommunity',
                },
            };

            // Add thumbnail if available
            if (item.enclosure && item.enclosure.url) {
                embed.thumbnail = { url: item.enclosure.url };
            }

            // Send to Discord
            await channel.send({ embeds: [embed] });
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        console.error('Error checking RSS feed:', error);
    }
}

/**
 * Clean and truncate description text
 * @param {string} text - Raw description text
 * @returns {string} Cleaned description
 */
function cleanDescription(text) {
    if (!text) return '';
    
    // Remove HTML tags
    let cleaned = text.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities
    cleaned = cleaned
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    
    // Truncate to 300 characters
    if (cleaned.length > 300) {
        cleaned = cleaned.substring(0, 297) + '...';
    }
    
    return cleaned;
}

module.exports = { initRedditFeed };