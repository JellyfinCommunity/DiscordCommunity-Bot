import { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType, MessageFlags } from "discord.js";
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data.json');

function createClientEmbed(client) {
    const featuredProjects = [
        'afinity', 'anchorr', 'jellybuddy', 'jellyfin-enhanced', 'kefin-tweaks', 
        'paradox-plugins', 'streamystats'
    ];
    
    const isFeatured = featuredProjects.some(id => client.id.includes(id) || client.name.toLowerCase().includes(id));
    
    const embed = new EmbedBuilder()
        .setColor(isFeatured ? 0xFFD700 : 0x3498DB)
        .setAuthor({
            name: "Third-Party Jellyfin Clients",
            iconURL: "https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png",
            url: "https://jellyfin.org/clients/"
        })
        .setTitle(`${isFeatured ? '⭐ ' : ''}${client.name}`)
        .setURL(client.repo || '#')
        .setDescription(client.description || 'No description available')
        .setFooter({ text: isFeatured ? "⭐ Developer active on this server" : "Use /clients to browse all available clients" });

    if (client.logo || client.icon || client.image) {
        embed.setThumbnail(client.logo || client.icon || client.image);
    }

    if (client.repo) {
        embed.addFields({ 
            name: "🔗 Repository", 
            value: `[View on GitHub](${client.repo})`, 
            inline: false 
        });
    }

    if (client.developers && client.developers.length > 0) {
        const devList = client.developers.map(dev => {
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
        const channelLinks = client.developers
            .filter(dev => typeof dev === 'object' && dev.discord_channel)
            .map(dev => `<#${dev.discord_channel}>`)
            .join(', ');
        
        if (channelLinks) {
            embed.addFields({
                name: "💬 Discord Channels",
                value: channelLinks,
                inline: false
            });
        }
    }

    if (client.lastRelease) {
        embed.addFields({
            name: "📦 Latest Release",
            value: `[${client.lastRelease.tag}](${client.lastRelease.url}) - ${new Date(client.lastRelease.published_at).toLocaleDateString()}`,
            inline: false
        });
    }

    return embed;
}

export default {
    data: new SlashCommandBuilder()
        .setName("clients")
        .setDescription("Browse third-party Jellyfin clients with an interactive menu"),

    async execute(interaction) {
        try {
            const data = await fs.readFile(DATA_FILE, 'utf8');
            const jsonData = JSON.parse(data);
            const clients = jsonData.third_party_clients || [];

            if (clients.length === 0) {
                await interaction.reply({
                    content: "❌ No third-party clients available.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Featured projects (developers on this server)
            const featuredProjects = [
                'afinity', 'anchorr', 'jellybuddy', 'jellyfin-enhanced', 'kefin-tweaks', 
                'paradox-plugins', 'streamystats'
            ];

            // Sort clients: featured first, then alphabetically
            const sortedClients = [...clients].sort((a, b) => {
                const aFeatured = featuredProjects.some(id => a.id.includes(id) || a.name.toLowerCase().includes(id));
                const bFeatured = featuredProjects.some(id => b.id.includes(id) || b.name.toLowerCase().includes(id));
                
                if (aFeatured && !bFeatured) return -1;
                if (!aFeatured && bFeatured) return 1;
                return a.name.localeCompare(b.name);
            });

            // Create select menu options (Discord limit: 25 options)
            const options = sortedClients.slice(0, 25).map(client => {
                const isFeatured = featuredProjects.some(id => client.id.includes(id) || client.name.toLowerCase().includes(id));
                return {
                    label: `${isFeatured ? '⭐ ' : ''}${client.name.substring(0, 97)}`, // Account for star emoji
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
                .setColor(0x3498DB)
                .setAuthor({
                    name: "Third-Party Jellyfin Clients",
                    iconURL: "https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png",
                    url: "https://jellyfin.org/clients/"
                })
                .setTitle("Community-Developed Clients")
                .setDescription("⭐ = Community developers on this server\n\nSelect a client from the dropdown menu below to view detailed information.")
                .setFooter({ text: `${clients.length} third-party clients available` });

            const response = await interaction.reply({
                embeds: [embed],
                components: [row]
            });

            // Handle select menu interaction
            const filter = (i) => i.customId === 'client_select' && i.user.id === interaction.user.id;
            
            try {
                const confirmation = await response.awaitMessageComponent({
                    filter,
                    componentType: ComponentType.StringSelect,
                    time: 60_000 // 60 seconds timeout
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

                const clientEmbed = createClientEmbed(selectedClient);

                await confirmation.update({
                    embeds: [clientEmbed],
                    components: []
                });

            } catch (error) {
                // Timeout or other interaction error
                await interaction.editReply({
                    content: "⏰ Selection timed out. Use `/clients` to try again.",
                    components: []
                });
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