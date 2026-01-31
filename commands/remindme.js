import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';

const TIME_LIMITS = {
    minutes: 1440, // 24 hours
    hours: 168,    // 1 week
    days: 365,     // 1 year
    weeks: 52      // 1 year
};

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
        console.error('Error loading reminders:', error);
        return [];
    }
}

// Save reminders to file
async function saveReminders(reminders) {
    try {
        await fs.writeFile(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
    } catch (error) {
        console.error('Error saving reminders:', error);
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
        try {
            const timeAmount = interaction.options.getInteger('time');
            const timeUnit = interaction.options.getString('unit');
            const userId = interaction.user.id;
            const channel = interaction.channel;
            const text = interaction.options.getString('text');

            // Check bot permissions
            if (!channel.permissionsFor(channel.guild.members.me).has('ViewChannel') || 
                !channel.permissionsFor(channel.guild.members.me).has('SendMessages')) {
                return await interaction.editReply({
                    content: '❌ I cannot send messages in this channel. Please check my permissions.'
                });
            }

            // Check time limits
            if (timeAmount > TIME_LIMITS[timeUnit]) {
                return await interaction.editReply({
                    content: `❌ You cannot set a reminder for more than ${TIME_LIMITS[timeUnit]} ${timeUnit}!`
                });
            }

            // Calculate reminder time
            const msMultiplier = {
                minutes: 60 * 1000,
                hours: 60 * 60 * 1000,
                days: 24 * 60 * 60 * 1000,
                weeks: 7 * 24 * 60 * 60 * 1000
            };

            const ms = timeAmount * msMultiplier[timeUnit];
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

            // Set timeout for reminder
            setTimeout(async () => {
                try {
                    const channel = await interaction.client.channels.fetch(reminder.channelId);
                    await channel.send({
                        content: `<@${userId}> 🔔 Reminder: ${text}`,
                        allowedMentions: { users: [userId] },
                    });
                    await removeReminder(reminderId);
                } catch (error) {
                    console.error('Error sending reminder:', error);
                    await removeReminder(reminderId);
                }
            }, ms);
        } catch (error) {
            console.error('Error setting reminder:', error);
            await interaction.editReply({
                content: '❌ An error occurred while setting the reminder.'
            });
        }
    }
};