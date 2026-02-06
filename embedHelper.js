import { EmbedBuilder } from 'discord.js';
import { COLORS, CATEGORY_INFO, isFeaturedProject } from './config.js';
import { truncate, sanitize, sanitizeUrl, EMBED_LIMITS } from './utils/safeEmbed.js';

/**
 * Creates an embed for a project (client, plugin, or service)
 * @param {Object} item - The project item
 * @param {string} category - Category type: 'clients', 'plugins', or 'services'
 * @returns {EmbedBuilder}
 */
export function createProjectEmbed(item, category) {
    const isFeatured = isFeaturedProject(item);
    const categoryInfo = CATEGORY_INFO[category];

    // Sanitize and validate URLs
    const projectIcon = sanitizeUrl(item.logo || item.icon || item.image) || categoryInfo.iconURL;
    const repoUrl = sanitizeUrl(item.repo);
    const statusUrl = sanitizeUrl(item.statusUrl);

    // Sanitize text content
    const safeName = truncate(sanitize(item.name), 200);
    const safeDescription = truncate(sanitize(item.description || 'No description available'), EMBED_LIMITS.DESCRIPTION);

    const embed = new EmbedBuilder()
        .setColor(isFeatured ? COLORS.featured : COLORS[category])
        .setAuthor({
            name: truncate(categoryInfo.name, EMBED_LIMITS.AUTHOR_NAME),
            iconURL: projectIcon,
            url: categoryInfo.url
        })
        .setTitle(truncate(`${isFeatured ? '⭐ ' : ''}${safeName}`, EMBED_LIMITS.TITLE))
        .setURL(repoUrl || '#')
        .setDescription(safeDescription)
        .setFooter({
            text: truncate(
                isFeatured
                    ? '⭐ Developer active on this server'
                    : `Use ${categoryInfo.command} to browse all available ${category}`,
                EMBED_LIMITS.FOOTER_TEXT
            )
        });

    const thumbnailUrl = sanitizeUrl(item.logo || item.icon || item.image);
    if (thumbnailUrl) {
        embed.setThumbnail(thumbnailUrl);
    }

    if (repoUrl) {
        embed.addFields({
            name: '🔗 Repository',
            value: `[View on GitHub](${repoUrl})`,
            inline: false
        });
    }

    // Services can have a status URL
    if (statusUrl) {
        embed.addFields({
            name: '🌐 Status Page',
            value: `[Check Status](${statusUrl})`,
            inline: false
        });
    }

    if (item.developers && item.developers.length > 0) {
        const devList = item.developers.map(dev => {
            if (typeof dev === 'string') {
                return sanitize(dev);
            }
            const name = sanitize(dev.name || 'Unknown');
            const discordUser = dev.discord_username ? ` (${sanitize(dev.discord_username)})` : '';
            return `${name}${discordUser}`;
        }).join(', ');

        embed.addFields({
            name: '👥 Developers',
            value: truncate(devList, EMBED_LIMITS.FIELD_VALUE),
            inline: false
        });

        const channelLinks = item.developers
            .filter(dev => typeof dev === 'object' && dev.discord_channel)
            .map(dev => `<#${sanitize(dev.discord_channel)}>`)
            .join(', ');

        if (channelLinks) {
            embed.addFields({
                name: '💬 Discord Channel',
                value: truncate(channelLinks, EMBED_LIMITS.FIELD_VALUE),
                inline: false
            });
        }
    }

    if (item.lastRelease) {
        const releaseUrl = sanitizeUrl(item.lastRelease.url);
        const safeTag = sanitize(item.lastRelease.tag || 'unknown');
        const releaseValue = releaseUrl
            ? `[${safeTag}](${releaseUrl}) - ${new Date(item.lastRelease.published_at).toLocaleDateString()}`
            : `${safeTag} - ${new Date(item.lastRelease.published_at).toLocaleDateString()}`;

        embed.addFields({
            name: '📦 Latest Release',
            value: truncate(releaseValue, EMBED_LIMITS.FIELD_VALUE),
            inline: false
        });
    }

    return embed;
}
