// Import RSS Parser
import Parser from 'rss-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { timerManager } from './utils/timerManager.js';
import { redditLogger as log } from './utils/logger.js';
import { addJitter } from './utils/jitter.js';
import { truncate, sanitize, sanitizeUrl } from './utils/safeEmbed.js';
import { writeJsonAtomicSync, readJsonWithRecoverySync } from './utils/atomicJson.js';

const parser = new Parser({
    timeout: 20000, // 20 second timeout (faster retries)
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
    }
});

// Configuration
const REDDIT_RSS_URL = 'https://www.reddit.com/r/JellyfinCommunity/new/.rss';
const CHECK_INTERVAL = 15 * 60 * 1000; // Check every 15 minutes (in milliseconds)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTED_ITEMS_FILE = path.join(__dirname, 'postedItems.json');
const MAX_STORED_ITEMS = 10;

/**
 * Fetch RSS feed with retry logic and exponential backoff
 * @param {string} url - RSS feed URL
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<Object>} Parsed RSS feed
 */
async function fetchWithRetry(url, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await parser.parseURL(url);
        } catch (error) {
            if (attempt === maxRetries) throw error;
            const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
            log.warn({ attempt, maxRetries, delaySeconds: delay / 1000 }, 'RSS fetch failed, retrying');
            // Use tracked sleep for graceful shutdown
            const completed = await timerManager.sleep(`rss-retry-${attempt}`, delay);
            if (!completed) {
                throw new Error('RSS fetch cancelled due to shutdown');
            }
        }
    }
}

// Store to track already posted items (to avoid duplicates)
let postedItems = new Set();

/**
 * Load full posted items data from JSON file
 */
function loadPostedItemsFile() {
    return readJsonWithRecoverySync(POSTED_ITEMS_FILE, { redditPosts: [], updatePosts: [] });
}

/**
 * Save full posted items data to JSON file
 */
function savePostedItemsFile(data) {
    try {
        writeJsonAtomicSync(POSTED_ITEMS_FILE, data);
    } catch (error) {
        log.error({ err: error }, 'Error saving posted items file');
    }
}

/**
 * Load Reddit posted items from JSON file
 */
function loadPostedItems() {
    try {
        const data = loadPostedItemsFile();
        postedItems = new Set(data.redditPosts || []);
        log.info({ count: postedItems.size }, 'Loaded previously posted Reddit items');
    } catch (error) {
        log.error({ err: error }, 'Error loading posted items');
        postedItems = new Set();
    }
}

/**
 * Save Reddit posted items to JSON file (keeps only the last MAX_STORED_ITEMS)
 */
function savePostedItems() {
    try {
        const data = loadPostedItemsFile();
        const itemsArray = Array.from(postedItems).slice(-MAX_STORED_ITEMS);
        postedItems = new Set(itemsArray);
        data.redditPosts = itemsArray;
        savePostedItemsFile(data);
    } catch (error) {
        log.error({ err: error }, 'Error saving posted items');
    }
}

/**
 * Initialize the Reddit RSS feed monitor
 * @param {Client} client - Discord.js client instance
 * @param {string} channelId - Discord channel ID where posts should be sent
 */
async function initRedditFeed(client, channelId) {
    log.info('Starting Reddit RSS feed monitor');

    // Load previously posted items from file
    loadPostedItems();

    // Get the target Discord channel
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
        log.error({ channelId }, 'Channel not found');
        return;
    }

    // Initial load - if no saved items, mark current feed as already posted to avoid spam
    try {
        const feed = await fetchWithRetry(REDDIT_RSS_URL);

        if (postedItems.size === 0 && feed.items.length > 0) {
            // First run: mark all current posts as already posted
            feed.items.forEach(item => {
                postedItems.add(item.link);
            });
            savePostedItems();
            log.info({ count: postedItems.size }, 'First run: marked existing posts as already posted');
        } else {
            // Check for any new posts immediately
            await checkForNewPosts(channel);
        }
    } catch (error) {
        log.error({ err: error }, 'Error during initial RSS feed load');
    }

    // Start periodic checking with jitter (using timerManager for graceful shutdown)
    const scheduleNextCheck = () => {
        const jitteredInterval = addJitter(CHECK_INTERVAL, 0.15); // 15% jitter
        timerManager.setTimeout('reddit-rss-check', async () => {
            await checkForNewPosts(channel);
            scheduleNextCheck(); // Schedule next check after completion
        }, jitteredInterval);
    };
    scheduleNextCheck();

    log.info({ intervalMinutes: CHECK_INTERVAL / 1000 / 60, jitter: '15%' }, 'Reddit feed monitor active');
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
    const flair = item.categories && item.categories.length > 0 ? sanitize(item.categories[0]) : null;

    // Clean up and sanitize author name
    const authorName = sanitize((item.author || 'Unknown').replace(/^\/?u\//, ''));

    // Build title with flair prefix if available (truncate to Discord limit)
    const rawTitle = flair ? `[${flair}] ${item.title}` : item.title;
    const title = truncate(sanitize(rawTitle), 256);

    // Validate URLs
    const itemUrl = sanitizeUrl(item.link);
    const authorUrl = sanitizeUrl(`https://www.reddit.com/user/${encodeURIComponent(authorName)}`);
    const safeImageUrl = imageUrl ? sanitizeUrl(imageUrl) : null;

    // Create Discord embed message with safe values
    const embed = {
        color: 0xFF5700, // Reddit orange
        title: title,
        url: itemUrl,
        author: {
            name: truncate(`u/${authorName}`, 256),
            url: authorUrl,
            icon_url: 'https://www.redditstatic.com/avatars/defaults/v2/avatar_default_1.png',
        },
        description: textContent ? truncate(textContent, 4096) : undefined,
        timestamp: new Date(item.pubDate),
        footer: {
            text: 'r/JellyfinCommunity',
            icon_url: 'https://styles.redditmedia.com/t5_3fh7f/styles/communityIcon_1f4bk8bxuqz41.png',
        },
    };

    // Add image if found and valid (use large image, not thumbnail)
    if (safeImageUrl) {
        embed.image = { url: safeImageUrl };
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
        const feed = await fetchWithRetry(REDDIT_RSS_URL);

        // Process items in reverse order (oldest first) to maintain chronological order
        const newItems = feed.items
            .filter(item => !postedItems.has(item.link))
            .reverse();

        if (newItems.length > 0) {
            log.info({ count: newItems.length }, 'Found new Reddit posts');
        }

        for (let i = 0; i < newItems.length; i++) {
            const item = newItems[i];
            // Mark as posted immediately to avoid duplicates
            postedItems.add(item.link);

            await postItem(channel, item);

            // Small delay to avoid rate limiting (tracked for graceful shutdown)
            if (i < newItems.length - 1) {
                await timerManager.sleep(`rss-post-delay-${i}`, 1000);
            }
        }

        // Save to file if we posted anything
        if (newItems.length > 0) {
            savePostedItems();
        }
    } catch (error) {
        log.error({ err: error }, 'Error checking RSS feed');
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
        // Decode numeric entities (decimal: &#32; and hex: &#x20;)
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        // Decode named entities
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ');
}

export { initRedditFeed };