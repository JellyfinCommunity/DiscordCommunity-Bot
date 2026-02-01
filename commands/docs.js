import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('docs')
		.setDescription('Official Jellyfin documentation'),
	async execute(interaction) {
		const embed = new EmbedBuilder()
			.setColor(0x00D4AA)
			.setAuthor({
				name: "Jellyfin Documentation",
				iconURL: "https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/web/icon-transparent.png",
				url: "https://jellyfin.org/docs/"
			})
			.setTitle("📖 Official Documentation")
			.setDescription("Comprehensive guides and documentation for Jellyfin")
			.addFields({
				name: "🔗 Documentation",
				value: "[jellyfin.org/docs/](https://jellyfin.org/docs/)",
				inline: false
			})
			.setFooter({ text: "Get help with installation, configuration, and usage" });

		await interaction.reply({ embeds: [embed] });
	},
};