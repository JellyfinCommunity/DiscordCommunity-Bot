/**
 * Discord ID validation utilities
 * Single Responsibility: Validate Discord snowflake IDs
 */

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
 * Validate and sanitize a Discord guild ID
 * @param {string} guildId - Guild ID to validate
 * @returns {string|null} Valid guild ID or null
 */
export function validateGuildId(guildId) {
    return validateUserId(guildId); // Same format as user IDs
}
