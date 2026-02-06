/**
 * Safe Discord embed construction utilities
 * Handles truncation and validation to stay within Discord's limits
 *
 * Discord Embed Limits:
 * - Title: 256 characters
 * - Description: 4096 characters
 * - Fields: 25 maximum
 * - Field name: 256 characters
 * - Field value: 1024 characters
 * - Footer text: 2048 characters
 * - Author name: 256 characters
 * - Total embed: 6000 characters
 */

import { EmbedBuilder } from 'discord.js';

// Discord embed limits
export const EMBED_LIMITS = {
    TITLE: 256,
    DESCRIPTION: 4096,
    FIELDS: 25,
    FIELD_NAME: 256,
    FIELD_VALUE: 1024,
    FOOTER_TEXT: 2048,
    AUTHOR_NAME: 256,
    TOTAL: 6000
};

/**
 * Safely truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add when truncated (default: '...')
 * @returns {string} Truncated text
 */
export function truncate(text, maxLength, suffix = '...') {
    if (!text) return '';
    if (typeof text !== 'string') text = String(text);
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Sanitize text for Discord embeds (remove potential XSS/injection)
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
export function sanitize(text) {
    if (!text) return '';
    if (typeof text !== 'string') text = String(text);

    // Remove zero-width characters that can be used for spoofing
    text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');

    // Remove excessive newlines (more than 2 consecutive)
    text = text.replace(/\n{3,}/g, '\n\n');

    // Limit consecutive spaces
    text = text.replace(/ {3,}/g, '  ');

    return text.trim();
}

/**
 * Validate and sanitize a URL
 * @param {string} url - URL to validate
 * @returns {string|null} Valid URL or null
 */
export function sanitizeUrl(url) {
    if (!url) return null;
    if (typeof url !== 'string') return null;

    try {
        const parsed = new URL(url);
        // Only allow http and https protocols
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return null;
        }
        return parsed.href;
    } catch {
        return null;
    }
}

/**
 * Create a safe embed field
 * @param {string} name - Field name
 * @param {string} value - Field value
 * @param {boolean} inline - Whether field is inline
 * @returns {Object|null} Safe field object or null if invalid
 */
export function safeField(name, value, inline = false) {
    const safeName = truncate(sanitize(name), EMBED_LIMITS.FIELD_NAME);
    const safeValue = truncate(sanitize(value), EMBED_LIMITS.FIELD_VALUE);

    // Discord requires non-empty name and value
    if (!safeName || !safeValue) return null;

    return { name: safeName, value: safeValue, inline };
}

/**
 * Safe embed builder wrapper
 */
export class SafeEmbedBuilder {
    constructor() {
        this.embed = new EmbedBuilder();
        this.totalLength = 0;
        this.fieldCount = 0;
    }

    /**
     * Set embed color
     * @param {number|string} color - Color value
     * @returns {SafeEmbedBuilder}
     */
    setColor(color) {
        this.embed.setColor(color);
        return this;
    }

    /**
     * Set embed title safely
     * @param {string} title - Title text
     * @returns {SafeEmbedBuilder}
     */
    setTitle(title) {
        const safeTitle = truncate(sanitize(title), EMBED_LIMITS.TITLE);
        if (safeTitle) {
            this.embed.setTitle(safeTitle);
            this.totalLength += safeTitle.length;
        }
        return this;
    }

    /**
     * Set embed URL safely
     * @param {string} url - URL string
     * @returns {SafeEmbedBuilder}
     */
    setURL(url) {
        const safeUrl = sanitizeUrl(url);
        if (safeUrl) {
            this.embed.setURL(safeUrl);
        }
        return this;
    }

    /**
     * Set embed description safely
     * @param {string} description - Description text
     * @returns {SafeEmbedBuilder}
     */
    setDescription(description) {
        const remaining = EMBED_LIMITS.TOTAL - this.totalLength - 500; // Reserve space for other fields
        const maxLength = Math.min(EMBED_LIMITS.DESCRIPTION, remaining);
        const safeDesc = truncate(sanitize(description), maxLength);
        if (safeDesc) {
            this.embed.setDescription(safeDesc);
            this.totalLength += safeDesc.length;
        }
        return this;
    }

    /**
     * Set embed author safely
     * @param {Object} author - Author object { name, iconURL?, url? }
     * @returns {SafeEmbedBuilder}
     */
    setAuthor(author) {
        if (!author || !author.name) return this;

        const safeAuthor = {
            name: truncate(sanitize(author.name), EMBED_LIMITS.AUTHOR_NAME)
        };

        if (author.iconURL) {
            const safeIconUrl = sanitizeUrl(author.iconURL);
            if (safeIconUrl) safeAuthor.iconURL = safeIconUrl;
        }

        if (author.url) {
            const safeUrl = sanitizeUrl(author.url);
            if (safeUrl) safeAuthor.url = safeUrl;
        }

        if (safeAuthor.name) {
            this.embed.setAuthor(safeAuthor);
            this.totalLength += safeAuthor.name.length;
        }
        return this;
    }

    /**
     * Set embed footer safely
     * @param {Object} footer - Footer object { text, iconURL? }
     * @returns {SafeEmbedBuilder}
     */
    setFooter(footer) {
        if (!footer || !footer.text) return this;

        const safeFooter = {
            text: truncate(sanitize(footer.text), EMBED_LIMITS.FOOTER_TEXT)
        };

        if (footer.iconURL) {
            const safeIconUrl = sanitizeUrl(footer.iconURL);
            if (safeIconUrl) safeFooter.iconURL = safeIconUrl;
        }

        if (safeFooter.text) {
            this.embed.setFooter(safeFooter);
            this.totalLength += safeFooter.text.length;
        }
        return this;
    }

    /**
     * Set embed thumbnail safely
     * @param {string} url - Thumbnail URL
     * @returns {SafeEmbedBuilder}
     */
    setThumbnail(url) {
        const safeUrl = sanitizeUrl(url);
        if (safeUrl) {
            this.embed.setThumbnail(safeUrl);
        }
        return this;
    }

    /**
     * Set embed image safely
     * @param {string} url - Image URL
     * @returns {SafeEmbedBuilder}
     */
    setImage(url) {
        const safeUrl = sanitizeUrl(url);
        if (safeUrl) {
            this.embed.setImage(safeUrl);
        }
        return this;
    }

    /**
     * Set embed timestamp
     * @param {Date|number|string} timestamp - Timestamp
     * @returns {SafeEmbedBuilder}
     */
    setTimestamp(timestamp) {
        try {
            const date = timestamp ? new Date(timestamp) : new Date();
            if (!isNaN(date.getTime())) {
                this.embed.setTimestamp(date);
            }
        } catch {
            // Invalid timestamp, skip
        }
        return this;
    }

    /**
     * Add a field safely
     * @param {string} name - Field name
     * @param {string} value - Field value
     * @param {boolean} inline - Whether field is inline
     * @returns {SafeEmbedBuilder}
     */
    addField(name, value, inline = false) {
        if (this.fieldCount >= EMBED_LIMITS.FIELDS) return this;

        const field = safeField(name, value, inline);
        if (field && this.totalLength + field.name.length + field.value.length < EMBED_LIMITS.TOTAL) {
            this.embed.addFields(field);
            this.totalLength += field.name.length + field.value.length;
            this.fieldCount++;
        }
        return this;
    }

    /**
     * Add multiple fields safely
     * @param {Array} fields - Array of field objects
     * @returns {SafeEmbedBuilder}
     */
    addFields(fields) {
        if (!Array.isArray(fields)) return this;
        for (const field of fields) {
            this.addField(field.name, field.value, field.inline);
        }
        return this;
    }

    /**
     * Build and return the embed
     * @returns {EmbedBuilder}
     */
    build() {
        return this.embed;
    }

    /**
     * Get current total length
     * @returns {number}
     */
    getLength() {
        return this.totalLength;
    }
}

/**
 * Create a new safe embed builder
 * @returns {SafeEmbedBuilder}
 */
export function createSafeEmbed() {
    return new SafeEmbedBuilder();
}
