import { SlashCommandBuilder, EmbedBuilder } from "discord.js"; 

export default {
  data: new SlashCommandBuilder()
    .setName("privatebin")
    .setDescription("Share logs, code snippets, or larger text using PrivateBin"),
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setAuthor({
                name: "PrivateBin",
                iconURL: "https://privatebin.info/img/logo.png",
                url: "https://privatebin.net/"
            })
            .setTitle("📋 Share Text Securely")
            .setDescription("Use PrivateBin to share logs, code snippets, or any larger text securely")
            .addFields({
                name: "🔗 PrivateBin",
                value: "[privatebin.net](https://privatebin.net/)",
                inline: false
            })
            .setFooter({ text: "Encrypted, zero-knowledge paste service" });

        await interaction.editReply({ embeds: [embed] });
    },
};