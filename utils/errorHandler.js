/**
 * Global error handling utilities
 * Prevents unhandled errors from crashing the bot
 */

import { createModuleLogger } from './logger.js';

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

/**
 * Wraps a command's execute function with error handling.
 * Catches errors and sends user-friendly error responses.
 *
 * @param {Object} command - Command object with execute method
 * @returns {Object} Command with wrapped execute
 */
export function wrapCommand(command) {
    const originalExecute = command.execute;

    command.execute = async (interaction) => {
        try {
            await originalExecute(interaction);
        } catch (error) {
            log.error({ err: error, command: command.data.name }, `Command error [${command.data.name}]`);

            // Send user-friendly error message
            const errorMessage = {
                content: '❌ An error occurred while executing this command. Please try again later.',
                ephemeral: true
            };

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            } catch (replyError) {
                log.error({ err: replyError }, 'Failed to send error response');
            }
        }
    };

    return command;
}

/**
 * Safe execution wrapper for any async function.
 * Catches errors and logs them with context.
 *
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context description for error messages
 * @returns {Function} Wrapped function that catches errors
 */
export function safeAsync(fn, context = 'Unknown') {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            log.error({ err: error, context }, `Error in ${context}`);
            // Re-throw after logging so caller can handle if needed
            throw error;
        }
    };
}
