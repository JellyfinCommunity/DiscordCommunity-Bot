/**
 * Secret redaction utilities
 * Prevents sensitive data from appearing in logs or error messages
 */

// Patterns that look like secrets (Discord tokens, GitHub tokens, etc.)
const SECRET_PATTERNS = [
    // Discord bot token pattern (3 base64-encoded parts separated by dots)
    /[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}/g,
    // GitHub personal access token
    /ghp_[A-Za-z0-9]{36}/g,
    // GitHub OAuth token
    /gho_[A-Za-z0-9]{36}/g,
    // GitHub fine-grained PAT
    /github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}/g,
    // Generic API key pattern (long alphanumeric strings)
    /(?:api[_-]?key|apikey|secret|token|password|auth)[=:]["']?([A-Za-z0-9_-]{20,})["']?/gi,
];

// Known secret environment variable names
const SECRET_ENV_VARS = [
    'TOKEN',
    'DISCORD_TOKEN',
    'BOT_TOKEN',
    'GITHUB_TOKEN',
    'API_KEY',
    'SECRET',
    'PASSWORD'
];

/**
 * Redact a single secret value, showing only the last 4 characters.
 * @param {string} secret - Secret value to redact
 * @returns {string} Redacted value like "****abcd"
 */
export function redactValue(secret) {
    if (!secret || typeof secret !== 'string' || secret.length < 4) {
        return '****';
    }
    return `****${secret.slice(-4)}`;
}

/**
 * Redact secrets from a string.
 * Replaces known secret patterns and environment variable values.
 * @param {string} text - Text to redact
 * @returns {string} Redacted text
 */
export function redact(text) {
    if (typeof text !== 'string') {
        return text;
    }

    let result = text;

    // Redact known environment variable values
    for (const envVar of SECRET_ENV_VARS) {
        const value = process.env[envVar];
        if (value && value.length > 8) {
            // Escape special regex characters in the value
            const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            result = result.replace(new RegExp(escaped, 'g'), '[REDACTED]');
        }
    }

    // Redact patterns that look like secrets
    for (const pattern of SECRET_PATTERNS) {
        result = result.replace(pattern, '[REDACTED]');
    }

    return result;
}

/**
 * Redact an Error object's message and stack trace.
 * Returns a new error-like object without modifying the original.
 * @param {Error} error - Error to redact
 * @returns {Object} Object with redacted name, message, and stack
 */
export function redactError(error) {
    if (!(error instanceof Error)) {
        return error;
    }

    return {
        name: error.name,
        message: redact(error.message),
        stack: redact(error.stack),
        code: error.code,
        // Preserve other enumerable properties
        ...Object.fromEntries(
            Object.entries(error)
                .filter(([key]) => !['name', 'message', 'stack'].includes(key))
                .map(([key, value]) => [key, typeof value === 'string' ? redact(value) : value])
        )
    };
}

/**
 * Recursively redact sensitive keys in an object.
 * Creates a new object without modifying the original.
 * @param {Object} obj - Object to redact
 * @param {number} depth - Current recursion depth (internal)
 * @returns {Object} Redacted object
 */
export function redactObject(obj, depth = 0) {
    // Prevent infinite recursion
    if (depth > 10 || obj == null || typeof obj !== 'object') {
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => redactObject(item, depth + 1));
    }

    // Handle Error objects
    if (obj instanceof Error) {
        return redactError(obj);
    }

    const SENSITIVE_KEYS = ['token', 'apikey', 'password', 'secret', 'key', 'auth', 'credential'];

    const redacted = {};
    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = SENSITIVE_KEYS.some(s => lowerKey.includes(s));

        if (isSensitive && typeof value === 'string') {
            redacted[key] = redactValue(value);
        } else if (typeof value === 'object' && value !== null) {
            redacted[key] = redactObject(value, depth + 1);
        } else if (typeof value === 'string') {
            redacted[key] = redact(value);
        } else {
            redacted[key] = value;
        }
    }

    return redacted;
}

/**
 * Create a safe console wrapper that automatically redacts secrets.
 * @returns {Object} Console-like object with redacting methods
 */
export function createRedactedConsole() {
    const methods = ['log', 'error', 'warn', 'info', 'debug'];
    const proxied = {};

    for (const method of methods) {
        proxied[method] = (...args) => {
            const redactedArgs = args.map(arg => {
                if (typeof arg === 'string') {
                    return redact(arg);
                }
                if (arg instanceof Error) {
                    return redactError(arg);
                }
                if (typeof arg === 'object' && arg !== null) {
                    try {
                        return redactObject(arg);
                    } catch {
                        return arg;
                    }
                }
                return arg;
            });
            console[method](...redactedArgs);
        };
    }

    return proxied;
}
