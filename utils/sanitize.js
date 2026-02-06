/**
 * String sanitization utilities
 * Single Responsibility: Remove potentially dangerous content from text
 */

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
