/**
 * Input validation and sanitization utilities
 * Validates external data and command inputs
 */

import { botLogger as log } from './logger.js';

/**
 * Sanitize a string by removing potentially dangerous content
 * @param {string} input - Input string
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized string
 */
export function sanitizeString(input, options = {}) {
    const {
        maxLength = 2000,
        allowNewlines = true,
        allowMarkdown = true,
        stripHtml = true
    } = options;

    if (input == null) return '';
    if (typeof input !== 'string') input = String(input);

    let result = input;

    // Strip HTML tags if requested
    if (stripHtml) {
        result = result.replace(/<[^>]*>/g, '');
    }

    // Remove null bytes and other control characters (except newlines/tabs if allowed)
    if (allowNewlines) {
        result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    } else {
        result = result.replace(/[\x00-\x1F\x7F]/g, ' ');
    }

    // Remove zero-width characters (potential spoofing)
    result = result.replace(/[\u200B-\u200D\uFEFF\u2060\u180E]/g, '');

    // Strip markdown if not allowed
    if (!allowMarkdown) {
        result = result.replace(/[*_`~|\\]/g, '');
    }

    // Normalize excessive whitespace
    result = result.replace(/[ \t]{3,}/g, '  ');
    if (allowNewlines) {
        result = result.replace(/\n{4,}/g, '\n\n\n');
    }

    // Truncate to max length
    if (result.length > maxLength) {
        result = result.substring(0, maxLength);
    }

    return result.trim();
}

/**
 * Validate and sanitize a Discord user ID
 * @param {string} userId - User ID to validate
 * @returns {string|null} Valid user ID or null
 */
export function validateUserId(userId) {
    if (!userId) return null;
    const id = String(userId).trim();
    // Discord snowflake IDs are 17-19 digit numbers
    if (/^\d{17,19}$/.test(id)) {
        return id;
    }
    return null;
}

/**
 * Validate and sanitize a Discord channel ID
 * @param {string} channelId - Channel ID to validate
 * @returns {string|null} Valid channel ID or null
 */
export function validateChannelId(channelId) {
    return validateUserId(channelId); // Same format as user IDs
}

/**
 * Validate and sanitize a URL
 * @param {string} url - URL to validate
 * @param {Object} options - Validation options
 * @returns {string|null} Valid URL or null
 */
export function validateUrl(url, options = {}) {
    const {
        allowedProtocols = ['http:', 'https:'],
        allowedHosts = null, // null = allow all
        maxLength = 2048
    } = options;

    if (!url || typeof url !== 'string') return null;
    if (url.length > maxLength) return null;

    try {
        const parsed = new URL(url.trim());

        // Check protocol
        if (!allowedProtocols.includes(parsed.protocol)) {
            return null;
        }

        // Check host whitelist if provided
        if (allowedHosts && !allowedHosts.includes(parsed.hostname)) {
            return null;
        }

        // Prevent localhost/internal IPs in production
        const hostname = parsed.hostname.toLowerCase();
        const blockedPatterns = [
            /^localhost$/i,
            /^127\./,
            /^10\./,
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
            /^192\.168\./,
            /^0\.0\.0\.0$/,
            /^::1$/,
            /^fc00:/i,
            /^fe80:/i
        ];

        for (const pattern of blockedPatterns) {
            if (pattern.test(hostname)) {
                return null;
            }
        }

        return parsed.href;
    } catch {
        return null;
    }
}

/**
 * Validate a GitHub repository URL
 * @param {string} url - Repository URL
 * @returns {{ valid: boolean, owner?: string, repo?: string, url?: string }}
 */
export function validateGitHubRepo(url) {
    if (!url) return { valid: false };

    const validUrl = validateUrl(url, { allowedHosts: ['github.com', 'www.github.com'] });
    if (!validUrl) return { valid: false };

    const match = validUrl.match(/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/);
    if (!match) return { valid: false };

    return {
        valid: true,
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
        url: validUrl
    };
}

/**
 * Validate reminder text
 * @param {string} text - Reminder text
 * @returns {{ valid: boolean, sanitized?: string, error?: string }}
 */
export function validateReminderText(text) {
    if (!text || typeof text !== 'string') {
        return { valid: false, error: 'Reminder text is required' };
    }

    const sanitized = sanitizeString(text, {
        maxLength: 500,
        allowNewlines: false,
        allowMarkdown: true
    });

    if (sanitized.length < 1) {
        return { valid: false, error: 'Reminder text cannot be empty' };
    }

    if (sanitized.length > 500) {
        return { valid: false, error: 'Reminder text cannot exceed 500 characters' };
    }

    return { valid: true, sanitized };
}

/**
 * Validate time amount for reminders
 * @param {number} amount - Time amount
 * @param {string} unit - Time unit (minutes, hours, days, weeks)
 * @returns {{ valid: boolean, ms?: number, error?: string }}
 */
export function validateTimeAmount(amount, unit) {
    const limits = {
        minutes: { max: 1440, multiplier: 60 * 1000 },
        hours: { max: 168, multiplier: 60 * 60 * 1000 },
        days: { max: 365, multiplier: 24 * 60 * 60 * 1000 },
        weeks: { max: 52, multiplier: 7 * 24 * 60 * 60 * 1000 }
    };

    if (!Number.isInteger(amount) || amount < 1) {
        return { valid: false, error: 'Time amount must be a positive integer' };
    }

    const unitConfig = limits[unit];
    if (!unitConfig) {
        return { valid: false, error: 'Invalid time unit' };
    }

    if (amount > unitConfig.max) {
        return { valid: false, error: `Cannot set reminder for more than ${unitConfig.max} ${unit}` };
    }

    return { valid: true, ms: amount * unitConfig.multiplier };
}

/**
 * Validate JSON data against expected structure
 * @param {any} data - Data to validate
 * @param {Object} schema - Simple schema definition
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateStructure(data, schema) {
    const errors = [];

    function validate(value, schemaNode, path = '') {
        if (schemaNode.type === 'object') {
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                errors.push(`${path || 'root'}: expected object`);
                return;
            }
            if (schemaNode.properties) {
                for (const [key, propSchema] of Object.entries(schemaNode.properties)) {
                    const propPath = path ? `${path}.${key}` : key;
                    if (propSchema.required && !(key in value)) {
                        errors.push(`${propPath}: required property missing`);
                    } else if (key in value) {
                        validate(value[key], propSchema, propPath);
                    }
                }
            }
        } else if (schemaNode.type === 'array') {
            if (!Array.isArray(value)) {
                errors.push(`${path || 'root'}: expected array`);
                return;
            }
            if (schemaNode.items) {
                value.forEach((item, index) => {
                    validate(item, schemaNode.items, `${path}[${index}]`);
                });
            }
        } else if (schemaNode.type === 'string') {
            if (typeof value !== 'string') {
                errors.push(`${path || 'root'}: expected string`);
            }
        } else if (schemaNode.type === 'number') {
            if (typeof value !== 'number' || isNaN(value)) {
                errors.push(`${path || 'root'}: expected number`);
            }
        } else if (schemaNode.type === 'boolean') {
            if (typeof value !== 'boolean') {
                errors.push(`${path || 'root'}: expected boolean`);
            }
        }
    }

    validate(data, schema);
    return { valid: errors.length === 0, errors };
}

/**
 * Log and handle validation failures
 * @param {string} context - Context description
 * @param {Object} validation - Validation result
 * @returns {boolean} Whether validation passed
 */
export function logValidationResult(context, validation) {
    if (!validation.valid) {
        log.warn({ context, errors: validation.errors || validation.error }, 'Validation failed');
    }
    return validation.valid;
}
