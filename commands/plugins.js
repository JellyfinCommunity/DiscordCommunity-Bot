import { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType, MessageFlags } from "discord.js";
import fs from 'fs/promises';
import path from 'path';
import { COLORS, CATEGORY_INFO, isFeaturedProject, sortByFeatured } from '../config.js';
import { createProjectEmbed } from '../embedHelper.js';

const DATA_FILE = path.join(process.cwd(), 'data.json');

export default {
    data: new SlashCommandBuilder()
        .setName("plugins")
        .setDescription("Browse Jellyfin plugins with an interactive menu"),

    async execute(interaction) {
        try {
            const data = await fs.readFile(DATA_FILE, 'utf8');
            const jsonData = JSON.parse(data);

            if (!jsonData.plugins || jsonData.plugins.length === 0) {
                await interaction.editReply({
                    content: "❌ No plugins available.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const sortedPlugins = sortByFeatured(jsonData.plugins);
            const categoryInfo = CATEGORY_INFO.plugins;

            const options = sortedPlugins.slice(0, 25).map(plugin => {
                const isFeatured = isFeaturedProject(plugin);
                return {
                    label: `${isFeatured ? '⭐ ' : ''}${plugin.name.substring(0, 97)}`,
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
                .setColor(COLORS.plugins)
                .setAuthor({
                    name: categoryInfo.name,
                    iconURL: categoryInfo.iconURL,
                    url: categoryInfo.url
                })
                .setTitle("Available Plugins")
                .setDescription("⭐ = Community developers on this server\n\nSelect a plugin from the dropdown menu below to view detailed information.")
                .setFooter({ text: `${jsonData.plugins.length} plugins available` });

            const response = await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

            const filter = (i) => i.customId === 'plugin_select' && i.user.id === interaction.user.id;

            try {
                const confirmation = await response.awaitMessageComponent({
                    filter,
                    componentType: ComponentType.StringSelect,
                    time: 60_000
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

                const pluginEmbed = createProjectEmbed(selectedPlugin, 'plugins');

                await confirmation.update({
                    embeds: [pluginEmbed],
                    components: []
                });

            } catch (error) {
                await interaction.editReply({
                    content: "⏰ Selection timed out. Use `/plugins` to try again.",
                    components: []
                });
            }

        } catch (error) {
            console.error('Error executing plugins command:', error);
            await interaction.editReply({
                content: "❌ An error occurred while fetching plugin information.",
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
