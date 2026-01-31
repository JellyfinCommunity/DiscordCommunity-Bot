import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('awesome-jellyfin')
		.setDescription('Awesome Jellyfin resources'),
	async execute(interaction) {
		const embed = new EmbedBuilder()
			.setColor(0xFFD700)
			.setAuthor({
				name: "Awesome Jellyfin",
				iconURL: "https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png",
				url: "https://github.com/awesome-jellyfin/awesome-jellyfin"
			})
			.setTitle("✨ Curated Jellyfin Resources")
			.setDescription("A collection of awesome themes, plugins, tools, and more for Jellyfin")
			.addFields({
				name: "🔗 Repository",
				value: "[awesome-jellyfin/awesome-jellyfin](https://github.com/awesome-jellyfin/awesome-jellyfin)",
				inline: false
			})
			.setFooter({ text: "Community curated resource list" });

		await interaction.editReply({ embeds: [embed] });
	},
};