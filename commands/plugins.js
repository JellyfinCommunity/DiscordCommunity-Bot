import { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType, MessageFlags } from "discord.js";
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data.json');

function createPluginEmbed(plugin) {
    const featuredProjects = [
        'afinity', 'anchorr', 'jellybuddy', 'jellyfin-enhanced', 'kefin-tweaks', 
        'paradox-plugins', 'streamystats'
    ];
    
    const isFeatured = featuredProjects.some(id => plugin.id.includes(id) || plugin.name.toLowerCase().includes(id));
    
    const embed = new EmbedBuilder()
        .setColor(isFeatured ? 0xFFD700 : 0x00D4AA)
        .setAuthor({
            name: "Jellyfin Plugins",
            iconURL: "https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png",
            url: "https://jellyfin.org/docs/general/server/plugins"
        })
        .setTitle(`${isFeatured ? '⭐ ' : ''}${plugin.name}`)
        .setURL(plugin.repo)
        .setDescription(plugin.description || 'No description available')
        .setFooter({ text: isFeatured ? "⭐ Developer active on this server" : "Use /plugins to browse all available plugins" });

    if (plugin.logo || plugin.icon || plugin.image) {
        embed.setThumbnail(plugin.logo || plugin.icon || plugin.image);
    }

    if (plugin.repo) {
        embed.addFields({ 
            name: "🔗 Repository", 
            value: `[View on GitHub](${plugin.repo})`, 
            inline: false 
        });
    }

    if (plugin.developers && plugin.developers.length > 0) {
        const devList = plugin.developers.map(dev => {
            if (typeof dev === 'string') {
                return dev;
            }
            const name = dev.name || 'Unknown';
            const discordUser = dev.discord_username ? ` (${dev.discord_username})` : '';
            return `${name}${discordUser}`;
        }).join(', ');
        embed.addFields({
            name: "👥 Developers",
            value: devList,
            inline: false
        });

        // Add Discord channel links if available
        const channelLinks = plugin.developers
            .filter(dev => typeof dev === 'object' && dev.discord_channel)
            .map(dev => `<#${dev.discord_channel}>`)
            .join(', ');
        
        if (channelLinks) {
            embed.addFields({
                name: "💬 Discord Channel",
                value: channelLinks,
                inline: false
            });
        }
    }

    if (plugin.lastRelease) {
        embed.addFields({
            name: "📦 Latest Release",
            value: `[${plugin.lastRelease.tag}](${plugin.lastRelease.url}) - ${new Date(plugin.lastRelease.published_at).toLocaleDateString()}`,
            inline: false
        });
    }

    return embed;
}

export default {
    data: new SlashCommandBuilder()
        .setName("plugins")
        .setDescription("Browse Jellyfin plugins with an interactive menu"),

    async execute(interaction) {
        try {
            const data = await fs.readFile(DATA_FILE, 'utf8');
            const jsonData = JSON.parse(data);

            if (!jsonData.plugins || jsonData.plugins.length === 0) {
                await interaction.reply({
                    content: "❌ No plugins available.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Featured projects (developers on this server)
            const featuredProjects = [
                'afinity', 'anchorr', 'jellybuddy', 'jellyfin-enhanced', 'kefin-tweaks', 
                'paradox-plugins', 'streamystats'
            ];

            // Sort plugins: featured first, then alphabetically
            const sortedPlugins = [...jsonData.plugins].sort((a, b) => {
                const aFeatured = featuredProjects.some(id => a.id.includes(id) || a.name.toLowerCase().includes(id));
                const bFeatured = featuredProjects.some(id => b.id.includes(id) || b.name.toLowerCase().includes(id));
                
                if (aFeatured && !bFeatured) return -1;
                if (!aFeatured && bFeatured) return 1;
                return a.name.localeCompare(b.name);
            });

            // Create select menu options (Discord limit: 25 options)
            const options = sortedPlugins.slice(0, 25).map(plugin => {
                const isFeatured = featuredProjects.some(id => plugin.id.includes(id) || plugin.name.toLowerCase().includes(id));
                return {
                    label: `${isFeatured ? '⭐ ' : ''}${plugin.name.substring(0, 97)}`, // Account for star emoji
                    description: plugin.description ? plugin.description.substring(0, 100) : 'No description available',
                    value: plugin.id
                };
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('plugin_select')
                .setPlaceholder('Choose a plugin to view details...')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setColor(0x00D4AA)
                .setAuthor({
                    name: "Jellyfin Plugins",
                    iconURL: "https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png",
                    url: "https://jellyfin.org/docs/general/server/plugins"
                })
                .setTitle("Available Plugins")
                .setDescription("⭐ = Community developers on this server\n\nSelect a plugin from the dropdown menu below to view detailed information.")
                .setFooter({ text: `${jsonData.plugins.length} plugins available` });

            const response = await interaction.reply({
                embeds: [embed],
                components: [row]
            });

            // Handle select menu interaction
            const filter = (i) => i.customId === 'plugin_select' && i.user.id === interaction.user.id;
            
            try {
                const confirmation = await response.awaitMessageComponent({
                    filter,
                    componentType: ComponentType.StringSelect,
                    time: 60_000 // 60 seconds timeout
                });

                const selectedPluginId = confirmation.values[0];
                const selectedPlugin = jsonData.plugins.find(p => p.id === selectedPluginId);

                if (!selectedPlugin) {
                    await confirmation.update({
                        content: "❌ Plugin not found.",
                        embeds: [],
                        components: []
                    });
                    return;
                }

                const pluginEmbed = createPluginEmbed(selectedPlugin);

                await confirmation.update({
                    embeds: [pluginEmbed],
                    components: []
                });

            } catch (error) {
                // Timeout or other interaction error
                await interaction.editReply({
                    content: "⏰ Selection timed out. Use `/plugins` to try again.",
                    components: []
                });
            }

        } catch (error) {
            console.error('Error executing plugins command:', error);
            await interaction.reply({
                content: "❌ An error occurred while fetching plugin information.",
                flags: MessageFlags.Ephemeral
            });
        }
    }
};