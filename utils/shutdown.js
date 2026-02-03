/**
 * Graceful shutdown handler
 * Properly cleans up timers and Discord connection on process termination
 */

import { timerManager } from './timerManager.js';
import { createModuleLogger } from './logger.js';

const log = createModuleLogger('shutdown');

const SHUTDOWN_TIMEOUT_MS = 30000;

let client = null;
let isShuttingDown = false;

/**
 * Initialize graceful shutdown handlers.
 * @param {Client} discordClient - Discord.js client instance
 */
export function initGracefulShutdown(discordClient) {
    client = discordClient;

    // Handle SIGTERM (Docker, Kubernetes, systemd)
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));

    // Handle SIGINT (Ctrl+C in terminal)
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    log.info('Graceful shutdown handlers initialized');
}

/**
 * Perform graceful shutdown.
 * @param {string} signal - Signal that triggered shutdown
 */
async function handleShutdown(signal) {
    if (isShuttingDown) {
        log.warn('Shutdown already in progress');
        return;
    }

    isShuttingDown = true;
    log.info({ signal }, 'Starting graceful shutdown');

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Shutdown timeout')), SHUTDOWN_TIMEOUT_MS);
    });

    const shutdownPromise = (async () => {
        // Clear all timers first
        timerManager.clearAll();

        // Destroy Discord client connection
        if (client) {
            log.info('Disconnecting from Discord');
            client.destroy();
            log.info('Discord client disconnected');
        }

        log.info('Graceful shutdown complete');
    })();

    try {
        await Promise.race([shutdownPromise, timeoutPromise]);
        process.exit(0);
    } catch (error) {
        log.error({ err: error }, 'Shutdown timeout - forcing exit');
        process.exit(1);
    }
}

export { handleShutdown, isShuttingDown };
