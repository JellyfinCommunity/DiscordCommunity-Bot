import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('pastebin')
		.setDescription('Share logs and code'),
	async execute(interaction) {
		const embed = new EmbedBuilder()
			.setColor(0x9B59B6)
			.setAuthor({
				name: 'PrivateBin',
				iconURL: 'https://privatebin.info/img/logo.png',
				url: 'https://privatebin.net/',
			})
			.setTitle('Share Text with PrivateBin')
			.setDescription(
				'Use https://privatebin.net for logs, code, configs, or other long text instead of posting it directly in chat.'
			)
			.addFields({
				name: 'Before you paste',
				value: 'Remove passwords, API keys, tokens, IPs, domains, and other personal or sensitive information.',
			});

		await interaction.reply({ embeds: [embed] });
	},
};
