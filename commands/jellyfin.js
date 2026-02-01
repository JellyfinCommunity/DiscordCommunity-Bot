import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName("jellyfin")
        .setDescription("Official Jellyfin resources."),
    async execute(interaction) {
        const embed = new EmbedBuilder()
  .setColor(0xAA5CC3)
  .setAuthor({
    name: "Jellyfin Project",
    iconURL: "https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png", 
    url: "https://jellyfin.org"
  })
  .setTitle("Official Channels")
  .setDescription("Stay connected with the Jellyfin community:")
  .addFields(
    { name: "🌐 Website", value: "[jellyfin.org](https://jellyfin.org)", inline: true },
    { name: "🗨️ Forums", value: "[forum.jellyfin.org](https://forum.jellyfin.org)", inline: true },
    { name: "💬 Discord", value: "[Join here](https://discord.gg/zHBxVSXdBV)", inline: true },
    { name: "🧵 Matrix", value: "`#jellyfinorg:matrix.org`", inline: true },
    { name: "📡 IRC", value: "`#jellyfin` on Libera.Chat", inline: true }
  )
  .setFooter({ text: "Powered by the community ❤️" });

        await interaction.reply({ embeds: [embed] });
    },
};