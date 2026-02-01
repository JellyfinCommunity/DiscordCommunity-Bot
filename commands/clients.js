import { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } from "discord.js";
import fs from 'fs/promises';
import path from 'path';
import { COLORS, CATEGORY_INFO, isFeaturedProject, sortByFeatured } from '../config.js';
import { createProjectEmbed } from '../embedHelper.js';

const DATA_FILE = path.join(process.cwd(), 'data.json');

export default {
    data: new SlashCommandBuilder()
        .setName("clients")
        .setDescription("Browse third-party Jellyfin clients with an interactive menu"),

    async execute(interaction) {
        // Defer to prevent timeout during file I/O
        await interaction.deferReply();

        try {
            const data = await fs.readFile(DATA_FILE, 'utf8');
            const jsonData = JSON.parse(data);
            const clients = jsonData.third_party_clients || [];

            if (clients.length === 0) {
                await interaction.editReply({
                    content: "❌ No third-party clients available."
                });
                return;
            }

            const sortedClients = sortByFeatured(clients);
            const categoryInfo = CATEGORY_INFO.clients;

            const options = sortedClients.slice(0, 25).map(client => {
                const isFeatured = isFeaturedProject(client);
                return {
                    label: `${isFeatured ? '⭐ ' : ''}${client.name.substring(0, 97)}`,
                    description: client.description ? client.description.substring(0, 100) : 'No description available',
                    value: client.id
                };
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('client_select')
                .setPlaceholder('Choose a client to view details...')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setColor(COLORS.clients)
                .setAuthor({
                    name: categoryInfo.name,
                    iconURL: categoryInfo.iconURL,
                    url: categoryInfo.url
                })
                .setTitle("Community-Developed Clients")
                .setDescription("⭐ = Community developers on this server\n\nSelect a client from the dropdown menu below to view detailed information.")
                .setFooter({ text: `${clients.length} third-party clients available` });

            const response = await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

            const filter = (i) => i.customId === 'client_select' && i.user.id === interaction.user.id;

            try {
                const confirmation = await response.awaitMessageComponent({
                    filter,
                    componentType: ComponentType.StringSelect,
                    time: 60_000
                });

                const selectedClientId = confirmation.values[0];
                const selectedClient = clients.find(c => c.id === selectedClientId);

                if (!selectedClient) {
                    await confirmation.update({
                        content: "❌ Client not found.",
                        embeds: [],
                        components: []
                    });
                    return;
                }

                const clientEmbed = createProjectEmbed(selectedClient, 'clients');

                await confirmation.update({
                    embeds: [clientEmbed],
                    components: []
                });

            } catch (error) {
                await interaction.editReply({
                    content: "⏰ Selection timed out. Use `/clients` to try again.",
                    components: []
                });
            }

        } catch (error) {
            console.error('Error executing clients command:', error);
            await interaction.editReply({
                content: "❌ An error occurred while fetching client information."
            });
        }
    }
};
