import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('api-docs')
		.setDescription('Official Jellyfin API documentation'),
	async execute(interaction) {
		const embed = new EmbedBuilder()
			.setColor(0x9B59B6)
			.setAuthor({
				name: "Jellyfin API Documentation",
				iconURL: "https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png",
				url: "https://api.jellyfin.org/"
			})
			.setTitle("🔌 API Documentation")
			.setDescription("Complete API reference and documentation for developers")
			.addFields(
				{
					name: "🌐 Official API Docs",
					value: "[api.jellyfin.org](https://api.jellyfin.org/)",
					inline: false
				},
				{
					name: "💡 Your Server's API Docs",
					value: "`[YOUR_JELLYFIN_URL]/api-docs/swagger/index.html`",
					inline: false
				}
			)
			.setFooter({ text: "Build integrations and tools with the Jellyfin API" });

		await interaction.reply({ embeds: [embed] });
	},
};
