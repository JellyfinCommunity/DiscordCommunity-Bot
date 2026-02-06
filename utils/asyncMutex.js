/**
 * Simple async mutex for coordinating concurrent operations
 * Prevents race conditions when multiple async operations need exclusive access
 */

import { createModuleLogger } from './logger.js';

const log = createModuleLogger('mutex');

class Mutex {
    constructor(name = 'unnamed') {
        this.name = name;
        this.queue = [];
        this.locked = false;
    }

    /**
     * Run a function with exclusive access.
     * @param {Function} fn - Async function to run exclusively
     * @returns {Promise<*>} Result of the function
     */
    async runExclusive(fn) {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }

    /**
     * Acquire the mutex lock.
     * @returns {Promise<void>}
     */
    acquire() {
        return new Promise(resolve => {
            if (this.locked) {
                this.queue.push(resolve);
                log.debug({ mutex: this.name, queueLength: this.queue.length }, 'Queued for mutex');
            } else {
                this.locked = true;
                resolve();
            }
        });
    }

    /**
     * Release the mutex lock.
     */
    release() {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            next();
        } else {
            this.locked = false;
        }
    }

    /**
     * Check if the mutex is currently locked.
     * @returns {boolean}
     */
    isLocked() {
        return this.locked;
    }

    /**
     * Get the current queue length.
     * @returns {number}
     */
    getQueueLength() {
        return this.queue.length;
    }
}

// Pre-configured mutex instances for common use cases
export const reminderMutex = new Mutex('reminders');
export const stateMutex = new Mutex('state');

// Export class for custom instances
export { Mutex };
