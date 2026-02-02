import { SlashCommandBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { timerManager } from '../utils/timerManager.js';
import { reminderLogger as log } from '../utils/logger.js';
import { validateReminderText, validateTimeAmount } from '../utils/inputValidator.js';

const REMINDERS_FILE = path.join(process.cwd(), 'reminders.json');

// Load reminders from file
async function loadReminders() {
    try {
        const data = await fs.readFile(REMINDERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        log.error({ err: error }, 'Error loading reminders');
        return [];
    }
}

// Save reminders to file
async function saveReminders(reminders) {
    try {
        await fs.writeFile(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
    } catch (error) {
        log.error({ err: error }, 'Error saving reminders');
    }
}

// Add reminder
async function addReminder(reminder) {
    const reminders = await loadReminders();
    reminders.push(reminder);
    await saveReminders(reminders);
}

// Remove reminder
async function removeReminder(reminderId) {
    const reminders = await loadReminders();
    const filtered = reminders.filter(r => r.id !== reminderId);
    await saveReminders(filtered);
}

export default {
    data: new SlashCommandBuilder()
        .setName('remindme')
        .setDescription('Set a reminder.')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('What should I remind you about?')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('time')
                .setDescription('Amount of time')
                .setRequired(true)
                .setMinValue(1))
        .addStringOption(option =>
            option.setName('unit')
                .setDescription('Minutes, hours, days, or weeks?')
                .setRequired(true)
                .addChoices(
                    { name: 'Minutes', value: 'minutes' },
                    { name: 'Hours', value: 'hours' },
                    { name: 'Days', value: 'days' },
                    { name: 'Weeks', value: 'weeks' }
                )),
    async execute(interaction) {
        // Defer with ephemeral since all responses should be private
        await interaction.deferReply({ ephemeral: true });

        try {
            const timeAmount = interaction.options.getInteger('time');
            const timeUnit = interaction.options.getString('unit');
            const userId = interaction.user.id;
            const channel = interaction.channel;
            const rawText = interaction.options.getString('text');

            // Validate and sanitize reminder text
            const textValidation = validateReminderText(rawText);
            if (!textValidation.valid) {
                return await interaction.editReply({
                    content: `❌ ${textValidation.error}`
                });
            }
            const text = textValidation.sanitized;

            // Validate time amount
            const timeValidation = validateTimeAmount(timeAmount, timeUnit);
            if (!timeValidation.valid) {
                return await interaction.editReply({
                    content: `❌ ${timeValidation.error}`
                });
            }

            // Check bot permissions
            if (!channel.permissionsFor(channel.guild.members.me).has('ViewChannel') ||
                !channel.permissionsFor(channel.guild.members.me).has('SendMessages')) {
                return await interaction.editReply({
                    content: '❌ I cannot send messages in this channel. Please check my permissions.'
                });
            }

            const ms = timeValidation.ms;
            const reminderTime = Date.now() + ms;
            const reminderId = `${userId}_${reminderTime}`;

            const reminder = {
                id: reminderId,
                text,
                userId,
                reminderTime,
                channelId: interaction.channelId,
                guildId: interaction.guildId
            };

            // Save reminder
            await addReminder(reminder);

            const timeString = `${timeAmount} ${timeUnit}`;
            await interaction.editReply({
                content: `✅ I will remind you about "${text}" in ${timeString}`
            });

            // Set timeout for reminder (using timerManager for cleanup)
            timerManager.setTimeout(`reminder-${reminderId}`, async () => {
                try {
                    const channel = await interaction.client.channels.fetch(reminder.channelId);
                    await channel.send({
                        content: `<@${userId}> 🔔 Reminder: ${text}`,
                        allowedMentions: { users: [userId] },
                    });
                    await removeReminder(reminderId);
                } catch (error) {
                    log.error({ err: error, reminderId }, 'Error sending reminder');
                    await removeReminder(reminderId);
                }
            }, ms);
        } catch (error) {
            log.error({ err: error, userId }, 'Error setting reminder');
            await interaction.editReply({
                content: '❌ An error occurred while setting the reminder.'
            });
        }
    }
};