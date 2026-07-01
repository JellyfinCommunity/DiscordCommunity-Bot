import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('cache')
		.setDescription('Troubleshoot common browser cache issues'),
	async execute(interaction) {
		const embed = new EmbedBuilder()
			.setColor(0x9B59B6)
			.setTitle('Browser Cache')
			.setDescription(
				'Web browsers can continue using cached files after Jellyfin or plugin updates, causing unexpected behavior or outdated pages.'
			)
			.addFields(
				{
					name: 'Try this first',
					value: [
						'• Clear your browser cache (cached images and files).',
						'• Or test in a Private/Incognito window (Ctrl+Shift+N Chrome/Edge, Ctrl+Shift+P Firefox, Cmd+Shift+N Mac): if the issue disappears there, it was a cache problem.',
					].join('\n'),
				},
				{
					name: 'If the issue persists, please include',
					value: 'Browser or Client + version, Jellyfin Server version, install method (Docker/native/TrueNAS/Unraid) installed plugins + versions, and any error messages or screenshots.',
				},
			);
		await interaction.reply({ embeds: [embed] });
	},
};
