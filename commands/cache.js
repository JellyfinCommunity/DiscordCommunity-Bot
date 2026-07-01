import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('cache')
		.setDescription('Troubleshoot common browser cache issues'),
	async execute(interaction) {
		const embed = new EmbedBuilder()
			.setColor(0x9B59B6)
			.setTitle('🧹 Web Browser Cache')
			.setDescription('Cached files can cause outdated pages or unexpected behavior after Jellyfin or plugin updates.')
			.addFields(
				{
					name: 'Try this first',
					value: [
						'• Clear your browser cache, including cached images and files.',
						'• Open Jellyfin in a Private/Incognito window.',
					].join('\n'),
				},
				{
					name: 'If the issue persists, provide',
					value: 'Browser/client + version, Jellyfin server version, install method (Docker/native/TrueNAS/Unraid), installed plugins + versions, and any errors or screenshots.',
				},
			);
		await interaction.reply({ embeds: [embed] });
	},
};
