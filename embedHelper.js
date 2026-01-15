import { EmbedBuilder } from 'discord.js';
import { COLORS, CATEGORY_INFO, isFeaturedProject } from './config.js';

/**
 * Creates an embed for a project (client, plugin, or service)
 * @param {Object} item - The project item
 * @param {string} category - Category type: 'clients', 'plugins', or 'services'
 * @returns {EmbedBuilder}
 */
export function createProjectEmbed(item, category) {
    const isFeatured = isFeaturedProject(item);
    const categoryInfo = CATEGORY_INFO[category];

    // Use project logo if available, otherwise fall back to category icon
    const projectIcon = item.logo || item.icon || item.image || categoryInfo.iconURL;

    const embed = new EmbedBuilder()
        .setColor(isFeatured ? COLORS.featured : COLORS[category])
        .setAuthor({
            name: categoryInfo.name,
            iconURL: projectIcon,
            url: categoryInfo.url
        })
        .setTitle(`${isFeatured ? '⭐ ' : ''}${item.name}`)
        .setURL(item.repo || '#')
        .setDescription(item.description || 'No description available')
        .setFooter({
            text: isFeatured
                ? '⭐ Developer active on this server'
                : `Use ${categoryInfo.command} to browse all available ${category}`
        });

    if (item.logo || item.icon || item.image) {
        embed.setThumbnail(item.logo || item.icon || item.image);
    }

    if (item.repo) {
        embed.addFields({
            name: '🔗 Repository',
            value: `[View on GitHub](${item.repo})`,
            inline: false
        });
    }

    // Services can have a status URL
    if (item.statusUrl) {
        embed.addFields({
            name: '🌐 Status Page',
            value: `[Check Status](${item.statusUrl})`,
            inline: false
        });
    }

    if (item.developers && item.developers.length > 0) {
        const devList = item.developers.map(dev => {
            if (typeof dev === 'string') {
                return dev;
            }
            const name = dev.name || 'Unknown';
            const discordUser = dev.discord_username ? ` (${dev.discord_username})` : '';
            return `${name}${discordUser}`;
        }).join(', ');

        embed.addFields({
            name: '👥 Developers',
            value: devList,
            inline: false
        });

        const channelLinks = item.developers
            .filter(dev => typeof dev === 'object' && dev.discord_channel)
            .map(dev => `<#${dev.discord_channel}>`)
            .join(', ');

        if (channelLinks) {
            embed.addFields({
                name: '💬 Discord Channel',
                value: channelLinks,
                inline: false
            });
        }
    }

    if (item.lastRelease) {
        embed.addFields({
            name: '📦 Latest Release',
            value: `[${item.lastRelease.tag}](${item.lastRelease.url}) - ${new Date(item.lastRelease.published_at).toLocaleDateString()}`,
            inline: false
        });
    }

    return embed;
}
