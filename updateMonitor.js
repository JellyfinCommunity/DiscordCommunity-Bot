import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import { COLORS } from './config.js';
import { timerManager } from './utils/timerManager.js';
import { updateLogger as log } from './utils/logger.js';
import { addJitter, addPositiveJitter } from './utils/jitter.js';
import { truncate, sanitize, sanitizeUrl, EMBED_LIMITS } from './utils/safeEmbed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(process.cwd(), 'data.json');
const POSTED_ITEMS_FILE = path.join(__dirname, 'postedItems.json');
const MAX_STORED_UPDATES = 10;
const UPDATE_CHANNEL_ID = process.env.UPDATE_CHANNEL_ID;

/**
 * Load full posted items data from JSON file
 */
function loadPostedItemsFile() {
    try {
        if (fsSync.existsSync(POSTED_ITEMS_FILE)) {
            return JSON.parse(fsSync.readFileSync(POSTED_ITEMS_FILE, 'utf8'));
        }
    } catch (error) {
        log.error({ err: error }, 'Error loading posted items file');
    }
    return { redditPosts: [], updatePosts: [] };
}

/**
 * Save full posted items data to JSON file
 */
function savePostedItemsFile(data) {
    try {
        fsSync.writeFileSync(POSTED_ITEMS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        log.error({ err: error }, 'Error saving posted items file');
    }
}

/**
 * Check if an update has already been posted
 */
function isUpdatePosted(releaseKey) {
    const data = loadPostedItemsFile();
    return (data.updatePosts || []).includes(releaseKey);
}

/**
 * Mark an update as posted
 */
function markUpdatePosted(releaseKey) {
    const data = loadPostedItemsFile();
    const updates = data.updatePosts || [];
    updates.push(releaseKey);
    data.updatePosts = updates.slice(-MAX_STORED_UPDATES);
    savePostedItemsFile(data);
}

export async function initializeUpdateMonitor(client) {
    log.info('Initializing update monitor');

    if (!UPDATE_CHANNEL_ID) {
        log.warn('UPDATE_CHANNEL_ID not set - update notifications disabled');
        return;
    }

    // Schedule checks every hour (using timerManager for graceful shutdown)
    const job = cron.schedule('0 * * * *', async () => {
        log.info('Running scheduled update check');
        await checkForUpdates(client);
    });
    timerManager.registerCron('update-monitor', job);

    // Initial check on startup (after 1-2 minutes with jitter to stagger startup)
    const initialDelay = addPositiveJitter(60000, 1.0); // 60-120 seconds
    timerManager.setTimeout('initial-update-check', async () => {
        log.info('Running initial update check');
        await checkForUpdates(client);
    }, initialDelay);

    log.info('Update monitor initialized');
}

async function checkForUpdates(client) {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const jsonData = JSON.parse(data);
        let hasUpdates = false;

        // Check third_party_clients, plugins, and services
        for (const [category, items] of Object.entries(jsonData)) {
            if (!Array.isArray(items)) continue;
            
            for (const item of items) {
                try {
                    if (!item.repo) continue;
                    
                    const latestRelease = await fetchLatestRelease(item.repo);
                    
                    if (latestRelease && (!item.lastRelease ||
                        latestRelease.tag_name !== item.lastRelease.tag)) {

                        // Create unique key for this release
                        const releaseKey = `${item.name}:${latestRelease.tag_name}`;

                        // Check if already posted (duplicate prevention on restart)
                        if (isUpdatePosted(releaseKey)) {
                            log.debug({ releaseKey }, 'Skipping already posted release');
                            item.lastRelease = {
                                tag: latestRelease.tag_name,
                                url: latestRelease.html_url,
                                published_at: latestRelease.published_at
                            };
                            hasUpdates = true;
                            continue;
                        }

                        // New release detected
                        log.info({ name: item.name, tag: latestRelease.tag_name }, 'New release detected');

                        // Update item data
                        item.lastRelease = {
                            tag: latestRelease.tag_name,
                            url: latestRelease.html_url,
                            published_at: latestRelease.published_at
                        };

                        // Send notification
                        await sendUpdateNotification(client, item, latestRelease, category);

                        // Mark as posted
                        markUpdatePosted(releaseKey);
                        hasUpdates = true;
                    }

                    item.lastChecked = new Date().toISOString();
                    
                    // Jittered delay between API calls to avoid rate limiting
                    const delay = addJitter(1000, 0.5); // 500-1500ms
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                } catch (error) {
                    log.error({ err: error, name: item.name }, 'Error checking updates for item');
                }
            }
        }

        if (hasUpdates) {
            // Save updated data
            await fs.writeFile(DATA_FILE, JSON.stringify(jsonData, null, 2));
        }

    } catch (error) {
        log.error({ err: error }, 'Error during update check');
    }
}

async function fetchLatestRelease(repoUrl) {
    // Extract owner/repo from GitHub URL
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) return null;
    
    const [, owner, repo] = match;
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Jellyfin-Community-Bot',
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                // No releases found
                return null;
            }
            throw new Error(`GitHub API responded with ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        throw new Error(`Failed to fetch release data: ${error.message}`);
    }
}

async function sendUpdateNotification(client, item, release, category) {
    try {
        const channel = await client.channels.fetch(UPDATE_CHANNEL_ID);
        if (!channel) {
            log.error({ channelId: UPDATE_CHANNEL_ID }, 'Update channel not found');
            return;
        }

        const releaseDate = new Date(release.published_at);

        // Map category keys to config keys
        const categoryColorMap = {
            third_party_clients: COLORS.clients,
            plugins: COLORS.plugins,
            services: COLORS.services
        };

        const categoryInfo = {
            third_party_clients: { icon: "🔧", name: "Third Party Client" },
            plugins: { icon: "🔧", name: "Plugin" },
            services: { icon: "⚙️", name: "Service" }
        };

        const categoryData = categoryInfo[category] || { icon: "📦", name: "Update" };

        // Sanitize and validate all external data
        const safeName = truncate(sanitize(item.name), 200);
        const safeTagName = truncate(sanitize(release.tag_name), 50);
        const safeReleaseUrl = sanitizeUrl(release.html_url);
        const safeRepoUrl = sanitizeUrl(item.repo);
        const safeReleaseBody = truncate(sanitize(release.body || 'No release notes available.'), 500);

        const embed = new EmbedBuilder()
            .setColor(categoryColorMap[category] || 0x00FF00)
            .setAuthor({
                name: truncate(`New ${categoryData.name} Release!`, EMBED_LIMITS.AUTHOR_NAME),
                iconURL: "https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png"
            })
            .setTitle(truncate(`${categoryData.icon} ${safeName} - ${safeTagName}`, EMBED_LIMITS.TITLE))
            .setURL(safeReleaseUrl)
            .setDescription(safeReleaseBody)
            .addFields(
                { name: "📅 Released", value: releaseDate.toLocaleDateString(), inline: true },
                { name: "🔗 Repository", value: safeRepoUrl ? `[View on GitHub](${safeRepoUrl})` : 'N/A', inline: true }
            )
            .setTimestamp(releaseDate)
            .setFooter({ text: truncate(`${categoryData.name} Update`, EMBED_LIMITS.FOOTER_TEXT) });

        // Add developers for clients
        if (category === 'third_party_clients' && item.developers) {
            const developersText = item.developers
                .map(dev => {
                    const safeDev = sanitize(dev.name || 'Unknown');
                    const safeLink = sanitizeUrl(dev.link);
                    return safeLink ? `[${safeDev}](${safeLink})` : safeDev;
                })
                .join(', ');
            embed.addFields({ name: "👨‍💻 Developers", value: truncate(developersText, EMBED_LIMITS.FIELD_VALUE), inline: true });
        }

        // Add status link for services
        if (category === 'services' && item.statusUrl) {
            const safeStatusUrl = sanitizeUrl(item.statusUrl);
            if (safeStatusUrl) {
                embed.addFields({ name: "🌐 Status", value: `[Check Status](${safeStatusUrl})`, inline: true });
            }
        }

        await channel.send({ embeds: [embed] });
        log.info({ name: item.name }, 'Sent update notification');

    } catch (error) {
        log.error({ err: error, name: item.name }, 'Error sending notification');
    }
}


// Manual check function for testing
export async function manualUpdateCheck(client) {
    log.info('Running manual update check');
    await checkForUpdates(client);
}