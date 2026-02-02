import fs from 'fs/promises';
import path from 'path';
import { timerManager } from './utils/timerManager.js';
import { reminderLogger as log } from './utils/logger.js';
import { validateReminders } from './utils/schemas.js';
import { sanitizeString } from './utils/inputValidator.js';

const REMINDERS_FILE = path.join(process.cwd(), 'reminders.json');

// Load and restore reminders on bot startup
export async function initializeReminders(client) {
    try {
        const data = await fs.readFile(REMINDERS_FILE, 'utf8');
        const parsedReminders = JSON.parse(data);

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
        
        // Save only active reminders back to file
        await fs.writeFile(REMINDERS_FILE, JSON.stringify(activeReminders, null, 2));

        log.info({ count: activeReminders.length }, 'Restored active reminders');
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, create empty file
            await fs.writeFile(REMINDERS_FILE, JSON.stringify([], null, 2));
            log.info('Created new reminders file');
        } else {
            log.error({ err: error }, 'Error initializing reminders');
        }
    }
}

// Helper function to remove reminder
async function removeReminder(reminderId) {
    try {
        const data = await fs.readFile(REMINDERS_FILE, 'utf8');
        const reminders = JSON.parse(data);
        const filtered = reminders.filter(r => r.id !== reminderId);
        await fs.writeFile(REMINDERS_FILE, JSON.stringify(filtered, null, 2));
    } catch (error) {
        log.error({ err: error, reminderId }, 'Error removing reminder');
    }
}