import fs from 'fs/promises';
import path from 'path';
import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import { COLORS } from './config.js';

const DATA_FILE = path.join(process.cwd(), 'data.json');
const UPDATE_CHANNEL_ID = process.env.UPDATE_CHANNEL_ID;

export async function initializeUpdateMonitor(client) {
    console.log('🔄 Initializing update monitor...');
    
    if (!UPDATE_CHANNEL_ID) {
        console.warn('⚠️  UPDATE_CHANNEL_ID not set in environment variables. Update notifications disabled.');
        return;
    }

    // Schedule checks every 6 hours
    cron.schedule('0 */6 * * *', async () => {
        console.log('🔍 Running scheduled update check...');
        await checkForUpdates(client);
    });

    // Initial check on startup (after 1 minute)
    setTimeout(async () => {
        console.log('🔍 Running initial update check...');
        await checkForUpdates(client);
    }, 60000);

    console.log('✅ Update monitor initialized');
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
                        
                        // New release detected
                        console.log(`🆕 New release for ${item.name}: ${latestRelease.tag_name}`);
                        
                        // Update item data
                        item.lastRelease = {
                            tag: latestRelease.tag_name,
                            url: latestRelease.html_url,
                            published_at: latestRelease.published_at
                        };
                        
                        // Send notification
                        await sendUpdateNotification(client, item, latestRelease, category);
                        hasUpdates = true;
                    }

                    item.lastChecked = new Date().toISOString();
                    
                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.error(`Error checking updates for ${item.name}:`, error.message);
                }
            }
        }

        if (hasUpdates) {
            // Save updated data
            await fs.writeFile(DATA_FILE, JSON.stringify(jsonData, null, 2));
        }

    } catch (error) {
        console.error('Error during update check:', error);
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
            console.error('Update channel not found');
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

        const embed = new EmbedBuilder()
            .setColor(categoryColorMap[category] || 0x00FF00)
            .setAuthor({
                name: `New ${categoryData.name} Release!`,
                iconURL: "https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png"
            })
            .setTitle(`${categoryData.icon} ${item.name} - ${release.tag_name}`)
            .setURL(release.html_url)
            .setDescription(truncateText(release.body || 'No release notes available.', 500))
            .addFields(
                { name: "📅 Released", value: releaseDate.toLocaleDateString(), inline: true },
                { name: "🔗 Repository", value: `[View on GitHub](${item.repo})`, inline: true }
            )
            .setTimestamp(releaseDate)
            .setFooter({ text: `${categoryData.name} Update` });

        // Add developers for clients
        if (category === 'third_party_clients' && item.developers) {
            const developersText = item.developers
                .map(dev => dev.link ? `[${dev.name}](${dev.link})` : dev.name)
                .join(', ');
            embed.addFields({ name: "👨‍💻 Developers", value: developersText, inline: true });
        }

        // Add status link for services
        if (category === 'services' && item.statusUrl) {
            embed.addFields({ name: "🌐 Status", value: `[Check Status](${item.statusUrl})`, inline: true });
        }

        await channel.send({ embeds: [embed] });
        console.log(`📢 Sent update notification for ${item.name}`);

    } catch (error) {
        console.error(`Error sending notification for ${item.name}:`, error);
    }
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    
    // Remove markdown formatting for cleaner truncation
    const cleanText = text.replace(/[*_`~|]/g, '').replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    
    if (cleanText.length <= maxLength) return cleanText;
    
    return cleanText.substring(0, maxLength - 3) + '...';
}

// Manual check function for testing
export async function manualUpdateCheck(client) {
    console.log('🔍 Running manual update check...');
    await checkForUpdates(client);
}