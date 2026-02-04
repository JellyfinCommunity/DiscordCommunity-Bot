import path from 'path';
import { PermissionFlagsBits } from 'discord.js';
import { timerManager } from './utils/timerManager.js';
import { reminderLogger as log } from './utils/logger.js';
import { validateReminders } from './utils/schemas.js';
import { sanitizeString } from './utils/sanitize.js';
import { writeJsonAtomic, readJsonWithRecovery } from './utils/atomicJson.js';
import { reminderMutex } from './utils/asyncMutex.js';

const REMINDERS_FILE = path.join(process.cwd(), 'reminders.json');

/**
 * Remove a reminder from the file (mutex-protected)
 * @param {string} reminderId - ID of the reminder to remove
 */
export async function removeReminder(reminderId) {
    return reminderMutex.runExclusive(async () => {
        try {
            const reminders = await readJsonWithRecovery(REMINDERS_FILE, []);
            const filtered = reminders.filter(r => r.id !== reminderId);
            await writeJsonAtomic(REMINDERS_FILE, filtered);
        } catch (error) {
            log.error({ err: error, reminderId }, 'Error removing reminder');
        }
    });
}

/**
 * Add a reminder to the file (mutex-protected)
 * @param {Object} reminder - Reminder object to add
 */
export async function addReminder(reminder) {
    return reminderMutex.runExclusive(async () => {
        try {
            const reminders = await readJsonWithRecovery(REMINDERS_FILE, []);
            reminders.push(reminder);
            await writeJsonAtomic(REMINDERS_FILE, reminders);
        } catch (error) {
            log.error({ err: error, reminderId: reminder.id }, 'Error adding reminder');
            throw error;
        }
    });
}

/**
 * Check if the bot has permission to send messages in a channel
 * @param {TextChannel} channel - Discord channel
 * @returns {boolean} Whether the bot can send messages
 */
function canSendToChannel(channel) {
    if (!channel || !channel.guild) {
        return false;
    }

    const me = channel.guild.members.me;
    if (!me) {
        return false;
    }

    const permissions = channel.permissionsFor(me);
    if (!permissions) {
        return false;
    }

    return permissions.has(PermissionFlagsBits.ViewChannel) &&
           permissions.has(PermissionFlagsBits.SendMessages);
}

// Load and restore reminders on bot startup
export async function initializeReminders(client) {
    try {
        const parsedReminders = await readJsonWithRecovery(REMINDERS_FILE, []);

        // Validate reminders against schema
        const validation = validateReminders(parsedReminders);
        if (!validation.valid) {
            log.warn({ errors: validation.errors }, 'Some reminders failed validation');
        }

        // Use only valid reminders
        const reminders = validation.validReminders;
        const activeReminders = [];
        const now = Date.now();

        for (const reminder of reminders) {
            const timeLeft = reminder.reminderTime - now;

            if (timeLeft > 0) {
                // Reminder is still pending, reschedule it (using timerManager for cleanup)
                timerManager.setTimeout(`reminder-${reminder.id}`, async () => {
                    try {
                        const channel = await client.channels.fetch(reminder.channelId);

                        // Check permissions before sending
                        if (!canSendToChannel(channel)) {
                            log.warn(
                                { reminderId: reminder.id, channelId: reminder.channelId },
                                'Cannot send reminder - missing channel permissions'
                            );
                            await removeReminder(reminder.id);
                            return;
                        }

                        // Sanitize text before sending to prevent injection
                        const safeText = sanitizeString(reminder.text, { maxLength: 500 });
                        await channel.send({
                            content: `<@${reminder.userId}> 🔔 Reminder: ${safeText}`,
                            allowedMentions: { users: [reminder.userId] },
                        });
                    } catch (error) {
                        log.error({ err: error, reminderId: reminder.id }, 'Error sending restored reminder');
                    }
                    // Remove reminder after sending
                    await removeReminder(reminder.id);
                }, timeLeft);

                activeReminders.push(reminder);
                log.debug({ userId: reminder.userId, minutesLeft: Math.round(timeLeft / 1000 / 60) }, 'Restored reminder');
            }
        }

        // Save only active reminders back to file (mutex-protected)
        await reminderMutex.runExclusive(async () => {
            await writeJsonAtomic(REMINDERS_FILE, activeReminders);
        });

        log.info({ count: activeReminders.length }, 'Restored active reminders');
    } catch (error) {
        log.error({ err: error }, 'Error initializing reminders');
    }
}
