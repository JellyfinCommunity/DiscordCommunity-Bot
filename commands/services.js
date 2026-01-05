import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data.json');

export default {
    data: new SlashCommandBuilder()
        .setName("services")
        .setDescription("Show Jellyfin services information")
        .addStringOption(option =>
            option
                .setName("service")
                .setDescription("Specific service to show details for")
                .setRequired(false)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        try {
            const data = await fs.readFile(DATA_FILE, 'utf8');
            const jsonData = JSON.parse(data);
            
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const filtered = jsonData.services.filter(service => 
                service.name.toLowerCase().includes(focusedValue) ||
                service.id.toLowerCase().includes(focusedValue)
            );

            await interaction.respond(
                filtered.slice(0, 25).map(service => ({
                    name: service.name,
                    value: service.id
                }))
            );
        } catch (error) {
            console.error('Error in services autocomplete:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        try {
            const data = await fs.readFile(DATA_FILE, 'utf8');
            const jsonData = JSON.parse(data);
            const serviceId = interaction.options.getString('service');

            if (serviceId) {
                // Show specific service details
                const service = jsonData.services.find(s => s.id === serviceId);
                if (!service) {
                    await interaction.reply({
                        content: "❌ Service not found. Use `/services` to see available services.",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setColor(0xFF6B35)
                    .setTitle(service.name)
                    .setURL(service.repo)
                    .setDescription(service.description || 'No description available')
                    .addFields(
                        { name: "🔗 Repository", value: `[View on GitHub](${service.repo})`, inline: false }
                    )
                    .setFooter({ text: "Use /services to see all available services" });

                if (service.logo || service.icon || service.image) {
                    embed.setThumbnail(service.logo || service.icon || service.image);
                }

                if (service.statusUrl) {
                    embed.addFields({
                        name: "🌐 Status Page",
                        value: `[Check Status](${service.statusUrl})`,
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

                if (service.developers && service.developers.length > 0) {
                    const devList = service.developers.map(dev => {
                        if (typeof dev === 'string') {
                            return dev;
                        }
                        const name = dev.name || 'Unknown';
                        const discordUser = dev.discord_username ? ` (<@${dev.discord_username}>)` : '';
                        return `${name}${discordUser}`;
                    }).join(', ');
                    embed.addFields({
                        name: "👥 Developers",
                        value: devList,
                        inline: false
                    });
                }

                await interaction.reply({ embeds: [embed] });
            } else {
                // Show all services list
                const servicesList = jsonData.services.map(service => {
                    const statusLink = service.statusUrl ? ` • [Status](${service.statusUrl})` : '';
                    return `**[${service.name}](${service.repo})** - ${service.description}${statusLink}`;
                }).join('\n');

                const embed = new EmbedBuilder()
                    .setColor(0xFF6B35)
                    .setAuthor({
                        name: "Jellyfin Services",
                        iconURL: "https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png",
                        url: "https://jellyfin.org"
                    })
                    .setTitle("Available Services")
                    .setDescription(servicesList)
                    .addFields({
                        name: "💡 Tip",
                        value: "Use `/services [service-name]` to see detailed information about a specific service.",
                        inline: false
                    })
                    .setFooter({ text: `${jsonData.services.length} services available` });

                await interaction.reply({ embeds: [embed] });
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