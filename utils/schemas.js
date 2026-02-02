/**
 * Strict schemas for configuration, environment, and persisted state
 * Provides validation and type safety for data structures
 */

import { validateStructure, validateUrl, validateUserId } from './inputValidator.js';
import { botLogger as log } from './logger.js';

/**
 * Schema for reminder objects
 */
export const reminderSchema = {
    type: 'object',
    properties: {
        id: { type: 'string', required: true },
        text: { type: 'string', required: true },
        userId: { type: 'string', required: true },
        reminderTime: { type: 'number', required: true },
        channelId: { type: 'string', required: true },
        guildId: { type: 'string', required: true }
    }
};

/**
 * Schema for reminders file
 */
export const remindersFileSchema = {
    type: 'array',
    items: reminderSchema
};

/**
 * Schema for developer objects
 */
export const developerSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', required: true },
        link: { type: 'string' },
        discord_username: { type: 'string' },
        discord_channel: { type: 'string' }
    }
};

/**
 * Schema for project items (clients, plugins, services)
 */
export const projectSchema = {
    type: 'object',
    properties: {
        id: { type: 'string', required: true },
        name: { type: 'string', required: true },
        description: { type: 'string' },
        repo: { type: 'string' },
        logo: { type: 'string' },
        statusUrl: { type: 'string' },
        developers: { type: 'array', items: developerSchema },
        lastRelease: {
            type: 'object',
            properties: {
                tag: { type: 'string' },
                url: { type: 'string' },
                published_at: { type: 'string' }
            }
        },
        lastChecked: { type: 'string' }
    }
};

/**
 * Schema for data.json
 */
export const dataFileSchema = {
    type: 'object',
    properties: {
        third_party_clients: { type: 'array', items: projectSchema },
        plugins: { type: 'array', items: projectSchema },
        services: { type: 'array', items: projectSchema }
    }
};

/**
 * Schema for postedItems.json
 */
export const postedItemsSchema = {
    type: 'object',
    properties: {
        redditPosts: { type: 'array', items: { type: 'string' } },
        updatePosts: { type: 'array', items: { type: 'string' } }
    }
};

/**
 * Validate a reminder object
 * @param {Object} reminder - Reminder to validate
 * @returns {{ valid: boolean, errors: string[], sanitized?: Object }}
 */
export function validateReminder(reminder) {
    const result = validateStructure(reminder, reminderSchema);

    if (!result.valid) {
        return result;
    }

    // Additional semantic validation
    const errors = [];

    if (!validateUserId(reminder.userId)) {
        errors.push('Invalid userId format');
    }

    if (!validateUserId(reminder.channelId)) {
        errors.push('Invalid channelId format');
    }

    if (!validateUserId(reminder.guildId)) {
        errors.push('Invalid guildId format');
    }

    if (typeof reminder.reminderTime !== 'number' || reminder.reminderTime < 0) {
        errors.push('Invalid reminderTime');
    }

    if (!reminder.text || reminder.text.trim().length === 0) {
        errors.push('Empty reminder text');
    }

    return {
        valid: errors.length === 0,
        errors: [...result.errors, ...errors],
        sanitized: errors.length === 0 ? {
            id: String(reminder.id),
            text: String(reminder.text).substring(0, 500),
            userId: reminder.userId,
            reminderTime: reminder.reminderTime,
            channelId: reminder.channelId,
            guildId: reminder.guildId
        } : undefined
    };
}

/**
 * Validate reminders array
 * @param {Array} reminders - Array of reminders
 * @returns {{ valid: boolean, errors: string[], validReminders: Array }}
 */
export function validateReminders(reminders) {
    if (!Array.isArray(reminders)) {
        return { valid: false, errors: ['Expected array of reminders'], validReminders: [] };
    }

    const errors = [];
    const validReminders = [];

    reminders.forEach((reminder, index) => {
        const result = validateReminder(reminder);
        if (result.valid) {
            validReminders.push(result.sanitized);
        } else {
            errors.push(`Reminder[${index}]: ${result.errors.join(', ')}`);
        }
    });

    return {
        valid: errors.length === 0,
        errors,
        validReminders
    };
}

/**
 * Validate a project item
 * @param {Object} project - Project to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProject(project) {
    const result = validateStructure(project, projectSchema);

    if (!result.valid) {
        return result;
    }

    const errors = [];

    // Validate URLs if present
    if (project.repo && !validateUrl(project.repo)) {
        errors.push('Invalid repo URL');
    }

    if (project.logo && !validateUrl(project.logo)) {
        errors.push('Invalid logo URL');
    }

    if (project.statusUrl && !validateUrl(project.statusUrl)) {
        errors.push('Invalid status URL');
    }

    return {
        valid: errors.length === 0,
        errors: [...result.errors, ...errors]
    };
}

/**
 * Validate data.json content
 * @param {Object} data - Data file content
 * @returns {{ valid: boolean, errors: string[], stats: Object }}
 */
export function validateDataFile(data) {
    const result = validateStructure(data, dataFileSchema);
    const errors = [...result.errors];
    const stats = { clients: 0, plugins: 0, services: 0, invalid: 0 };

    // Validate each category
    const categories = ['third_party_clients', 'plugins', 'services'];
    const statKeys = ['clients', 'plugins', 'services'];

    categories.forEach((category, index) => {
        const items = data[category];
        if (Array.isArray(items)) {
            items.forEach((item, itemIndex) => {
                const itemResult = validateProject(item);
                if (itemResult.valid) {
                    stats[statKeys[index]]++;
                } else {
                    stats.invalid++;
                    errors.push(`${category}[${itemIndex}] (${item.name || 'unknown'}): ${itemResult.errors.join(', ')}`);
                }
            });
        }
    });

    return {
        valid: errors.length === 0,
        errors,
        stats
    };
}

/**
 * Validate posted items file
 * @param {Object} data - Posted items data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePostedItems(data) {
    const result = validateStructure(data, postedItemsSchema);

    if (!result.valid) {
        return result;
    }

    // Ensure arrays exist with valid content
    const errors = [];

    if (data.redditPosts && !Array.isArray(data.redditPosts)) {
        errors.push('redditPosts must be an array');
    }

    if (data.updatePosts && !Array.isArray(data.updatePosts)) {
        errors.push('updatePosts must be an array');
    }

    return {
        valid: errors.length === 0,
        errors: [...result.errors, ...errors]
    };
}

/**
 * Safe JSON parse with schema validation
 * @param {string} jsonString - JSON string to parse
 * @param {Object} schema - Schema to validate against
 * @param {any} defaultValue - Default value if parsing fails
 * @returns {{ data: any, valid: boolean, errors: string[] }}
 */
export function safeJsonParse(jsonString, schema, defaultValue = null) {
    try {
        const data = JSON.parse(jsonString);
        const validation = validateStructure(data, schema);

        if (!validation.valid) {
            log.warn({ errors: validation.errors }, 'JSON schema validation failed');
            return { data: defaultValue, valid: false, errors: validation.errors };
        }

        return { data, valid: true, errors: [] };
    } catch (error) {
        log.error({ err: error }, 'JSON parse failed');
        return { data: defaultValue, valid: false, errors: [error.message] };
    }
}
