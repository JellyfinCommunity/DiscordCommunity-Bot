import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data.json');

export default {
    data: new SlashCommandBuilder()
        .setName("clients")
        .setDescription("Show third-party Jellyfin clients")
        .addStringOption(option =>
            option
                .setName("client")
                .setDescription("Specific client to show details for")
                .setRequired(false)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        try {
            const data = await fs.readFile(DATA_FILE, 'utf8');
            const jsonData = JSON.parse(data);
            
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const filtered = (jsonData.third_party_clients || []).filter(client => 
                client.name.toLowerCase().includes(focusedValue) ||
                client.id.toLowerCase().includes(focusedValue)
            );

            await interaction.respond(
                filtered.slice(0, 25).map(client => ({
                    name: client.name,
                    value: client.id
                }))
            );
        } catch (error) {
            console.error('Error in clients autocomplete:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        try {
            const data = await fs.readFile(DATA_FILE, 'utf8');
            const jsonData = JSON.parse(data);
            const clientId = interaction.options.getString('client');

            if (clientId) {
                // Show specific client details
                const client = (jsonData.third_party_clients || []).find(c => c.id === clientId);
                if (!client) {
                    await interaction.reply({
                        content: "❌ Client not found. Use `/clients` to see available clients.",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const developersText = client.developers
                    .map(dev => dev.name)
                    .join(', ');

                const embed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle(client.name)
                    .setURL(client.repo || '#')
                    .setDescription(client.description || 'No description available')
                    .addFields(
                        { name: "👨‍💻 Developers", value: developersText, inline: false }
                    )
                    .setFooter({ text: "Use /clients to see all available clients" });

                if (client.logo || client.icon || client.image) {
                    embed.setThumbnail(client.logo || client.icon || client.image);
                }

                if (client.repo) {
                    embed.addFields({ name: "🔗 Repository", value: `[View on GitHub](${client.repo})`, inline: false });
                }

                if (client.lastRelease) {
                    embed.addFields({
                        name: "📦 Latest Release",
                        value: `[${client.lastRelease.tag}](${client.lastRelease.url}) - ${new Date(client.lastRelease.published_at).toLocaleDateString()}`,
                        inline: false
                    });
                }

                await interaction.reply({ embeds: [embed] });
            } else {
                // Show all clients list
                const clients = jsonData.third_party_clients || [];
                
                if (clients.length === 0) {
                    await interaction.reply({
                        content: "No third-party clients found in the database.",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const clientsList = clients.map(client => {
                    const devs = client.developers.slice(0, 2)
                        .map(dev => dev.name)
                        .join(', ') + (client.developers.length > 2 ? '...' : '');
                    const releaseInfo = client.lastRelease ? ` (${client.lastRelease.tag})` : '';
                    return `**[${client.name}](${client.repo || '#'})** - ${devs}${releaseInfo}`;
                }).join('\n');

                const embed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setAuthor({
                        name: "Third-Party Jellyfin Clients",
                        iconURL: "https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png"
                    })
                    .setTitle("Community-Developed Clients")
                    .setDescription(clientsList)
                    .addFields({
                        name: "💡 Tip",
                        value: "Use `/clients [client-name]` to see detailed information about a specific client.",
                        inline: false
                    })
                    .setFooter({ text: `${clients.length} third-party clients available` });

                await interaction.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error executing clients command:', error);
            await interaction.reply({
                content: "❌ An error occurred while fetching client information.",
                flags: MessageFlags.Ephemeral
            });
        }
    }
};