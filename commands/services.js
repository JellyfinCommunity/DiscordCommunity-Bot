import { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType, MessageFlags } from "discord.js";
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data.json');

function createServiceEmbed(service) {
    const featuredProjects = [
        'afinity', 'anchorr', 'jellybuddy', 'jellyfin-enhanced', 'kefin-tweaks', 
        'paradox-plugins', 'streamystats'
    ];
    
    const isFeatured = featuredProjects.some(id => service.id.includes(id) || service.name.toLowerCase().includes(id));
    
    const embed = new EmbedBuilder()
        .setColor(isFeatured ? 0xFFD700 : 0xFF6B35)
        .setAuthor({
            name: "Jellyfin Services",
            iconURL: "https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png",
            url: "https://jellyfin.org"
        })
        .setTitle(`${isFeatured ? '⭐ ' : ''}${service.name}`)
        .setURL(service.repo)
        .setDescription(service.description || 'No description available')
        .setFooter({ text: isFeatured ? "⭐ Developer active on this server" : "Use /services to browse all available services" });

    if (service.logo || service.icon || service.image) {
        embed.setThumbnail(service.logo || service.icon || service.image);
    }

    if (service.repo) {
        embed.addFields({ 
            name: "🔗 Repository", 
            value: `[View on GitHub](${service.repo})`, 
            inline: false 
        });
    }

    if (service.statusUrl) {
        embed.addFields({
            name: "🌐 Status Page",
            value: `[Check Status](${service.statusUrl})`,
            inline: false
        });
    }

    if (service.developers && service.developers.length > 0) {
        const devList = service.developers.map(dev => {
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
    }

    if (service.lastRelease) {
        embed.addFields({
            name: "📦 Latest Release",
            value: `[${service.lastRelease.tag}](${service.lastRelease.url}) - ${new Date(service.lastRelease.published_at).toLocaleDateString()}`,
            inline: false
        });
    }

    return embed;
}

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
                await interaction.reply({
                    content: "❌ No services available.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Featured projects (developers on this server)
            const featuredProjects = [
                'afinity', 'anchorr', 'jellybuddy', 'jellyfin-enhanced', 'kefin-tweaks', 
                'paradox-plugins', 'streamystats'
            ];

            // Sort services: featured first, then alphabetically
            const sortedServices = [...services].sort((a, b) => {
                const aFeatured = featuredProjects.some(id => a.id.includes(id) || a.name.toLowerCase().includes(id));
                const bFeatured = featuredProjects.some(id => b.id.includes(id) || b.name.toLowerCase().includes(id));
                
                if (aFeatured && !bFeatured) return -1;
                if (!aFeatured && bFeatured) return 1;
                return a.name.localeCompare(b.name);
            });

            // Create select menu options (Discord limit: 25 options)
            const options = sortedServices.slice(0, 25).map(service => {
                const isFeatured = featuredProjects.some(id => service.id.includes(id) || service.name.toLowerCase().includes(id));
                return {
                    label: `${isFeatured ? '⭐ ' : ''}${service.name.substring(0, 97)}`, // Account for star emoji
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
                .setColor(0xFF6B35)
                .setAuthor({
                    name: "Jellyfin Services",
                    iconURL: "https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png",
                    url: "https://jellyfin.org"
                })
                .setTitle("Available Services")
                .setDescription("⭐ = Community developers on this server\n\nSelect a service from the dropdown menu below to view detailed information.")
                .setFooter({ text: `${services.length} services available` });

            const response = await interaction.reply({
                embeds: [embed],
                components: [row]
            });

            // Handle select menu interaction
            const filter = (i) => i.customId === 'service_select' && i.user.id === interaction.user.id;
            
            try {
                const confirmation = await response.awaitMessageComponent({
                    filter,
                    componentType: ComponentType.StringSelect,
                    time: 60_000 // 60 seconds timeout
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

                const serviceEmbed = createServiceEmbed(selectedService);

                await confirmation.update({
                    embeds: [serviceEmbed],
                    components: []
                });

            } catch (error) {
                // Timeout or other interaction error
                await interaction.editReply({
                    content: "⏰ Selection timed out. Use `/services` to try again.",
                    components: []
                });
            }

        } catch (error) {
            console.error('Error executing services command:', error);
            await interaction.reply({
                content: "❌ An error occurred while fetching service information.",
                flags: MessageFlags.Ephemeral
            });
        }
    }
};