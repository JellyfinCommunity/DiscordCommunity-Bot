/**
 * Global error handling utilities
 * Prevents unhandled errors from crashing the bot
 */

import { createModuleLogger } from './logger.js';
import { isShuttingDown } from './shutdown.js';

const log = createModuleLogger('error-handler');

/**
 * Initialize global error handlers.
 * Must be called early in the startup process, before any async operations.
 */
export function initGlobalErrorHandlers() {
    // Handle unhandled promise rejections (prevents crash)
    process.on('unhandledRejection', (reason, promise) => {
        log.error({ err: reason, promise }, 'Unhandled Promise Rejection');
        // Don't exit - log and continue running
    });

    // Handle uncaught exceptions (must exit - state may be corrupted)
    process.on('uncaughtException', (error) => {
        log.fatal({ err: error }, 'Uncaught Exception - Bot will restart');
        // Skip force-exit if already shutting down gracefully
        if (isShuttingDown) {
            log.info('Already shutting down - skipping force exit');
            return;
        }
        // Give time to log, then exit for process manager to restart
        setTimeout(() => process.exit(1), 1000);
    });

    // Handle Node.js warnings (memory, deprecation, etc.)
    process.on('warning', (warning) => {
        log.warn({ name: warning.name, message: warning.message }, 'Node.js Warning');
    });

    log.info('Global error handlers initialized');
}

/**
 * Wraps an async event handler to catch and log errors.
 * Prevents bot from crashing if an event handler throws.
 *
 * @param {Function} handler - Async event handler function
 * @param {string} eventName - Name of event for logging context
 * @returns {Function} Wrapped handler that catches errors
 */
export function wrapEventHandler(handler, eventName) {
    return async (...args) => {
        try {
            await handler(...args);
        } catch (error) {
            log.error({ err: error, event: eventName }, `Error in event handler [${eventName}]`);
            // Bot keeps running - only this event handler failed
        }
    };
}

