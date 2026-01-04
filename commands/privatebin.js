import { SlashCommandBuilder } from "discord.js"; 

export default {
  data: new SlashCommandBuilder()
    .setName("privatebin")
    .setDescription("Share logs, code snippets, or larger text using PrivateBin"),
    async execute(interaction) {
        await interaction.reply("Paste your logs, code snippets, or any larger text here! - https://privatebin.net/ ");
    },
};