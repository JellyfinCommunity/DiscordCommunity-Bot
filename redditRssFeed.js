// Import RSS Parser
import Parser from 'rss-parser';
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

    // Initial load - post the latest item to verify functionality, mark others as already posted
    try {
        const feed = await parser.parseURL(REDDIT_RSS_URL);

        if (feed.items.length > 0) {
            // The first item is the newest post
            const latestPost = feed.items[0];

            // Mark all OTHER posts as already posted (skip the first one)
            feed.items.slice(1).forEach(item => {
                postedItems.add(item.link);
            });
            console.log(`Loaded ${postedItems.size} existing Reddit posts (won't be reposted)`);

            // Post the latest one to verify functionality
            console.log('Posting latest Reddit post to verify functionality...');
            await postItem(channel, latestPost);
            postedItems.add(latestPost.link);
            console.log('Verification post sent successfully!');
        } else {
            console.log('No Reddit posts found in feed');
        }
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
 * Post a single RSS item to Discord
 * @param {TextChannel} channel - Discord channel to post to
 * @param {Object} item - RSS feed item
 */
async function postItem(channel, item) {
    // Extract image URL and text content from the post
    const { imageUrl, textContent } = extractContent(item.content || item.contentSnippet || '');

    // Extract flair from categories if available
    const flair = item.categories && item.categories.length > 0 ? item.categories[0] : null;

    // Build description with image URL link if present
    let description = '';
    if (imageUrl) {
        description += `${imageUrl}\n\n`;
    }
    if (textContent) {
        description += textContent;
    }

    // Create Discord embed message
    const embed = {
        color: 0xFF5700, // Reddit/Jellyfin orange color
        title: item.title,
        url: item.link,
        author: {
            name: `u/${item.author || 'Unknown'}`,
        },
        description: description || undefined,
        fields: [],
        timestamp: new Date(item.pubDate),
        footer: {
            text: 'r/JellyfinCommunity',
        },
    };

    // Add flair field if available
    if (flair) {
        embed.fields.push({
            name: 'Flair',
            value: flair,
            inline: false,
        });
    }

    // Remove empty fields array if no fields
    if (embed.fields.length === 0) {
        delete embed.fields;
    }

    // Add thumbnail if we found an image
    if (imageUrl) {
        embed.thumbnail = { url: imageUrl };
    }

    // Send to Discord
    await channel.send({ embeds: [embed] });
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

            await postItem(channel, item);

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        console.error('Error checking RSS feed:', error);
    }
}

/**
 * Extract image URL and text content from HTML content
 * @param {string} html - Raw HTML content
 * @returns {Object} Object with imageUrl and textContent
 */
function extractContent(html) {
    if (!html) return { imageUrl: null, textContent: '' };

    let imageUrl = null;
    let textContent = '';

    // Extract image URL from img tags or preview.redd.it links
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) {
        imageUrl = decodeHtmlEntities(imgMatch[1]);
    }

    // Also check for preview.redd.it or i.redd.it links in href
    if (!imageUrl) {
        const linkMatch = html.match(/href=["'](https?:\/\/(?:preview|i)\.redd\.it\/[^"']+)["']/i);
        if (linkMatch) {
            imageUrl = decodeHtmlEntities(linkMatch[1]);
        }
    }

    // Extract text content (remove HTML tags)
    textContent = html
        .replace(/<a[^>]*>.*?<\/a>/gi, '') // Remove link elements (often just the image link)
        .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
        .trim();

    // Decode HTML entities
    textContent = decodeHtmlEntities(textContent);

    // Remove "[link]" and "[comments]" text
    textContent = textContent
        .replace(/\[link\]/gi, '')
        .replace(/\[comments\]/gi, '')
        .trim();

    // Truncate to 300 characters
    if (textContent.length > 300) {
        textContent = textContent.substring(0, 297) + '...';
    }

    return { imageUrl, textContent };
}

/**
 * Decode HTML entities
 * @param {string} text - Text with HTML entities
 * @returns {string} Decoded text
 */
function decodeHtmlEntities(text) {
    if (!text) return '';
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

export { initRedditFeed };