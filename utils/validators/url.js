/**
 * URL validation utilities
 * Single Responsibility: Validate and sanitize URLs
 */

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
 * Simple URL sanitization for embed URLs
 * @param {string} url - URL to sanitize
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
