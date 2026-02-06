/**
 * Environment variable validation utility
 * Validates required environment variables on startup and exits with clear errors if missing
 */

import { createRedactedConsole } from './redact.js';

const safeConsole = createRedactedConsole();

const REQUIRED_ENV_VARS = {
    TOKEN: {
        description: 'Discord bot token',
        validate: (value) => {
            if (!value || value.trim() === '') return 'is missing or empty';
            if (value.length < 50) return 'appears invalid (too short)';
            return null;
        }
    },
    CLIENT_ID: {
        description: 'Discord application client ID',
        validate: (value) => {
            if (!value || value.trim() === '') return 'is missing or empty';
            if (!/^\d{17,19}$/.test(value)) return 'must be 17-19 digits (Discord snowflake)';
            return null;
        }
    },
    GUILD_ID: {
        description: 'Discord guild/server ID',
        validate: (value) => {
            if (!value || value.trim() === '') return 'is missing or empty';
            if (!/^\d{17,19}$/.test(value)) return 'must be 17-19 digits (Discord snowflake)';
            return null;
        }
    }
};

const OPTIONAL_ENV_VARS = {
    REDDIT_CHANNEL_ID: {
        description: 'Channel ID for Reddit feed posts',
        default: null,
        validate: (value) => {
            if (value && !/^\d{17,19}$/.test(value)) return 'must be 17-19 digits if provided';
            return null;
        }
    },
    UPDATE_CHANNEL_ID: {
        description: 'Channel ID for update notifications',
        default: null,
        validate: (value) => {
            if (value && !/^\d{17,19}$/.test(value)) return 'must be 17-19 digits if provided';
            return null;
        }
    },
    LOG_LEVEL: {
        description: 'Logging level (debug, info, warn, error)',
        default: 'info',
        validate: (value) => {
            const validLevels = ['debug', 'info', 'warn', 'error', 'fatal'];
            if (value && !validLevels.includes(value.toLowerCase())) {
                return `must be one of: ${validLevels.join(', ')}`;
            }
            return null;
        }
    },
    NODE_ENV: {
        description: 'Node environment (development, production)',
        default: 'development',
        validate: () => null
    }
};

/**
 * Validates all environment variables and returns a validated config object.
 * Exits process with code 1 if any required variables are missing or invalid.
 * @returns {Object} Validated configuration object
 */
export function validateEnv() {
    const errors = [];
    const warnings = [];
    const config = {};

    // Validate required variables
    for (const [key, meta] of Object.entries(REQUIRED_ENV_VARS)) {
        const value = process.env[key];
        const error = meta.validate(value);

        if (error) {
            errors.push(`${key} ${error} (${meta.description})`);
        } else {
            config[key] = value;
        }
    }

    // Process optional variables
    for (const [key, meta] of Object.entries(OPTIONAL_ENV_VARS)) {
        const value = process.env[key];

        if (!value || value.trim() === '' || value === 'YOUR_CHANNEL_ID') {
            config[key] = meta.default;
            if (meta.default === null) {
                warnings.push(`${key} not set - ${meta.description} will be disabled`);
            }
        } else {
            const error = meta.validate(value);
            if (error) {
                warnings.push(`${key} ${error}, using default`);
                config[key] = meta.default;
            } else {
                config[key] = value;
            }
        }
    }

    // Log warnings for optional variables (using redacted console to prevent secret leaks)
    if (warnings.length > 0) {
        safeConsole.warn('\n⚠️  Environment Warnings:');
        warnings.forEach(warning => safeConsole.warn(`   - ${warning}`));
        safeConsole.warn('');
    }

    // Exit if required variables are missing/invalid
    if (errors.length > 0) {
        safeConsole.error('\n❌ Environment Validation Failed:\n');
        errors.forEach(error => safeConsole.error(`   ❌ ${error}`));
        safeConsole.error('\n   Bot cannot start. Please check your .env file.\n');
        process.exit(1);
    }

    return config;
}

export { REQUIRED_ENV_VARS, OPTIONAL_ENV_VARS };
