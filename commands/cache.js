import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('cache')
		.setDescription('Troubleshoot common browser cache issues'),
	async execute(interaction) {
		const embed = new EmbedBuilder()
			.setColor(0x9B59B6)
			.setTitle('🧹 Browser Cache')
			.setDescription('Cached files can cause outdated pages or unexpected behavior after Jellyfin or plugin updates.')
			.addFields(
				{
					name: 'Try this first',
					value: [
						'• Clear cached images and files.',
						'• Test in a Private/Incognito window (Ctrl+Shift+N Chrome/Edge, Ctrl+Shift+P Firefox, Cmd+Shift+N Mac).',
					].join('\n'),
				},
				{
					name: 'If it persists, include',
					value: 'Browser/client + version, Jellyfin server version, install method (Docker/native/TrueNAS/Unraid), installed plugins + versions, and any errors or screenshots.',
				},
			);
		await interaction.reply({ embeds: [embed] });
	},
};
