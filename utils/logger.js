/**
 * Structured logging with Pino
 * Provides consistent, production-ready logging with automatic secret redaction
 */

import pino from 'pino';
import { redact } from './redact.js';

// Determine log level from environment
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Custom serializer for error objects
 * Redacts sensitive data from error messages and stacks
 */
function errorSerializer(err) {
    if (!err) return err;

    return {
        type: err.constructor?.name || 'Error',
        message: redact(err.message || ''),
        stack: redact(err.stack || ''),
        code: err.code,
        // Include any additional properties
        ...(err.statusCode && { statusCode: err.statusCode }),
        ...(err.errno && { errno: err.errno }),
    };
}

/**
 * Create the base Pino logger instance
 */
const logger = pino({
    level: LOG_LEVEL,

    // Custom serializers for safe logging
    serializers: {
        err: errorSerializer,
        error: errorSerializer,
    },

    // Timestamp format
    timestamp: pino.stdTimeFunctions.isoTime,

    // Pretty print in development, JSON in production
    transport: IS_PRODUCTION
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:HH:MM:ss',
                ignore: 'pid,hostname',
            },
        },

    // Base context for all logs
    base: {
        app: 'jellyfin-community-bot',
    },
});

/**
 * Create a child logger with module context.
 * @param {string} module - Module name for context
 * @returns {pino.Logger} Child logger with module context
 */
export function createModuleLogger(module) {
    return logger.child({ module });
}

// Pre-configured loggers for common modules
export const botLogger = createModuleLogger('bot');
export const commandLogger = createModuleLogger('commands');
export const redditLogger = createModuleLogger('reddit-feed');
export const updateLogger = createModuleLogger('update-monitor');
export const reminderLogger = createModuleLogger('reminders');

export default logger;

/**
 * Usage examples:
 *
 * // Import the default logger
 * import logger from './utils/logger.js';
 * logger.info('Bot starting');
 * logger.error({ err: error }, 'Failed to connect');
 *
 * // Or use a pre-configured module logger
 * import { botLogger as log } from './utils/logger.js';
 * log.info({ userId: '123' }, 'User connected');
 *
 * // Or create a custom module logger
 * import { createModuleLogger } from './utils/logger.js';
 * const log = createModuleLogger('my-module');
 * log.debug({ data }, 'Processing data');
 *
 * // Log levels: trace, debug, info, warn, error, fatal
 */
