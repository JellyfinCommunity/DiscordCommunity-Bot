import { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType, MessageFlags } from "discord.js";
import fs from 'fs/promises';
import path from 'path';
import { COLORS, CATEGORY_INFO, isFeaturedProject, sortByFeatured } from '../config.js';
import { createProjectEmbed } from '../embedHelper.js';

const DATA_FILE = path.join(process.cwd(), 'data.json');

export default {
    data: new SlashCommandBuilder()
        .setName("services")
        .setDescription("Browse Jellyfin services with an interactive menu"),

    async execute(interaction) {
        try {
            const data = await fs.readFile(DATA_FILE, 'utf8');
            const jsonData = JSON.parse(data);
            const services = jsonData.services || [];

            if (services.length === 0) {
                await interaction.editReply({
                    content: "❌ No services available.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const sortedServices = sortByFeatured(services);
            const categoryInfo = CATEGORY_INFO.services;

            const options = sortedServices.slice(0, 25).map(service => {
                const isFeatured = isFeaturedProject(service);
                return {
                    label: `${isFeatured ? '⭐ ' : ''}${service.name.substring(0, 97)}`,
                    description: service.description ? service.description.substring(0, 100) : 'No description available',
                    value: service.id
                };
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('service_select')
                .setPlaceholder('Choose a service to view details...')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setColor(COLORS.services)
                .setAuthor({
                    name: categoryInfo.name,
                    iconURL: categoryInfo.iconURL,
                    url: categoryInfo.url
                })
                .setTitle("Available Services")
                .setDescription("⭐ = Community developers on this server\n\nSelect a service from the dropdown menu below to view detailed information.")
                .setFooter({ text: `${services.length} services available` });

            const response = await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

            const filter = (i) => i.customId === 'service_select' && i.user.id === interaction.user.id;

            try {
                const confirmation = await response.awaitMessageComponent({
                    filter,
                    componentType: ComponentType.StringSelect,
                    time: 60_000
                });

                const selectedServiceId = confirmation.values[0];
                const selectedService = services.find(s => s.id === selectedServiceId);

                if (!selectedService) {
                    await confirmation.update({
                        content: "❌ Service not found.",
                        embeds: [],
                        components: []
                    });
                    return;
                }

                const serviceEmbed = createProjectEmbed(selectedService, 'services');

                await confirmation.update({
                    embeds: [serviceEmbed],
                    components: []
                });

            } catch (error) {
                await interaction.editReply({
                    content: "⏰ Selection timed out. Use `/services` to try again.",
                    components: []
                });
            }

        } catch (error) {
            console.error('Error executing services command:', error);
            await interaction.editReply({
                content: "❌ An error occurred while fetching service information.",
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
