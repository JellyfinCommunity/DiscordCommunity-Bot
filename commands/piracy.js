import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('piracy')
		.setDescription('Policy on piracy and content acquisition.'),
	async execute(interaction) {
		const embed = new EmbedBuilder()
			.setColor(0xE74C3C)
			.setTitle("⚠️ Community Warning")
			.setDescription("Discussions of piracy, content acquisition, or related activities, including tools and outlets that enable them, are prohibited.")
			.addFields({
				name: "📋 Rule Reference",
				value: "[Rule 2](https://discord.com/channels/1381737066366242896/1381738925625970758) exists to ensure a safe, orderly, and legally compliant community.",
				inline: false
			})
			.setFooter({ text: "Note: Occasional false triggers may occur. Disregard accordingly." });

		await interaction.reply({ embeds: [embed] });
	},
};
