import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data.json');

export default {
    data: new SlashCommandBuilder()
        .setName("plugins")
        .setDescription("Show Jellyfin plugins information")
        .addStringOption(option =>
            option
                .setName("plugin")
                .setDescription("Specific plugin to show details for")
                .setRequired(false)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        try {
            const data = await fs.readFile(DATA_FILE, 'utf8');
            const jsonData = JSON.parse(data);
            
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const filtered = jsonData.plugins.filter(plugin => 
                plugin.name.toLowerCase().includes(focusedValue) ||
                plugin.id.toLowerCase().includes(focusedValue)
            );

            await interaction.respond(
                filtered.slice(0, 25).map(plugin => ({
                    name: plugin.name,
                    value: plugin.id
                }))
            );
        } catch (error) {
            console.error('Error in plugins autocomplete:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        try {
            const data = await fs.readFile(DATA_FILE, 'utf8');
            const jsonData = JSON.parse(data);
            const pluginId = interaction.options.getString('plugin');

            if (pluginId) {
                // Show specific plugin details
                const plugin = jsonData.plugins.find(p => p.id === pluginId);
                if (!plugin) {
                    await interaction.reply({
                        content: "❌ Plugin not found. Use `/plugins` to see available plugins.",
                        ephemeral: true
                    });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setColor(0x00D4AA)
                    .setTitle(plugin.name)
                    .setURL(plugin.repo)
                    .setDescription(plugin.description || 'No description available')
                    .addFields(
                        { name: "🔗 Repository", value: `[View on GitHub](${plugin.repo})`, inline: false }
                    )
                    .setFooter({ text: "Use /plugins to see all available plugins" });

                if (plugin.logo || plugin.icon || plugin.image) {
                    embed.setThumbnail(plugin.logo || plugin.icon || plugin.image);
                }

                if (plugin.lastRelease) {
                    embed.addFields({
                        name: "📦 Latest Release",
                        value: `[${plugin.lastRelease.tag}](${plugin.lastRelease.url}) - ${new Date(plugin.lastRelease.published_at).toLocaleDateString()}`,
                        inline: false
                    });
                }

                await interaction.reply({ embeds: [embed] });
            } else {
                // Show all plugins list
                const pluginsList = jsonData.plugins.map(plugin => {
                    const description = plugin.description ? ` - ${plugin.description}` : '';
                    return `**[${plugin.name}](${plugin.repo})**${description}`;
                }).join('\n');

                const embed = new EmbedBuilder()
                    .setColor(0x00D4AA)
                    .setAuthor({
                        name: "Jellyfin Plugins",
                        iconURL: "https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png",
                        url: "https://jellyfin.org/docs/general/server/plugins"
                    })
                    .setTitle("Available Plugins")
                    .setDescription(pluginsList)
                    .addFields({
                        name: "💡 Tip",
                        value: "Use `/plugins [plugin-name]` to see detailed information about a specific plugin.",
                        inline: false
                    })
                    .setFooter({ text: `${jsonData.plugins.length} plugins available` });

                await interaction.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error executing plugins command:', error);
            await interaction.reply({
                content: "❌ An error occurred while fetching plugin information.",
                ephemeral: true
            });
        }
    }
};